#!/usr/bin/env node
/**
 * Detect Layout Grid Script
 * Extracts CSS grid/flexbox properties from a live web page using Playwright.
 * Classifies the primary layout grid into one of 7 types.
 * Part of the Antigravity AI Workflow - Website Mode
 *
 * Usage:
 *   node detect-layout-grid.js <url> [options]
 *
 * Options:
 *   --viewport=desktop   Viewport preset: desktop, tablet, mobile (default: desktop)
 *   --all-viewports      Check desktop, tablet, mobile viewports
 *   --output=grid.json   Save report to file
 *
 * Examples:
 *   node detect-layout-grid.js https://example.com
 *   node detect-layout-grid.js https://example.com --all-viewports
 *   node detect-layout-grid.js https://example.com --viewport=mobile --output=report.json
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Viewport presets
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 }
};

// Grid type classification constants
const GOLDEN_RATIO = 1.618;
const GOLDEN_TOLERANCE = 0.15;

/**
 * Evaluates a page to find all grid and flexbox containers and their computed properties.
 * Runs inside the browser context via page.evaluate().
 */
const DETECT_GRID_SCRIPT = () => {
  const containers = [];
  const allElements = document.querySelectorAll('*');

  for (const el of allElements) {
    const computed = window.getComputedStyle(el);
    const display = computed.display;

    if (display === 'grid' || display === 'inline-grid') {
      const rect = el.getBoundingClientRect();
      containers.push({
        type: 'grid',
        tag: el.tagName.toLowerCase(),
        className: (el.className || '').toString().substring(0, 80),
        id: el.id || null,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        area: Math.round(rect.width * rect.height),
        properties: {
          gridTemplateColumns: computed.gridTemplateColumns,
          gridTemplateRows: computed.gridTemplateRows,
          gridTemplateAreas: computed.gridTemplateAreas,
          gap: computed.gap,
          rowGap: computed.rowGap,
          columnGap: computed.columnGap,
          gridAutoFlow: computed.gridAutoFlow,
          gridAutoColumns: computed.gridAutoColumns,
          gridAutoRows: computed.gridAutoRows
        },
        childCount: el.children.length
      });
    } else if (display === 'flex' || display === 'inline-flex') {
      const rect = el.getBoundingClientRect();
      // Only include flex containers that are reasonably sized (not tiny utility elements)
      if (rect.width > 100 && rect.height > 50) {
        containers.push({
          type: 'flex',
          tag: el.tagName.toLowerCase(),
          className: (el.className || '').toString().substring(0, 80),
          id: el.id || null,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          area: Math.round(rect.width * rect.height),
          properties: {
            flexDirection: computed.flexDirection,
            flexWrap: computed.flexWrap,
            justifyContent: computed.justifyContent,
            alignItems: computed.alignItems,
            gap: computed.gap
          },
          childCount: el.children.length
        });
      }
    }
  }

  return containers;
};

/**
 * Classifies a grid container into one of 7 grid types based on its properties.
 *
 * Types:
 *   Regular       - Equal-width columns with uniform gutters
 *   Golden Ratio  - Column ratio approximately 1:1.618
 *   Modular       - Uses grid-template-areas
 *   Bento         - Mixed span sizes in children
 *   Asymmetric    - Intentionally unequal but not golden
 *   Hierarchical  - Nested grid structures
 *   Freeform      - Does not match other patterns
 *
 * @param {Object} container - A detected grid container object
 * @returns {{ type: string, confidence: number, reason: string }}
 */
