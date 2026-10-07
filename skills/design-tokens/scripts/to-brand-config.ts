/**
 * to-brand-config.ts
 *
 * Maps a raw extraction (`.design/tokens-evidence/raw.json`) to the CONTRACT §5
 * brand_config shape, scores confidence per token group, and writes:
 *   .design/brand_config.draft.json        (exactly §5 keys, no provenance)
 *   .design/tokens-evidence/confidence.json (per-group scores + promotion verdict)
 *   .design/tokens-report.md                (source, chosen values, confidence, screenshots)
 *
 * The same raw shape is produced by extract-all.ts (URL mode) and written by hand
 * or by image-colors.sh + vision (image mode) and guide parsing (guide mode).
 * See references/raw-schema.md.
 *
 * Usage:
 *   npx tsx to-brand-config.ts --raw .design/tokens-evidence/raw.json [--design-dir .design] [--id acme] [--name "Acme"]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

type Ranked = { value: string | number; count: number };
type Group = 'colors' | 'typography' | 'spacing' | 'radius' | 'effects' | 'components' | 'motion';
type SourceType = 'url' | 'image' | 'guide';

export interface RawExtraction {
  meta: { source: string; sourceType: SourceType; extractedAt?: string; colorMethod?: string };
  colors?: Record<string, { value: string; usage?: string[]; occurrences?: number }>;
  roles?: {
    background?: { base: string | null; isDark?: boolean | null };
    surface?: Ranked[];
    brand?: Ranked[];
    text?: Ranked[];
    border?: Ranked[];
    brandSource?: string;
  };
  typography?: {
    fontFamilies?: Record<string, string>;
    fontSizes?: Record<string, string | number>;
    fontWeights?: Record<string, number>;
    lineHeights?: Record<string, number>;
    letterSpacing?: Record<string, string>;
  };
  typographyScale?: { base: number; ratio: number; detected: boolean };
  spacing?: { base?: string | number; scale?: Record<string, string | number>; gaps?: Record<string, string> };
  spacingConfidence?: number;
  radii?: Ranked[];
  shadows?: Ranked[];
  motion?: { durations?: Ranked[]; easings?: Ranked[] };
  components?: Record<string, Record<string, unknown>>;
  grid?: Record<string, unknown>;
  page?: { title?: string | null; siteName?: string | null; description?: string | null; themeColor?: string | null; logoCandidates?: string[] };
  evidence?: { screenshots?: string[] };
  confidence?: Partial<Record<Group, number>>;
  notes?: string[];
}

/** Single place for promotion policy. promote.ts imports this. */
export const THRESHOLDS = {
  colors: 85,
  typography: 80,
  overall: 80,
  autoPromoteSourceTypes: ['url', 'guide'] as SourceType[],
};

const WEIGHTS: Record<Group, number> = {
  colors: 0.35, typography: 0.3, spacing: 0.15, radius: 0.1, effects: 0.05, components: 0.05, motion: 0,
};

/** Upper bound per source type: an image can never be as certain as computed CSS. */
const CAPS: Record<SourceType, Record<Group, number>> = {
  url: { colors: 100, typography: 100, spacing: 100, radius: 100, effects: 100, components: 100, motion: 100 },
  image: { colors: 95, typography: 60, spacing: 50, radius: 50, effects: 40, components: 40, motion: 0 },
  guide: { colors: 100, typography: 100, spacing: 100, radius: 100, effects: 100, components: 100, motion: 100 },
};

/**
 * Radius naming. The brand's own scale is the canon (agreed with design-system's
 * build-system.ts --check): allowed names are exactly these, strictly increasing in this
 * order, plus numeric names whose value equals the number ("10": 10).
 */
export const RADIUS_RANK = ['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'];

const NEUTRAL_STEPS: Array<[number, number]> = [
  [99.5, 0], [97, 50], [93, 100], [86, 200], [75, 300], [60, 400], [45, 500], [35, 600], [25, 700], [15, 800], [7, 900], [0, 950],
];

// ---------- color helpers ----------
function normHex(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  const short = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
  if (/^#[0-9a-f]{8}$/i.test(s)) return s.slice(0, 7).toUpperCase();
  const rgb = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) return '#' + [rgb[1], rgb[2], rgb[3]].map(x => parseInt(x, 10).toString(16).padStart(2, '0')).join('').toUpperCase();
  return null;
}

function hsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hueDistance(a: string, b: string): number {
  const d = Math.abs(hsl(a).h - hsl(b).h);
  return Math.min(d, 360 - d);
}

/** Chroma (max-min channel, 0..1). HSL saturation explodes near white/black, chroma does not. */
function chroma(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return Math.max(r, g, b) - Math.min(r, g, b);
}
const isChromatic = (hex: string) => chroma(hex) >= 0.12;
const isNeutral = (hex: string) => chroma(hex) < 0.12;

function px(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const m = v.match(/^(-?[\d.]+)\s*(px|rem|em)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === 'rem' || m[2] === 'em' ? n * 16 : n;
}

function slug(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'brand';
}

// ---------- mapping ----------
export interface MapResult {
  config: Record<string, unknown>;
  confidence: Record<Group, number> & { overall: number };
  reasons: Record<Group, string>;
  dropped: { colors: string[]; radius: Array<{ measured: number; snappedTo: string; count: number }>; notes: string[] };
  promotion: { eligible: boolean; why: string[] };
}

export function toBrandConfig(raw: RawExtraction, opts: { id?: string; name?: string } = {}): MapResult {
  const sourceType: SourceType = raw.meta.sourceType;
  const reasons = {} as Record<Group, string>;
  const score = {} as Record<Group, number>;

  // ----- colors -----
  const clusters = Object.values(raw.colors || {})
    .map(c => ({ hex: normHex(c.value), count: c.occurrences || 1, usage: c.usage || [] }))
    .filter((c): c is { hex: string; count: number; usage: string[] } => !!c.hex);
  const roleBrand = (raw.roles?.brand || []).map(r => normHex(r.value)).filter((h): h is string => !!h);
  const chromaticClusters = clusters.filter(c => isChromatic(c.hex)).sort((a, b) => b.count - a.count).map(c => c.hex);
  const candidates = [...new Set([...roleBrand, ...chromaticClusters])].filter(isChromatic);

  const primary = candidates[0] || null;
  const accent = primary ? candidates.slice(1).find(h => hueDistance(h, primary) >= 30) || null : null;

  const statusHues: Array<[string, (h: number) => boolean]> = [
    ['danger', h => h >= 345 || h <= 15],
    ['warning', h => h >= 35 && h <= 60],
    ['success', h => h >= 90 && h <= 160],
  ];
  const semantic: Record<string, string> = {};   // only success / warning / danger / info
  const bg = normHex(raw.roles?.background?.base);
  const surface = normHex(raw.roles?.surface?.[0]?.value);
  // Body text is neutral and contrasts with the page background; white CTA text and colored links are not.
  const bgL = bg ? hsl(bg).l : 100;
  const texts = (raw.roles?.text || []).map(t => normHex(t.value))
    .filter((h): h is string => !!h && isNeutral(h) && Math.abs(hsl(h).l - bgL) >= 30);
  const border = normHex(raw.roles?.border?.[0]?.value);
  const used = new Set([primary, accent].filter(Boolean));
  for (const hex of candidates) {
    if (used.has(hex)) continue;
    for (const [name, test] of statusHues) {
      if (!semantic[name] && test(hsl(hex).h)) { semantic[name] = hex; used.add(hex); break; }
    }
  }
  const droppedColors = candidates.filter(h => !used.has(h));

  // Neutral steps. Colors that a role points at are placed first and never evicted; when two
  // land on the same step the later one moves to the nearest free step. Other neutrals only
  // fill free steps, most frequent first; the rest are reported as dropped.
  const STEP_KEYS = NEUTRAL_STEPS.map(([, step]) => step);
  const stepOf = (hex: string) => (NEUTRAL_STEPS.find(([min]) => hsl(hex).l >= min) || [0, 950])[1];
  const neutral: Record<string, string> = {};
  const stepOfHex = new Map<string, number>();
  const place = (hex: string, exactStepOnly: boolean): boolean => {
    if (stepOfHex.has(hex)) return true;
    const want = STEP_KEYS.indexOf(stepOf(hex));
    const order = exactStepOnly ? [want] : STEP_KEYS.map((_, i) => i).sort((x, y) => Math.abs(x - want) - Math.abs(y - want));
    for (const i of order) {
      const k = String(STEP_KEYS[i]);
      if (!neutral[k]) { neutral[k] = hex; stepOfHex.set(hex, STEP_KEYS[i]); return true; }
    }
    return false;
  };
  const roleSources: Array<[string, string | null | undefined]> = [
    ['background', bg], ['surface', surface && surface !== bg ? surface : null],
    ['text', texts[0]], ['textMuted', texts[1]], ['border', border],
  ];
  const roles: Record<string, string> = {};
  const roleNotes: string[] = [];
  for (const [role, hex] of roleSources) {
    if (!hex) continue;
    if (hex === primary) { roles[role] = 'primary'; continue; }
    if (hex === accent) { roles[role] = 'accent'; continue; }
    if (!isNeutral(hex)) { roleNotes.push(`role ${role}=${hex} is chromatic but not primary/accent; left out (3-color rule)`); continue; }
    place(hex, false);
    roles[role] = `neutral.${stepOfHex.get(hex)}`;
  }
  if (primary) roles.focus = 'primary';
  const neutralPool = new Map<string, number>();
  clusters.forEach(c => { if (isNeutral(c.hex)) neutralPool.set(c.hex, (neutralPool.get(c.hex) || 0) + c.count); });
  const droppedNeutrals: string[] = [];
  [...neutralPool.entries()].sort((x, y) => y[1] - x[1]).forEach(([hex]) => { if (!place(hex, true)) droppedNeutrals.push(hex); });
  const neutralSorted = Object.fromEntries(Object.entries(neutral).sort((x, y) => Number(x[0]) - Number(y[0])));

  if (sourceType === 'url') {
    const multi = clusters.filter(c => c.count > 1).length / Math.max(clusters.length, 1);
    let s = Math.round(85 + multi * 15);
    const notes: string[] = [`${clusters.length} clusters, ${Math.round(multi * 100)}% seen more than once`];
    if (raw.roles?.brandSource !== 'interactive-elements') { s -= 15; notes.push('primary not seen on an interactive element (-15)'); }
    if (!primary) { s = Math.min(s, 40); notes.push('no chromatic color found'); }
    if (primary && !accent) notes.push('no accent candidate ≥ 30° hue away: user must choose one before promotion');
    score.colors = s;
    reasons.colors = notes.join('; ');
  } else {
    score.colors = primary ? 70 : 30;
    reasons.colors = `${sourceType} mode, color method=${raw.meta.colorMethod || 'unknown'}`;
  }

  // ----- typography -----
  const t = raw.typography || {};
  const scale: Record<string, number> = {};
  Object.entries(t.fontSizes || {}).forEach(([k, v]) => { const n = px(v); if (n !== null) scale[k] = n; });
  if (sourceType === 'url') {
    let s = 80;
    if (raw.typographyScale?.detected) s += 10;
    if (Object.keys(t.fontFamilies || {}).length >= 2) s += 5;
    if (Object.keys(scale).length >= 5) s += 5;
    score.typography = Math.min(s, 100);
    reasons.typography = `${Object.keys(scale).length} sizes, ratio ${raw.typographyScale?.ratio ?? 'n/a'} (${raw.typographyScale?.detected ? 'detected' : 'not detected'})`;
  } else {
    score.typography = Object.keys(scale).length ? 60 : 20;
    reasons.typography = `${sourceType} mode, ${Object.keys(scale).length} sizes`;
  }

  // ----- spacing -----
  const spacingScale: Record<string, number> = {};
  Object.entries(raw.spacing?.scale || {}).forEach(([k, v]) => { const n = px(v); if (n !== null) spacingScale[k] = n; });
  const baseUnit = px(raw.spacing?.base ?? null);
  score.spacing = raw.spacingConfidence ?? (Object.keys(spacingScale).length > 1 ? 60 : 20);
  reasons.spacing = `base ${baseUnit ?? 'n/a'}px, ${Object.keys(spacingScale).length} steps`;

  // ----- radius (brand scale, named by rank) -----
  // Distinct measured values; values within ±1px merge into the more frequent one.
  const radiusScale: Record<string, number> = {};
  const droppedRadius: MapResult['dropped']['radius'] = [];
  let hasFull = false;
  const measured = new Map<number, number>();
  let total = 0;
  for (const r of raw.radii || []) {
    const v = r.value === 'full' ? 9999 : Math.round(Number(r.value));
    if (!Number.isFinite(v) || v < 0) continue;
    total += r.count;
    if (v >= 999) { hasFull = true; continue; }
    measured.set(v, (measured.get(v) || 0) + r.count);
  }
  const merged: Array<[number, number]> = [];
  for (const [v, c] of [...measured.entries()].sort((x, y) => y[1] - x[1])) {
    const near = merged.find(([m]) => Math.abs(m - v) <= 1);
    if (near) { near[1] += c; droppedRadius.push({ measured: v, snappedTo: `${near[0]}px`, count: c }); }
    else merged.push([v, c]);
  }
  const minCount = total >= 20 ? 2 : 1;
  const values = merged.filter(([v, c]) => v === 0 || c >= minCount).map(([v]) => v).sort((x, y) => x - y);
  merged.filter(([v, c]) => v !== 0 && c < minCount).forEach(([v, c]) => droppedRadius.push({ measured: v, snappedTo: 'dropped (rare)', count: c }));
  const ranked = ['sm', 'md', 'lg', 'xl', '2xl', '3xl'];
  radiusScale.none = 0;
  let ri = 0;
  for (const v of values) {
    if (v === 0) continue;
    if (ri < ranked.length) radiusScale[ranked[ri++]] = v;
    else radiusScale[String(v)] = v;
  }
  if (hasFull) radiusScale.full = 9999;
  // CONTRACT §5: a named scale needs none plus at least two more named steps. Otherwise use
  // numeric names only ("6": 6), which are always valid.
  if (Object.keys(radiusScale).filter(k => RADIUS_RANK.includes(k) && k !== 'none').length < 2) {
    for (const k of Object.keys(radiusScale)) {
      const v = radiusScale[k];
      delete radiusScale[k];
      radiusScale[String(v)] = v;
    }
  }
  const snapped = droppedRadius.filter(d => d.snappedTo.endsWith('px')).reduce((x, d) => x + d.count, 0);
  score.radius = total ? Math.max(40, Math.round(((total - snapped) / total) * 100)) : 50;
  reasons.radius = total ? `${values.filter(v => v > 0).length + (hasFull ? 1 : 0)} distinct radii from ${total} uses; ${droppedRadius.length} merged or dropped` : 'no radius measured';

  // ----- effects -----
  const shadowList = (raw.shadows || []).slice(0, 3);
  const blur = (s: string) => { const nums = String(s).match(/-?[\d.]+px/g) || []; return nums[2] ? parseFloat(nums[2]) : 0; };
  const shadows: Record<string, string> = {};
  ['sm', 'md', 'lg'].forEach((name, i) => {
    const sorted = [...shadowList].sort((a, b) => blur(String(a.value)) - blur(String(b.value)));
    if (sorted[i]) shadows[name] = String(sorted[i].value);
  });
  score.effects = shadowList.length ? 80 : 60;
  reasons.effects = shadowList.length ? `${raw.shadows?.length} distinct shadows, top ${shadowList.length} kept` : 'no shadows (flat surface is a valid result)';

  // ----- components -----
  const components: Record<string, unknown> = {};
  Object.entries(raw.components || {}).forEach(([type, styles]) => { components[type] = { variants: { default: styles }, states: {} }; });
  score.components = Object.keys(components).length ? 80 : 0;
  reasons.components = `${Object.keys(components).length} component types`;

  // ----- motion -----
  const durations: Record<string, string> = {};
  const durs = [...(raw.motion?.durations || [])].slice(0, 3)
    .sort((a, b) => parseFloat(String(a.value)) * (String(a.value).endsWith('ms') ? 1 : 1000) - parseFloat(String(b.value)) * (String(b.value).endsWith('ms') ? 1 : 1000));
  ['fast', 'base', 'slow'].forEach((n, i) => { if (durs[i]) durations[n] = String(durs[i].value); });
  const easingCurves: Record<string, string> = {};
  (raw.motion?.easings || []).slice(0, 2).forEach((e, i) => { easingCurves[i === 0 ? 'standard' : 'alternate'] = String(e.value); });
  score.motion = durs.length ? 70 : 0;
  reasons.motion = `${durs.length} durations`;

  // ----- caps + overrides -----
  const caps = CAPS[sourceType] || CAPS.image;
  (Object.keys(score) as Group[]).forEach(g => {
    const override = raw.confidence?.[g];
    const v = typeof override === 'number' ? override : score[g];
    score[g] = Math.max(0, Math.min(v, caps[g]));
  });
  const overall = Math.round((Object.keys(WEIGHTS) as Group[]).reduce((sum, g) => sum + score[g] * WEIGHTS[g], 0));

  // ----- brand identity -----
  let host = '';
  try { host = new URL(raw.meta.source).hostname.replace(/^www\./, ''); } catch { host = path.basename(raw.meta.source).replace(/\.[^.]+$/, ''); }
  const titleName = (raw.page?.title || '').split(/\s[|–—-]\s/)[0].trim();
  const hostLabel = host.split('.')[0];
  const nameFrom = opts.name ? 'flag --name' : raw.page?.siteName ? 'og:site_name' : titleName ? 'page/document title'
    : hostLabel ? (sourceType === 'url' ? 'url host' : 'file name') : 'fallback "brand"';
  const name = opts.name || raw.page?.siteName || titleName || hostLabel || 'brand';
  const idFrom = opts.id ? 'flag --id' : hostLabel ? (sourceType === 'url' ? 'url host' : 'file name') : 'slug of brand.name';
  const id = opts.id || slug(hostLabel || name);

  const families = t.fontFamilies || {};
  const config = {
    brand: { id, name, nameKr: '', description: raw.page?.description || '', mood: [], philosophy: '' },
    tokens: {
      colors: { primary, accent, neutral: neutralSorted, semantic, roles },
      typography: {
        families,
        scale,
        weights: t.fontWeights || {},
        lineHeights: t.lineHeights || {},
      },
      spacing: { scale: spacingScale },
      radius: { scale: radiusScale },
      effects: { shadows },
      geometry: { ...(baseUnit ? { baseUnit } : {}), ...(raw.grid ? { grid: raw.grid } : {}) },
    },
    artStyle: { artStyleId: '', artStyleName: '', negative: [] },
    visualSystem: { logoDirection: '', iconStyle: '', illustration: '' },
    motion: { feel: '', easingCurves, durations },
    assets: {
      logo: {}, fonts: {}, references: (raw.evidence?.screenshots || []),
      hero: '', moodBoard: '', canvasSizes: {}, imagePromptConfiguration: {},
    },
    components,
    platforms: ['web'],
    brandKeywords: [],
    _meta: {
      source: raw.meta.source,
      extractedAt: raw.meta.extractedAt || new Date().toISOString(),
      defaultsFrom: [],
      derived: { 'brand.id': idFrom, 'brand.name': nameFrom },
    },
  };

  const why: string[] = [];
  if (!THRESHOLDS.autoPromoteSourceTypes.includes(sourceType)) why.push(`sourceType=${sourceType} always needs user confirmation`);
  if (score.colors < THRESHOLDS.colors) why.push(`colors ${score.colors} < ${THRESHOLDS.colors}`);
  if (score.typography < THRESHOLDS.typography) why.push(`typography ${score.typography} < ${THRESHOLDS.typography}`);
  if (overall < THRESHOLDS.overall) why.push(`overall ${overall} < ${THRESHOLDS.overall}`);
  if (!primary) why.push('no primary color');
  if (!accent) why.push('no accent color (build-system --check requires one)');

  return {
    config,
    confidence: { ...score, overall },
    reasons,
    dropped: { colors: [...droppedColors, ...droppedNeutrals], radius: droppedRadius, notes: roleNotes },
    promotion: { eligible: why.length === 0, why },
  };
}

// ---------- report ----------
export function renderReport(raw: RawExtraction, r: MapResult, designDir: string): string {
  const c = r.config as any;
  const rel = (p: string) => path.relative(designDir, path.resolve(p)) || p;
  const shots = (raw.evidence?.screenshots || []).map(p => `- ![${path.basename(p)}](${rel(p)})`).join('\n') || '- (none)';
  const groups: Group[] = ['colors', 'typography', 'spacing', 'radius', 'effects', 'components', 'motion'];
  const empty = [
    'brand.nameKr', 'brand.mood', 'brand.philosophy', 'artStyle.*', 'visualSystem.*', 'motion.feel',
    'assets.logo', 'assets.fonts', 'brandKeywords',
  ];
  return `# Tokens Report

| Field | Value |
|---|---|
| Source | ${raw.meta.source} |
| Source type | ${raw.meta.sourceType} |
| Color method | ${raw.meta.colorMethod || (raw.meta.sourceType === 'url' ? 'computed' : 'unknown')} |
| Extracted at | ${raw.meta.extractedAt || new Date().toISOString()} |
| Draft | brand_config.draft.json |

## Confidence

| Group | Score | Basis |
|---|---|---|
${groups.map(g => `| ${g} | ${r.confidence[g]} | ${r.reasons[g]} |`).join('\n')}
| **overall** | **${r.confidence.overall}** | weighted: colors .35, typography .3, spacing .15, radius .1, effects .05, components .05 |

## Promotion

${r.promotion.eligible
    ? 'Eligible for auto-promotion (all thresholds met).'
    : `Needs user confirmation:\n${r.promotion.why.map(w => `- ${w}`).join('\n')}`}

## Chosen values

| Token | Value |
|---|---|
| primary | ${c.tokens.colors.primary ?? '(none)'} |
| accent | ${c.tokens.colors.accent ?? '(none)'} |
| neutral | ${Object.entries(c.tokens.colors.neutral).map(([k, v]) => `${k}:${v}`).join(' ') || '(none)'} |
| semantic | ${Object.entries(c.tokens.colors.semantic).map(([k, v]) => `${k}:${v}`).join(' ') || '(none)'} |
| roles | ${Object.entries(c.tokens.colors.roles).map(([k, v]) => `${k}→${v}`).join(' ') || '(none)'} |
| families | ${Object.entries(c.tokens.typography.families).map(([k, v]) => `${k}: ${v}`).join(' / ') || '(none)'} |
| type scale | ${Object.entries(c.tokens.typography.scale).map(([k, v]) => `${k}:${v}`).join(' ') || '(none)'} |
| spacing | ${Object.values(c.tokens.spacing.scale).join(' ') || '(none)'} |
| radius | ${Object.entries(c.tokens.radius.scale).map(([k, v]) => `${k}:${v}`).join(' ')} |

## Dropped / adjusted

- Colors not kept (3-color rule, or neutral step already taken): ${r.dropped.colors.join(', ') || 'none'}
- Radius values merged (±1px) or dropped as rare: ${r.dropped.radius.map(d => `${d.measured}px→${d.snappedTo} (x${d.count})`).join(', ') || 'none'}
${r.dropped.notes.map(n => `- ${n}`).join('\n')}
- Logo candidates (not downloaded): ${(raw.page?.logoCandidates || []).join(', ') || 'none'}
${(raw.notes || []).map(n => `- ${n}`).join('\n')}

## Left empty for brief / user

${empty.map(e => `- ${e}`).join('\n')}

## Screenshots

${shots}
`;
}

// ---------- write ----------
export function writeOutputs(raw: RawExtraction, designDir: string, opts: { id?: string; name?: string } = {}): MapResult {
  const result = toBrandConfig(raw, opts);
  const evidenceDir = path.join(designDir, 'tokens-evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(designDir, 'brand_config.draft.json'), JSON.stringify(result.config, null, 2) + '\n');
  fs.writeFileSync(path.join(evidenceDir, 'confidence.json'), JSON.stringify({
    source: raw.meta.source, sourceType: raw.meta.sourceType,
    confidence: result.confidence, reasons: result.reasons, promotion: result.promotion, thresholds: THRESHOLDS,
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(designDir, 'tokens-report.md'), renderReport(raw, result, designDir));
  return result;
}

function arg(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const rawPath = arg(args, '--raw');
  if (!rawPath) {
    console.error('Usage: npx tsx to-brand-config.ts --raw <raw.json> [--design-dir .design] [--id <id>] [--name <name>]');
    process.exit(1);
  }
  const designDir = arg(args, '--design-dir') || '.design';
  const raw: RawExtraction = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
  if (!raw.meta?.source || !['url', 'image', 'guide'].includes(raw.meta.sourceType)) {
    console.error('raw.meta.source and raw.meta.sourceType (url|image|guide) are required');
    process.exit(1);
  }
  const r = writeOutputs(raw, designDir, { id: arg(args, '--id'), name: arg(args, '--name') });
  console.log(`draft:  ${path.join(designDir, 'brand_config.draft.json')}`);
  console.log(`report: ${path.join(designDir, 'tokens-report.md')}`);
  console.log(`confidence: ${JSON.stringify(r.confidence)}`);
  console.log(r.promotion.eligible ? 'promotion: eligible' : `promotion: needs confirmation (${r.promotion.why.join('; ')})`);
}
