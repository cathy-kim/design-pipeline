#!/usr/bin/env node
// design-brief 완료 조건 검사: .design/brief.md 구조 + (브랜드 없음이면) brand_config 결정 블록.
// 사용: node check-brief.mjs [project-root]   (기본: 현재 디렉터리)
// 종료 코드: 0 = PASS, 1 = FAIL.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || process.cwd();
const briefPath = join(root, '.design', 'brief.md');
const hasBrand = existsSync(join(root, '.design', 'brand_config.json'));
const fails = [];
const fail = (m) => fails.push(m);

if (!existsSync(briefPath)) { console.log(`FAIL: ${briefPath} not found`); process.exit(1); }
const md = readFileSync(briefPath, 'utf8');

const sections = ['## 1. 목표', '## 2. 대상 사용자', '## 3. 화면 목록과 우선순위', '## 4. 톤', '## 5. 콘텐츠', '## 6. 제약', '## 7. 가정과 미결', '## 8. 팔레트·타이포 결정'];
let last = -1;
for (const s of sections) {
  const i = md.indexOf(s);
  if (i < 0) fail(`missing section "${s}"`);
  else if (i < last) fail(`section "${s}" out of order`);
  else last = i;
}

// 화면 표(§3 안에서만): | S1 | ... | P0 | 행
const s3 = md.slice(Math.max(0, md.indexOf('## 3. 화면 목록과 우선순위')), md.indexOf('## 4. 톤') > 0 ? md.indexOf('## 4. 톤') : undefined);
const rows = s3.split('\n').filter((l) => /^\|\s*S\d+\s*\|/.test(l));
if (rows.length === 0) fail('screen table has no S<n> rows');
const p0 = rows.filter((l) => /\|\s*P0\s*\|/.test(l)).length;
if (p0 < 1 || p0 > 3) fail(`P0 screens must be 1-3, found ${p0}`);
for (const r of rows) if (!/\|\s*P[012]\s*\|/.test(r)) fail(`screen row without P0/P1/P2: ${r.trim()}`);

// design-system/build-system.ts --promote-brief 와 같은 정규식으로 찾는다.
const m = md.match(/```json[ \t]+brand-decision[^\n]*\n([\s\S]*?)```/);
if (hasBrand) {
  if (m) fail('brand_config.json exists but brief still carries a brand-decision block');
  if (!/브랜드 있음: \.design\/brand_config\.json/.test(md)) fail('§8 must say "브랜드 있음: .design/brand_config.json ..."');
} else if (!m) {
  fail('no brand_config.json and no ```json brand-decision block in §8');
} else {
  let j;
  try { j = JSON.parse(m[1]); } catch (e) { fail(`brand-decision block is not JSON: ${e.message}`); }
  if (j) {
    const isHex = (v) => typeof v === 'string' && /^#[0-9A-F]{6}$/i.test(v);
    const bad = Object.keys(j).filter((k) => !/^(brand|tokens)\./.test(k));
    if (bad.length) fail(`keys must be dotted brand_config paths under brand./tokens.: ${bad.join(', ')}`);
    if (typeof j['brand.id'] !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(j['brand.id'])) fail('"brand.id" must be a kebab-case string');
    if (typeof j['brand.name'] !== 'string' || !j['brand.name']) fail('"brand.name" required');
    if (!Array.isArray(j['brand.mood']) || !j['brand.philosophy']) fail('"brand.mood" (array) and "brand.philosophy" required');
    const c = j['tokens.colors'] || {}, t = j['tokens.typography'] || {};
    const extra = Object.keys(c).filter((k) => !['primary', 'accent', 'neutral', 'semantic'].includes(k));
    if (extra.length) fail(`tokens.colors has roles beyond primary/accent/neutral/semantic (3-color rule): ${extra.join(', ')}`);
    for (const g of ['primary', 'accent']) {
      if (!c[g] || !isHex(c[g].DEFAULT) || !isHex(c[g].foreground)) fail(`tokens.colors.${g} needs DEFAULT and foreground as #RRGGBB`);
      else for (const [k, v] of Object.entries(c[g])) if (!isHex(v)) fail(`tokens.colors.${g}.${k} not #RRGGBB`);
    }
    const n = c.neutral || {};
    if (Object.values(n).filter(isHex).length < 3 || !isHex(n['0']) || !isHex(n['950'] ?? n['900'])) fail('tokens.colors.neutral needs "0", a dark end (900/950) and >=3 #RRGGBB steps');
    for (const k of Object.keys(c.semantic || {})) if (!['success', 'warning', 'danger', 'info'].includes(k)) fail(`tokens.colors.semantic.${k} not allowed`);
    if (typeof t.families?.sans !== 'string') fail('tokens.typography.families.sans required');
    for (const k of ['body-md', 'button-md', 'caption']) {
      const e = t.scale?.[k];
      if (!e || !/^\d+px$/.test(e.size) || e.lineHeight == null || e.weight == null) fail(`tokens.typography.scale["${k}"] needs size(px)/lineHeight/weight (default components use it)`);
    }
    if (!t.weights || !t.lineHeights) fail('tokens.typography.weights and lineHeights required');
    if (j['tokens.radius']) fail('brief must not decide tokens.radius (design-system owns it)');
  }
  if (/\|\s*SR-[0-9]+[^|]*\|\s*FAIL\s*\|/.test(md)) fail('palette check table still has FAIL rows');
}

if (fails.length) { fails.forEach((f) => console.log(`FAIL: ${f}`)); process.exit(1); }
console.log(`PASS: ${briefPath} (${rows.length} screens, P0=${p0}, brand=${hasBrand ? 'existing' : 'decided in brief'})`);
