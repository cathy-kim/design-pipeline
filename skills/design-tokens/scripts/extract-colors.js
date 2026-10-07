/**
 * extract-colors.js
 *
 * Extracts color palette from computed styles of a website.
 * Uses color clustering to group similar colors and categorizes by usage.
 */

/**
 * Color extraction configuration
 */
const CONFIG = {
  // Delta E threshold for color clustering (lower = more strict)
  clusterThreshold: 2,
  // Minimum occurrences to include color
  minOccurrences: 2,
  // Color categories
  categories: ['background', 'text', 'border', 'accent', 'shadow']
};

/**
 * Convert any color format to hex
 * @param {string} color - CSS color value
 * @returns {string|null} Hex color or null
 */
function normalizeToHex(color) {
  if (!color || color === 'transparent' || color === 'inherit') {
    return null;
  }

  // Already hex
  if (color.startsWith('#')) {
    // Normalize shorthand hex
    if (color.length === 4) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toUpperCase();
    }
    return color.toUpperCase();
  }

  // RGB/RGBA
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  }

  // HSL/HSLA (simplified conversion)
  const hslMatch = color.match(/hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*[\d.]+)?\)/);
  if (hslMatch) {
    const h = parseInt(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    const rgb = hslToRgb(h, s, l);
    const r = rgb[0].toString(16).padStart(2, '0');
    const g = rgb[1].toString(16).padStart(2, '0');
    const b = rgb[2].toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  }

  return null;
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Calculate color difference (simplified deltaE)
 * @param {string} hex1
 * @param {string} hex2
 * @returns {number}
 */
function colorDifference(hex1, hex2) {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);

  return Math.sqrt(
    Math.pow(r2 - r1, 2) +
    Math.pow(g2 - g1, 2) +
    Math.pow(b2 - b1, 2)
  );
}

/**
 * Cluster similar colors together
 * @param {Map} colorMap - Map of hex -> {count, usages}
 * @returns {Array} Clustered colors
 */
function clusterColors(colorMap) {
  const clusters = [];
  const processed = new Set();

  for (const [hex, data] of colorMap) {
    if (processed.has(hex)) continue;

    const cluster = {
      representative: hex,
      members: [hex],
      count: data.count,
      usages: [...data.usages]
    };

    for (const [otherHex, otherData] of colorMap) {
      if (otherHex === hex || processed.has(otherHex)) continue;

      const diff = colorDifference(hex, otherHex);
      if (diff < CONFIG.clusterThreshold * 10) { // Scaled threshold
        cluster.members.push(otherHex);
        cluster.count += otherData.count;
        cluster.usages.push(...otherData.usages);
        processed.add(otherHex);
      }
    }

    // Use most frequent color as representative
    if (cluster.members.length > 1) {
      cluster.representative = cluster.members.reduce((best, hex) => {
        return (colorMap.get(hex)?.count || 0) > (colorMap.get(best)?.count || 0) ? hex : best;
      });
    }

    processed.add(hex);
    clusters.push(cluster);
  }

  return clusters.sort((a, b) => b.count - a.count);
}

/**
 * Generate semantic name for color
 * @param {string} hex
 * @param {string[]} usages
 * @param {number} index
 * @returns {string}
 */
function generateColorName(hex, usages, index) {
  // Check for common patterns
  const uniqueUsages = [...new Set(usages)];

  if (uniqueUsages.includes('backgroundColor') && isLight(hex)) {
    if (hex === '#FFFFFF') return 'white';
    return `background-${index}`;
  }

  if (uniqueUsages.includes('color') && isDark(hex)) {
    if (hex === '#000000') return 'black';
    return `text-${index}`;
  }

  if (uniqueUsages.includes('borderColor')) {
    return `border-${index}`;
  }

  // Heuristic naming based on color characteristics
  const hsl = hexToHsl(hex);

  if (hsl.s < 10) {
    // Grayscale
    if (hsl.l > 90) return 'white';
    if (hsl.l < 10) return 'black';
    return `gray-${Math.round(hsl.l / 10)}`;
  }

  // Chromatic colors
  const hueNames = [
    [0, 'red'], [30, 'orange'], [60, 'yellow'],
    [120, 'green'], [180, 'cyan'], [240, 'blue'],
    [270, 'purple'], [330, 'pink'], [360, 'red']
  ];

  let colorName = 'color';
  for (let i = 0; i < hueNames.length - 1; i++) {
    if (hsl.h >= hueNames[i][0] && hsl.h < hueNames[i + 1][0]) {
      colorName = hueNames[i][1];
      break;
    }
  }

  return `${colorName}-${index}`;
}

function isLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

function isDark(hex) {
  return !isLight(hex);
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Main extraction function - to be called from browser context
 * @returns {Object} Extracted color data
 */
function extractColorsFromPage() {
  const colorMap = new Map();
  const elements = document.querySelectorAll('*');

  const colorProperties = [
    'color',
    'backgroundColor',
    'borderColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor'
  ];

  elements.forEach(el => {
    const styles = getComputedStyle(el);

    colorProperties.forEach(prop => {
      const value = styles[prop];
      const hex = normalizeToHex(value);

      if (hex) {
        if (!colorMap.has(hex)) {
          colorMap.set(hex, { count: 0, usages: [] });
        }
        colorMap.get(hex).count++;
        if (!colorMap.get(hex).usages.includes(prop)) {
          colorMap.get(hex).usages.push(prop);
        }
      }
    });
  });

  // Cluster and categorize
  const clusters = clusterColors(colorMap);

  // Build output
  const colors = {};
  let index = 1;

  clusters.forEach(cluster => {
    if (cluster.count >= CONFIG.minOccurrences) {
      const name = generateColorName(cluster.representative, cluster.usages, index++);
      colors[name] = {
        value: cluster.representative,
        usage: [...new Set(cluster.usages)],
        occurrences: cluster.count,
        variants: cluster.members.length > 1 ? cluster.members : undefined
      };
    }
  });

  return {
    colors,
    stats: {
      totalColorsFound: colorMap.size,
      clusteredColors: Object.keys(colors).length,
      elementsScanned: elements.length
    }
  };
}

// Export for use in Node.js context
if (typeof module !== 'undefined') {
  module.exports = {
    normalizeToHex,
    clusterColors,
    generateColorName,
    extractColorsFromPage,
    CONFIG
  };
}

// Browser context execution helper
if (typeof window !== 'undefined') {
  window.extractColorsFromPage = extractColorsFromPage;
}
