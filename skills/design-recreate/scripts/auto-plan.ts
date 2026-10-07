/**
 * auto-plan.ts — D2 Deconstruction Plan Auto-Generator
 *
 * Reads D1 analysis results and generates plan/deconstruct-plan.json
 * following the D2 schema exactly.
 *
 * Usage:
 *   npx tsx auto-plan.ts <analysis-dir> <plan-dir> [options]
 *   npx tsx auto-plan.ts ./analysis ./plan
 *   npx tsx auto-plan.ts analysis/ plan/ --gemini-prompts
 *
 * Options:
 *   --asset-prompts        Write asset_request prompts for RAW_IMAGE elements that cannot be cropped
 *                          (handed to the design-assets skill — this script never generates images)
 *   --no-procedural        Skip L1-B (PROCEDURAL) layer
 *   --brand-config=PATH    brand_config(.draft).json — use its typography families instead of a generic stack
 *
 * Plan has two axes:
 *   depthLayers[]  3-Signal Depth Layers (z order) — overlap > visual weight > semantic role
 *   layers[]       method groups (L0..L5) — how each element type is implemented
 * buildOrder is depth-major: z0 → z1 → …, and inside each z the method order L0 → L1-A → L1-B → L2 → L3 → L4 → L5.
 *
 * Output (stdout): JSON plan summary
 * Logs (stderr): Progress messages
 */

import * as fs from 'fs';
import * as path from 'path';

// --- Types (matching auto-analyze output) ---

interface D1Metadata {
  image_meta: { width: number; height: number; colorspace: string; format: string };
  dominant_colors: string[];
  background_samples: Record<string, string>;
  background_hex: string;
  confidence: string;
}

interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DesignElement {
  id: string;
  classification: string;
  description: string;
  bounds: ElementBounds;
  text_content?: string;
  font_analysis?: {
    serif: boolean;
    weight: string;
    estimated_size: string;
    style?: string;
  };
  procedural_type?: string;
  semantic_role?: string;
  overlaps_above?: string[];
  font_size_px?: number;
  font_weight?: number;
  color_contrast?: number;
  confidence: string;
}

interface D1Elements {
  grid: {
    type: string;
    columns: number[];
    rows: number[];
    gutter: number;
    margin: number;
  };
  layers: { z: number; type: string; description: string }[];
  elements: DesignElement[];
  procedural_detected: boolean;
  gemini_tier_used: number;
}

interface D1Colors {
  background: { hex: string; method: string; samples: number };
  elements: Record<string, { dominant: string; palette: string[]; method: string }>;
  global_palette: string[];
  confidence: string;
}

// --- Plan Types (D2 Schema) ---

interface PlanMeta {
  sourceImage: string;
  canvasSize: { width: number; height: number };
  gridSystem: {
    type: string;
    columns: number[];
    rows: number[];
    gutter: number;
    margin: number;
  };
}

interface PlanLayer {
  id: string;
  name: string;
  method: string;
  spec?: any;
  elements?: any[];
  effects?: any[];
  order: number;
}

interface DepthElement {
  id: string;
  classification: string;
  method: string;
  semanticRole: string;
  visualWeight: number;
  reason: string;
}

interface DepthLayer {
  z: number;
  role: string;
  elements: DepthElement[];
}

interface DeconstructPlan {
  meta: PlanMeta;
  depthLayers: DepthLayer[];
  layers: PlanLayer[];
  methodOrder: string[];
  buildOrder: string[];
}

// --- Utilities ---

function log(msg: string): void {
  process.stderr.write(`[auto-plan] ${msg}\n`);
}

function loadJSON<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// --- Layer Builders ---

function buildL0(bgHex: string, width: number, height: number): PlanLayer {
  return {
    id: 'L0',
    name: 'Canvas & Background',
    method: 'CSS',
    spec: {
      background: bgHex,
      width: `${width}px`,
      height: `${height}px`,
    },
    order: 0,
  };
}

