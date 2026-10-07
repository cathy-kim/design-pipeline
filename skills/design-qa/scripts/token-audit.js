#!/usr/bin/env node
/**
 * token-audit.js — design-qa Layer A: 정적 토큰 감사 (CONTRACT §1-6 의 기계 검출)
 *
 * Usage:
 *   node token-audit.js [path ...] [--config .design/brand_config.json]
 *        [--json .design/qa/token-audit.json] [--md .design/qa/token-audit.md] [--max-colors 3]
 *
 * 규칙 (상세: references/static-rules.md)
 *   R1 colors-per-screen   화면 파일당 색 역할 > max-colors (Primary/Accent/Neutral + 팔레트 밖 색상군)  FAIL
 *   R2 radius-scale        brand 스케일 자체 (CONTRACT §5, build-system.ts radiusErrors 와 동일)     FAIL
 *   R3 radius-off-scale    코드의 radius 값/이름이 brand 스케일 밖, 또는 토큰 정의의 이름-값 불일치      FAIL
 *   R4 pill-button         버튼에 9999px / 50% / rounded-full (정사각 아이콘 버튼 제외)                   FAIL
 *   R5 neon-glow           채도 높은 색 + blur>=10px 그림자 (text-shadow 는 >=8px), 색 그림자 + 큰 shadow  FAIL
 *   R6 glassmorphism       backdrop-filter: blur / backdrop-blur-*                                      FAIL
 *   R7 gradient-border     border-image gradient, mask-composite 트릭, gradient 래퍼 + 1~2px 패딩        FAIL
 *   W1 off-palette-color   brand primary/accent/neutral/semantic 어디에도 속하지 않는 색                   WARN
 *
 * brand_config.exceptions[{rule, scope, reason, evidence}] 에 덮이는 위반은 WAIVED 로 보고한다(실패로 세지 않음).
 * exit 0 = FAIL 0건, 1 = FAIL 있음, 2 = 실행 오류.
 */
import fs from 'node:fs';
import path from 'node:path';

// ---------- args ----------
const argv = process.argv.slice(2);
const opt = { config: '.design/brand_config.json', json: null, md: null, maxColors: 3, paths: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-h' || a === '--help') {
    process.stderr.write('Usage: node token-audit.js [path ...] [--config f] [--json f] [--md f] [--max-colors 3]\n');
    process.exit(0);
  }
  if (a.startsWith('--')) {
    let [k, v] = a.slice(2).split(/=(.*)/s);
    if (v === undefined) v = argv[++i];
    if (k === 'config') opt.config = v;
    else if (k === 'json') opt.json = v;
    else if (k === 'md') opt.md = v;
    else if (k === 'max-colors') opt.maxColors = Number(v);
    else {
      process.stderr.write(`unknown option --${k}\n`);
      process.exit(2);
    }
  } else opt.paths.push(a);
}
if (!opt.paths.length) opt.paths.push('.');

// ---------- color utils ----------
function parseHex(h) {
  let s = h.replace('#', '');
  if (s.length === 3 || s.length === 4) s = [...s].map((c) => c + c).join('');
  const n = (i) => parseInt(s.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: s.length === 8 ? n(6) / 255 : 1 };
}
function parseFuncColor(str) {
  const m = str.match(/^(rgba?|hsla?)\(([^)]*)\)$/i);
  if (!m) return null;
  const parts = m[2].split(/[\s,/]+/).filter(Boolean);
  const num = (p, scale) => (p.endsWith('%') ? (parseFloat(p) / 100) * scale : parseFloat(p));
  const a = parts[3] !== undefined ? num(parts[3], 1) : 1;
  if (m[1].toLowerCase().startsWith('rgb')) {
    return { r: num(parts[0], 255), g: num(parts[1], 255), b: num(parts[2], 255), a };
  }
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const k = (n) => (n + h / 30) % 12;
  const f = (n) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255, a };
}
function parseColor(str) {
  if (!str) return null;
  str = String(str).trim();
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(str)) return parseHex(str);
  return parseFuncColor(str);
}
function hsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
const hueDist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const chanDelta = (a, b) => Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
const isNeutral = (c) => {
  const x = hsl(c);
  return x.s < 0.12 || x.l < 0.06 || x.l > 0.97;
};

