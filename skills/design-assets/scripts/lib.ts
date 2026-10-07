/**
 * design-assets 공용 헬퍼 — brand_config 로딩, 색·폰트·radius·캔버스 해석, manifest 기록.
 * 브랜드 값은 전부 `.design/brand_config.json` 에서 읽는다. 이 파일에 브랜드 값을 쓰지 않는다.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export type Args = Record<string, string | boolean>;

/** `--key value`, `--key=value`, `--flag` 를 모두 받는다. */
export function parseArgs(argv = process.argv.slice(2)): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

export function str(args: Args, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

export class RouteBackError extends Error {}

export function fail(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`ERROR: ${msg}`);
  process.exit(err instanceof RouteBackError ? 2 : 1);
}

// ---------------------------------------------------------------------------
// brand_config
// ---------------------------------------------------------------------------

export interface BrandConfig {
  brand?: { id?: string; name?: string; nameKr?: string; description?: string; mood?: string[]; philosophy?: string; industry?: string };
  tokens?: {
    colors?: { primary?: unknown; accent?: unknown; neutral?: unknown; semantic?: unknown; roles?: Record<string, string> };
    typography?: { families?: Record<string, unknown> };
    radius?: { scale?: Record<string, number | string> };
    spacing?: { scale?: unknown };
  };
  artStyle?: { artStyleId?: string; artStyleName?: string; negative?: string[] };
  visualSystem?: { logoDirection?: string; iconStyle?: string; illustration?: string };
  motion?: { feel?: string; easingCurves?: Record<string, string>; durations?: Record<string, number | string> };
  assets?: {
    logo?: Record<string, string> | string;
    fonts?: Record<string, string | { file?: string; src?: string } | null>;
    canvasSizes?: Record<string, unknown>;
    imagePromptConfiguration?: ImagePromptConfiguration;
  };
  components?: Record<string, { radius?: string } & Record<string, unknown>>;
  brandKeywords?: string[];
  exceptions?: Array<{ rule: string; scope?: string; reason?: string; evidence?: string }>;
}

/** `assets.imagePromptConfiguration` 에서 이 스킬이 읽는 키. 모두 선택. */
export interface ImagePromptConfiguration {
  model?: string;            // Tier 1 모델
  fallbackModel?: string;    // Tier 2 모델
  styleKeywords?: string[];
  lighting?: string;
  composition?: string;
  negativeSpace?: number;    // % (card/ad 기본 40)
  negative?: string[];
  prefix?: string;
  suffix?: string;
  style?: string;            // brands/_template.json 별칭 → styleKeywords 앞에 붙는다
  avoid?: string[];          // brands/_template.json 별칭 → negative 에 합쳐진다
}

/** _template.json 별칭(style, avoid)을 정규 키로 합친다. */
export function promptConfig(cfg: BrandConfig): ImagePromptConfiguration {
  const pc = { ...(cfg.assets?.imagePromptConfiguration ?? {}) };
  if (pc.style) pc.styleKeywords = [pc.style, ...(pc.styleKeywords ?? [])];
  if (pc.avoid) pc.negative = [...(pc.negative ?? []), ...pc.avoid];
  return pc;
}

export function designDir(args: Args): string {
  return path.resolve(str(args, 'design-dir') ?? path.join(process.cwd(), '.design'));
}

export function loadBrand(dir: string): BrandConfig {
  const p = path.join(dir, 'brand_config.json');
  if (!fs.existsSync(p)) {
    throw new RouteBackError(
      `${p} 가 없습니다. design-tokens(참조 있음) 또는 design-brief(참조 없음)로 되돌아가 brand_config.json 을 먼저 만드세요.`,
    );
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as BrandConfig;
}

export function brandName(cfg: BrandConfig): string {
  return cfg.brand?.name ?? cfg.brand?.id ?? 'brand';
}

// ---------------------------------------------------------------------------
// 색
// ---------------------------------------------------------------------------

function resolveColor(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return resolveColor(v[0]);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['DEFAULT', 'base', 'value', 'main', '500', '600']) {
      if (o[k] !== undefined) return resolveColor(o[k]);
    }
    const first = Object.values(o)[0];
    return resolveColor(first);
  }
  return undefined;
}

