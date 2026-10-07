#!/usr/bin/env npx tsx
/**
 * Generalized HTML to PNG Screenshot Renderer
 *
 * Renders any HTML file to PNG using Puppeteer with configurable dimensions.
 * Outputs JSON result to stdout for script chaining.
 *
 * Usage:
 *   npx tsx render-screenshot.ts input.html output.png
 *   npx tsx render-screenshot.ts input.html output.png --width=1920 --height=1080
 *   npx tsx render-screenshot.ts input.html output.png --scale=2
 */

import * as fs from "fs";
import * as path from "path";

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1350;
const DEFAULT_SCALE = 1;
const FONT_WAIT_MS = 500;

function parseArgs(): {
  htmlPath: string;
  outputPath: string;
  width: number;
  height: number;
  scale: number;
} {
  const args = process.argv.slice(2);
  const positional: string[] = [];
  let width = DEFAULT_WIDTH;
  let height = DEFAULT_HEIGHT;
  let scale = DEFAULT_SCALE;

  for (const arg of args) {
    if (arg.startsWith("--width=")) {
      width = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--height=")) {
      height = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--scale=")) {
      scale = parseFloat(arg.split("=")[1]);
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    console.error(
      "Usage: npx tsx render-screenshot.ts <html-path> <output-png> [--width=1080] [--height=1350] [--scale=1]"
    );
    process.exit(1);
  }

  return {
    htmlPath: path.resolve(positional[0]),
    outputPath: path.resolve(positional[1]),
    width,
    height,
    scale,
  };
}

async function renderScreenshot(
  htmlPath: string,
  outputPath: string,
  width: number,
  height: number,
  scale: number
): Promise<void> {
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML file not found: ${htmlPath}`);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width,
      height,
      deviceScaleFactor: scale,
    });

    await page.goto(`file://${htmlPath}`, {
      waitUntil: "networkidle0",
    });

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);
    await new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS));

    // Capture viewport area only (not full page scroll)
    await page.screenshot({
      path: outputPath,
      type: "png",
      fullPage: false,
      clip: { x: 0, y: 0, width, height },
    });

    // Output JSON result to stdout
    console.log(
      JSON.stringify({
        success: true,
        output: outputPath,
        dimensions: { width, height, scale },
        htmlPath,
      })
    );
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const { htmlPath, outputPath, width, height, scale } = parseArgs();

  try {
    await renderScreenshot(htmlPath, outputPath, width, height, scale);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    console.log(JSON.stringify({ success: false, error: message }));
    process.exit(1);
  }
}

main();
