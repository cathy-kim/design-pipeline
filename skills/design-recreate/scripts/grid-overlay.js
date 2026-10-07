#!/usr/bin/env node
/**
 * Grid Overlay Script
 * Draws grid lines on an image based on detected or specified grid structure.
 * Supports regular, golden-ratio, and bento grid types.
 * Part of the Antigravity AI Workflow - Grid Visualization
 *
 * Usage:
 *   node grid-overlay.js <input-image> <output-image> [options]
 *
 * Options:
 *   --cols=12       Number of columns (default: 12)
 *   --gutter=24     Gutter width in px (default: 24)
 *   --margin=64     Margin width in px (default: 64)
 *   --type=regular  Grid type: regular, golden, bento (default: regular)
 *
 * Examples:
 *   node grid-overlay.js screenshot.png overlay.png
 *   node grid-overlay.js design.jpg overlay.png --cols=6 --gutter=16 --margin=32
 *   node grid-overlay.js layout.png overlay.png --type=golden
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Color constants for overlay elements
const COLORS = {
  column: 'rgba(255, 0, 0, 0.4)',
  gutter: 'rgba(0, 0, 255, 0.15)',
  margin: 'rgba(0, 255, 0, 0.1)',
  label: 'rgba(255, 255, 255, 0.9)',
  labelBg: 'rgba(0, 0, 0, 0.5)'
};

/**
 * Generates column positions for a regular (equal-width) grid.
 */
function buildRegularGrid(width, cols, gutter, margin) {
  const availableWidth = width - margin * 2 + gutter;
  const colWidth = (availableWidth - gutter * cols) / cols;
  const columns = [];

  for (let i = 0; i < cols; i++) {
    const x = margin + i * (colWidth + gutter);
    columns.push({ x, width: colWidth });
  }

  return { columns, colWidth, type: 'regular' };
}

/**
 * Generates column positions for a golden-ratio (1:1.618) two-column split.
 */
function buildGoldenGrid(width, gutter, margin) {
  const availableWidth = width - margin * 2 - gutter;
  const phi = 1.618;
  const leftWidth = Math.floor(availableWidth / (1 + phi));
  const rightWidth = availableWidth - leftWidth;

  const columns = [
    { x: margin, width: leftWidth },
    { x: margin + leftWidth + gutter, width: rightWidth }
  ];

  return { columns, colWidth: null, type: 'golden' };
}

/**
 * Generates column positions for a bento-style grid with mixed cell sizes.
 * Uses a base unit derived from a 12-column grid and maps span definitions.
 *
 * @param {number} width - Image width
 * @param {number} gutter - Gutter width in pixels
 * @param {number} margin - Margin width in pixels
 * @param {Array} cellMapping - Array of {span: N} objects defining column spans
 */
function buildBentoGrid(width, gutter, margin, cellMapping) {
  const baseCols = 12;
  const availableWidth = width - margin * 2 + gutter;
  const unitWidth = (availableWidth - gutter * baseCols) / baseCols;
  const columns = [];
  let currentX = margin;

  const mapping = cellMapping || [
    { span: 4 }, { span: 8 },   // Row 1: 1/3 + 2/3
    { span: 6 }, { span: 6 },   // Row 2: 1/2 + 1/2
    { span: 3 }, { span: 3 }, { span: 3 }, { span: 3 } // Row 3: 4 equal
  ];

  for (const cell of mapping) {
    const cellWidth = unitWidth * cell.span + gutter * (cell.span - 1);
    columns.push({ x: currentX, width: cellWidth, span: cell.span });
    currentX += cellWidth + gutter;
  }

  return { columns, colWidth: unitWidth, type: 'bento' };
}

/**
 * Draws a grid overlay on the given image and saves the result.
 *
 * @param {string} inputPath - Path to the source image
 * @param {string} outputPath - Path for the output overlay image
 * @param {Object} options - Grid configuration options
 */