function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return 0.5;
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface Palette {
  primary: string;
  accent: string;
  bg: string;    // neutral 가장 밝은 값
  fg: string;    // neutral 가장 어두운 값
  muted: string; // neutral 중간값
}

const isHex = (v: string | undefined): v is string => !!v && /^#[0-9a-f]{3,8}$/i.test(v);

/** "neutral.0" 같은 토큰 참조를 tokens.colors 안에서 푼다. */
function resolveRef(colors: Record<string, unknown>, ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  if (ref.startsWith('#')) return ref;
  let cur: unknown = colors;
  for (const k of ref.split('.')) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[k] : undefined;
  return resolveColor(cur);
}

/**
 * 3색(Primary + Accent + Neutral)만 꺼낸다. 다른 색은 템플릿에 넘기지 않는다.
 * neutral 은 tokens.colors.roles(background · text · textMuted)가 있으면 그것을 따르고,
 * 없으면 neutral 스케일의 hex 값을 명도로 정렬해 양끝과 중간값을 쓴다. rgb()/투명 값은 건너뛴다.
 */
export function palette(cfg: BrandConfig): Palette {
  const c = (cfg.tokens?.colors ?? {}) as NonNullable<NonNullable<BrandConfig['tokens']>['colors']>;
  const all = c as unknown as Record<string, unknown>;
  const primary = resolveColor(c.primary);
  if (!isHex(primary)) throw new RouteBackError('tokens.colors.primary(hex) 가 없습니다. brand_config 를 보완하세요.');
  const accentRaw = resolveColor(c.accent);
  const accent = isHex(accentRaw) ? accentRaw : primary;
  const neutralVals: string[] = [];
  if (c.neutral && typeof c.neutral === 'object') {
    for (const v of Object.values(c.neutral as Record<string, unknown>)) {
      const r = resolveColor(v);
      if (isHex(r)) neutralVals.push(r);
    }
  } else if (typeof c.neutral === 'string' && isHex(c.neutral)) {
    neutralVals.push(c.neutral);
  }
  if (neutralVals.length === 0) throw new RouteBackError('tokens.colors.neutral 스케일(hex)이 없습니다. brand_config 를 보완하세요.');
  const sorted = [...neutralVals].sort((a, b) => luminance(b) - luminance(a));
  const roles = c.roles ?? {};
  const role = (k: string) => {
    const v = resolveRef(all, roles[k]);
    return isHex(v) ? v : undefined;
  };
  return {
    primary,
    accent,
    bg: role('background') ?? sorted[0],
    fg: role('text') ?? sorted[sorted.length - 1],
    muted: role('textMuted') ?? sorted[Math.floor(sorted.length / 2)],
  };
}

// ---------------------------------------------------------------------------
// 폰트 · radius · 로고
// ---------------------------------------------------------------------------

function fontValue(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(String).join(', ');
  return undefined;
}

export function fonts(cfg: BrandConfig): { heading: string; body: string } {
  const f = cfg.tokens?.typography?.families ?? {};
  const first = fontValue(Object.values(f)[0]);
  const heading = fontValue(f.heading) ?? fontValue(f.display) ?? fontValue(f.sans) ?? first ?? 'sans-serif';
  const body = fontValue(f.body) ?? fontValue(f.sans) ?? first ?? 'sans-serif';
  return { heading, body };
}

/** 닫힌 radius 스케일에서만 고른다. 컴포넌트가 이름을 지정하면 그 이름, 아니면 fallback 이름 순서. */
/**
 * 닫힌 radius 스케일에서만 고른다. 컴포넌트가 이름을 지정하면 그 이름, 아니면 fallback 이름 순서,
 * 그래도 없으면 스케일의 가장 작은 양수 값. pill(full · 999 이상)은 쓰지 않는다(CONTRACT §1-6).
 * 단, brand_config.exceptions[] 에 rule "no-pill-button" + scope "components.<component>" 가 등록돼 있으면
 * 브랜드 값을 그대로 쓴다(design-qa 가 WAIVED 로 표기).
 */
/** 이 컴포넌트의 pill 을 승인한 exceptions[] 항목. 없으면 undefined. */
export function pillException(cfg: BrandConfig, component: string) {
  return (cfg.exceptions ?? []).find((e) => e.rule === 'no-pill-button' && (!e.scope || e.scope === `components.${component}`));
}