// Tailwind 기본 팔레트 → 대표 색상 (hue, 채도 0.7 가정). 회색 계열은 neutral.
const TW_HUE = {
  red: 0, orange: 25, amber: 38, yellow: 48, lime: 85, green: 142, emerald: 160, teal: 173, cyan: 189,
  sky: 199, blue: 217, indigo: 239, violet: 258, purple: 271, fuchsia: 292, pink: 330, rose: 350,
};
const TW_NEUTRAL = new Set(['slate', 'gray', 'zinc', 'neutral', 'stone', 'black', 'white']);
const TOKEN_ROLE = (name) => {
  if (/foreground|background|^border$|^input$|^card|^popover|^muted|^neutral|^surface/.test(name)) return 'neutral';
  if (/^primary/.test(name)) return 'primary';
  if (/^(accent|secondary)/.test(name)) return 'accent';
  if (/^(destructive|error|danger|success|warning|info)/.test(name)) return 'semantic';
  return null;
};

// ---------- brand config ----------
function collectColors(node, out = []) {
  if (node == null) return out;
  if (typeof node === 'string') {
    const c = parseColor(node);
    if (c) out.push(c);
  } else if (typeof node === 'object') for (const v of Object.values(node)) collectColors(v, out);
  return out;
}
const toPx = (v) => {
  if (typeof v === 'number') return v;
  const m = String(v).trim().match(/^(-?[\d.]+)(px|rem|em)?$/);
  if (!m) return null;
  return parseFloat(m[1]) * (m[2] === 'rem' || m[2] === 'em' ? 16 : 1);
};

const violations = [];
const add = (rule, severity, file, line, match, message) =>
  violations.push({ rule, severity, file, line, match: String(match).slice(0, 120), message });

let brand = null;
const cfgPath = path.resolve(opt.config);
if (fs.existsSync(cfgPath)) {
  try {
    brand = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (e) {
    process.stderr.write(`brand_config parse error: ${e.message}\n`);
    process.exit(2);
  }
}
const colors = brand?.tokens?.colors || {};
const brandPalette = {
  primary: collectColors(colors.primary),
  accent: collectColors(colors.accent),
  neutral: collectColors(colors.neutral),
  semantic: collectColors(colors.semantic),
};
const radiusScale = {};
for (const [k, v] of Object.entries(brand?.tokens?.radius?.scale || {})) {
  const px = toPx(v);
  if (px !== null) radiusScale[k] = px;
}
const hasRadius = Object.keys(radiusScale).length > 0;
const radiusValues = Object.values(radiusScale);
const inScale = (px) => radiusValues.some((v) => Math.abs(v - px) < 0.5 || (v >= 999 && px >= 999));

// R2: brand 스케일 자체 검증 — CONTRACT §5 "radius 규칙(확정)".
//     design-system/scripts/build-system.ts 의 radiusErrors() 와 동일한 함수다(guards/radius-scale.test.ts 와도 동일).
//     한쪽을 바꾸면 세 곳을 같이 바꾼다. 정본은 .design/brand_config.json 의 tokens.radius.scale 뿐(하드코딩 표 없음).
const RADIUS_RANK = ['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'];
function radiusErrors(scale) {
  const errs = []; // { name, msg }
  const named = RADIUS_RANK.filter((n) => n in scale);
  if (named.some((n) => n !== 'none')) {
    if (scale.none !== 0) errs.push({ name: 'none', msg: `radius: a scale with named steps (${named.join(', ')}) must include "none": 0` });
    if (named.filter((n) => n !== 'none').length < 2) errs.push({ name: named[named.length - 1], msg: `radius: a scale with named steps needs "none" plus at least two more named steps (has ${named.join(', ')}); or use numeric names only ("none" may stay as the zero step)` });
  }
  let prev = null;
  for (const name of RADIUS_RANK) {
    const v = scale[name];
    if (typeof v !== 'number') continue;
    if (prev && v <= prev[1]) errs.push({ name, msg: `radius "${name}": ${v} must be greater than "${prev[0]}" (${prev[1]}); named steps rise in order ${RADIUS_RANK.join(' < ')}` });
    prev = [name, v];
  }
  for (const [name, v] of Object.entries(scale)) {
    if (typeof v !== 'number' || v < 0 || !Number.isInteger(v)) { errs.push({ name, msg: `radius "${name}": value must be a non-negative integer px` }); continue; }
    if (RADIUS_RANK.includes(name)) continue;
    if (!/^\d+$/.test(name)) errs.push({ name, msg: `radius "${name}": unknown step name; use ${RADIUS_RANK.join('/')} or the number itself ("${v}": ${v})` });
    else if (Number(name) !== v) errs.push({ name, msg: `radius "${name}": a numeric name must equal its value (got ${v})` });
  }
  return errs;
}
const rawRadiusScale = brand?.tokens?.radius?.scale;
if (rawRadiusScale && typeof rawRadiusScale === 'object' && Object.keys(rawRadiusScale).length) {
  const cfgRel = path.relative(process.cwd(), cfgPath);
  const cfgText = fs.readFileSync(cfgPath, 'utf8');
  const radiusAt = cfgText.search(/"radius"\s*:/);
  const cfgLine = (k) => {
    const i = cfgText.indexOf(`"${k}"`, Math.max(0, radiusAt));
    return i < 0 ? Math.max(1, cfgText.slice(0, Math.max(0, radiusAt)).split('\n').length) : cfgText.slice(0, i).split('\n').length;
  };
  for (const e of radiusErrors(rawRadiusScale))
    add('radius-scale', 'FAIL', cfgRel, cfgLine(e.name), e.name in rawRadiusScale ? `${e.name}: ${JSON.stringify(rawRadiusScale[e.name])}` : e.name, e.msg);
}

// ---------- file walk ----------
const EXT = /\.(css|scss|sass|less|html?|jsx|tsx|js|ts|mjs|vue|svelte|mdx)$/;
const SKIP_DIR = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', '.turbo']);
const SKIP_FILE = /\.(test|spec)\.|\.d\.ts$|\.min\.|package(-lock)?\.json/;
function walk(p, out) {
  if (!fs.existsSync(p)) return out;
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p)) if (!SKIP_DIR.has(e) && !(e === 'qa' && path.basename(p) === '.design')) walk(path.join(p, e), out);
  } else if (EXT.test(p) && !SKIP_FILE.test(p)) out.push(p);
  return out;
}
const files = opt.paths.flatMap((p) => walk(path.resolve(p), []));
// 토큰 정의 파일: 팔레트 전체를 담는 게 정상이므로 R1/W1/R3(literal) 면제, 대신 이름-값 대조
const isTokenDef = (f) => /(tailwind|nativewind)\.config|tokens?\.|theme\.|\/guards\//i.test(f);