function classifyGridType(container) {
  if (container.type !== 'grid') {
    return { type: 'Freeform', confidence: 0.3, reason: 'Flexbox layout, not CSS Grid' };
  }

  const props = container.properties;

  // Check for grid-template-areas (Modular or Bento)
  if (props.gridTemplateAreas && props.gridTemplateAreas !== 'none') {
    return {
      type: 'Modular',
      confidence: 0.85,
      reason: `Uses grid-template-areas: ${props.gridTemplateAreas.substring(0, 60)}`
    };
  }

  // Parse column widths from gridTemplateColumns
  const colValues = parseTrackValues(props.gridTemplateColumns);

  if (colValues.length === 0) {
    return { type: 'Freeform', confidence: 0.4, reason: 'No explicit column definitions' };
  }

  // Check for golden ratio (2-column layout)
  if (colValues.length === 2) {
    const ratio = Math.max(colValues[0], colValues[1]) / Math.min(colValues[0], colValues[1]);
    if (Math.abs(ratio - GOLDEN_RATIO) < GOLDEN_TOLERANCE) {
      return {
        type: 'Golden Ratio',
        confidence: 0.9,
        reason: `Column ratio ${ratio.toFixed(3)} is near phi (1.618)`
      };
    }
  }

  // Check for equal-width columns (Regular)
  if (colValues.length >= 2) {
    const avg = colValues.reduce((s, v) => s + v, 0) / colValues.length;
    const allEqual = colValues.every(v => Math.abs(v - avg) / avg < 0.05);
    if (allEqual) {
      return {
        type: 'Regular',
        confidence: 0.9,
        reason: `${colValues.length} equal-width columns (${Math.round(avg)}px each)`
      };
    }
  }

  // Check for mixed span sizes (Bento)
  if (colValues.length >= 3) {
    const uniqueWidths = new Set(colValues.map(v => Math.round(v)));
    if (uniqueWidths.size >= 2 && uniqueWidths.size < colValues.length) {
      return {
        type: 'Bento',
        confidence: 0.7,
        reason: `Mixed column widths: ${colValues.map(v => Math.round(v)).join(', ')}px`
      };
    }
  }

  // Check for intentionally unequal columns (Asymmetric)
  if (colValues.length >= 2) {
    return {
      type: 'Asymmetric',
      confidence: 0.6,
      reason: `Unequal columns: ${colValues.map(v => Math.round(v)).join(', ')}px`
    };
  }

  return { type: 'Freeform', confidence: 0.4, reason: 'Does not match a specific pattern' };
}

/**
 * Parses numeric pixel values from a CSS grid-template-columns string.
 * Handles values like "200px 1fr 300px" or "repeat(3, 1fr)".
 *
 * @param {string} trackStr - Computed gridTemplateColumns value
 * @returns {number[]} Array of pixel widths
 */
function parseTrackValues(trackStr) {
  if (!trackStr || trackStr === 'none') return [];

  // Computed styles resolve to pixel values, e.g. "200px 400px 200px"
  const matches = trackStr.match(/[\d.]+px/g);
  if (!matches) return [];

  return matches.map(m => parseFloat(m));
}

/**
 * Detects grid and flexbox layouts on a page at a given viewport.
 *
 * @param {string} url - URL to analyze
 * @param {{ width: number, height: number }} viewport - Viewport dimensions
 * @returns {Promise<Object>} Detection results for this viewport
 */
async function detectAtViewport(page, url, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Allow layout to settle
  await page.waitForTimeout(1000);

  const containers = await page.evaluate(DETECT_GRID_SCRIPT);

  // Sort by area (largest first) - the main layout grid is usually the largest
  containers.sort((a, b) => b.area - a.area);

  // Classify the primary grid (largest container)
  let primaryClassification = null;
  if (containers.length > 0) {
    primaryClassification = classifyGridType(containers[0]);
  }

  return {
    viewport: `${viewport.width}x${viewport.height}`,
    totalContainers: containers.length,
    gridContainers: containers.filter(c => c.type === 'grid').length,
    flexContainers: containers.filter(c => c.type === 'flex').length,
    primaryGrid: containers.length > 0 ? containers[0] : null,
    primaryClassification,
    containers: containers.slice(0, 20) // Limit to top 20 by area
  };
}

/**
 * Main detection function. Analyzes a URL across one or more viewports.
 *
 * @param {string} url - URL to analyze
 * @param {Object} options - Detection options
 * @returns {Promise<Object>} Full detection report
 */