function buildL1A(
  elements: DesignElement[],
  colors: D1Colors,
  generatePrompts: boolean
): PlanLayer {
  const rawImages = elements.filter(e => e.classification === 'RAW_IMAGE');

  const layerElements = rawImages.map(el => {
    const elementColor = colors.elements[el.id];
    // Crops under 100px on either side are too low quality to reuse directly.
    const croppable = el.bounds.width >= MIN_CROP_PX && el.bounds.height >= MIN_CROP_PX;
    const base: any = {
      id: el.id,
      original_description: el.description,
      bounds: el.bounds,
      source: croppable ? 'crop' : 'design-assets',
    };

    if (!croppable && generatePrompts) {
      base.asset_request = {
        prompt: generateGeminiPrompt(el, elementColor),
        aspect_ratio: getAspectRatio(el.bounds.width, el.bounds.height),
        reference_crop: `crops/${el.id}.png`,
      };
    }

    if (elementColor) {
      base.post_processing = {
        crop: 'center',
        resize: `${el.bounds.width}x${el.bounds.height}`,
      };
    }

    return base;
  });

  return {
    id: 'L1-A',
    name: 'Raw Images (reference crop, or design-assets when too small)',
    method: 'CROP_OR_ASSETS',
    elements: layerElements,
    order: 1,
  };
}

function buildL1B(elements: DesignElement[]): PlanLayer {
  const procedurals = elements.filter(e => e.classification === 'PROCEDURAL');

  const layerElements = procedurals.map(el => ({
    id: el.id,
    type: el.procedural_type || 'geometric',
    spec: generateProceduralSpec(el),
    bounds: el.bounds,
  }));

  return {
    id: 'L1-B',
    name: 'Procedural Art (CSS/SVG/Canvas)',
    method: 'CSS_SVG_CANVAS',
    elements: layerElements,
    order: 1.5,
  };
}

function buildL2(grid: D1Elements['grid']): PlanLayer {
  let gridTemplate = '';

  if (grid.columns.length > 0) {
    const cols = grid.columns.map(c => typeof c === 'number' ? `${c}fr` : c).join(' ');
    gridTemplate += `grid-template-columns: ${cols};`;
  }

  if (grid.rows.length > 0) {
    const rows = grid.rows.map(r => typeof r === 'number' ? `${r}fr` : r).join(' ');
    gridTemplate += ` grid-template-rows: ${rows};`;
  }

  if (grid.gutter > 0) {
    gridTemplate += ` gap: ${grid.gutter}px;`;
  }

  return {
    id: 'L2',
    name: 'Structure',
    method: 'HTML_CSS',
    spec: {
      gridTemplate: gridTemplate || 'display: flex; flex-direction: column;',
      gridType: grid.type,
    },
    order: 2,
  };
}

function buildL3(elements: DesignElement[]): PlanLayer {
  const components = elements.filter(e => e.classification === 'COMPONENT');

  return {
    id: 'L3',
    name: 'Components',
    method: 'CSS_SVG',
    elements: components.map(el => ({
      id: el.id,
      type: guessComponentType(el),
      description: el.description,
      bounds: el.bounds,
    })),
    order: 3,
  };
}

function buildL4(elements: DesignElement[], colors: D1Colors): PlanLayer {
  const textures = elements.filter(e => e.classification === 'TEXTURE');

  return {
    id: 'L4',
    name: 'Textures & Effects',
    method: 'CSS',
    effects: textures.map(el => ({
      id: el.id,
      type: guessTextureType(el),
      description: el.description,
      bounds: el.bounds,
    })),
    order: 4,
  };
}