/** radius 가 실제로 pill 값이고 예외로 승인됐을 때 manifest 에 남길 waived 객체. */
export function pillWaiver(cfg: BrandConfig, component: string, value: number) {
  const e = pillException(cfg, component);
  return value >= 999 && e ? { rule: e.rule, scope: e.scope ?? `components.${component}`, reason: e.reason ?? '' } : null;
}

export function radius(cfg: BrandConfig, component: string, fallbacks: string[]): number {
  const scale = cfg.tokens?.radius?.scale ?? {};
  const num = (v: number | string) => (typeof v === 'number' ? v : parseFloat(v));
  const named = cfg.components?.[component]?.radius;
  for (const n of [named, ...fallbacks].filter(Boolean) as string[]) {
    const v = scale[n];
    if (v === undefined) continue;
    if (num(v) >= 999 && !pillException(cfg, component)) {
      console.warn(`WARN: components.${component}.radius="${n}" 은 pill 입니다. §1-6 에 따라 스케일의 다른 값을 씁니다.`);
      continue;
    }
    return num(v);
  }
  const positive = Object.values(scale).map(num).filter((v) => v > 0 && v < 999).sort((a, b) => a - b);
  return positive[0] ?? 0;
}

/**
 * brand_config 의 에셋 상대경로를 찾는다. 기준 디렉터리 순서:
 * .design/ → .design/brand-assets/ → $BRAND_ASSETS_DIR → ${CLAUDE_PLUGIN_ROOT}/brands/
 * (brands/<id>.json 의 경로는 brands/ 기준이다. 예: "acme/logo/icon.png")
 */
export function resolveAsset(dir: string, relPath: string | null | undefined): string | undefined {
  if (!relPath) return undefined;
  if (path.isAbsolute(relPath)) return fs.existsSync(relPath) ? relPath : undefined;
  const bases = [dir, path.join(dir, 'brand-assets'), process.env.BRAND_ASSETS_DIR,
    process.env.CLAUDE_PLUGIN_ROOT ? path.join(process.env.CLAUDE_PLUGIN_ROOT, 'brands') : undefined];
  for (const b of bases) {
    if (!b) continue;
    const abs = path.resolve(b, relPath);
    if (fs.existsSync(abs)) return abs;
  }
  return undefined;
}

/** 로고: wordmark → primary → default → symbol → 첫 문자열 값. 없거나 파일이 없으면 워드마크 텍스트로 대체된다. */
export function logoPath(cfg: BrandConfig, dir: string): string | undefined {
  const l = cfg.assets?.logo;
  if (typeof l === 'string') return resolveAsset(dir, l);
  if (!l) return undefined;
  const o = l as Record<string, string | null>;
  const candidates = [o.wordmark, o.primary, o.default, o.symbol, ...Object.values(o)];
  for (const c of candidates) {
    if (typeof c !== 'string' || /\.ico$/i.test(c)) continue;
    const abs = resolveAsset(dir, c);
    if (abs) return abs;
  }
  return undefined;
}

