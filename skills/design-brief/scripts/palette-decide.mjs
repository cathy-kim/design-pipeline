#!/usr/bin/env node
// design-brief: 팔레트 결정 입력(OKLCH 3역할 + 타이포)을 받아
//   1) design-system 이 승격하는 `json brand-decision` 블록(키 = brand_config 점 경로)을 HEX 로 확정하고
//   2) sophistication 규칙(SR-01~SR-10)과 WCAG 대비를 기계 검증한다.
// 출력 형식은 design-system/scripts/build-system.ts 의 --promote-brief 와 brands/_template.json 에 맞춘다.
// 사용: node palette-decide.mjs <input.json>   (또는 stdin)
// 종료 코드: 0 = FAIL 항목 없음, 1 = FAIL 있음, 2 = 입력 오류.
// 의존성 없음 (Node 18+).
import { readFileSync } from 'node:fs';

const raw = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
let input;
try { input = JSON.parse(raw); } catch (e) { console.error(`input is not JSON: ${e.message}`); process.exit(2); }

const need = (cond, msg) => { if (!cond) { console.error(`input error: ${msg}`); process.exit(2); } };
const isLch = (o) => o && ['l', 'c', 'h'].every((k) => typeof o[k] === 'number');
need(['luxury', 'premium', 'standard', 'mass'].includes(input.positioning), 'positioning must be luxury|premium|standard|mass');
need(isLch(input.primary), 'primary {l,c,h} required');
need(isLch(input.accent), 'accent {l,c,h} required');
need(input.neutral && typeof input.neutral.c === 'number' && typeof input.neutral.h === 'number', 'neutral {c,h} required');
need(typeof input.brandId === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(input.brandId), 'brandId (kebab-case) required');
need(typeof input.brandName === 'string' && input.brandName.length > 0, 'brandName required');
const t = input.typography;
need(t && ['families', 'weights', 'lineHeights'].every((k) => t[k] && typeof t[k] === 'object'), 'typography {families,weights,lineHeights} required');
need(typeof t.families.sans === 'string', 'typography.families.sans required');
need(typeof t.ratio === 'number' && t.ratio >= 1.067 && t.ratio <= 1.5, 'typography.ratio (1.067-1.5) required');
need(typeof t.base === 'number' && t.base >= 12 && t.base <= 20, 'typography.base (12-20 px) required');

