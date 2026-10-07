/**
 * gemini-analyze.ts — Gemini 3-Tier Fallback Module
 *
 * Shared module for auto-analyze.ts and auto-plan.ts.
 * Attempts Gemini analysis with progressive fallback:
 *   Tier 1: gemini CLI (30s timeout)
 *   Tier 2: @google/generative-ai SDK
 *   Tier 3: Returns manual prompt for Claude agent
 *
 * Usage (as module):
 *   import { analyzeWithGemini } from './gemini-analyze';
 *   const result = await analyzeWithGemini('image.jpg', 'Analyze this image...', { maxTier: 2 });
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface GeminiResult {
  success: boolean;
  tierUsed: number;
  data: any;
  error?: string;
  manualPrompt?: string;
}

interface GeminiOptions {
  maxTier?: 1 | 2 | 3;
  timeout?: number;   // Tier 1 timeout in seconds (default: 30)
  model?: string;     // Gemini model for Tier 2 (default: gemini-2.5-flash)
}

function log(msg: string): void {
  process.stderr.write(`[gemini-analyze] ${msg}\n`);
}

/**
 * Extract JSON from a string that may contain markdown code blocks or extra text
 */
function extractJSON(raw: string): any {
  // Try direct parse first
  try {
    return JSON.parse(raw.trim());
  } catch {}

  // Try extracting from markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  // Try finding any JSON object
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  return null;
}

/**
 * Tier 1: gemini CLI with timeout
 */
function tryTier1(imagePath: string, prompt: string, timeout: number): GeminiResult {
  log(`Tier 1: Trying gemini CLI (${timeout}s timeout)...`);

  try {
    // Check if gemini CLI exists
    try {
      execSync('which gemini', { stdio: 'pipe' });
    } catch {
      return { success: false, tierUsed: 1, data: null, error: 'gemini CLI not found' };
    }

    const absImagePath = path.resolve(imagePath);
    const escapedPrompt = prompt.replace(/'/g, "'\\''");

    const output = execSync(
      `gemini -p '${escapedPrompt}' < "${absImagePath}"`,
      {
        encoding: 'utf-8',
        timeout: (timeout + 5) * 1000,
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    const data = extractJSON(output);
    if (data) {
      log('Tier 1: Success');
      return { success: true, tierUsed: 1, data };
    }

    return { success: false, tierUsed: 1, data: null, error: 'Failed to parse JSON from CLI output' };
  } catch (err: any) {
    const msg = err.message || String(err);
    if (msg.includes('ETIMEDOUT') || msg.includes('timeout') || msg.includes('SIGTERM')) {
      return { success: false, tierUsed: 1, data: null, error: `CLI timeout after ${timeout}s` };
    }
    return { success: false, tierUsed: 1, data: null, error: `CLI error: ${msg.slice(0, 200)}` };
  }
}

/**
 * Tier 2: @google/generative-ai SDK
 */
async function tryTier2(imagePath: string, prompt: string, model: string): Promise<GeminiResult> {
  log('Tier 2: Trying Gemini REST API (SDK)...');

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return { success: false, tierUsed: 2, data: null, error: 'GEMINI_API_KEY / GOOGLE_AI_API_KEY not set' };
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });

    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' :
                     ext === '.webp' ? 'image/webp' : 'image/jpeg';

    const result = await genModel.generateContent([
      { inlineData: { mimeType, data: base64 } },
      { text: prompt },
    ]);

    const text = result.response.text();
    const data = extractJSON(text);

    if (data) {
      log('Tier 2: Success');
      return { success: true, tierUsed: 2, data };
    }

    return { success: false, tierUsed: 2, data: null, error: 'Failed to parse JSON from SDK response' };
  } catch (err: any) {
    return { success: false, tierUsed: 2, data: null, error: `SDK error: ${(err.message || String(err)).slice(0, 200)}` };
  }
}

/**
 * Tier 3: Return manual prompt for Claude agent to handle
 */
function tier3Fallback(imagePath: string, prompt: string): GeminiResult {
  log('Tier 3: Returning manual prompt (Claude agent will handle)');

  return {
    success: false,
    tierUsed: 3,
    data: null,
    manualPrompt: `[MANUAL ANALYSIS REQUIRED]\nImage: ${path.resolve(imagePath)}\n\nPlease analyze this image with the following prompt:\n\n${prompt}`,
    error: 'All automated tiers failed — manual analysis required',
  };
}

/**
 * Main entry: Analyze image with Gemini using 3-Tier Fallback
 */
export async function analyzeWithGemini(
  imagePath: string,
  prompt: string,
  options: GeminiOptions = {}
): Promise<GeminiResult> {
  const { maxTier = 3, timeout = 30, model = 'gemini-2.5-flash' } = options;

  // Validate image exists
  if (!fs.existsSync(imagePath)) {
    return { success: false, tierUsed: 0, data: null, error: `Image not found: ${imagePath}` };
  }

  // Tier 1: CLI
  const tier1 = tryTier1(imagePath, prompt, timeout);
  if (tier1.success) return tier1;
  log(`Tier 1 failed: ${tier1.error}`);

  if (maxTier < 2) return tier1;

  // Tier 2: SDK
  const tier2 = await tryTier2(imagePath, prompt, model);
  if (tier2.success) return tier2;
  log(`Tier 2 failed: ${tier2.error}`);

  if (maxTier < 3) return tier2;

  // Tier 3: Manual
  return tier3Fallback(imagePath, prompt);
}

/**
 * CLI entry point for standalone testing
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: npx tsx gemini-analyze.ts <image-path> <prompt-or-file> [--max-tier=3] [--timeout=30]');
    process.exit(1);
  }

  const imagePath = args[0];
  let prompt = args[1];
  let maxTier: 1 | 2 | 3 = 3;
  let timeout = 30;

  for (const arg of args.slice(2)) {
    if (arg.startsWith('--max-tier=')) maxTier = parseInt(arg.split('=')[1]) as 1 | 2 | 3;
    if (arg.startsWith('--timeout=')) timeout = parseInt(arg.split('=')[1]);
  }

  // If prompt looks like a file path, read it
  if (fs.existsSync(prompt) && prompt.endsWith('.txt')) {
    prompt = fs.readFileSync(prompt, 'utf-8');
  }

  const result = await analyzeWithGemini(imagePath, prompt, { maxTier, timeout });
  console.log(JSON.stringify(result, null, 2));
}

// Run if executed directly
const isMain = process.argv[1] && (
  process.argv[1].endsWith('gemini-analyze.ts') ||
  process.argv[1].includes('gemini-analyze')
);
if (isMain) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
