/**
 * extract-all.ts
 *
 * URL mode of design-tokens. Loads a page in headless Chromium (Playwright),
 * injects the browser-context extractors, and writes:
 *   .design/tokens-evidence/raw.json              raw measured values
 *   .design/tokens-evidence/desktop.png, mobile.png
 *   .design/brand_config.draft.json               CONTRACT §5 shape (via to-brand-config.ts)
 *   .design/tokens-report.md
 *   .design/tokens-evidence/confidence.json
 *
 * Usage:
 *   npx tsx extract-all.ts --url https://example.com [--design-dir .design] [--id acme] [--name "Acme"]
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { writeOutputs, RawExtraction } from './to-brand-config.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES = ['extract-colors.js', 'extract-typography.js', 'extract-spacing.js', 'extract-components.js', 'extract-semantics.js']
  .map(f => fs.readFileSync(path.join(__dirname, f), 'utf-8'));

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function load(page: Page, url: string) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch {
    console.log('  Warning: network idle timeout, continuing with what rendered');
  }
  await page.waitForTimeout(2000);
}

async function extract(url: string, evidenceDir: string): Promise<RawExtraction> {
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, userAgent: UA });
    const page = await context.newPage();

    console.log(`[1/5] Loading ${url}`);
    await load(page, url);
    const desktopShot = path.join(evidenceDir, 'desktop.png');
    await page.screenshot({ path: desktopShot });

    console.log('[2/5] Injecting extractors');
    for (const src of MODULES) {
      await page.evaluate(script => { new Function(script)(); }, src);
    }

    console.log('[3/5] Colors + semantic roles');
    const colors = await page.evaluate(() => (window as any).extractColorsFromPage());
    const semantics = await page.evaluate(() => (window as any).extractSemanticsFromPage());

    console.log('[4/5] Typography + spacing + components');
    const typography = await page.evaluate(() => (window as any).extractTypographyFromPage());
    const spacing = await page.evaluate(() => (window as any).extractSpacingFromPage());
    const components = await page.evaluate(() => (window as any).extractComponentsFromPage());

    console.log('[5/5] Mobile screenshot');
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
    const mpage = await mobile.newPage();
    await load(mpage, url);
    const mobileShot = path.join(evidenceDir, 'mobile.png');
    await mpage.screenshot({ path: mobileShot });

    return {
      meta: { source: url, sourceType: 'url', extractedAt: new Date().toISOString(), colorMethod: 'computed' },
      colors: colors.colors,
      roles: semantics.roles,
      typography: typography.typography,
      typographyScale: typography.scale,
      spacing: spacing.spacing,
      spacingConfidence: spacing.analysis?.confidence,
      radii: semantics.radii,
      shadows: semantics.shadows,
      motion: semantics.motion,
      components: components.components,
      page: semantics.page,
      evidence: { screenshots: [desktopShot, mobileShot] },
      notes: [
        `elements scanned: ${colors.stats?.elementsScanned ?? 'n/a'}`,
        `component instances found: ${components.stats?.totalComponentsFound ?? 0}`,
      ],
    };
  } finally {
    await browser.close();
  }
}

function arg(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const url = arg(args, '--url');
  if (!url) {
    console.error('Usage: npx tsx extract-all.ts --url <URL> [--design-dir .design] [--id <id>] [--name <name>]');
    process.exit(1);
  }
  const designDir = arg(args, '--design-dir') || '.design';
  const evidenceDir = path.join(designDir, 'tokens-evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });

  const raw = await extract(url, evidenceDir);
  fs.writeFileSync(path.join(evidenceDir, 'raw.json'), JSON.stringify(raw, null, 2) + '\n');

  const r = writeOutputs(raw, designDir, { id: arg(args, '--id'), name: arg(args, '--name') });
  console.log(`\nraw:    ${path.join(evidenceDir, 'raw.json')}`);
  console.log(`draft:  ${path.join(designDir, 'brand_config.draft.json')}`);
  console.log(`report: ${path.join(designDir, 'tokens-report.md')}`);
  console.log(`confidence: ${JSON.stringify(r.confidence)}`);
  console.log(r.promotion.eligible ? 'promotion: eligible' : `promotion: needs confirmation (${r.promotion.why.join('; ')})`);
}

main().catch(err => {
  console.error('Extraction failed:', err);
  process.exit(1);
});