/** assets.fonts { family: 경로 | { file } } → @font-face. 경로는 resolveAsset 순서로 찾고, 없으면 건너뛴다. */
export function fontFaceCss(cfg: BrandConfig, dir: string): string {
  const out: string[] = [];
  for (const [family, v] of Object.entries(cfg.assets?.fonts ?? {})) {
    const relPath = typeof v === 'string' ? v : (v?.file ?? v?.src);
    if (!relPath) continue;
    const abs = resolveAsset(dir, relPath);
    if (!abs) {
      console.warn(`WARN: font file not found, skipped: ${relPath}`);
      continue;
    }
    out.push(`@font-face{font-family:'${family}';src:url('file://${abs}');font-display:block;}`);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// 캔버스
// ---------------------------------------------------------------------------

export interface Canvas { key: string; width: number; height?: number }

export function canvas(cfg: BrandConfig, key: string): Canvas {
  const sizes = cfg.assets?.canvasSizes;
  if (!sizes) throw new RouteBackError('assets.canvasSizes 가 없습니다. references/card-templates.md 의 권장 키를 brand_config 에 추가하세요.');
  const v = sizes[key];
  if (v === undefined) {
    throw new Error(`assets.canvasSizes.${key} 가 없습니다. 있는 키: ${Object.keys(sizes).join(', ') || '(없음)'}`);
  }
  if (typeof v === 'string') {
    const [w, h] = v.split('x').map((n) => parseInt(n, 10));
    return { key, width: w, height: Number.isFinite(h) ? h : undefined };
  }
  const o = v as Record<string, number>;
  return { key, width: o.width ?? o.w, height: o.height ?? o.h };
}

const GEMINI_RATIOS: Array<[string, number]> = [
  ['1:1', 1], ['2:3', 2 / 3], ['3:2', 3 / 2], ['3:4', 3 / 4], ['4:3', 4 / 3],
  ['4:5', 4 / 5], ['5:4', 5 / 4], ['9:16', 9 / 16], ['16:9', 16 / 9], ['21:9', 21 / 9],
];

/** 캔버스 비율에 가장 가까운 Gemini 지원 비율. */
export function nearestAspect(width: number, height: number): string {
  const r = width / height;
  let best = GEMINI_RATIOS[0];
  for (const cand of GEMINI_RATIOS) {
    if (Math.abs(Math.log(cand[1] / r)) < Math.abs(Math.log(best[1] / r))) best = cand;
  }
  return best[0];
}

// ---------------------------------------------------------------------------
// 출력 · manifest
// ---------------------------------------------------------------------------

export type AssetMode = 'card' | 'ad' | 'detail-page' | 'logo-prompt' | 'logo' | 'hero' | 'moodboard' | 'motion';
export const MODES: AssetMode[] = ['card', 'ad', 'detail-page', 'logo-prompt', 'logo', 'hero', 'moodboard', 'motion'];

export function assertMode(m: string | undefined): AssetMode {
  if (!m || !MODES.includes(m as AssetMode)) throw new Error(`--mode 는 ${MODES.join(' | ')} 중 하나여야 합니다 (받은 값: ${m ?? '(없음)'})`);
  return m as AssetMode;
}

export function modeDir(dir: string, mode: AssetMode): string {
  const p = path.join(dir, 'assets', mode);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export interface ManifestEntry {
  file: string;                       // .design/ 기준 상대경로
  mode: AssetMode;
  kind: 'image' | 'render' | 'prompt' | 'code';
  prompt: string | null;
  negativePrompt?: string | null;
  model: string | null;               // gemini 모델 id, 'puppeteer', 프롬프트 대상 플랫폼 등
  tier?: 1 | 2 | 3 | null;            // 3 = placeholder
  seed: number | null;
  size: { width: number; height: number | null } | null;   // 목표 캔버스 (assets.canvasSizes)
  pixels?: { width: number; height: number } | null;        // 실제 파일 픽셀 (모델이 캔버스와 다르게 줄 수 있다)
  aspectRatio?: string | null;
  sources?: string[];
  sha256?: string;
  note?: string;
  waived?: { rule: string; scope: string; reason: string } | null; // brand_config.exceptions[] 로 승인된 규칙 예외
  createdAt: string;
}

export interface Manifest { version: 1; brandId: string | null; entries: ManifestEntry[] }

/** PNG/JPEG 헤더에서 실제 픽셀 크기를 읽는다. 다른 형식은 null. */
export function imagePixels(file: string): { width: number; height: number } | null {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

export function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** 같은 file 의 항목은 교체, 새 file 은 추가. */
export function recordManifest(dir: string, cfg: BrandConfig, entry: Omit<ManifestEntry, 'createdAt'>): void {
  const p = path.join(dir, 'assets', 'manifest.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const m: Manifest = fs.existsSync(p)
    ? JSON.parse(fs.readFileSync(p, 'utf-8'))
    : { version: 1, brandId: cfg.brand?.id ?? null, entries: [] };
  const full: ManifestEntry = { ...entry, createdAt: new Date().toISOString() };
  const i = m.entries.findIndex((e) => e.file === full.file);
  if (i === -1) m.entries.push(full);
  else m.entries[i] = full;
  fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
}

export function rel(dir: string, file: string): string {
  return path.relative(dir, file).split(path.sep).join('/');
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '') || 'asset';
}