// ---- OKLCH -> sRGB (Björn Ottosson) ----
const toLinear = ({ l, c, h }) => {
  const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
};
const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
const gamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const warnings = [];
// 감마 밖이면 L,H 고정하고 C 를 줄인다.
const fit = (name, lch) => {
  if (inGamut(toLinear(lch))) return lch;
  let lo = 0, hi = lch.c;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; inGamut(toLinear({ ...lch, c: mid })) ? (lo = mid) : (hi = mid); }
  warnings.push(`${name}: OKLCH(${lch.l}, ${lch.c}, ${lch.h}) is outside sRGB; chroma clipped to ${lo.toFixed(3)}`);
  return { ...lch, c: +lo.toFixed(3) };
};
const hex = (lch) => '#' + toLinear(lch).map((v) => Math.round(Math.min(1, Math.max(0, gamma(v))) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const lum = (hx) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const hslS = (hx) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  return max === min ? 0 : Math.round(((max - min) / (1 - Math.abs(2 * l - 1))) * 100);
};
const hueDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const temp = (h) => (h <= 80 || h >= 320 ? 'warm' : h >= 140 && h <= 260 ? 'cool' : 'neutral');

// ---- 색 확정 ----
const primary = fit('primary', input.primary);
const accent = fit('accent', input.accent);
const NEUTRAL_L = { 0: 1, 50: 0.985, 100: 0.965, 200: 0.925, 300: 0.87, 400: 0.72, 500: 0.585, 600: 0.475, 700: 0.38, 800: 0.285, 900: 0.21, 950: 0.145 };
const neutral = Object.fromEntries(Object.entries(NEUTRAL_L).map(([k, l]) => [k, hex(fit(`neutral.${k}`, { l, c: input.neutral.c, h: input.neutral.h }))]));
const sem = (h) => hex(fit(`semantic@${h}`, { l: 0.55, c: 0.15, h }));
const semantic = { success: sem(150), warning: hex(fit('semantic.warning', { l: 0.7, c: 0.15, h: 75 })), danger: sem(27), info: hex(primary) };
const P = hex(primary), A = hex(accent);
const step = (name, lch, dl, cf) => hex(fit(name, { l: Math.min(0.99, Math.max(0.05, lch.l + dl)), c: lch.c * cf, h: lch.h }));
const label = (bgHex) => (contrast('#FFFFFF', bgHex) >= contrast(neutral[950], bgHex) ? '#FFFFFF' : neutral[950]);
// 단계 이름은 brands/_template.json 과 같게. hover = 600.
const primaryGroup = { DEFAULT: P, foreground: label(P), 50: step('primary.50', { ...primary, l: 0.97 }, 0, 0.25), 100: step('primary.100', { ...primary, l: 0.93 }, 0, 0.4),
  500: P, 600: step('primary.600', primary, -0.06, 1), 700: step('primary.700', primary, -0.12, 0.95) };
const accentGroup = { DEFAULT: A, foreground: label(A), 100: step('accent.100', { ...accent, l: 0.94 }, 0, 0.35), 600: step('accent.600', accent, -0.06, 1) };

// 타이포: ratio·base 로 역할 이름 스케일을 만든다(design-system 기본 컴포넌트가 body-md·button-md·caption 을 참조).
const r = t.ratio, b = t.base, w = t.weights;
const size = (n) => `${Math.max(12, Math.round(b * r ** n))}px`;
const strong = w.bold ?? w.semibold ?? 600, semi = w.semibold ?? strong, reg = w.regular ?? 400;
const typeScale = {
  display: { size: size(6), lineHeight: '1.15', weight: strong, letterSpacing: '-0.02em' },
  'title-lg': { size: size(4), lineHeight: '1.3', weight: strong, letterSpacing: '-0.01em' },
  'title-md': { size: size(2), lineHeight: '1.4', weight: semi },
  'body-lg': { size: size(1), lineHeight: String(t.lineHeights.relaxed ?? 1.6), weight: reg },
  'body-md': { size: size(0), lineHeight: String(t.lineHeights.relaxed ?? 1.6), weight: reg },
  caption: { size: size(-1), lineHeight: '1.4', weight: reg },
  'button-md': { size: size(0), lineHeight: '1.2', weight: semi },
};

// ---- 검증 ----
// [primary(=Support 역할) S 상한, accent S 상한, 최소 L 분산] — sector-mapping 'HSL 범위 확장' 표
const ceil = { luxury: [50, 50, 0.6], premium: [60, 65, 0.5], standard: [75, 80, 0.4], mass: [100, 100, 0.3] }[input.positioning];
const checks = [];
const add = (id, level, pass, detail) => checks.push({ id, result: pass ? 'PASS' : level, detail });

add('SR-01 chroma binding', 'FAIL', input.neutral.c <= 0.05 && accent.c - input.neutral.c >= 0.08 && input.neutral.c <= primary.c && primary.c <= accent.c,
  `neutral C=${input.neutral.c} <= primary C=${primary.c} <= accent C=${accent.c}; gap ${(accent.c - input.neutral.c).toFixed(3)} (>=0.08, neutral<=0.05)`);
const Ls = [primary.l, accent.l, NEUTRAL_L[50], NEUTRAL_L[900]];
add('SR-02 lightness spread', 'FAIL', Math.max(...Ls) - Math.min(...Ls) >= ceil[2], `spread ${(Math.max(...Ls) - Math.min(...Ls)).toFixed(2)} (>=${ceil[2]})`);
const nh = input.neutral.h;
add('SR-03 neutral undertone', 'FAIL', input.neutral.c === 0 ? !!input.pureGrayAllowed : (nh >= 20 && nh <= 50) || (nh >= 200 && nh <= 240) || hueDiff(nh, primary.h) <= 5,
  input.neutral.c === 0 ? `pure gray; allowed only for devtool/streetwear/fashion-luxury (pureGrayAllowed=${!!input.pureGrayAllowed})` : `neutral H=${nh} (warm 20-50 | cool 200-240 | primary hue ±5)`);
const dPA = hueDiff(primary.h, accent.h);
add('SR-04 complementary ban', 'FAIL', dPA < 150, `primary/accent hue diff ${dPA.toFixed(0)}° (150°+ = complementary)`);
add('SR-04 accent within ±30°', 'WARN', dPA <= 30, `primary/accent hue diff ${dPA.toFixed(0)}°; wider is allowed only when the sector table pairs them`);
add('SR-05 primary saturation', 'FAIL', hslS(P) <= ceil[0], `primary HSL S=${hslS(P)}% (<=${ceil[0]}%, Support 역할 상한)`);
add('SR-05 accent saturation', input.signatureAccent ? 'WARN' : 'FAIL', hslS(A) < ceil[1],
  `accent HSL S=${hslS(A)}% (<${ceil[1]}%)${input.signatureAccent ? '; signature exception declared: area <=15%, neutral surround, CTA/logo only' : ''}`);
const tP = temp(primary.h), tA = temp(accent.h);
add('SR-09 temperature', 'WARN', tP === tA || tP === 'neutral' || tA === 'neutral', `primary ${tP}, accent ${tA}`);
const oc = [primary.h, accent.h].filter((h) => h <= 45 || h >= 320 || (h >= 160 && h <= 200)).length;
add('SR-10 orange/cyan bias', 'WARN', oc === 0, `${oc}/2 role hues in orange(0-45,320-360) or cyan(160-200)`);
const bg = neutral[50], ink = neutral[900];
add('SR-07 body text', 'FAIL', contrast(ink, bg) >= 4.5, `neutral.900 on neutral.50 = ${contrast(ink, bg)}:1 (>=4.5)`);
add('SR-07 primary UI', 'FAIL', contrast(P, bg) >= 3, `primary on neutral.50 = ${contrast(P, bg)}:1 (>=3)`);
add('SR-07 accent UI', 'FAIL', contrast(A, bg) >= 3, `accent on neutral.50 = ${contrast(A, bg)}:1 (>=3)`);
const onA = accentGroup.foreground, onP = primaryGroup.foreground;
add('SR-07 text on accent', 'FAIL', contrast(onA, A) >= 4.5, `accent.foreground ${onA} on accent = ${contrast(onA, A)}:1 (>=4.5)`);
add('SR-07 text on primary', 'FAIL', contrast(onP, P) >= 4.5, `primary.foreground ${onP} on primary = ${contrast(onP, P)}:1 (>=4.5)`);

// 키 = brand_config 점 경로. build-system.ts --promote-brief 가 경로별로 그대로 대입한다.
// radius·spacing·roles·components 는 넣지 않는다(design-system 소유, 없으면 기본값).
const brandDecision = {
  'brand.id': input.brandId,
  'brand.name': input.brandName,
  'brand.mood': input.mood || [],
  'brand.philosophy': input.philosophy || '',
  'tokens.colors': { primary: primaryGroup, accent: accentGroup, neutral, semantic },
  'tokens.typography': { families: t.families, scale: typeScale, weights: w, lineHeights: t.lineHeights },
};
const out = {
  brand_decision: brandDecision,
  oklch: { primary, accent, neutral: { c: input.neutral.c, h: nh } },
  checks,
  warnings,
};
console.log(JSON.stringify(out, null, 2));
process.exit(checks.some((c) => c.result === 'FAIL') ? 1 : 0);
