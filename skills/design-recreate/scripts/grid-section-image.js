#!/usr/bin/env node
/**
 * Grid Section Image Script
 * Divides an image into N*M grid cells for detailed analysis.
 * Part of the Antigravity AI Workflow - Phase 2: Grid-Based Sectioning
 *
 * Usage:
 *   node grid-section-image.js <input> <output-dir> [--rows=4] [--cols=4]
 *
 * Examples:
 *   node grid-section-image.js screenshot.png ./cells
 *   node grid-section-image.js design.jpg ./cells --rows=6 --cols=6
 *   node grid-section-image.js reference.png ./cells --rows=3 --cols=3
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Grid density presets
const PRESETS = {
  quick: { rows: 3, cols: 3 },
  standard: { rows: 4, cols: 4 },
  detailed: { rows: 6, cols: 6 }
};

/**
 * Sections an image into a grid of N*M cells, saving each cell as a separate PNG.
 *
 * @param {string} inputPath - Path to the source image
 * @param {string} outputDir - Directory to write cell images and manifest
 * @param {number} rows - Number of grid rows (default: 4)
 * @param {number} cols - Number of grid columns (default: 4)
 * @returns {Promise<Object>} Grid manifest describing all cells
 */
async function sectionImage(inputPath, outputDir, rows = 4, cols = 4) {
  // 1. Validate input
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  // 2. Read image metadata
  const metadata = await sharp(inputPath).metadata();
  const { width, height } = metadata;
  console.log(`\nGrid Section Image`);
  console.log(`  Input: ${inputPath} (${width}x${height})`);
  console.log(`  Grid: ${rows}x${cols} = ${rows * cols} cells\n`);

  // 3. Calculate cell dimensions
  const cellWidth = Math.floor(width / cols);
  const cellHeight = Math.floor(height / rows);

  // 4. Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const cells = [];

  // 5. Extract each cell
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellWidth;
      const y = r * cellHeight;
      // Last column/row absorbs any remainder pixels
      const w = c === cols - 1 ? width - x : cellWidth;
      const h = r === rows - 1 ? height - y : cellHeight;

      const filename = `cell-${r}-${c}.png`;
      const filepath = path.join(outputDir, filename);

      await sharp(inputPath)
        .extract({ left: x, top: y, width: w, height: h })
        .toFile(filepath);

      cells.push({
        id: `${r}-${c}`,
        row: r,
        col: c,
        x,
        y,
        width: w,
        height: h,
        file: filepath
      });

      console.log(`  [ok] cell-${r}-${c} (${x},${y}) ${w}x${h}`);
    }
  }

  // 6. Generate grid overlay image
  const overlayPath = path.join(outputDir, 'grid-overlay.png');
  await generateGridOverlay(inputPath, overlayPath, rows, cols, width, height, cellWidth, cellHeight);
  console.log(`\n  [ok] Grid overlay: ${overlayPath}`);

  // 7. Write manifest
  const manifest = {
    source: path.resolve(inputPath),
    dimensions: { width, height },
    grid: { rows, cols },
    cellSize: { width: cellWidth, height: cellHeight },
    cells,
    overlay: overlayPath,
    timestamp: new Date().toISOString()
  };

  const manifestPath = path.join(outputDir, 'grid-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  [ok] Manifest: ${manifestPath}\n`);

  return manifest;
}

/**
 * Generates a grid overlay image with grid lines and cell labels composited
 * on top of the original image.
 *
 * @param {string} inputPath - Path to the source image
 * @param {string} outputPath - Path for the output overlay image
 * @param {number} rows - Number of grid rows
 * @param {number} cols - Number of grid columns
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {number} cellWidth - Width of each cell in pixels
 * @param {number} cellHeight - Height of each cell in pixels
 */
async function generateGridOverlay(inputPath, outputPath, rows, cols, width, height, cellWidth, cellHeight) {
  // Build SVG overlay with grid lines and cell labels
  const lineColor = 'rgba(255, 0, 0, 0.6)';
  const labelBg = 'rgba(0, 0, 0, 0.5)';
  const labelColor = 'white';
  const lineWidth = 2;

  const svgParts = [];

  // Vertical lines
  for (let c = 1; c < cols; c++) {
    const x = c * cellWidth;
    svgParts.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${lineColor}" stroke-width="${lineWidth}"/>`
    );
  }

  // Horizontal lines
  for (let r = 1; r < rows; r++) {
    const y = r * cellHeight;
    svgParts.push(
      `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${lineColor}" stroke-width="${lineWidth}"/>`
    );
  }

  // Cell labels
  const labelSize = Math.max(10, Math.min(16, Math.floor(cellWidth / 8)));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellWidth + 4;
      const y = r * cellHeight + labelSize + 4;
      svgParts.push(
        `<rect x="${x - 2}" y="${y - labelSize}" width="${labelSize * 3}" height="${labelSize + 4}" fill="${labelBg}" rx="2"/>`
      );
      svgParts.push(
        `<text x="${x}" y="${y}" font-family="monospace" font-size="${labelSize}" fill="${labelColor}">${r}-${c}</text>`
      );
    }
  }

  const svgOverlay = `<svg width="${width}" height="${height}">${svgParts.join('')}</svg>`;

  await sharp(inputPath)
    .composite([{
      input: Buffer.from(svgOverlay),
      top: 0,
      left: 0
    }])
    .toFile(outputPath);
}

/**
 * Merges grid cells back into a single image (inverse of sectionImage).
 * Useful for reassembling after per-cell edits.
 *
 * @param {string} manifestPath - Path to a grid-manifest.json file
 * @param {string} outputPath - Path for the reassembled output image
 */
async function mergeGridCells(manifestPath, outputPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const { dimensions, cells } = manifest;

  // Create blank canvas
  const composites = cells.map(cell => ({
    input: cell.file,
    top: cell.y,
    left: cell.x
  }));

  await sharp({
    create: {
      width: dimensions.width,
      height: dimensions.height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite(composites)
    .toFile(outputPath);

  console.log(`[ok] Merged ${cells.length} cells into ${outputPath}`);
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Grid Section Image - Antigravity Phase 2

Usage:
  node grid-section-image.js <input-image> <output-dir> [options]

Options:
  --rows=N        Number of rows (default: 4)
  --cols=N        Number of columns (default: 4)
  --preset=NAME   Use preset: quick(3x3), standard(4x4), detailed(6x6)

Examples:
  node grid-section-image.js screenshot.png ./cells
  node grid-section-image.js design.jpg ./cells --rows=6 --cols=6
  node grid-section-image.js reference.png ./cells --preset=quick
    `);
    process.exit(0);
  }

  const inputPath = args[0];
  const outputDir = args[1] || './grid-cells';

  // Parse options
  let rows = 4;
  let cols = 4;
  args.slice(2).forEach(arg => {
    if (arg.startsWith('--rows=')) rows = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--cols=')) cols = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--preset=')) {
      const preset = PRESETS[arg.split('=')[1]];
      if (preset) {
        rows = preset.rows;
        cols = preset.cols;
      }
    }
  });

  sectionImage(inputPath, outputDir, rows, cols)
    .then(manifest => {
      console.log(`Done: Sectioned into ${manifest.cells.length} cells`);
    })
    .catch(error => {
      console.error('Error: Sectioning failed:', error.message);
      process.exit(1);
    });
}

module.exports = { sectionImage, generateGridOverlay, mergeGridCells, PRESETS };