async function drawGridOverlay(inputPath, outputPath, options = {}) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const {
    cols = 12,
    gutter = 24,
    margin = 64,
    type = 'regular',
    cellMapping = null
  } = options;

  const metadata = await sharp(inputPath).metadata();
  const { width, height } = metadata;

  console.log(`\nGrid Overlay`);
  console.log(`  Input: ${inputPath} (${width}x${height})`);
  console.log(`  Type: ${type}, Cols: ${cols}, Gutter: ${gutter}px, Margin: ${margin}px\n`);

  // Build grid structure based on type
  let grid;
  switch (type) {
    case 'golden':
      grid = buildGoldenGrid(width, gutter, margin);
      break;
    case 'bento':
      grid = buildBentoGrid(width, gutter, margin, cellMapping);
      break;
    case 'regular':
    default:
      grid = buildRegularGrid(width, cols, gutter, margin);
      break;
  }

  // Build SVG overlay
  const svgParts = [];

  // Draw margin areas (left and right)
  if (margin > 0) {
    svgParts.push(
      `<rect x="0" y="0" width="${margin}" height="${height}" fill="${COLORS.margin}"/>`,
      `<rect x="${width - margin}" y="0" width="${margin}" height="${height}" fill="${COLORS.margin}"/>`
    );
  }

  // Draw columns and gutters
  for (let i = 0; i < grid.columns.length; i++) {
    const col = grid.columns[i];

    // Column fill
    svgParts.push(
      `<rect x="${col.x}" y="0" width="${col.width}" height="${height}" fill="${COLORS.column}"/>`
    );

    // Column boundary lines (left and right edges)
    svgParts.push(
      `<line x1="${col.x}" y1="0" x2="${col.x}" y2="${height}" stroke="${COLORS.column}" stroke-width="1"/>`,
      `<line x1="${col.x + col.width}" y1="0" x2="${col.x + col.width}" y2="${height}" stroke="${COLORS.column}" stroke-width="1"/>`
    );

    // Gutter fill between columns
    if (i < grid.columns.length - 1) {
      const gutterX = col.x + col.width;
      const nextCol = grid.columns[i + 1];
      const gutterWidth = nextCol.x - gutterX;
      if (gutterWidth > 0) {
        svgParts.push(
          `<rect x="${gutterX}" y="0" width="${gutterWidth}" height="${height}" fill="${COLORS.gutter}"/>`
        );
      }
    }

    // Column label at the top
    const labelSize = Math.max(9, Math.min(14, Math.floor(col.width / 5)));
    const labelText = col.span ? `${i}(${col.span})` : `${i}`;
    const labelX = col.x + col.width / 2;
    svgParts.push(
      `<rect x="${labelX - 12}" y="4" width="24" height="${labelSize + 4}" fill="${COLORS.labelBg}" rx="2"/>`,
      `<text x="${labelX}" y="${labelSize + 4}" font-family="monospace" font-size="${labelSize}" fill="${COLORS.label}" text-anchor="middle">${labelText}</text>`
    );
  }

  const svgOverlay = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgParts.join('')}</svg>`;

  await sharp(inputPath)
    .composite([{
      input: Buffer.from(svgOverlay),
      top: 0,
      left: 0
    }])
    .toFile(outputPath);

  console.log(`  [ok] Overlay saved: ${outputPath}`);
  console.log(`  Columns: ${grid.columns.length}, Type: ${grid.type}\n`);

  return {
    output: outputPath,
    grid,
    dimensions: { width, height },
    options: { cols, gutter, margin, type }
  };
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Grid Overlay - Antigravity Grid Visualization

Usage:
  node grid-overlay.js <input-image> <output-image> [options]

Options:
  --cols=12       Number of columns (default: 12)
  --gutter=24     Gutter width in px (default: 24)
  --margin=64     Margin width in px (default: 64)
  --type=regular  Grid type: regular, golden, bento (default: regular)

Examples:
  node grid-overlay.js screenshot.png overlay.png
  node grid-overlay.js design.jpg overlay.png --cols=6 --gutter=16 --margin=32
  node grid-overlay.js layout.png overlay.png --type=golden
    `);
    process.exit(0);
  }

  const inputPath = args[0];
  const outputPath = args[1] || 'grid-overlay.png';

  // Parse options
  const options = {};
  args.slice(2).forEach(arg => {
    if (arg.startsWith('--cols=')) options.cols = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--gutter=')) options.gutter = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--margin=')) options.margin = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--type=')) options.type = arg.split('=')[1];
  });

  drawGridOverlay(inputPath, outputPath, options)
    .then(result => {
      console.log(`Done: Grid overlay generated (${result.grid.columns.length} columns, ${result.grid.type})`);
    })
    .catch(error => {
      console.error('Error: Overlay generation failed:', error.message);
      process.exit(1);
    });
}

module.exports = { drawGridOverlay, buildRegularGrid, buildGoldenGrid, buildBentoGrid, COLORS };
