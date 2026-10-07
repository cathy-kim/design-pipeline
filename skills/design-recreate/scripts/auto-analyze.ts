/**
 * auto-analyze.ts — D1 Visual Analysis Full Automation
 *
 * Automates the entire D1 pipeline:
 *   Step 1: ImageMagick Metadata (D1.0)
 *   Step 2: Gemini Structure Analysis (D1.1~D1.3, 3-Tier Fallback)
 *   Step 3: Bounding Box Extraction (D1.3.1)
 *   Step 4: Region Crop + Color Analysis (D1.3.2 + D1.10)
 *   Step 5: PROCEDURAL Detection
 *   Step 6: Cross-Validation (D1.13)
 *
 * Usage:
 *   npx tsx auto-analyze.ts <reference-image> <output-dir> [options]
 *   npx tsx auto-analyze.ts captures/reference.jpg ./analysis
 *   npx tsx auto-analyze.ts ref.png analysis/ --skip-advanced --no-crop
 *
 * Options:
 *   --skip-advanced    Skip D1.14-D1.18 (auto-skipped if no PROCEDURAL)
 *   --no-crop          Skip D1.3.2 region crop
 *   --samples=N        Background sampling points (default: 5)
 *   --gemini-tier=N    Max Gemini fallback tier 1|2|3 (default: 3)
 *
 * Output (stdout): JSON summary of all analysis
 * Logs (stderr): Progress messages
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeWithGemini } from './gemini-analyze';

// --- Types ---

interface ImageMeta {
  width: number;
  height: number;
  colorspace: string;
  format: string;
}

interface ColorSample {
  coord: string;
  hex: string;
}

interface D1Metadata {
  image_meta: ImageMeta;
  dominant_colors: string[];
  background_samples: Record<string, string>;
  background_hex: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DesignElement {
  id: string;
  classification: 'TEMPLATE' | 'RAW_IMAGE' | 'PROCEDURAL' | 'COMPONENT' | 'TEXTURE' | 'TEXT';
  description: string;
  bounds: ElementBounds;
  bounds_normalized?: { x_min: number; y_min: number; x_max: number; y_max: number };
  text_content?: string;
  font_analysis?: {
    serif: boolean;
    weight: string;
    estimated_size: string;
    style?: string;
  };
  procedural_type?: string;
  // 3-Signal Depth Layer inputs (see references/three-signal-layers.md)
  semantic_role?: string;
  overlaps_above?: string[];
  font_size_px?: number;
  font_weight?: number;
  color_contrast?: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface GridSystem {
  type: string;
  columns: number[];
  rows: number[];
  gutter: number;
  margin: number;
}

interface LayerInfo {
  z: number;
  type: string;
  description: string;
}

interface D1Elements {
  grid: GridSystem;
  layers: LayerInfo[];
  elements: DesignElement[];
  procedural_detected: boolean;
  gemini_tier_used: number;
}

interface ElementColor {
  dominant: string;
  palette: string[];
  method: string;
}

interface D1Colors {
  background: { hex: string; method: string; samples: number };
  elements: Record<string, ElementColor>;
  global_palette: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface AnalysisResult {
  success: boolean;
  metadata: D1Metadata;
  elements: D1Elements;
  colors: D1Colors;
  gate1_passed: boolean;
  errors: string[];
}

// --- Config ---

interface Config {
  imagePath: string;
  outputDir: string;
  skipAdvanced: boolean;
  noCrop: boolean;
  samples: number;
  geminiTier: 1 | 2 | 3;
}

// --- Utilities ---

function log(msg: string): void {
  process.stderr.write(`[auto-analyze] ${msg}\n`);
}

function runMagick(args: string): string {
  try {
    return execSync(`magick ${args}`, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
  } catch (err: any) {
    log(`ImageMagick error: ${(err.message || '').slice(0, 200)}`);
    return '';
  }
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseHexColor(raw: string): string {
  const cleaned = raw.replace(/^#?/, '').replace(/[^0-9A-Fa-f]/g, '');
  if (cleaned.length >= 6) return `#${cleaned.substring(0, 6).toUpperCase()}`;
  if (cleaned.length >= 3) {
    const r = cleaned[0], g = cleaned[1], b = cleaned[2];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return '#000000';
}

// --- Step 1: ImageMagick Metadata (D1.0) ---

function step1_metadata(imagePath: string, sampleCount: number): D1Metadata {
  log('=== Step 1: ImageMagick Metadata (D1.0) ===');

  // Image metadata
  const identifyRaw = runMagick(`identify -format "W:%w H:%h CS:%[colorspace] F:%m" "${imagePath}"`);
  const wMatch = identifyRaw.match(/W:(\d+)/);
  const hMatch = identifyRaw.match(/H:(\d+)/);
  const csMatch = identifyRaw.match(/CS:(\S+)/);
  const fMatch = identifyRaw.match(/F:(\S+)/);

  const meta: ImageMeta = {
    width: wMatch ? parseInt(wMatch[1]) : 0,
    height: hMatch ? parseInt(hMatch[1]) : 0,
    colorspace: csMatch ? csMatch[1] : 'unknown',
    format: fMatch ? fMatch[1] : 'unknown',
  };

  log(`Image: ${meta.width}x${meta.height} ${meta.format} (${meta.colorspace})`);

  // Dominant colors (top 10)
  const histRaw = runMagick(
    `"${imagePath}" -colors 10 -define histogram:unique-colors=true -format "%c" histogram:info:`
  );
  const dominant_colors: string[] = [];
  const histLines = histRaw.split('\n').filter(l => l.trim());
  for (const line of histLines) {
    const hexMatch = line.match(/#([0-9A-Fa-f]{6})/);
    if (hexMatch) {
      dominant_colors.push(`#${hexMatch[1].toUpperCase()}`);
    }
  }
  log(`Dominant colors: ${dominant_colors.slice(0, 5).join(', ')}${dominant_colors.length > 5 ? '...' : ''}`);

  // Background sampling
  const w = meta.width;
  const h = meta.height;
  const samplePoints: [number, number][] = [];

  if (sampleCount >= 5) {
    // 5-point cross pattern
    samplePoints.push(
      [Math.round(w * 0.05), Math.round(h * 0.05)],
      [Math.round(w * 0.5), Math.round(h * 0.05)],
      [Math.round(w * 0.95), Math.round(h * 0.05)],
      [Math.round(w * 0.05), Math.round(h * 0.95)],
      [Math.round(w * 0.95), Math.round(h * 0.95)],
    );
  }
  // Add center and edge midpoints for more samples
  if (sampleCount >= 9) {
    samplePoints.push(
      [Math.round(w * 0.5), Math.round(h * 0.5)],
      [Math.round(w * 0.5), Math.round(h * 0.95)],
      [Math.round(w * 0.05), Math.round(h * 0.5)],
      [Math.round(w * 0.95), Math.round(h * 0.5)],
    );
  }

  const background_samples: Record<string, string> = {};
  for (const [x, y] of samplePoints) {
    const raw = runMagick(`"${imagePath}" -format "%[hex:p{${x},${y}}]" info:`);
    if (raw) {
      background_samples[`${x},${y}`] = parseHexColor(raw);
    }
  }

  // Determine consensus background color using area-averaged sampling
  const bgCenterRaw = runMagick(
    `"${imagePath}" -crop 10x10+${Math.round(w * 0.05)}+${Math.round(h * 0.05)} +repage -scale 1x1! -format "%[hex:p{0,0}]" info:`
  );
  const background_hex = bgCenterRaw ? parseHexColor(bgCenterRaw) : (dominant_colors[0] || '#FFFFFF');

  log(`Background: ${background_hex}`);

  // Confidence: check if background samples are consistent
  const sampleValues = Object.values(background_samples);
  const confidence = assessBackgroundConfidence(sampleValues);
  log(`Metadata confidence: ${confidence}`);

  return {
    image_meta: meta,
    dominant_colors,
    background_samples,
    background_hex,
    confidence,
  };
}

function assessBackgroundConfidence(samples: string[]): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (samples.length < 3) return 'LOW';
  // Calculate max hex diff between samples
  const hexToRgb = (hex: string) => {
    const c = hex.replace('#', '');
    return [parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16)];
  };
  let maxDiff = 0;
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const a = hexToRgb(samples[i]);
      const b = hexToRgb(samples[j]);
      const diff = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
      maxDiff = Math.max(maxDiff, diff);
    }
  }
  if (maxDiff < 5) return 'HIGH';
  if (maxDiff < 15) return 'MEDIUM';
  return 'LOW';
}

// --- Step 2: Gemini Structure Analysis (D1.1~D1.3) ---

async function step2_geminiAnalysis(
  imagePath: string,
  meta: ImageMeta,
  geminiTier: 1 | 2 | 3
): Promise<D1Elements> {
  log('=== Step 2: Gemini Structure Analysis (D1.1~D1.3) ===');

  const promptPath = path.resolve(__dirname, 'prompts/d1-analysis-prompt.txt');
  let prompt: string;

  if (fs.existsSync(promptPath)) {
    prompt = fs.readFileSync(promptPath, 'utf-8');
  } else {
    prompt = `Analyze this design image. Identify grid system, layers, and all visual elements.
Classify each element as TEMPLATE, RAW_IMAGE, PROCEDURAL, COMPONENT, TEXTURE, or TEXT.
For each element, provide bounding box coordinates (0-1000 normalized scale).
Return a JSON object with: grid, layers, elements arrays.`;
  }

  const result = await analyzeWithGemini(imagePath, prompt, { maxTier: geminiTier, timeout: 30 });

  if (result.success && result.data) {
    log(`Gemini analysis successful (Tier ${result.tierUsed})`);
    return processGeminiResult(result.data, meta, result.tierUsed);
  }

  // Fallback: return minimal structure
  log(`Gemini analysis failed: ${result.error}`);
  if (result.manualPrompt) {
    log('Manual analysis required — prompt saved to stderr');
    process.stderr.write(`\n${result.manualPrompt}\n\n`);
  }

  return {
    grid: { type: 'freeform', columns: [], rows: [], gutter: 0, margin: 0 },
    layers: [{ z: 0, type: 'background', description: 'Background layer (auto-detected)' }],
    elements: [],
    procedural_detected: false,
    gemini_tier_used: result.tierUsed,
  };
}

function processGeminiResult(data: any, meta: ImageMeta, tierUsed: number): D1Elements {
  const elements: DesignElement[] = [];

  // Process elements with bounding box conversion
  const rawElements = data.elements || [];
  for (const el of rawElements) {
    const bounds_normalized = el.bounds || el.bounding_box || {};
    const bounds = convertBounds(bounds_normalized, meta.width, meta.height);

    elements.push({
      id: el.id || `element-${elements.length}`,
      classification: normalizeClassification(el.classification || el.type || 'TEMPLATE'),
      description: el.description || '',
      bounds,
      bounds_normalized: {
        x_min: bounds_normalized.x_min || 0,
        y_min: bounds_normalized.y_min || 0,
        x_max: bounds_normalized.x_max || 1000,
        y_max: bounds_normalized.y_max || 1000,
      },
      text_content: el.text_content || el.text || undefined,
      font_analysis: el.font_analysis || undefined,
      procedural_type: el.procedural_type || undefined,
      semantic_role: el.semantic_role || el.semanticRole || undefined,
      overlaps_above: Array.isArray(el.overlaps_above) ? el.overlaps_above : undefined,
      font_size_px: typeof el.font_size_px === 'number' ? el.font_size_px : undefined,
      font_weight: typeof el.font_weight === 'number' ? el.font_weight : undefined,
      color_contrast: typeof el.color_contrast === 'number' ? el.color_contrast : undefined,
      confidence: 'MEDIUM',
    });
  }

  const procedural_detected = elements.some(e => e.classification === 'PROCEDURAL');

  return {
    grid: data.grid || { type: 'freeform', columns: [], rows: [], gutter: 0, margin: 0 },
    layers: data.layers || [{ z: 0, type: 'background', description: 'Background' }],
    elements,
    procedural_detected,
    gemini_tier_used: tierUsed,
  };
}

function convertBounds(normalized: any, imgWidth: number, imgHeight: number): ElementBounds {
  const xMin = (normalized.x_min || 0) / 1000;
  const yMin = (normalized.y_min || 0) / 1000;
  const xMax = (normalized.x_max || 1000) / 1000;
  const yMax = (normalized.y_max || 1000) / 1000;

  return {
    x: Math.round(xMin * imgWidth),
    y: Math.round(yMin * imgHeight),
    width: Math.round((xMax - xMin) * imgWidth),
    height: Math.round((yMax - yMin) * imgHeight),
  };
}

function normalizeClassification(raw: string): DesignElement['classification'] {
  const upper = raw.toUpperCase().replace(/[\s-]/g, '_');
  const validTypes: DesignElement['classification'][] = [
    'TEMPLATE', 'RAW_IMAGE', 'PROCEDURAL', 'COMPONENT', 'TEXTURE', 'TEXT'
  ];
  if (validTypes.includes(upper as any)) return upper as DesignElement['classification'];

  // Common aliases
  if (upper.includes('IMAGE') || upper.includes('PHOTO')) return 'RAW_IMAGE';
  if (upper.includes('TEXT') || upper.includes('TYPO') || upper.includes('HEADING')) return 'TEXT';
  if (upper.includes('LAYOUT') || upper.includes('STRUCTURE') || upper.includes('GRID')) return 'TEMPLATE';
  if (upper.includes('BADGE') || upper.includes('BUTTON') || upper.includes('ICON')) return 'COMPONENT';
  if (upper.includes('NOISE') || upper.includes('GRADIENT') || upper.includes('SHADOW')) return 'TEXTURE';
  if (upper.includes('HALFTONE') || upper.includes('STARBURST') || upper.includes('GLITCH') || upper.includes('PATTERN')) return 'PROCEDURAL';

  return 'TEMPLATE';
}

// --- Step 3 & 4: Region Crop + Color Analysis ---

function step4_colorAnalysis(
  imagePath: string,
  metadata: D1Metadata,
  elementsData: D1Elements,
  outputDir: string,
  noCrop: boolean
): D1Colors {
  log('=== Step 4: Region Crop + Color Analysis (D1.3.2 + D1.10) ===');

  const cropsDir = path.join(outputDir, 'crops');
  if (!noCrop) {
    ensureDir(cropsDir);
  }

  const elementColors: Record<string, ElementColor> = {};

  for (const element of elementsData.elements) {
    const { id, bounds } = element;

    // Skip elements with zero/invalid bounds
    if (bounds.width <= 0 || bounds.height <= 0) continue;

    // Ensure crop is within image bounds
    const w = Math.min(bounds.width, metadata.image_meta.width - bounds.x);
    const h = Math.min(bounds.height, metadata.image_meta.height - bounds.y);
    if (w <= 0 || h <= 0) continue;

    // Crop the element region
    if (!noCrop) {
      const cropPath = path.join(cropsDir, `${id}.jpg`);
      runMagick(`"${imagePath}" -crop ${w}x${h}+${bounds.x}+${bounds.y} +repage "${cropPath}"`);
    }

    // Area-averaged color sampling (center of element)
    const cx = bounds.x + Math.round(w / 2);
    const cy = bounds.y + Math.round(h / 2);
    const sampleSize = Math.min(10, Math.round(Math.min(w, h) / 4));

    let dominantHex = '#000000';
    if (sampleSize >= 2) {
      const raw = runMagick(
        `"${imagePath}" -crop ${sampleSize}x${sampleSize}+${cx - Math.round(sampleSize / 2)}+${cy - Math.round(sampleSize / 2)} +repage -scale 1x1! -format "%[hex:p{0,0}]" info:`
      );
      if (raw) dominantHex = parseHexColor(raw);
    }

    // Get palette (top 3 colors from element region)
    const palette: string[] = [];
    const histRaw = runMagick(
      `"${imagePath}" -crop ${w}x${h}+${bounds.x}+${bounds.y} +repage -colors 3 -define histogram:unique-colors=true -format "%c" histogram:info:`
    );
    for (const line of histRaw.split('\n')) {
      const hexMatch = line.match(/#([0-9A-Fa-f]{6})/);
      if (hexMatch) palette.push(`#${hexMatch[1].toUpperCase()}`);
    }

    elementColors[id] = {
      dominant: dominantHex,
      palette: palette.length > 0 ? palette : [dominantHex],
      method: 'area_averaged',
    };

    log(`  ${id}: ${dominantHex} (${element.classification})`);
  }

  // Build global palette from dominant + element colors
  const allColors = new Set<string>(metadata.dominant_colors);
  for (const ec of Object.values(elementColors)) {
    allColors.add(ec.dominant);
    for (const c of ec.palette) allColors.add(c);
  }

  return {
    background: {
      hex: metadata.background_hex,
      method: 'pixel_sampling',
      samples: Object.keys(metadata.background_samples).length,
    },
    elements: elementColors,
    global_palette: Array.from(allColors).slice(0, 20),
    confidence: Object.keys(elementColors).length > 0 ? 'HIGH' : 'LOW',
  };
}

// --- Step 6: Cross-Validation ---

function step6_crossValidation(
  metadata: D1Metadata,
  elementsData: D1Elements,
  colors: D1Colors
): void {
  log('=== Step 6: Cross-Validation (D1.13) ===');

  let issues = 0;

  // Check background color consistency
  const bgSamples = Object.values(metadata.background_samples);
  if (bgSamples.length >= 3) {
    const unique = new Set(bgSamples);
    if (unique.size > 3) {
      log('  WARNING: Background is not uniform (gradient or pattern?)');
      metadata.confidence = 'MEDIUM';
      issues++;
    }
  }

  // Check element bounds don't exceed image
  for (const el of elementsData.elements) {
    const b = el.bounds;
    if (b.x + b.width > metadata.image_meta.width * 1.05 ||
        b.y + b.height > metadata.image_meta.height * 1.05) {
      log(`  WARNING: Element ${el.id} bounds exceed image dimensions`);
      el.confidence = 'LOW';
      issues++;
    }
  }

  // Check text elements have text_content
  for (const el of elementsData.elements) {
    if (el.classification === 'TEXT' && !el.text_content) {
      log(`  WARNING: TEXT element ${el.id} missing text_content`);
      el.confidence = 'MEDIUM';
    }
  }

  log(`  Cross-validation complete: ${issues} issue(s) found`);
}

// --- GATE-1 Check ---

function checkGate1(outputDir: string): boolean {
  const files = [
    path.join(outputDir, 'd1-metadata.json'),
    path.join(outputDir, 'd1-elements.json'),
    path.join(outputDir, 'd1-colors.json'),
  ];

  const exists = files.filter(f => fs.existsSync(f)).length;
  const cropsDir = path.join(outputDir, 'crops');
  const hasCrops = fs.existsSync(cropsDir) &&
    fs.readdirSync(cropsDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png')).length > 0;

  return exists >= 3;
}

// --- Argument Parsing ---

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const positional: string[] = [];
  let skipAdvanced = false;
  let noCrop = false;
  let samples = 5;
  let geminiTier: 1 | 2 | 3 = 3;

  for (const arg of args) {
    if (arg === '--skip-advanced') skipAdvanced = true;
    else if (arg === '--no-crop') noCrop = true;
    else if (arg.startsWith('--samples=')) samples = parseInt(arg.split('=')[1]) || 5;
    else if (arg.startsWith('--gemini-tier=')) geminiTier = (parseInt(arg.split('=')[1]) || 3) as 1 | 2 | 3;
    else if (!arg.startsWith('--')) positional.push(arg);
  }

  if (positional.length < 2) {
    console.error('Usage: npx tsx auto-analyze.ts <reference-image> <output-dir> [options]');
    console.error('Options:');
    console.error('  --skip-advanced    Skip D1.14-D1.18 advanced analysis');
    console.error('  --no-crop          Skip element region cropping');
    console.error('  --samples=N        Background sampling points (default: 5)');
    console.error('  --gemini-tier=N    Max Gemini fallback tier 1|2|3 (default: 3)');
    process.exit(1);
  }

  return {
    imagePath: path.resolve(positional[0]),
    outputDir: path.resolve(positional[1]),
    skipAdvanced,
    noCrop,
    samples,
    geminiTier,
  };
}

// --- Main ---

async function main(): Promise<void> {
  const config = parseArgs();

  if (!fs.existsSync(config.imagePath)) {
    log(`ERROR: Image not found: ${config.imagePath}`);
    process.exit(1);
  }

  ensureDir(config.outputDir);

  log('=========================================');
  log('  D1 Auto-Analyze Pipeline');
  log('=========================================');
  log(`Image:     ${config.imagePath}`);
  log(`Output:    ${config.outputDir}`);
  log(`Samples:   ${config.samples}`);
  log(`Gemini:    Tier 1-${config.geminiTier}`);
  log(`Crop:      ${config.noCrop ? 'disabled' : 'enabled'}`);
  log('=========================================');

  const errors: string[] = [];

  // Step 1: ImageMagick Metadata
  const metadata = step1_metadata(config.imagePath, config.samples);
  fs.writeFileSync(
    path.join(config.outputDir, 'd1-metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  log(`Saved: d1-metadata.json`);

  // Step 2: Gemini Structure Analysis
  const elementsData = await step2_geminiAnalysis(
    config.imagePath,
    metadata.image_meta,
    config.geminiTier
  );

  if (elementsData.elements.length === 0) {
    errors.push('No elements detected by Gemini — manual analysis may be needed');
    log('WARNING: No elements detected');
  }

  // Step 5: PROCEDURAL Detection
  if (elementsData.procedural_detected) {
    log('PROCEDURAL elements detected!');
    if (config.skipAdvanced) {
      log('  (Skipped D1.14-D1.18 per --skip-advanced flag)');
    } else {
      log('  D1.14-D1.18 advanced analysis flagged (run separately if needed)');
    }
  }

  fs.writeFileSync(
    path.join(config.outputDir, 'd1-elements.json'),
    JSON.stringify(elementsData, null, 2)
  );
  log(`Saved: d1-elements.json (${elementsData.elements.length} elements)`);

  // Step 4: Color Analysis
  const colors = step4_colorAnalysis(
    config.imagePath,
    metadata,
    elementsData,
    config.outputDir,
    config.noCrop
  );
  fs.writeFileSync(
    path.join(config.outputDir, 'd1-colors.json'),
    JSON.stringify(colors, null, 2)
  );
  log(`Saved: d1-colors.json`);

  // Step 6: Cross-Validation
  step6_crossValidation(metadata, elementsData, colors);

  // Re-save after cross-validation updates confidence
  fs.writeFileSync(
    path.join(config.outputDir, 'd1-metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  fs.writeFileSync(
    path.join(config.outputDir, 'd1-elements.json'),
    JSON.stringify(elementsData, null, 2)
  );

  // GATE-1 Check
  const gate1 = checkGate1(config.outputDir);
  log('');
  log('=========================================');
  log(`  GATE-1: ${gate1 ? 'PASSED' : 'FAILED'}`);
  log(`  Elements: ${elementsData.elements.length}`);
  log(`  PROCEDURAL: ${elementsData.procedural_detected ? 'Yes' : 'No'}`);
  log(`  Gemini Tier: ${elementsData.gemini_tier_used}`);
  log(`  Errors: ${errors.length}`);
  log('=========================================');

  // Output summary to stdout
  const result: AnalysisResult = {
    success: gate1,
    metadata,
    elements: elementsData,
    colors,
    gate1_passed: gate1,
    errors,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  log(`Fatal error: ${err.message || err}`);
  console.log(JSON.stringify({
    success: false,
    error: String(err.message || err),
    gate1_passed: false,
  }));
  process.exit(1);
});
