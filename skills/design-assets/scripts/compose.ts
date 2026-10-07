#!/usr/bin/env -S npx tsx
/**
 * compose.ts — 템플릿 조합 + 렌더 (card · ad · detail-page · moodboard).
 *
 * templates/<mode>.html (mustache 부분집합) + templates/base.css 에
 * brand_config 의 3색·폰트·radius 를 CSS 변수로 주입하고, content JSON 의 문구·이미지를 채워
 * .design/assets/<mode>/<slug>/ 에 HTML 과 PNG 를 쓴다. 캔버스는 assets.canvasSizes 에서 읽는다.
 *
 * Usage
 *   npx tsx compose.ts --mode card        --content .design/assets/card/content.json
 *   npx tsx compose.ts --mode ad          --content ad.json
 *   npx tsx compose.ts --mode detail-page --content pdp.json
 *   npx tsx compose.ts --mode moodboard   --content moodboard.json
 *   --no-render   HTML 만 쓰고 PNG 렌더는 건너뛴다
 *
 * content 스키마는 references/card-templates.md 참고.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type AssetMode, type BrandConfig, type Canvas,
  assertMode, brandName, canvas, designDir, fail, fontFaceCss, fonts, loadBrand, logoPath,
  imagePixels, modeDir, palette, pillWaiver, parseArgs, radius, recordManifest, rel, sha256, slug, str,
} from './lib.ts';

const TEMPLATES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const COMPOSABLE: AssetMode[] = ['card', 'ad', 'detail-page', 'moodboard'];
const DEFAULT_CANVAS: Record<string, string> = {
  card: 'instagram-feed', ad: 'ad-square', 'detail-page': 'detail-page', moodboard: 'moodboard',
};

// ---------------------------------------------------------------------------
// mustache 부분집합: {{x}} {{{x}}} {{#x}}..{{/x}} {{^x}}..{{/x}} {{.}} 점 경로
// ---------------------------------------------------------------------------

type Ctx = unknown;

function lookup(name: string, stack: Ctx[]): unknown {
  if (name === '.') return stack[stack.length - 1];
  const keys = name.split('.');
  for (let i = stack.length - 1; i >= 0; i--) {
    let cur = stack[i] as Record<string, unknown> | undefined;
    if (cur === null || typeof cur !== 'object' || !(keys[0] in cur)) continue;
    let v: unknown = cur;
    for (const k of keys) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
    return v;
  }
  return undefined;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const truthy = (v: unknown) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

export function render(tpl: string, stack: Ctx[]): string {
  const sectioned = tpl.replace(/\{\{([#^])\s*([\w.]+)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g, (_m, kind, name, inner) => {
    const v = lookup(name, stack);
    if (kind === '^') return truthy(v) ? '' : render(inner, stack);
    if (!truthy(v)) return '';
    if (Array.isArray(v)) return v.map((item) => render(inner, [...stack, item])).join('');
    if (typeof v === 'object') return render(inner, [...stack, v]);
    return render(inner, stack);
  });
  return sectioned
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_m, n) => String(lookup(n, stack) ?? ''))
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, n) => esc(String(lookup(n, stack) ?? '')));
}

// ---------------------------------------------------------------------------
// 브랜드 → CSS 변수
// ---------------------------------------------------------------------------

/** --u = 캔버스 폭 / 설계 기준 폭 (상세페이지 860, 나머지 1080). 템플릿 px 값은 전부 calc(Npx*var(--u)). */
function brandCss(cfg: BrandConfig, dir: string, c: Canvas, baseWidth: number): string {
  const p = palette(cfg);
  const f = fonts(cfg);
  const rCard = radius(cfg, 'card', ['md', 'sm']);
  const rControl = radius(cfg, 'button', ['sm']);
  const rTag = radius(cfg, 'badge', ['sm']); // 배지는 button 예외의 범위 밖
  const u = c.width / baseWidth;
  return `${fontFaceCss(cfg, dir)}
:root{
  --c-primary:${p.primary};--c-accent:${p.accent};
  --c-bg:${p.bg};--c-fg:${p.fg};--c-muted:${p.muted};
  --f-head:${f.heading};--f-body:${f.body};
  --r-card:${rCard}px;--r-control:${rControl}px;--r-tag:${rTag}px;
  --w:${c.width}px;--h:${c.height ? `${c.height}px` : 'auto'};--u:${u};
}`;
}

