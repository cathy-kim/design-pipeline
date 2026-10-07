#!/usr/bin/env -S npx tsx
/**
 * generate-image.ts — 이 플러그인의 유일한 Gemini 이미지 생성 구현 (CONTRACT §1-3).
 *
 * 프롬프트는 `.design/brand_config.json` 의 artStyle · tokens.colors · brand.mood ·
 * assets.imagePromptConfiguration 으로 조립한다. 캔버스 크기는 assets.canvasSizes 에서 읽는다.
 * API 키는 process.env.GEMINI_API_KEY 에서만 읽는다.
 *
 * 3-Tier fallback
 *   Tier 1  imagePromptConfiguration.model        (기본 gemini-3-pro-image-preview)
 *   Tier 2  imagePromptConfiguration.fallbackModel (기본 gemini-3.1-flash-image-preview)
 *   Tier 3  브랜드 neutral 색 SVG placeholder (manifest 에 tier:3 으로 남는다. --strict 면 실패)
 *
 * Usage
 *   npx tsx generate-image.ts --mode hero --name hero-main --subject "..." --canvas web-hero
 *   npx tsx generate-image.ts --mode card --name cover-bg --subject "..." --canvas instagram-feed --seed 42
 *   npx tsx generate-image.ts --mode logo --name logo-a --prompt-file .design/assets/logo-prompt/prompts.json --canvas logo-square
 *   npx tsx generate-image.ts --mode ad --name ad-bg --subject "..." --canvas ad-square --ref ./product.png
 *   --dry-run   프롬프트만 파일로 쓰고 API 를 부르지 않는다
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type AssetMode, type BrandConfig, type Canvas,
  assertMode, brandName, canvas, designDir, fail, loadBrand, modeDir, nearestAspect,
  imagePixels, palette, parseArgs, promptConfig, recordManifest, rel, sha256, str,
} from './lib.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3-pro-image-preview';
const DEFAULT_FALLBACK = 'gemini-3.1-flash-image-preview';

const PURPOSE: Record<AssetMode, string> = {
  card: 'an Instagram card-news background',
  ad: 'a paid social ad creative background',
  'detail-page': 'a product detail page section visual',
  hero: 'a website hero visual',
  moodboard: 'a brand mood board tile',
  logo: 'a logo',
  'logo-prompt': 'a logo',
  motion: 'a motion graphic keyframe',
};

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPrompt(cfg: BrandConfig, mode: AssetMode, subject: string, aspect: string): { prompt: string; negative: string } {
  const pc = promptConfig(cfg);
  const pal = palette(cfg);
  const art = cfg.artStyle?.artStyleName ?? 'clean, editorial';
  const mood = (cfg.brand?.mood ?? []).join(', ');
  const negSpace = pc.negativeSpace ?? (mode === 'card' || mode === 'ad' ? 40 : 20);
  const negative = [...new Set([
    ...(mode === 'logo' ? [] : ['text', 'numbers', 'logos', 'watermarks']),
    'neon glow', 'glassmorphism', 'gradient borders', 'busy patterns', 'generic stock photo look',
    ...(cfg.artStyle?.negative ?? []),
    ...(pc.negative ?? []),
  ].map((n) => n.toLowerCase().trim()))];
  const lines = [
    pc.prefix ?? '',
    `Generate a ${art} image for ${PURPOSE[mode]} for the brand "${brandName(cfg)}".`,
    mode === 'logo' ? '' : 'The image must contain absolutely no text, letters, captions, or typography of any kind; type is added later in HTML.',
    '',
    `SUBJECT: ${subject}`,
    '',
    'COMPOSITION:',
    `- ${pc.composition ?? 'single clear focal point, generous margins'}`,
    `- ${negSpace}% negative space reserved for typography overlay`,
    `- Aspect ratio ${aspect}`,
    '',
    'STYLE:',
    `- Colors: primary ${pal.primary}, accent ${pal.accent}, neutrals ${pal.bg} and ${pal.fg}. No other dominant hues.`,
    mood ? `- Mood: ${mood}` : '',
    pc.styleKeywords?.length ? `- Keywords: ${pc.styleKeywords.join(', ')}` : '',
    `- Lighting: ${pc.lighting ?? 'soft, diffused'}`,
    '- Quality: professional, high resolution',
    '',
    'FORBIDDEN:',
    ...negative.map((n) => `- NO ${n}`),
    pc.suffix ?? '',
  ];
  return { prompt: lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim(), negative: negative.join(', ') };
}

/** logo-prompt-builder 의 prompts.json(배열) 또는 일반 텍스트 파일. */
function readPromptFile(file: string, platform: string): { prompt: string; negative: string | null } {
  const raw = fs.readFileSync(file, 'utf-8');
  if (file.endsWith('.json')) {
    const arr = JSON.parse(raw) as Array<{ platform: string; prompt: string; negativePrompt?: string }>;
    const hit = arr.find((p) => p.platform === platform) ?? arr[0];
    if (!hit) throw new Error(`${file} 에 프롬프트가 없습니다`);
    return { prompt: hit.prompt, negative: hit.negativePrompt ?? null };
  }
  return { prompt: raw.trim(), negative: null };
}

// ---------------------------------------------------------------------------
// Gemini REST (SDK 없이 fetch — 의존성 0)
// ---------------------------------------------------------------------------

interface GenResult { data: Buffer; mimeType: string }

