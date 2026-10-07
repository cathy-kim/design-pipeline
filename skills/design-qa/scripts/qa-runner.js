#!/usr/bin/env node
/**
 * qa-runner.js — design-qa Layer B: Playwright 동적 QA
 *
 * Usage:
 *   node qa-runner.js <base-url> [--routes /,/about] [--out .design/qa]
 *        [--viewports 375,768,1280] [--themes light,dark] [--states] [--max-elements 12]
 *        [--only "<route>@<theme>@<width>,..."]
 *
 * 조합(route × theme × viewport)마다:
 *   - 전체 페이지 스크린샷 → <out>/screenshots/<route>-<theme>-<w>.png
 *   - responsive: 가로 overflow(FAIL), 터치 타깃 <24px(FAIL) / <44px(WARN, 모바일 폭만), 글자 <12px(WARN)
 *   - effects: 런타임 computed style 로 글래스모피즘·pill 버튼·그라디언트 보더·네온 글로우 재검출 (FAIL)
 *   - a11y: axe-core (가장 넓은 viewport 에서) critical/serious = FAIL, moderate/minor = WARN
 * --states: 인터랙티브 요소별 default/hover/focus/disabled 스크린샷 + focus 표시 유무(FAIL) 검사
 *
 * 결과: <out>/dynamic-results.json (items[], coverage, failingKeys). --only 로 재실행하면 해당 조합만 갱신.
 * 브라우저: playwright 기본 chromium. 이미 설치된 다른 Chromium 을 쓰려면 QA_CHROMIUM_PATH=<실행파일>.
 * exit 0 = FAIL 0건, 1 = FAIL 있음, 2 = 실행 오류.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = { routes: '/', out: '.design/qa', viewports: '375,768,1280', themes: 'light', states: false, 'max-elements': 12, only: '' };
let baseUrl = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { baseUrl = a; continue; }
  let [k, v] = a.slice(2).split(/=(.*)/s);
  if (k === 'states') { opt.states = true; continue; }
  if (v === undefined) v = argv[++i];
  if (!(k in opt)) { process.stderr.write(`unknown option --${k}\n`); process.exit(2); }
  opt[k] = v;
}
if (!baseUrl) {
  process.stderr.write('Usage: node qa-runner.js <base-url> [--routes /,/a] [--out .design/qa] [--viewports 375,768,1280] [--themes light,dark] [--states] [--only keys]\n');
  process.exit(2);
}
const routes = opt.routes.split(',').filter(Boolean);
const widths = opt.viewports.split(',').map(Number);
const themes = opt.themes.split(',');
const only = new Set(opt.only.split(',').filter(Boolean));
const outDir = path.resolve(opt.out);
const shotDir = path.join(outDir, 'screenshots');
fs.mkdirSync(path.join(shotDir, 'states'), { recursive: true });
const slug = (r) => (r === '/' ? 'home' : r.replace(/^\/|\/$/g, '').replace(/[^\w-]+/g, '_'));
const rel = (p) => path.relative(process.cwd(), p);

let AxeBuilder = null;
try {
  const mod = await import('@axe-core/playwright');
  AxeBuilder = mod.AxeBuilder || mod.default?.default || mod.default;
} catch {
  AxeBuilder = null;
}

const resultsPath = path.join(outDir, 'dynamic-results.json');
const prev = only.size && fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath, 'utf8')) : null;
const items = prev ? prev.items.filter((it) => !only.has(it.key)) : [];
const push = (key, check, status, detail, screenshot) => items.push({ key, check, status, detail, screenshot: screenshot || null });

const NO_MOTION = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';

// 페이지 안에서 실행: 반응형·효과 검사
function pageAudit() {
  const vw = window.innerWidth;
  const out = { overflow: [], smallTargets: [], tinyText: 0, glass: [], pill: [], gradBorder: [], glow: [] };
  const desc = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    return s;
  };
  const rgb = (str) => { const m = str.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const sat = (c) => {
    if (!c || c.a < 0.25) return false;
    const r = c.r / 255, g = c.g / 255, b = c.b / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return false;
    const s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    return s >= 0.5 && l >= 0.25 && l <= 0.85;
  };
  const docW = document.documentElement.scrollWidth;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (docW > vw + 1 && r.right > vw + 1 && out.overflow.length < 10) out.overflow.push(`${desc(el)} right=${Math.round(r.right)}`);
    // WCAG 2.5.8: 문장 속 인라인 링크는 타깃 크기 기준에서 면제
    const interactive = el.matches('a[href],button,input:not([type=hidden]),select,textarea,[role=button]') && !(el.tagName === 'A' && cs.display === 'inline');
    if (interactive && Math.min(r.width, r.height) < 44 && out.smallTargets.length < 20) out.smallTargets.push({ el: desc(el), w: Math.round(r.width), h: Math.round(r.height) });
    if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(cs.fontSize) < 12) out.tinyText++;
    const bf = cs.backdropFilter || cs.webkitBackdropFilter || '';
    if (/blur\(/.test(bf)) out.glass.push(desc(el));
    if (/gradient\(/.test(cs.borderImageSource)) out.gradBorder.push(desc(el));
    if (/gradient\(/.test(cs.backgroundImage) && /exclude|xor/.test(cs.maskComposite || cs.webkitMaskComposite || '')) out.gradBorder.push(desc(el));
    const isBtn = el.matches('button,[role=button],input[type=submit],input[type=button]');
    if (isBtn && r.width > r.height * 1.2) {
      const rad = parseFloat(cs.borderTopLeftRadius);
      if (rad >= r.height / 2 - 0.5) out.pill.push(`${desc(el)} radius=${cs.borderTopLeftRadius} h=${Math.round(r.height)}`);
    }
    for (const [prop, min] of [['boxShadow', 10], ['textShadow', 8]]) {
      const v = cs[prop];
      if (!v || v === 'none') continue;
      for (const layer of v.split(/,(?![^(]*\))/)) {
        const lens = (layer.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
        if ((lens[2] || 0) >= min && sat(rgb(layer))) { out.glow.push(`${desc(el)} ${prop}`); break; }
      }
    }
  }
  return out;
}

let browser;
try {
  browser = await chromium.launch(process.env.QA_CHROMIUM_PATH ? { executablePath: process.env.QA_CHROMIUM_PATH } : {});
} catch (e) {
  process.stderr.write(`[qa-runner] browser launch failed: ${e.message.split('\n')[0]}\n  fix: cd \${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts && npx playwright install chromium\n`);
  process.exit(2);
}
try {
  for (const route of routes) {
    for (const theme of themes) {
      for (const w of widths) {
        const key = `${route}@${theme}@${w}`;
        if (only.size && !only.has(key)) continue;
        const ctx = await browser.newContext({ viewport: { width: w, height: w <= 480 ? 812 : w <= 1024 ? 1024 : 900 }, colorScheme: theme === 'dark' ? 'dark' : 'light' });
        const page = await ctx.newPage();
        const consoleErrors = [];
        page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 160)));
        try {
          const resp = await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle', timeout: 30000 });
          await page.addStyleTag({ content: NO_MOTION });
          await page.waitForTimeout(300);
          const shot = path.join(shotDir, `${slug(route)}-${theme}-${w}.png`);
          await page.screenshot({ path: shot, fullPage: true });
          push(key, 'load', resp && resp.status() < 400 ? 'PASS' : 'FAIL', `HTTP ${resp ? resp.status() : 'n/a'}${consoleErrors.length ? `; console errors: ${consoleErrors.length}` : ''}`, rel(shot));

          const a = await page.evaluate(pageAudit);
          push(key, 'responsive.overflow', a.overflow.length ? 'FAIL' : 'PASS', a.overflow.join('; ') || 'no horizontal overflow');
          const tiny = a.smallTargets.filter((t) => Math.min(t.w, t.h) < 24);
          const small = w <= 768 ? a.smallTargets.filter((t) => Math.min(t.w, t.h) >= 24) : [];
          push(key, 'responsive.touch-target', tiny.length ? 'FAIL' : small.length ? 'WARN' : 'PASS', [...tiny, ...small].map((t) => `${t.el} ${t.w}x${t.h}`).join('; ') || 'ok');
          push(key, 'responsive.min-font', a.tinyText ? 'WARN' : 'PASS', a.tinyText ? `${a.tinyText} text nodes < 12px` : 'ok');
          push(key, 'effects.glassmorphism', a.glass.length ? 'FAIL' : 'PASS', a.glass.slice(0, 10).join('; ') || 'ok');
          push(key, 'effects.pill-button', a.pill.length ? 'FAIL' : 'PASS', a.pill.slice(0, 10).join('; ') || 'ok');
          push(key, 'effects.gradient-border', a.gradBorder.length ? 'FAIL' : 'PASS', a.gradBorder.slice(0, 10).join('; ') || 'ok');
          push(key, 'effects.neon-glow', a.glow.length ? 'FAIL' : 'PASS', a.glow.slice(0, 10).join('; ') || 'ok');

          if (w === Math.max(...widths)) {
            if (!AxeBuilder) push(key, 'a11y.axe', 'ERROR', '@axe-core/playwright 를 불러오지 못했다 — scripts 에서 npm ci');
            else {
              const ax = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
              const bad = ax.violations.filter((v) => ['critical', 'serious'].includes(v.impact));
              const soft = ax.violations.filter((v) => !['critical', 'serious'].includes(v.impact));
              const fmt = (v) => `${v.id}[${v.impact}] x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`;
              push(key, 'a11y.axe', bad.length ? 'FAIL' : soft.length ? 'WARN' : 'PASS', [...bad, ...soft].map(fmt).join('; ') || `${ax.passes.length} rules passed`);
            }
          }

          if (opt.states && w === Math.max(...widths)) {
            const handles = await page.$$('button, a[href], input:not([type=hidden]), select, textarea, [role=button]');
            let n = 0;
            for (const h of handles) {
              if (n >= Number(opt['max-elements'])) break;
              if (!(await h.isVisible())) continue;
              n++;
              const id = `${slug(route)}-${theme}-${n}`;
              const sk = `${key}#${n}`;
              const style = () => h.evaluate((el) => { const c = getComputedStyle(el); return [c.outlineStyle, c.outlineWidth, c.outlineColor, c.boxShadow, c.borderColor, c.backgroundColor].join('|'); });
              await h.scrollIntoViewIfNeeded();
              const disabled = await h.evaluate((el) => el.disabled === true || el.getAttribute('aria-disabled') === 'true');
              const shots = {};
              shots.default = path.join(shotDir, 'states', `${id}-default.png`);
              await h.screenshot({ path: shots.default });
              const base = await style();
              if (disabled) {
                const ok = await h.evaluate((el) => { const c = getComputedStyle(el); return parseFloat(c.opacity) < 1 || c.cursor === 'not-allowed'; });
                push(sk, 'state.disabled', ok ? 'PASS' : 'WARN', ok ? 'disabled 표시 있음' : 'disabled 인데 opacity/cursor 변화 없음', rel(shots.default));
                continue;
              }
              await h.hover();
              shots.hover = path.join(shotDir, 'states', `${id}-hover.png`);
              await h.screenshot({ path: shots.hover });
              await page.mouse.move(0, 0);
              await page.keyboard.press('Tab'); // focus-visible 휴리스틱을 키보드 모드로
              await h.focus();
              shots.focus = path.join(shotDir, 'states', `${id}-focus.png`);
              await h.screenshot({ path: shots.focus });
              const focused = await style();
              const label = await h.evaluate((el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.tagName).trim().slice(0, 40));
              push(sk, 'state.focus-visible', focused !== base ? 'PASS' : 'FAIL', `${label}: ${focused !== base ? 'focus 스타일 변화 있음' : 'focus 시 outline/shadow/border/bg 변화 없음'}`, rel(shots.focus));
              await h.evaluate((el) => el.blur());
            }
          }
        } catch (e) {
          push(key, 'load', 'ERROR', e.message.split('\n')[0]);
        } finally {
          await ctx.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}

const total = items.length;
const executed = items.filter((i) => i.status !== 'ERROR').length;
const fails = items.filter((i) => i.status === 'FAIL');
const failingKeys = [...new Set(items.filter((i) => i.status === 'FAIL' || i.status === 'ERROR').map((i) => i.key.split('#')[0]))];
const result = {
  baseUrl, routes, viewports: widths, themes,
  coverage: total ? Number(((executed / total) * 100).toFixed(1)) : 0,
  pass: fails.length === 0 && executed === total,
  counts: { PASS: items.filter((i) => i.status === 'PASS').length, FAIL: fails.length, WARN: items.filter((i) => i.status === 'WARN').length, ERROR: total - executed },
  failingKeys,
  items,
};
fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2));
process.stdout.write(JSON.stringify({ pass: result.pass, coverage: result.coverage, counts: result.counts, failingKeys, results: rel(resultsPath) }) + '\n');
process.exit(result.pass ? 0 : 1);