// ---------- helpers ----------
function lineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return (off) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= off) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}
// shadow 값 → 레이어 [{ox, oy, blur, color}]
function parseShadow(value) {
  const layers = [];
  let depth = 0, cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { layers.push(cur); cur = ''; } else cur += ch;
  }
  layers.push(cur);
  return layers.map((l) => {
    const colorM = l.match(/#[0-9a-f]{3,8}\b|(rgba?|hsla?)\([^)]*\)/i);
    const rest = colorM ? l.replace(colorM[0], ' ') : l;
    const lens = (rest.match(/-?[\d.]+(px|rem|em)?/g) || []).map(toPx).filter((n) => n !== null);
    return { ox: lens[0] || 0, oy: lens[1] || 0, blur: lens[2] || 0, color: colorM ? parseColor(colorM[0]) : null };
  });
}
const saturated = (c) => {
  if (!c || c.a < 0.25) return false;
  const x = hsl(c);
  return x.s >= 0.5 && x.l >= 0.25 && x.l <= 0.85;
};
function checkShadow(kind, value, file, line, raw) {
  const min = kind === 'text-shadow' ? 8 : 10;
  for (const ly of parseShadow(value)) {
    if (ly.blur >= min && saturated(ly.color)) {
      add('neon-glow', 'FAIL', file, line, raw, `${kind}: 채도 높은 색 + blur ${ly.blur}px (기준 ${min}px) — 네온 글로우`);
      return;
    }
  }
}

