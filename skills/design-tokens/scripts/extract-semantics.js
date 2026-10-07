/**
 * extract-semantics.js
 *
 * Browser-context module. Ported from the antigravity extractor's
 * "context-aware color mapping" and effects pass, rewritten to return
 * MEASURED values with occurrence counts instead of a hard-coded scale.
 *
 * Returns:
 *   roles   - background / surface / brand / text / border colors chosen by element context
 *   radii   - every non-zero border-radius in px with counts (no invented scale)
 *   shadows - every box-shadow with counts
 *   motion  - transition durations and timing functions with counts
 *   page    - title, meta description, site name, theme-color, logo candidates
 *
 * Injected by extract-all.ts via `new Function(source)`; exposes
 * window.extractSemanticsFromPage.
 */

function semToHex(color) {
  if (!color) return null;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null; // fully transparent
  return '#' + [m[1], m[2], m[3]]
    .map(v => parseInt(v, 10).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function semRgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function semLuminance(hex) {
  const [r, g, b] = semRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function semSaturation(hex) {
  const [r, g, b] = semRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

function semRank(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function semBump(map, key, by) {
  map.set(key, (map.get(key) || 0) + (by || 1));
}

function extractSemanticsFromPage() {
  const viewportArea = window.innerWidth * window.innerHeight;
  const backgrounds = new Map(); // hex -> summed area
  const surfaces = new Map();
  const brands = new Map();
  const texts = new Map();
  const borders = new Map(); // only elements that actually draw a border
  const radii = new Map();
  const shadows = new Map();
  const durations = new Map();
  const easings = new Map();

  const elements = document.querySelectorAll('*');
  elements.forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    const zIndex = parseInt(style.zIndex, 10) || 0;
    const bg = semToHex(style.backgroundColor);
    const fg = semToHex(style.color);

    // Background: large area, not elevated
    if (bg && area > viewportArea * 0.3 && zIndex <= 0) semBump(backgrounds, bg, area);

    // Surface: elevated or shadowed containers
    if (bg && area > 1000 && (zIndex > 0 || style.boxShadow !== 'none')) semBump(surfaces, bg, 1);

    // Brand: saturated fills/text on interactive elements
    const interactive = el.tagName === 'BUTTON' || el.tagName === 'A' ||
      el.getAttribute('role') === 'button' || style.cursor === 'pointer';
    if (interactive) {
      if (bg && semSaturation(bg) > 0.3) semBump(brands, bg, 2); // filled CTA weighs more
      if (fg && semSaturation(fg) > 0.3) semBump(brands, fg, 1); // colored link text
    }

    // Text: elements that own direct text nodes
    const ownsText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (fg && ownsText) semBump(texts, fg, 1);

    // Border: computed borderColor defaults to currentColor, so require a visible border
    if (parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none') {
      const bc = semToHex(style.borderTopColor);
      if (bc) semBump(borders, bc, 1);
    }
    if (parseFloat(style.borderBottomWidth) > 0 && style.borderBottomStyle !== 'none') {
      const bc = semToHex(style.borderBottomColor);
      if (bc) semBump(borders, bc, 1);
    }

    // Radius (top-left corner is representative; percentages = full)
    const r = style.borderTopLeftRadius;
    if (r && r !== '0px') {
      if (r.endsWith('%')) semBump(radii, 'full', 1);
      else {
        const px = Math.round(parseFloat(r));
        if (px > 0) semBump(radii, px >= 999 ? 'full' : px, 1);
      }
    }

    if (style.boxShadow && style.boxShadow !== 'none') semBump(shadows, style.boxShadow, 1);

    if (style.transitionDuration && style.transitionDuration !== '0s') {
      style.transitionDuration.split(',').map(s => s.trim()).filter(s => s !== '0s')
        .forEach(d => semBump(durations, d, 1));
      style.transitionTimingFunction.split(',').map(s => s.trim())
        .forEach(e => semBump(easings, e, 1));
    }
  });

  const bgRanked = semRank(backgrounds, 3);
  const baseBg = bgRanked[0] ? bgRanked[0].value : null;

  const meta = name => {
    const node = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return node ? node.getAttribute('content') : null;
  };
  const logoCandidates = [...document.querySelectorAll('img, svg')]
    .filter(n => /logo/i.test((n.getAttribute('src') || '') + ' ' + (n.getAttribute('alt') || '') +
      ' ' + (n.getAttribute('class') || '') + ' ' + (n.getAttribute('aria-label') || '')))
    .slice(0, 5)
    .map(n => n.tagName === 'IMG' ? n.currentSrc || n.src : 'inline-svg');

  return {
    roles: {
      background: { base: baseBg, isDark: baseBg ? semLuminance(baseBg) < 0.5 : null, ranked: bgRanked },
      surface: semRank(surfaces, 3),
      brand: semRank(brands, 5),
      text: semRank(texts, 5),
      border: semRank(borders, 3),
      brandSource: brands.size > 0 ? 'interactive-elements' : 'none'
    },
    radii: semRank(radii, 20),
    shadows: semRank(shadows, 8),
    motion: { durations: semRank(durations, 5), easings: semRank(easings, 5) },
    page: {
      title: document.title || null,
      siteName: meta('og:site_name'),
      description: meta('description') || meta('og:description'),
      themeColor: meta('theme-color'),
      lang: document.documentElement.lang || null,
      logoCandidates
    },
    stats: { elementsScanned: elements.length }
  };
}

if (typeof window !== 'undefined') {
  window.extractSemanticsFromPage = extractSemanticsFromPage;
}