async function callGemini(model: string, prompt: string, aspect: string, seed: number, ref?: string): Promise<GenResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const parts: unknown[] = [];
  if (ref) {
    const ext = path.extname(ref).toLowerCase();
    const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
    parts.push({ inlineData: { mimeType, data: fs.readFileSync(ref).toString('base64') } });
  }
  parts.push({ text: prompt });
  const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], seed, imageConfig: { aspectRatio: aspect } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`HTTP ${res.status} from ${model}: ${body}`);
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data: string; mimeType?: string }; text?: string }> }; finishReason?: string }>;
  };
  const cand = json.candidates?.[0];
  const img = cand?.content?.parts?.find((p) => p.inlineData?.data);
  if (!img?.inlineData) throw new Error(`no image in response from ${model} (finishReason=${cand?.finishReason ?? 'n/a'})`);
  return { data: Buffer.from(img.inlineData.data, 'base64'), mimeType: img.inlineData.mimeType ?? 'image/png' };
}

function placeholderSvg(cfg: BrandConfig, c: Canvas, label: string): string {
  const pal = palette(cfg);
  const w = c.width;
  const h = c.height ?? c.width;
  const esc = label.replace(/[<>&"]/g, (ch) => `&#${ch.charCodeAt(0)};`).slice(0, 80);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="100%" height="100%" fill="${pal.muted}"/>
<text x="50%" y="50%" fill="${pal.fg}" font-family="sans-serif" font-size="${Math.round(w / 30)}" text-anchor="middle">PLACEHOLDER: ${esc}</text>
</svg>\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const dir = designDir(args);
  const cfg = loadBrand(dir);
  const mode = assertMode(str(args, 'mode'));
  const name = str(args, 'name');
  if (!name) throw new Error('--name 이 필요합니다 (출력 파일 basename)');

  const canvasKey = str(args, 'canvas');
  let c: Canvas;
  if (canvasKey) c = canvas(cfg, canvasKey);
  else if (str(args, 'size')) {
    const [w, h] = str(args, 'size')!.split('x').map(Number);
    c = { key: 'custom', width: w, height: h };
  } else throw new Error('--canvas <assets.canvasSizes 키> 또는 --size WxH 가 필요합니다');
  const aspect = nearestAspect(c.width, c.height ?? c.width);

  let prompt: string;
  let negative: string | null;
  const promptFile = str(args, 'prompt-file');
  if (promptFile) ({ prompt, negative } = readPromptFile(promptFile, str(args, 'platform') ?? 'gemini'));
  else if (str(args, 'prompt')) ({ prompt, negative } = { prompt: str(args, 'prompt')!, negative: null });
  else {
    const subject = str(args, 'subject');
    if (!subject) throw new Error('--subject, --prompt, --prompt-file 중 하나가 필요합니다');
    ({ prompt, negative } = buildPrompt(cfg, mode, subject, aspect));
  }

  const seed = str(args, 'seed') !== undefined ? parseInt(str(args, 'seed')!, 10) : Math.floor(Math.random() * 2 ** 31);
  const ref = str(args, 'ref') ? path.resolve(str(args, 'ref')!) : undefined;
  if (ref && !fs.existsSync(ref)) throw new Error(`--ref 파일이 없습니다: ${ref}`);

  const out = modeDir(dir, mode);
  const promptsDir = path.join(out, 'prompts');
  fs.mkdirSync(promptsDir, { recursive: true });
  fs.writeFileSync(path.join(promptsDir, `${name}.txt`), prompt + '\n');

  if (args['dry-run']) {
    console.log(prompt);
    console.log(`\n[dry-run] seed=${seed} aspect=${aspect} canvas=${c.key} ${c.width}x${c.height ?? '-'}`);
    return;
  }

  const pc = promptConfig(cfg);
  const tiers: Array<{ tier: 1 | 2; model: string }> = [
    { tier: 1, model: str(args, 'model') ?? pc.model ?? DEFAULT_MODEL },
    { tier: 2, model: pc.fallbackModel ?? DEFAULT_FALLBACK },
  ];
  const errors: string[] = [];
  for (const t of tiers) {
    try {
      console.log(`Tier ${t.tier}: ${t.model} ...`);
      const r = await callGemini(t.model, prompt, aspect, seed, ref);
      const ext = r.mimeType.includes('jpeg') ? 'jpg' : r.mimeType.includes('webp') ? 'webp' : 'png';
      const file = path.join(out, `${name}.${ext}`);
      fs.writeFileSync(file, r.data);
      recordManifest(dir, cfg, {
        file: rel(dir, file), mode, kind: 'image', prompt, negativePrompt: negative, model: t.model, tier: t.tier,
        seed, size: { width: c.width, height: c.height ?? null }, pixels: imagePixels(file), aspectRatio: aspect,
        sources: ref ? [ref] : [], sha256: sha256(file),
      });
      console.log(`OK ${file}`);
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`tier${t.tier} ${t.model}: ${msg}`);
      console.warn(`WARN tier ${t.tier} failed: ${msg}`);
      if (msg.includes('GEMINI_API_KEY not set')) break;
    }
  }

  if (args.strict) throw new Error(`all Gemini tiers failed:\n${errors.join('\n')}`);
  const file = path.join(out, `${name}.placeholder.svg`);
  fs.writeFileSync(file, placeholderSvg(cfg, c, name));
  recordManifest(dir, cfg, {
    file: rel(dir, file), mode, kind: 'image', prompt, negativePrompt: negative, model: null, tier: 3,
    seed, size: { width: c.width, height: c.height ?? null }, aspectRatio: aspect, note: errors.join(' | '),
  });
  console.warn(`PLACEHOLDER ${file} — 최종 산출 전에 재생성하거나 사용자에게 보고하세요.`);
}

main().catch(fail);