function buildL5(elements: DesignElement[], colors: D1Colors, families: FontFamilies): PlanLayer {
  const texts = elements.filter(e => e.classification === 'TEXT');

  const layerElements = texts.map(el => {
    const elColor = colors.elements[el.id];
    const font = el.font_analysis || { serif: false, weight: 'normal', estimated_size: '16px' };

    return {
      id: el.id,
      text: el.text_content || el.description,
      font: {
        family: font.serif ? families.serif : families.sans,
        weight: fontWeightToNumber(font.weight),
        size: font.estimated_size,
        color: elColor?.dominant || '#000000',
        style: font.style || 'normal',
      },
      bounds: el.bounds,
    };
  });

  return {
    id: 'L5',
    name: 'Typography',
    method: 'HTML_FONT',
    elements: layerElements,
    order: 5,
  };
}

// --- Helper Functions ---

function generateGeminiPrompt(el: DesignElement, _color?: any): string {
  return `NO text, NO letters, NO words, NO numbers, NO watermarks, NO logos. ${el.description}. High quality, professional photography, studio lighting.`;
}

function generateProceduralSpec(el: DesignElement): any {
  const type = el.procedural_type || 'geometric';
  switch (type) {
    case 'halftone':
      return { dot_spacing: '20px', contrast: 20, blend_mode: 'multiply' };
    case 'starburst':
      return { ray_count: 24, method: 'conic-gradient' };
    case 'glitch':
      return { displacement: '5px', channels: ['R', 'G', 'B'] };
    default:
      return { description: el.description };
  }
}

function getAspectRatio(w: number, h: number): string {
  const ratio = w / h;
  if (Math.abs(ratio - 1) < 0.1) return '1:1';
  if (Math.abs(ratio - 4 / 3) < 0.15) return '4:3';
  if (Math.abs(ratio - 3 / 4) < 0.15) return '3:4';
  if (Math.abs(ratio - 16 / 9) < 0.15) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.15) return '9:16';
  return `${Math.round(ratio * 100) / 100}:1`;
}

function guessComponentType(el: DesignElement): string {
  const desc = (el.description || '').toLowerCase();
  if (desc.includes('badge') || desc.includes('tag') || desc.includes('label')) return 'badge';
  if (desc.includes('button') || desc.includes('cta')) return 'button';
  if (desc.includes('divider') || desc.includes('line') || desc.includes('separator')) return 'line';
  if (desc.includes('icon')) return 'icon';
  if (desc.includes('arrow')) return 'arrow';
  return 'custom';
}

function guessTextureType(el: DesignElement): string {
  const desc = (el.description || '').toLowerCase();
  if (desc.includes('noise') || desc.includes('grain')) return 'noise';
  if (desc.includes('gradient')) return 'gradient';
  if (desc.includes('shadow')) return 'shadow';
  if (desc.includes('glass') || desc.includes('blur')) return 'glassmorphism';
  return 'custom';
}

function fontWeightToNumber(weight: string): number {
  const w = weight.toLowerCase();
  if (w === 'thin' || w === '100') return 100;
  if (w === 'light' || w === '300') return 300;
  if (w === 'normal' || w === 'regular' || w === '400') return 400;
  if (w === 'medium' || w === '500') return 500;
  if (w === 'semibold' || w === '600') return 600;
  if (w === 'bold' || w === '700') return 700;
  if (w === 'extrabold' || w === 'extra-bold' || w === '800') return 800;
  if (w === 'black' || w === '900') return 900;
  return 400;
}

// --- 3-Signal Depth Layers ---

const MIN_CROP_PX = 100;
const PROMOTE_SCORE = 0.75;

const SEMANTIC_BOOST: Record<string, number> = {
  cta: 1.0, price: 1.0, discount: 1.0,
  headline: 0.7, hero: 0.7,
  body: 0.4, 'sub-copy': 0.4,
  spec: 0.3, pill: 0.3,
  logo: 0.2, badge: 0.2,
  decoration: 0.1,
  background: 0.0,
};