// ---------- per-file audit ----------
const COLOR_RE = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\([^)]*\)/g;
const TW_PREFIX = '(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|fill|stroke|from|via|to|outline|decoration|shadow|caret|divide|placeholder|accent)';
const TW_COLOR_RE = new RegExp(`(?<![\\w-])${TW_PREFIX}-([a-z]+(?:-[a-z]+)*)(?:-(\\d{2,3}))?(?:\\/\\d+)?(?![\\w-])`, 'g');
const STRING_RE = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g;
const TAG_RE = /<([A-Za-z][\w.]*)\b((?:[^>"'{]|"[^"]*"|'[^']*'|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*)>/g;
const RADIUS_TW_RE = /(?<![\w-])rounded(?:-(?:t|r|b|l|tl|tr|br|bl|s|e|ss|se|es|ee))?(?:-(\[[^\]\s]+\]|[\w.]+))?(?![\w-])/g;

let screens = 0;
for (const abs of files) {
  const file = path.relative(process.cwd(), abs) || abs;
  const text = fs.readFileSync(abs, 'utf8');
  const lineOf = lineIndex(text);
  const tokenDef = isTokenDef(abs);
  const isMarkup = /\.(jsx|tsx|html?|vue|svelte|mdx|js|ts|mjs)$/.test(abs);

  // --- R6 glassmorphism ---
  for (const re of [/(?:-webkit-)?backdrop-filter\s*:\s*[^;}\n]*blur\(/gi, /backdropFilter\s*:\s*['"`][^'"`]*blur\(/g, /(?<![\w-])backdrop-blur(?!-none)(?:-[\w]+|-\[[^\]]+\])?(?![\w-])/g]) {
    for (const m of text.matchAll(re)) add('glassmorphism', 'FAIL', file, lineOf(m.index), m[0], 'backdrop blur 금지 (글래스모피즘)');
  }

  // --- R7 gradient border ---
  for (const m of text.matchAll(/border-image(?:-source)?\s*:\s*[^;}\n]*gradient\(|borderImage(?:Source)?\s*:\s*['"`][^'"`]*gradient\(/gi))
    add('gradient-border', 'FAIL', file, lineOf(m.index), m[0], 'border-image 에 gradient');
  for (const m of text.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const body = m[2];
    const masked = /mask-composite\s*:\s*(exclude|xor|destination-out)/i.test(body) && /gradient\(/i.test(body);
    const clipTrick = /padding-box/i.test(body) && /border-box/i.test(body) && /gradient\(/i.test(body);
    if (masked || clipTrick)
      add('gradient-border', 'FAIL', file, lineOf(m.index + m[1].length), m[1].trim(), masked ? 'mask-composite + gradient 보더 트릭' : 'padding-box/border-box gradient 보더 트릭');
  }

  // --- R5 neon glow (CSS / JS style) ---
  for (const m of text.matchAll(/(box-shadow|text-shadow)\s*:\s*([^;}\n]+)/gi)) checkShadow(m[1].toLowerCase(), m[2], file, lineOf(m.index), m[0]);
  for (const m of text.matchAll(/(boxShadow|textShadow)\s*:\s*['"`]([^'"`]+)['"`]/g)) checkShadow(m[1] === 'textShadow' ? 'text-shadow' : 'box-shadow', m[2], file, lineOf(m.index), m[0]);
  for (const m of text.matchAll(/drop-shadow\(([^()]*(?:\([^)]*\))?[^()]*)\)/gi)) checkShadow('drop-shadow', m[1], file, lineOf(m.index), m[0]);

  // --- tailwind class strings: glow / gradient-border wrapper ---
  if (isMarkup) {
    for (const m of text.matchAll(STRING_RE)) {
      const s = m[1] ?? m[2] ?? m[3] ?? '';
      if (!/[a-z]-/.test(s)) continue;
      const ln = lineOf(m.index);
      for (const a of s.matchAll(/(?<![\w-])(?:drop-)?shadow-\[([^\]]+)\]/g)) checkShadow('box-shadow', a[1].replace(/_/g, ' '), file, ln, a[0]);
      const colored = s.match(/(?<![\w-])shadow-([a-z]+)-(\d{2,3})(?:\/\d+)?(?![\w-])/);
      const big = /(?<![\w-])shadow-(lg|xl|2xl)(?![\w-])/.test(s);
      if (colored && big && (TW_HUE[colored[1]] !== undefined || /^(primary|accent)/.test(colored[1])))
        add('neon-glow', 'FAIL', file, ln, colored[0], '색 그림자(shadow-<color>) + 큰 shadow — 네온 글로우');
      if (/(?<![\w-])(?:bg-gradient-to-\w+|bg-linear-to-\w+|bg-\[linear-gradient)/.test(s) && /(?<![\w-])(?:p-px|p-\[[12]px\]|p-0\.5)(?![\w-])/.test(s))
        add('gradient-border', 'FAIL', file, ln, s.slice(0, 80), 'gradient 배경 래퍼 + 1~2px 패딩 = 그라디언트 보더');
    }
  }

  // --- R4 pill button ---
  const pillName = Object.entries(radiusScale).filter(([, v]) => v >= 999).map(([k]) => k);
  const pillClass = new RegExp(`(?<![\\w-])rounded-(?:full|\\[(?:9999px|999px|50%|100%)\\]${pillName.map((n) => '|' + n.replace(/[.]/g, '\\.')).join('')})(?![\\w-])`);
  const iconExempt = (attrs) => {
    if (/(?<![\w-])(size-\S+|aspect-square)(?![\w-])/.test(attrs)) return true;
    const h = attrs.match(/(?<![\w-])h-(\S+?)(?=["'`\s])/), w = attrs.match(/(?<![\w-])w-(\S+?)(?=["'`\s])/);
    return !!(h && w && h[1] === w[1]);
  };
  if (isMarkup) {
    for (const m of text.matchAll(TAG_RE)) {
      const [, tag, attrs] = m;
      const isBtn = /^(button|.*Button)$/.test(tag) || /role=["']button["']/.test(attrs) || /(?:class|className)=["'{`][^"'`]*(?<![\w-])(btn|button)(?![\w])/.test(attrs) || (tag === 'input' && /type=["'](submit|button)["']/.test(attrs));
      if (!isBtn) continue;
      const styled = /borderRadius\s*:\s*['"]?(9999|999|50%|100%)/.test(attrs);
      if ((pillClass.test(attrs) || styled) && !iconExempt(attrs))
        add('pill-button', 'FAIL', file, lineOf(m.index), `<${tag}${attrs.slice(0, 80)}>`, '버튼에 pill radius (정사각 아이콘 버튼만 원형 허용)');
    }
    if (/button/i.test(path.basename(abs))) {
      for (const m of text.matchAll(STRING_RE)) {
        const s = m[1] ?? m[2] ?? m[3] ?? '';
        const ln = lineOf(m.index);
        if (pillClass.test(s) && !iconExempt(s + ' ') && !violations.some((v) => v.rule === 'pill-button' && v.file === file && v.line === ln))
          add('pill-button', 'FAIL', file, ln, s.slice(0, 80), '버튼 프리미티브 variant 에 pill radius');
      }
    }
  }
  for (const m of text.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const sel = m[1].split(/[;\n]/).pop();
    if (!/\bbutton\b|\.btn\b|\[role=["']?button|\.cta\b|-button\b|button-/i.test(sel)) continue;
    const r = m[2].match(/border-radius\s*:\s*([^;]+)/i);
    if (!r) continue;
    const v = r[1].trim();
    const pct = v.match(/^([\d.]+)%/);
    const px = toPx(v.split(/\s+/)[0]);
    if ((pct && Number(pct[1]) >= 50) || (px !== null && px >= 100)) {
      if (/width\s*:\s*([^;]+);[\s\S]*height\s*:\s*\1\s*;|height\s*:\s*([^;]+);[\s\S]*width\s*:\s*\2\s*;|aspect-ratio\s*:\s*1\b/i.test(m[2])) continue;
      add('pill-button', 'FAIL', file, lineOf(m.index + m[1].length), `${sel.trim()} { border-radius: ${v} }`, '버튼 셀렉터에 pill radius');
    }
  }

  // --- R3 radius off-scale ---
  if (hasRadius) {
    if (tokenDef) {
      const blocks = [...text.matchAll(/borderRadius\s*:\s*\{([^}]*)\}/g)].map((b) => ({ body: b[1], off: b.index }));
      for (const b of blocks)
        for (const p of b.body.matchAll(/['"]?([\w.-]+)['"]?\s*:\s*['"]?(-?[\d.]+(?:px|rem)?)['"]?/g)) {
          const name = p[1], px = toPx(p[2]);
          if (px === null) continue;
          if (!(name in radiusScale)) add('radius-off-scale', 'FAIL', file, lineOf(b.off), p[0], `토큰 이름 "${name}" 이 brand radius 스케일에 없다`);
          else if (Math.abs(radiusScale[name] - px) >= 0.5 && !(radiusScale[name] >= 999 && px >= 999))
            add('radius-off-scale', 'FAIL', file, lineOf(b.off), p[0], `이름-값 불일치: ${name} = ${px}px, brand = ${radiusScale[name]}px`);
        }
      for (const p of text.matchAll(/--radius-([\w.-]+)\s*:\s*([\d.]+(?:px|rem)?)/g)) {
        const name = p[1], px = toPx(p[2]);
        if (name in radiusScale && Math.abs(radiusScale[name] - px) >= 0.5 && !(radiusScale[name] >= 999 && px >= 999))
          add('radius-off-scale', 'FAIL', file, lineOf(p.index), p[0], `이름-값 불일치: --radius-${name} = ${px}px, brand = ${radiusScale[name]}px`);
      }
    } else {
      for (const m of text.matchAll(/border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius\s*:\s*([^;}\n]+)/gi)) {
        for (const v of m[1].trim().split(/[\s/]+/)) {
          if (/var\(|calc\(|inherit|initial|unset|%$/.test(v)) continue;
          const px = toPx(v);
          if (px !== null && !inScale(px)) add('radius-off-scale', 'FAIL', file, lineOf(m.index), m[0], `${v} 는 brand radius 스케일(${radiusValues.join('/')}) 밖`);
        }
      }
      for (const m of text.matchAll(/borderRadius\s*:\s*['"]?(-?[\d.]+(?:px|rem)?)['"]?/g)) {
        const px = toPx(m[1]);
        if (px !== null && !inScale(px)) add('radius-off-scale', 'FAIL', file, lineOf(m.index), m[0], `${m[1]} 는 brand radius 스케일 밖`);
      }
      if (isMarkup)
        for (const m of text.matchAll(RADIUS_TW_RE)) {
          const name = m[1];
          if (!name) {
            if (!('DEFAULT' in radiusScale)) add('radius-off-scale', 'FAIL', file, lineOf(m.index), m[0], '이름 없는 rounded 는 스케일 밖 — rounded-<brand 스케일 이름> 을 쓴다');
          } else if (name.startsWith('[')) {
            const px = toPx(name.slice(1, -1));
            if (px === null || !inScale(px)) add('radius-off-scale', 'FAIL', file, lineOf(m.index), m[0], '임의 radius 값 — brand 스케일 이름을 쓴다');
          } else if (!(name in radiusScale) && name !== 'full') {
            add('radius-off-scale', 'FAIL', file, lineOf(m.index), m[0], `"${name}" 은 brand radius 스케일 이름이 아니다`);
          }
        }
    }
  }

  // --- R1 colors per screen + W1 off-palette ---
  if (tokenDef) continue;
  const roles = new Map(); // role -> first {line, match}
  const offClusters = []; // {hue, line, match}
  const note = (role, line, match) => { if (!roles.has(role)) roles.set(role, { line, match }); };
  const classify = (c, line, match, fromTailwindHue) => {
    if (!c || c.a === 0) return;
    if (isNeutral(c)) return note('neutral', line, match);
    if (brandPalette.semantic.some((s) => chanDelta(s, c) <= 12)) return note('semantic', line, match);
    if (brandPalette.neutral.some((s) => chanDelta(s, c) <= 12)) return note('neutral', line, match);
    const h = hsl(c).h;
    const fam = (list) => list.some((s) => !isNeutral(s) && (chanDelta(s, c) <= 12 || hueDist(hsl(s).h, h) <= 15));
    if (fam(brandPalette.primary)) return note('primary', line, match);
    if (fam(brandPalette.accent)) return note('accent', line, match);
    let cl = offClusters.find((o) => hueDist(o.hue, h) <= 20);
    if (!cl) { cl = { hue: h, line, match }; offClusters.push(cl); }
    note(`hue~${Math.round(cl.hue)}`, line, match);
    if (brand) add('off-palette-color', 'WARN', file, line, match, `brand 팔레트 밖 색 (hue ${Math.round(h)}°)${fromTailwindHue ? ' — Tailwind 기본 팔레트 클래스' : ''}`);
  };
  for (const m of text.matchAll(COLOR_RE)) {
    const pre = text.slice(Math.max(0, m.index - 6), m.index);
    if (/href=["']?$|url\($/.test(pre)) continue;
    classify(parseColor(m[0]), lineOf(m.index), m[0], false);
  }
  if (isMarkup || /@apply/.test(text)) {
    for (const m of text.matchAll(TW_COLOR_RE)) {
      const name = m[1];
      const base = name.split('-')[0];
      const ln = lineOf(m.index);
      if (TW_NEUTRAL.has(base)) note('neutral', ln, m[0]);
      else if (TW_HUE[base] !== undefined) {
        const hue = TW_HUE[base];
        const k = (n) => (n + hue / 30) % 12;
        const f = (n) => 0.5 - 0.35 * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
        classify({ r: f(0) * 255, g: f(8) * 255, b: f(4) * 255, a: 1 }, ln, m[0], true);
      } else {
        const role = TOKEN_ROLE(name);
        if (role) note(role, ln, m[0]);
      }
    }
  }
  const counted = [...roles.keys()].filter((r) => r !== 'semantic');
  if (counted.length) screens++;
  if (counted.length > opt.maxColors) {
    const detail = counted.map((r) => `${r}@L${roles.get(r).line}(${roles.get(r).match})`).join(', ');
    add('colors-per-screen', 'FAIL', file, roles.get(counted[opt.maxColors]).line, detail, `색 역할 ${counted.length}개 > ${opt.maxColors} (semantic 제외)`);
  }
}

// ---------- exceptions → WAIVED ----------
// brand_config.exceptions[{ rule, scope, reason, evidence }] 가 덮는 위반은 WAIVED (실패로 세지 않고 항상 보고).
// rule: 아래 별칭 표의 어느 이름이든, 또는 "*" (전 규칙).
const RULE_ALIASES = {
  'colors-per-screen': ['r1', 'colors-per-screen', 'max-3-colors', 'three-colors', '3-colors'],
  'radius-scale': ['r2', 'radius-scale'],
  'radius-off-scale': ['r3', 'radius-off-scale', 'closed-radius', 'radius-closed-scale'],
  'pill-button': ['r4', 'pill-button', 'no-pill-button', 'no-pill', 'pill'],
  'neon-glow': ['r5', 'neon-glow', 'no-neon-glow', 'no-glow', 'glow'],
  glassmorphism: ['r6', 'glassmorphism', 'no-glassmorphism', 'no-glass'],
  'gradient-border': ['r7', 'gradient-border', 'no-gradient-border'],
  'off-palette-color': ['w1', 'off-palette-color'],
};
// scope: 생략/"*" = 전부. 쉼표로 여러 항목. 각 항목은
//   경로(/ 포함)  → 위반 파일 경로가 그 접두로 시작
//   점 경로(components.button) → 마지막 조각
//   그 밖 자유 문장 → 단어들
// 의 단어가 "모두" 위반 파일 경로 + 매치 문자열에 (대소문자 무시) 들어 있으면 해당. 단어 button 은 btn 도 맞는다.
const exceptions = Array.isArray(brand?.exceptions) ? brand.exceptions : [];
const ruleMatches = (exRule, id) => {
  const r = String(exRule || '').trim().toLowerCase();
  return r === '*' || (RULE_ALIASES[id] || [id]).includes(r);
};
const scopeMatches = (scope, v) => {
  if (!scope || String(scope).trim() === '*') return true;
  const hay = `${v.file} ${v.match}`.toLowerCase();
  return String(scope).split(',').some((term) => {
    term = term.trim();
    if (!term) return false;
    if (term.includes('/')) return v.file.startsWith(term.replace(/\*.*$/, ''));
    const leaf = term.split('.').pop().toLowerCase();
    const words = leaf.match(/[a-z0-9][a-z0-9-]*/g) || [];
    return words.length > 0 && words.every((w) => hay.includes(w) || (w === 'button' && hay.includes('btn')));
  });
};
for (const v of violations) {
  if (v.severity !== 'FAIL' && v.severity !== 'WARN') continue;
  const ex = exceptions.find((e) => ruleMatches(e.rule, v.rule) && scopeMatches(e.scope, v));
  if (ex) {
    v.waivedFrom = v.severity;
    v.severity = 'WAIVED';
    v.waiver = { rule: ex.rule, scope: ex.scope ?? '*', reason: ex.reason ?? '', evidence: ex.evidence ?? '' };
  }
}

// ---------- report ----------
const RULES = [
  ['colors-per-screen', 'R1 한 화면 3색'],
  ['radius-scale', 'R2 brand radius 스케일 정합'],
  ['radius-off-scale', 'R3 radius 닫힌 스케일'],
  ['pill-button', 'R4 pill 버튼 금지'],
  ['neon-glow', 'R5 네온 글로우 금지'],
  ['glassmorphism', 'R6 글래스모피즘 금지'],
  ['gradient-border', 'R7 그라디언트 보더 금지'],
  ['off-palette-color', 'W1 팔레트 밖 색 (경고)'],
];
const radiusRule = (id) => (id.startsWith('radius') || id === 'off-palette-color') && !brand;
const summary = RULES.map(([id, label]) => {
  const mine = violations.filter((v) => v.rule === id);
  const live = mine.filter((v) => v.severity !== 'WAIVED');
  const waived = mine.length - live.length;
  const sev = id === 'off-palette-color' ? 'WARN' : 'FAIL';
  const skipped = radiusRule(id) || (id.startsWith('radius') && !hasRadius);
  const status = skipped ? 'SKIP' : live.length ? sev : waived ? 'WAIVED' : 'PASS';
  return { id, label, count: live.length, waived, status };
});
const failCount = violations.filter((v) => v.severity === 'FAIL').length;
const warnCount = violations.filter((v) => v.severity === 'WARN').length;
const waivedList = violations.filter((v) => v.severity === 'WAIVED');
const result = {
  pass: failCount === 0,
  config: brand ? path.relative(process.cwd(), cfgPath) : null,
  filesScanned: files.length,
  screensWithColor: screens,
  maxColors: opt.maxColors,
  exceptions,
  summary,
  violations,
};

const md = [
  `## Layer A — 정적 토큰 감사`,
  '',
  `- brand_config: ${result.config ?? '없음 (radius·팔레트 대조 규칙 SKIP)'}`,
  `- 스캔 파일: ${files.length}`,
  `- 결과: **${result.pass ? 'PASS' : 'FAIL'}** (FAIL ${failCount}건, WARN ${warnCount}건, WAIVED ${waivedList.length}건)`,
  '',
  '| 규칙 | 상태 | 건수 | WAIVED |',
  '|---|---|---|---|',
  ...summary.map((s) => `| ${s.label} | ${s.status} | ${s.count} | ${s.waived} |`),
  '',
  ...(violations.length - waivedList.length
    ? ['| 규칙 | 심각도 | 위치 | 내용 | 매치 |', '|---|---|---|---|---|',
       ...violations.filter((v) => v.severity !== 'WAIVED').map((v) => `| ${v.rule} | ${v.severity} | \`${v.file}:${v.line}\` | ${v.message} | \`${v.match.replace(/\|/g, '\\|').replace(/`/g, "'")}\` |`)]
    : ['위반 없음.']),
  '',
  ...(waivedList.length
    ? ['### WAIVED (brand_config.exceptions — 실패로 세지 않음)', '',
       '| 규칙 | 원래 심각도 | 위치 | 예외(rule / scope) | 사유 | 근거 |', '|---|---|---|---|---|---|',
       ...waivedList.map((v) => `| ${v.rule} | ${v.waivedFrom} | \`${v.file}:${v.line}\` | ${v.waiver.rule} / ${v.waiver.scope} | "${String(v.waiver.reason).replace(/\|/g, '\\|')}" | "${String(v.waiver.evidence).replace(/\|/g, '\\|')}" |`), '']
    : []),
].join('\n');

if (opt.json) { fs.mkdirSync(path.dirname(path.resolve(opt.json)), { recursive: true }); fs.writeFileSync(opt.json, JSON.stringify(result, null, 2)); }
if (opt.md) { fs.mkdirSync(path.dirname(path.resolve(opt.md)), { recursive: true }); fs.writeFileSync(opt.md, md); }
process.stdout.write(opt.json || opt.md ? JSON.stringify({ pass: result.pass, fail: failCount, warn: warnCount, waived: waivedList.length, summary }) + '\n' : md);
process.exit(result.pass ? 0 : 1);