/** content 안의 상대경로 이미지(존재하는 파일)를 file:// URL 로 바꾼다. */
function resolveImages(v: unknown, base: string, used: string[]): unknown {
  if (typeof v === 'string' && /\.(png|jpe?g|webp|svg|gif)$/i.test(v) && !/^(https?|file|data):/.test(v)) {
    const abs = path.resolve(base, v);
    if (fs.existsSync(abs)) {
      used.push(abs);
      return `file://${abs}`;
    }
    console.warn(`WARN: image not found: ${abs}`);
    return v;
  }
  if (Array.isArray(v)) return v.map((x) => resolveImages(x, base, used));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveImages(x, base, used)]));
  }
  return v;
}

// ---------------------------------------------------------------------------
// 모드별 페이지 목록
// ---------------------------------------------------------------------------

interface Page { name: string; canvas: Canvas; ctx: Record<string, unknown> }

function pagesFor(mode: AssetMode, cfg: BrandConfig, content: Record<string, unknown>): Page[] {
  const pal = palette(cfg);
  const common = { brandName: brandName(cfg), palette: pal };
  if (mode === 'card') {
    const c = canvas(cfg, String(content.canvas ?? DEFAULT_CANVAS.card));
    const pages = (content.pages as Array<Record<string, unknown>>) ?? [];
    if (pages.length === 0) throw new Error('card content 에 pages[] 가 없습니다');
    const isStory = (c.height ?? 0) / c.width > 1.7;
    return pages.map((pg, i) => {
      const role = String(pg.role ?? (i === 0 ? 'cover' : i === pages.length - 1 ? 'cta' : 'content'));
      return {
        name: `card-${String(i + 1).padStart(2, '0')}`,
        canvas: c,
        ctx: {
          ...common, ...pg, role, isStory,
          isCover: role === 'cover', isContent: role === 'content', isData: role === 'data', isCta: role === 'cta',
          index: i + 1, total: pages.length,
        },
      };
    });
  }
  if (mode === 'ad') {
    const keys = (content.canvases as string[]) ?? [DEFAULT_CANVAS.ad];
    return keys.map((k) => {
      const c = canvas(cfg, k);
      const h = c.height ?? c.width;
      const layout = c.width / h > 1.3 ? 'landscape' : h / c.width > 1.3 ? 'portrait' : 'square';
      return { name: k, canvas: c, ctx: { ...common, ...content, layout } };
    });
  }
  if (mode === 'detail-page') {
    const c = canvas(cfg, String(content.canvas ?? DEFAULT_CANVAS['detail-page']));
    const sections = ((content.sections as Array<Record<string, unknown>>) ?? []).map((s) => ({
      ...s,
      isBenefits: s.type === 'benefits', isSteps: s.type === 'steps', isSpecs: s.type === 'specs',
      isReviews: s.type === 'reviews', isFaq: s.type === 'faq',
      // 항목에 키를 명시해 두어 상위 섹션의 image/title 을 물려받지 않게 한다
      items: ((s.items as Array<Record<string, unknown>>) ?? []).map((it, i) => ({ image: null, title: '', body: '', rating: null, ...it, n: i + 1 })),
      image: s.image ?? null, eyebrow: s.eyebrow ?? null, body: s.body ?? null,
    }));
    return [{ name: 'detail-page', canvas: c, ctx: { ...common, ...content, sections } }];
  }
  // moodboard
  const c = canvas(cfg, String(content.canvas ?? DEFAULT_CANVAS.moodboard));
  const f = fonts(cfg);
  return [{
    name: 'moodboard', canvas: c,
    ctx: {
      ...common, ...content, fontHeading: f.heading.split(',')[0].replace(/['"]/g, '').trim(), fontBody: f.body.split(',')[0].replace(/['"]/g, '').trim(),
      mood: (cfg.brand?.mood ?? []).join(' · '),
      swatches: [
        { label: 'Primary', hex: pal.primary }, { label: 'Accent', hex: pal.accent },
        { label: 'Neutral', hex: pal.bg }, { label: 'Neutral', hex: pal.fg },
      ],
    },
  }];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const dir = designDir(args);
  const cfg = loadBrand(dir);
  const mode = assertMode(str(args, 'mode'));
  if (!COMPOSABLE.includes(mode)) throw new Error(`compose 는 ${COMPOSABLE.join(' | ')} 만 지원합니다`);
  const contentPath = str(args, 'content');
  if (!contentPath) throw new Error('--content <json> 이 필요합니다');
  const contentAbs = path.resolve(contentPath);
  const used: string[] = [];
  const content = resolveImages(JSON.parse(fs.readFileSync(contentAbs, 'utf-8')), path.dirname(contentAbs), used) as Record<string, unknown>;

  const logo = logoPath(cfg, dir);
  if (logo) used.push(logo);
  const outDir = path.join(modeDir(dir, mode), slug(String(content.slug ?? content.title ?? content.productName ?? mode)));
  fs.mkdirSync(outDir, { recursive: true });

  const tpl = fs.readFileSync(path.join(TEMPLATES, `${mode}.html`), 'utf-8');
  const baseCss = fs.readFileSync(path.join(TEMPLATES, 'base.css'), 'utf-8');
  const pages = pagesFor(mode, cfg, content);
  // 템플릿이 버튼(--r-control)을 쓰는 경우에만 승인된 pill 예외를 기록한다
  const waived = pillWaiver(cfg, 'button', radius(cfg, 'button', ['sm']));
  if (waived) console.log(`WAIVED ${waived.rule} (${waived.scope}): ${waived.reason}`);

  const htmlFiles: Array<{ page: Page; file: string; waived: ReturnType<typeof pillWaiver> }> = [];
  for (const page of pages) {
    const ctx = { ...page.ctx, logo: logo ? `file://${logo}` : '', css: `${brandCss(cfg, dir, page.canvas, mode === 'detail-page' ? 860 : 1080)}\n${baseCss}` };
    const file = path.join(outDir, `${page.name}.html`);
    const html = render(tpl, [ctx]);
    fs.writeFileSync(file, html);
    // 버튼이 실제로 그려진 파일에만 waived 를 남긴다
    const pageWaived = waived && /class="btn"/.test(html) ? waived : null;
    htmlFiles.push({ page, file, waived: pageWaived });
    recordManifest(dir, cfg, {
      file: rel(dir, file), mode, kind: 'code', prompt: null, model: null, seed: null,
      size: { width: page.canvas.width, height: page.canvas.height ?? null }, sources: used.map((u) => rel(dir, u)), waived: pageWaived,
    });
  }

  if (args['no-render']) {
    console.log(`HTML only: ${outDir}`);
    return;
  }

  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({ headless: true, args: ['--allow-file-access-from-files'] });
  try {
    for (const { page, file, waived: pageWaived } of htmlFiles) {
      const tab = await browser.newPage();
      await tab.setViewport({ width: page.canvas.width, height: page.canvas.height ?? 1200, deviceScaleFactor: 1 });
      await tab.goto(`file://${file}`, { waitUntil: 'networkidle0' });
      await tab.evaluate('document.fonts.ready');
      const png = file.replace(/\.html$/, '.png');
      if (page.canvas.height) {
        await tab.screenshot({ path: png as `${string}.png`, clip: { x: 0, y: 0, width: page.canvas.width, height: page.canvas.height } });
      } else {
        await tab.screenshot({ path: png as `${string}.png`, fullPage: true });
      }
      const dims = await tab.evaluate('[document.documentElement.scrollWidth, document.documentElement.scrollHeight]') as [number, number];
      await tab.close();
      recordManifest(dir, cfg, {
        file: rel(dir, png), mode, kind: 'render', prompt: null, model: 'puppeteer', seed: null,
        size: { width: page.canvas.width, height: page.canvas.height ?? dims[1] }, pixels: imagePixels(png),
        sources: [rel(dir, file), ...used.map((u) => rel(dir, u))], sha256: sha256(png), waived: pageWaived,
      });
      console.log(`OK ${png}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(fail);
