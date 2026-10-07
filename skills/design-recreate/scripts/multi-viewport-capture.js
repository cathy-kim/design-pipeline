#!/usr/bin/env node

/**
 * Multi-Viewport Capture Script
 *
 * Captures screenshots across Desktop, Tablet, and Mobile viewports.
 * Part of the Antigravity AI Workflow - Phase 1: Analysis
 *
 * Usage:
 *   node multi-viewport-capture.js <url> [output-dir]
 *
 * Examples:
 *   node multi-viewport-capture.js https://example.com
 *   node multi-viewport-capture.js https://example.com ./captures
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Viewport configurations matching Antigravity spec
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080, name: 'desktop' },
  laptop: { width: 1440, height: 900, name: 'laptop' },
  tablet: { width: 768, height: 1024, name: 'tablet' },
  mobile: { width: 375, height: 812, name: 'mobile' }
};

/**
 * Capture screenshots across all viewports
 */
async function captureMultiViewport(url, outputDir = './captures') {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = Date.now();
  const urlSlug = new URL(url).hostname.replace(/\./g, '-');

  console.log(`\n📸 Multi-Viewport Capture: ${url}\n`);

  for (const [key, viewport] of Object.entries(VIEWPORTS)) {
    console.log(`  Capturing ${viewport.name} (${viewport.width}x${viewport.height})...`);

    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: key === 'mobile' ? 2 : 1,
      userAgent: key === 'mobile'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    try {
      // Navigate and wait for network idle
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Additional wait for any lazy-loaded content
      await page.waitForTimeout(1000);

      // Handle common cookie banners
      await dismissOverlays(page);

      // Capture full page screenshot
      const filename = `${urlSlug}-${viewport.name}-${timestamp}.png`;
      const filepath = path.join(outputDir, filename);

      await page.screenshot({
        path: filepath,
        fullPage: true
      });

      // Also capture above-the-fold
      const foldFilename = `${urlSlug}-${viewport.name}-fold-${timestamp}.png`;
      const foldFilepath = path.join(outputDir, foldFilename);

      await page.screenshot({
        path: foldFilepath,
        fullPage: false
      });

      // Extract viewport-specific metadata
      const metadata = await page.evaluate(() => ({
        documentHeight: document.documentElement.scrollHeight,
        documentWidth: document.documentElement.scrollWidth,
        title: document.title,
        hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth
      }));

      results.push({
        viewport: viewport.name,
        dimensions: { width: viewport.width, height: viewport.height },
        fullPage: filepath,
        aboveFold: foldFilepath,
        metadata
      });

      console.log(`    ✓ Saved: ${filename}`);
    } catch (error) {
      console.error(`    ✗ Failed: ${error.message}`);
      results.push({
        viewport: viewport.name,
        error: error.message
      });
    }

    await context.close();
  }

  await browser.close();

  // Generate summary report
  const report = {
    url,
    timestamp: new Date(timestamp).toISOString(),
    captures: results,
    outputDir: path.resolve(outputDir)
  };

  const reportPath = path.join(outputDir, `capture-report-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📋 Report saved: ${reportPath}\n`);

  return report;
}

/**
 * Attempt to dismiss common overlay elements
 */
async function dismissOverlays(page) {
  const dismissSelectors = [
    // Cookie banners
    '[class*="cookie"] button[class*="accept"]',
    '[class*="cookie"] button[class*="agree"]',
    '[id*="cookie"] button',
    '[class*="consent"] button[class*="accept"]',
    // Generic modals
    '[class*="modal"] [class*="close"]',
    '[class*="popup"] [class*="close"]',
    'button[aria-label="Close"]',
    'button[aria-label="Dismiss"]'
  ];

  for (const selector of dismissSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        await page.waitForTimeout(300);
      }
    } catch {
      // Ignore errors from dismiss attempts
    }
  }
}

/**
 * Capture with computed styles for each viewport
 */
async function captureWithStyles(url, selectors = ['body', 'header', 'main', 'footer']) {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const [key, viewport] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle' });

    results[viewport.name] = await page.evaluate((sels) => {
      const styles = {};
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (el) {
          const computed = window.getComputedStyle(el);
          styles[sel] = {
            display: computed.display,
            flexDirection: computed.flexDirection,
            gridTemplateColumns: computed.gridTemplateColumns,
            padding: computed.padding,
            margin: computed.margin,
            fontSize: computed.fontSize,
            width: computed.width,
            maxWidth: computed.maxWidth
          };
        }
      }
      return styles;
    }, selectors);

    await context.close();
  }

  await browser.close();
  return results;
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Multi-Viewport Capture - Antigravity Phase 1

Usage:
  node multi-viewport-capture.js <url> [output-dir]

Viewports:
  - Desktop: 1920x1080
  - Laptop:  1440x900
  - Tablet:  768x1024
  - Mobile:  375x812

Examples:
  node multi-viewport-capture.js https://example.com
  node multi-viewport-capture.js https://linear.app ./my-captures
    `);
    process.exit(0);
  }

  const url = args[0];
  const outputDir = args[1] || './captures';

  captureMultiViewport(url, outputDir)
    .then(report => {
      console.log('Capture Summary:');
      console.log(`  Total viewports: ${report.captures.length}`);
      console.log(`  Successful: ${report.captures.filter(c => !c.error).length}`);
      console.log(`  Failed: ${report.captures.filter(c => c.error).length}`);
    })
    .catch(error => {
      console.error('Capture failed:', error.message);
      process.exit(1);
    });
}

module.exports = { captureMultiViewport, captureWithStyles, VIEWPORTS };
