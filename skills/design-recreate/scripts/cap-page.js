#!/usr/bin/env node
/**
 * cap-page.js — single-viewport page capture with reveal/intro bypass.
 *
 * Replaces the per-project cap-mobile.js / cap-localhost-temp.js one-offs.
 * Use it for pages whose content is hidden behind scroll-reveal classes or intro overlays,
 * and for capturing the local recreation at the same viewport as the reference.
 *
 * Usage:
 *   node cap-page.js <url> <output.png> [options]
 *
 * Options:
 *   --viewport=WxH      Viewport size (default: 1440x900)
 *   --scale=N           deviceScaleFactor (default: 1)
 *   --wait=MS           Extra wait after load before DOM tweaks (default: 1000)
 *   --reveal=SELECTOR   Add class "is-visible" to every match (repeatable)
 *   --remove=SELECTOR   Remove every match from the DOM, e.g. intro overlays (repeatable)
 *   --fold              Capture only the first viewport (default: full page)
 *
 * Output (stdout): JSON { success, output, viewport, fullPage }
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

function parseArgs(argv) {
  const opts = { viewport: { width: 1440, height: 900 }, scale: 1, wait: 1000, reveal: [], remove: [], fold: false };
  const positional = [];
  for (const arg of argv) {
    if (arg.startsWith('--viewport=')) {
      const [w, h] = arg.split('=')[1].split('x').map(Number);
      if (!w || !h) throw new Error(`Invalid --viewport: ${arg}`);
      opts.viewport = { width: w, height: h };
    } else if (arg.startsWith('--scale=')) opts.scale = Number(arg.split('=')[1]) || 1;
    else if (arg.startsWith('--wait=')) opts.wait = Number(arg.split('=')[1]) || 0;
    else if (arg.startsWith('--reveal=')) opts.reveal.push(arg.slice('--reveal='.length));
    else if (arg.startsWith('--remove=')) opts.remove.push(arg.slice('--remove='.length));
    else if (arg === '--fold') opts.fold = true;
    else if (!arg.startsWith('--')) positional.push(arg);
  }
  if (positional.length < 2) {
    console.error('Usage: node cap-page.js <url> <output.png> [--viewport=WxH] [--scale=N] [--wait=MS] [--reveal=SEL] [--remove=SEL] [--fold]');
    process.exit(2);
  }
  opts.url = positional[0];
  opts.output = path.resolve(positional[1]);
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(path.dirname(opts.output), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: opts.viewport, deviceScaleFactor: opts.scale });
    const page = await ctx.newPage();
    await page.goto(opts.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(opts.wait);
    if (opts.reveal.length || opts.remove.length) {
      await page.evaluate(({ reveal, remove }) => {
        reveal.forEach(sel => document.querySelectorAll(sel).forEach(el => el.classList.add('is-visible')));
        remove.forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()));
      }, { reveal: opts.reveal, remove: opts.remove });
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.screenshot({ path: opts.output, fullPage: !opts.fold });
    console.log(JSON.stringify({ success: true, output: opts.output, viewport: opts.viewport, fullPage: !opts.fold }));
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.log(JSON.stringify({ success: false, error: String(err && err.message || err) }));
  process.exit(1);
});