async function detectLayoutGrid(url, options = {}) {
  const {
    viewport = 'desktop',
    allViewports = false,
    output = null
  } = options;

  console.log(`\nDetect Layout Grid`);
  console.log(`  URL: ${url}`);
  console.log(`  Viewports: ${allViewports ? 'all (desktop, tablet, mobile)' : viewport}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const report = {
    url,
    timestamp: new Date().toISOString(),
    viewports: {}
  };

  try {
    if (allViewports) {
      for (const [name, vp] of Object.entries(VIEWPORTS)) {
        console.log(`  Checking ${name} (${vp.width}x${vp.height})...`);
        report.viewports[name] = await detectAtViewport(page, url, vp);
        console.log(`    Found ${report.viewports[name].totalContainers} layout containers`);
        if (report.viewports[name].primaryClassification) {
          const cls = report.viewports[name].primaryClassification;
          console.log(`    Primary grid: ${cls.type} (${Math.round(cls.confidence * 100)}% confidence)`);
        }
      }

      // Compute responsive changes
      report.responsiveChanges = computeResponsiveChanges(report.viewports);
    } else {
      const vp = VIEWPORTS[viewport] || VIEWPORTS.desktop;
      report.viewports[viewport] = await detectAtViewport(page, url, vp);
      const result = report.viewports[viewport];
      console.log(`  Found ${result.totalContainers} layout containers`);
      if (result.primaryClassification) {
        const cls = result.primaryClassification;
        console.log(`  Primary grid: ${cls.type} (${Math.round(cls.confidence * 100)}% confidence)`);
      }
    }
  } finally {
    await browser.close();
  }

  // Save report if output path specified
  if (output) {
    const outputPath = path.resolve(output);
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n  [ok] Report saved: ${outputPath}`);
  }

  console.log('');
  return report;
}

/**
 * Computes responsive layout changes across multiple viewport results.
 *
 * @param {Object} viewports - Map of viewport name to detection results
 * @returns {Object} Summary of responsive changes
 */
function computeResponsiveChanges(viewports) {
  const names = Object.keys(viewports);
  const changes = [];

  for (let i = 0; i < names.length - 1; i++) {
    const from = names[i];
    const to = names[i + 1];
    const fromResult = viewports[from];
    const toResult = viewports[to];

    const change = {
      from,
      to,
      containerCountChange: toResult.totalContainers - fromResult.totalContainers,
      gridTypeChanged: false
    };

    if (fromResult.primaryClassification && toResult.primaryClassification) {
      change.gridTypeChanged =
        fromResult.primaryClassification.type !== toResult.primaryClassification.type;
      change.fromType = fromResult.primaryClassification.type;
      change.toType = toResult.primaryClassification.type;
    }

    changes.push(change);
  }

  return changes;
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Detect Layout Grid - Antigravity Website Mode

Usage:
  node detect-layout-grid.js <url> [options]

Options:
  --viewport=desktop   Viewport preset: desktop, tablet, mobile (default: desktop)
  --all-viewports      Check all three viewports
  --output=grid.json   Save report to file

Examples:
  node detect-layout-grid.js https://example.com
  node detect-layout-grid.js https://example.com --all-viewports
  node detect-layout-grid.js https://example.com --viewport=mobile --output=report.json
    `);
    process.exit(0);
  }

  const url = args[0];
  const options = {};

  args.slice(1).forEach(arg => {
    if (arg.startsWith('--viewport=')) options.viewport = arg.split('=')[1];
    if (arg === '--all-viewports') options.allViewports = true;
    if (arg.startsWith('--output=')) options.output = arg.split('=')[1];
  });

  detectLayoutGrid(url, options)
    .then(report => {
      const primaryViewport = Object.keys(report.viewports)[0];
      const result = report.viewports[primaryViewport];
      if (result.primaryClassification) {
        console.log(`Done: ${result.primaryClassification.type} grid detected (${result.totalContainers} containers)`);
      } else {
        console.log(`Done: No CSS grid/flex containers found`);
      }
    })
    .catch(error => {
      console.error('Error: Layout detection failed:', error.message);
      process.exit(1);
    });
}

module.exports = { detectLayoutGrid, classifyGridType, VIEWPORTS };