const METHOD_BY_CLASS: Record<string, string> = {
  RAW_IMAGE: 'L1-A', PROCEDURAL: 'L1-B', TEMPLATE: 'L2', COMPONENT: 'L3', TEXTURE: 'L4', TEXT: 'L5',
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function intersects(a: ElementBounds, b: ElementBounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function visualWeight(el: DesignElement, canvasArea: number): number {
  const area = (el.bounds.width * el.bounds.height) / canvasArea;
  const size = el.font_size_px ?? 0;
  const weight = el.font_weight ?? 400;
  const contrast = el.color_contrast ?? 0.5;
  const boost = SEMANTIC_BOOST[el.semantic_role || ''] ?? 0.3;
  const score =
    clamp01(size / 150) * 0.30 +
    clamp01((weight - 100) / 800) * (size > 0 ? 0.15 : 0) +
    clamp01(contrast) * 0.25 +
    clamp01(area / 0.5) * 0.15 +
    boost * 0.15;
  return Math.round(score * 100) / 100;
}

function isBackground(el: DesignElement, canvasArea: number): boolean {
  if (el.semantic_role === 'background') return true;
  const area = (el.bounds.width * el.bounds.height) / canvasArea;
  return !el.semantic_role && el.classification !== 'TEXT' && area >= 0.9;
}

function assignDepthLayers(elements: DesignElement[], width: number, height: number): DepthLayer[] {
  const canvasArea = Math.max(1, width * height);
  const byId = new Map(elements.map(e => [e.id, e]));
  const depth = new Map<string, number>();
  const reason = new Map<string, string>();
  const scores = new Map(elements.map(e => [e.id, visualWeight(e, canvasArea)]));

  // Signal 1 — overlap graph: below[id] = elements this one sits on top of (bbox must intersect).
  const below = new Map<string, string[]>();
  for (const el of elements) {
    const ids = (el.overlaps_above || []).filter(id => {
      const other = byId.get(id);
      return other && other.id !== el.id && intersects(el.bounds, other.bounds);
    });
    below.set(el.id, ids);
  }

  const visiting = new Set<string>();
  const resolve = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    const el = byId.get(id)!;
    if (isBackground(el, canvasArea)) {
      depth.set(id, 0);
      reason.set(id, 'background → z0');
      return 0;
    }
    if (visiting.has(id)) return 1; // cycle guard: treat as base content
    visiting.add(id);
    // Signal 2 — visual weight promotion (score >= 0.75 starts one layer higher).
    const score = scores.get(id)!;
    let z = score >= PROMOTE_SCORE ? 2 : 1;
    let why = score >= PROMOTE_SCORE ? `visualWeight ${score} >= ${PROMOTE_SCORE} → promoted` : 'base content';
    for (const lowerId of below.get(id) || []) {
      const lz = resolve(lowerId) + 1;
      if (lz > z) {
        z = lz;
        why = `overlaps ${lowerId} → above it`;
      }
    }
    visiting.delete(id);
    depth.set(id, z);
    reason.set(id, why);
    return z;
  };
  elements.forEach(e => resolve(e.id));

  // Compact to consecutive z values (0,1,2,…) and group.
  const distinct = Array.from(new Set(depth.values())).sort((a, b) => a - b);
  const remap = new Map(distinct.map((z, i) => [z, i]));
  const layers: DepthLayer[] = distinct.map((_, i) => ({
    z: i,
    role: i === 0 && distinct[0] === 0 ? 'background' : i === distinct.length - 1 && i > 1 ? 'overlay' : 'content',
    elements: [],
  }));
  for (const el of elements) {
    const z = remap.get(depth.get(el.id)!)!;
    layers[z].elements.push({
      id: el.id,
      classification: el.classification,
      method: METHOD_BY_CLASS[el.classification] || 'L2',
      // Signal 3 — semantic role is recorded and feeds the weight boost; it never overrides overlap.
      semanticRole: el.semantic_role || 'unknown',
      visualWeight: scores.get(el.id)!,
      reason: reason.get(el.id)!,
    });
  }
  return layers;
}

interface FontFamilies {
  sans: string;
  serif: string;
}

function loadFamilies(brandConfigPath: string | null): FontFamilies {
  const fallback = { sans: 'system-ui, -apple-system, sans-serif', serif: 'Georgia, serif' };
  if (!brandConfigPath) return fallback;
  const cfg = loadJSON<any>(brandConfigPath);
  const fam = cfg?.tokens?.typography?.families;
  if (!fam || typeof fam !== 'object') {
    log(`brand config has no tokens.typography.families — using generic stacks`);
    return fallback;
  }
  const pick = (...keys: string[]) => keys.map(k => fam[k]).find(v => typeof v === 'string');
  return {
    sans: pick('body', 'sans', 'base', 'heading') || fallback.sans,
    serif: pick('serif', 'display') || fallback.serif,
  };
}

// --- GATE-2 Check ---

function checkGate2(plan: DeconstructPlan): boolean {
  if (!plan.meta || !plan.layers || !Array.isArray(plan.layers)) return false;
  if (plan.layers.length === 0) return false;
  if (!plan.buildOrder || !Array.isArray(plan.buildOrder)) return false;
  if (!Array.isArray(plan.depthLayers) || plan.depthLayers.length === 0) return false;
  return true;
}

// --- Argument Parsing ---

interface Config {
  analysisDir: string;
  planDir: string;
  geminiPrompts: boolean;
  noProcedural: boolean;
  brandConfig: string | null;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const positional: string[] = [];
  let geminiPrompts = false;
  let noProcedural = false;
  let brandConfig: string | null = null;

  for (const arg of args) {
    if (arg === '--asset-prompts') geminiPrompts = true;
    else if (arg.startsWith('--brand-config=')) brandConfig = path.resolve(arg.split('=')[1]);
    else if (arg === '--no-procedural') noProcedural = true;
    else if (!arg.startsWith('--')) positional.push(arg);
  }

  if (positional.length < 2) {
    console.error('Usage: npx tsx auto-plan.ts <analysis-dir> <plan-dir> [options]');
    console.error('Options:');
    console.error('  --asset-prompts        Write asset_request prompts for small RAW_IMAGE elements');
    console.error('  --no-procedural        Skip L1-B layer');
    console.error('  --brand-config=PATH    Use brand typography families');
    process.exit(1);
  }

  return {
    analysisDir: path.resolve(positional[0]),
    planDir: path.resolve(positional[1]),
    geminiPrompts,
    noProcedural,
    brandConfig,
  };
}

// --- Main ---

function main(): void {
  const config = parseArgs();

  log('=========================================');
  log('  D2 Auto-Plan Generator');
  log('=========================================');
  log(`Analysis: ${config.analysisDir}`);
  log(`Output:   ${config.planDir}`);
  log('=========================================');

  // Load D1 results
  const metadata = loadJSON<D1Metadata>(path.join(config.analysisDir, 'd1-metadata.json'));
  const elementsData = loadJSON<D1Elements>(path.join(config.analysisDir, 'd1-elements.json'));
  const colors = loadJSON<D1Colors>(path.join(config.analysisDir, 'd1-colors.json'));

  if (!metadata || !elementsData || !colors) {
    log('ERROR: Missing D1 analysis files. Run auto-analyze.ts first.');
    log(`  d1-metadata.json: ${metadata ? 'OK' : 'MISSING'}`);
    log(`  d1-elements.json: ${elementsData ? 'OK' : 'MISSING'}`);
    log(`  d1-colors.json: ${colors ? 'OK' : 'MISSING'}`);
    console.log(JSON.stringify({ success: false, error: 'Missing D1 analysis files' }));
    process.exit(1);
  }

  // GATE-1 check
  log('GATE-1 check: All D1 files present');

  const { image_meta } = metadata;
  const allElements = elementsData.elements;

  // Build layers
  const layers: PlanLayer[] = [];

  // L0: Background
  layers.push(buildL0(colors.background.hex, image_meta.width, image_meta.height));
  log(`L0: Background (${colors.background.hex})`);

  // L1-A: Raw Images
  const hasRawImages = allElements.some(e => e.classification === 'RAW_IMAGE');
  if (hasRawImages) {
    layers.push(buildL1A(allElements, colors, config.geminiPrompts));
    const count = allElements.filter(e => e.classification === 'RAW_IMAGE').length;
    log(`L1-A: ${count} raw image(s)`);
  }

  // L1-B: Procedural Art
  const hasProcedural = !config.noProcedural && elementsData.procedural_detected;
  if (hasProcedural) {
    layers.push(buildL1B(allElements));
    const count = allElements.filter(e => e.classification === 'PROCEDURAL').length;
    log(`L1-B: ${count} procedural element(s)`);
  }

  // L2: Structure
  layers.push(buildL2(elementsData.grid));
  log(`L2: Structure (${elementsData.grid.type} grid)`);

  // L3: Components
  const hasComponents = allElements.some(e => e.classification === 'COMPONENT');
  if (hasComponents) {
    layers.push(buildL3(allElements));
    const count = allElements.filter(e => e.classification === 'COMPONENT').length;
    log(`L3: ${count} component(s)`);
  }

  // L4: Textures
  const hasTextures = allElements.some(e => e.classification === 'TEXTURE');
  if (hasTextures) {
    layers.push(buildL4(allElements, colors));
    const count = allElements.filter(e => e.classification === 'TEXTURE').length;
    log(`L4: ${count} texture/effect(s)`);
  }

  // L5: Typography
  const hasText = allElements.some(e => e.classification === 'TEXT');
  if (hasText) {
    layers.push(buildL5(allElements, colors, loadFamilies(config.brandConfig)));
    const count = allElements.filter(e => e.classification === 'TEXT').length;
    log(`L5: ${count} text element(s)`);
  }

  // Method order (inside each depth layer)
  const methodOrder = layers
    .sort((a, b) => a.order - b.order)
    .map(l => l.id);

  // 3-Signal depth layers → depth-major build order
  const depthLayers = assignDepthLayers(allElements, image_meta.width, image_meta.height);
  const buildOrder = depthLayers.map(d => `z${d.z}`);
  depthLayers.forEach(d => log(`z${d.z} (${d.role}): ${d.elements.map(e => e.id).join(', ') || '—'}`));

  // Assemble plan
  const plan: DeconstructPlan = {
    meta: {
      sourceImage: 'reference.jpg',
      canvasSize: { width: image_meta.width, height: image_meta.height },
      gridSystem: elementsData.grid,
    },
    depthLayers,
    layers,
    methodOrder,
    buildOrder,
  };

  // GATE-2 check
  const gate2 = checkGate2(plan);

  // Save
  if (!fs.existsSync(config.planDir)) {
    fs.mkdirSync(config.planDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(config.planDir, 'deconstruct-plan.json'),
    JSON.stringify(plan, null, 2)
  );

  log('');
  log('=========================================');
  log(`  GATE-2: ${gate2 ? 'PASSED' : 'FAILED'}`);
  log(`  Layers: ${layers.length}`);
  log(`  Elements: ${allElements.length}`);
  log(`  Depth Layers: ${depthLayers.length}`);
  log(`  Build Order: ${buildOrder.join(' → ')} (method order inside each: ${methodOrder.join(' → ')})`);
  log('=========================================');

  // Stdout summary
  console.log(JSON.stringify({
    success: gate2,
    gate2_passed: gate2,
    layers: layers.length,
    elements: allElements.length,
    depthLayers: depthLayers.length,
    methodOrder,
    buildOrder,
    planPath: path.join(config.planDir, 'deconstruct-plan.json'),
  }, null, 2));
}

main();
