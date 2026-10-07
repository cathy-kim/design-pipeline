/**
 * extract-typography.js
 *
 * Extracts typography system from computed styles of a website.
 * Detects font families, sizes, weights, line-heights, and letter-spacing.
 */

/**
 * Typography extraction configuration
 */
const CONFIG = {
  // Minimum occurrences for a font size to be included
  minOccurrences: 2,
  // Common font size scale names
  sizeNames: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'],
  // Common font weights
  weightNames: {
    100: 'thin',
    200: 'extralight',
    300: 'light',
    400: 'normal',
    500: 'medium',
    600: 'semibold',
    700: 'bold',
    800: 'extrabold',
    900: 'black'
  }
};

/**
 * Parse font size to number (px)
 * @param {string} size - CSS font size
 * @returns {number|null}
 */
function parseFontSize(size) {
  if (!size) return null;

  const pxMatch = size.match(/([\d.]+)px/);
  if (pxMatch) return parseFloat(pxMatch[1]);

  const remMatch = size.match(/([\d.]+)rem/);
  if (remMatch) return parseFloat(remMatch[1]) * 16;

  const emMatch = size.match(/([\d.]+)em/);
  if (emMatch) return parseFloat(emMatch[1]) * 16;

  return null;
}

/**
 * Parse line height to number
 * @param {string} lineHeight - CSS line height
 * @param {number} fontSize - Associated font size in px
 * @returns {number|null}
 */
function parseLineHeight(lineHeight, fontSize) {
  if (!lineHeight || lineHeight === 'normal') return 1.5;

  const pxMatch = lineHeight.match(/([\d.]+)px/);
  if (pxMatch && fontSize) {
    return parseFloat((parseFloat(pxMatch[1]) / fontSize).toFixed(2));
  }

  const numericMatch = lineHeight.match(/^([\d.]+)$/);
  if (numericMatch) {
    return parseFloat(parseFloat(numericMatch[1]).toFixed(2));
  }

  return 1.5;
}

/**
 * Clean font family string
 * @param {string} fontFamily
 * @returns {string}
 */
function cleanFontFamily(fontFamily) {
  if (!fontFamily) return null;

  return fontFamily
    .split(',')
    .map(f => f.trim().replace(/['"]/g, ''))
    .filter(f => !f.startsWith('-apple-system') &&
                 !f.startsWith('BlinkMacSystemFont') &&
                 f !== 'system-ui' &&
                 f !== 'Segoe UI' &&
                 f !== 'Roboto')
    .slice(0, 3)
    .join(', ') || fontFamily;
}

/**
 * Detect type scale ratio
 * @param {number[]} sizes - Sorted array of font sizes
 * @returns {Object} Scale info
 */
function detectScale(sizes) {
  if (sizes.length < 2) {
    return { base: sizes[0] || 16, ratio: 1.25, detected: false };
  }

  // Find the most common size (likely base)
  const sizeFreq = {};
  sizes.forEach(s => {
    const rounded = Math.round(s);
    sizeFreq[rounded] = (sizeFreq[rounded] || 0) + 1;
  });

  // Assume 16px as base if present, otherwise use most frequent
  let base = 16;
  if (!sizeFreq[16]) {
    base = parseInt(Object.entries(sizeFreq).sort((a, b) => b[1] - a[1])[0][0]);
  }

  // Calculate ratios between consecutive sizes
  const uniqueSizes = [...new Set(sizes.map(s => Math.round(s)))].sort((a, b) => a - b);
  const ratios = [];

  for (let i = 1; i < uniqueSizes.length; i++) {
    const ratio = uniqueSizes[i] / uniqueSizes[i - 1];
    if (ratio > 1 && ratio < 2) {
      ratios.push(ratio);
    }
  }

  // Find average ratio
  const avgRatio = ratios.length > 0
    ? ratios.reduce((a, b) => a + b, 0) / ratios.length
    : 1.25;

  // Round to common scale ratios
  const commonRatios = [1.067, 1.125, 1.2, 1.25, 1.333, 1.414, 1.5, 1.618];
  const closestRatio = commonRatios.reduce((prev, curr) =>
    Math.abs(curr - avgRatio) < Math.abs(prev - avgRatio) ? curr : prev
  );

  return {
    base,
    ratio: closestRatio,
    detected: true,
    averageRatio: parseFloat(avgRatio.toFixed(3))
  };
}

/**
 * Generate scale name based on size and base
 * @param {number} size
 * @param {number} base
 * @param {number[]} allSizes
 * @returns {string}
 */
function generateSizeName(size, base, allSizes) {
  const sortedSizes = [...new Set(allSizes.map(s => Math.round(s)))].sort((a, b) => a - b);
  const index = sortedSizes.indexOf(Math.round(size));
  const baseIndex = sortedSizes.indexOf(Math.round(base));

  const offset = index - baseIndex;

  if (offset === 0) return 'base';
  if (offset === -1) return 'sm';
  if (offset === -2) return 'xs';
  if (offset < -2) return `${Math.abs(offset)}xs`;
  if (offset === 1) return 'lg';
  if (offset === 2) return 'xl';
  if (offset > 2) return `${offset}xl`;

  return `size-${Math.round(size)}`;
}

/**
 * Categorize line heights
 * @param {number[]} lineHeights
 * @returns {Object}
 */
function categorizeLineHeights(lineHeights) {
  const unique = [...new Set(lineHeights.filter(lh => lh && lh > 0))].sort((a, b) => a - b);

  const result = {};

  unique.forEach(lh => {
    if (lh <= 1.2) {
      result.none = lh;
    } else if (lh <= 1.3) {
      result.tight = lh;
    } else if (lh <= 1.45) {
      result.snug = lh;
    } else if (lh <= 1.55) {
      result.normal = lh;
    } else if (lh <= 1.7) {
      result.relaxed = lh;
    } else {
      result.loose = lh;
    }
  });

  return result;
}

/**
 * Main extraction function - to be called from browser context
 * @returns {Object} Extracted typography data
 */
function extractTypographyFromPage() {
  const fontFamilies = new Map();
  const fontSizes = new Map();
  const fontWeights = new Map();
  const lineHeights = [];
  const letterSpacings = new Map();

  const elements = document.querySelectorAll('*');

  elements.forEach(el => {
    const styles = getComputedStyle(el);
    const tagName = el.tagName.toLowerCase();

    // Font family
    const family = cleanFontFamily(styles.fontFamily);
    if (family) {
      if (!fontFamilies.has(family)) {
        fontFamilies.set(family, { count: 0, elements: [] });
      }
      fontFamilies.get(family).count++;
      if (!fontFamilies.get(family).elements.includes(tagName)) {
        fontFamilies.get(family).elements.push(tagName);
      }
    }

    // Font size
    const size = parseFontSize(styles.fontSize);
    if (size && size > 0) {
      const rounded = Math.round(size * 10) / 10;
      if (!fontSizes.has(rounded)) {
        fontSizes.set(rounded, { count: 0, elements: [] });
      }
      fontSizes.get(rounded).count++;
      if (!fontSizes.get(rounded).elements.includes(tagName)) {
        fontSizes.get(rounded).elements.push(tagName);
      }
    }

    // Font weight
    const weight = parseInt(styles.fontWeight);
    if (weight) {
      if (!fontWeights.has(weight)) {
        fontWeights.set(weight, { count: 0, elements: [] });
      }
      fontWeights.get(weight).count++;
    }

    // Line height
    const lh = parseLineHeight(styles.lineHeight, size);
    if (lh) {
      lineHeights.push(lh);
    }

    // Letter spacing
    if (styles.letterSpacing && styles.letterSpacing !== 'normal') {
      const ls = styles.letterSpacing;
      if (!letterSpacings.has(ls)) {
        letterSpacings.set(ls, 0);
      }
      letterSpacings.set(ls, letterSpacings.get(ls) + 1);
    }
  });

  // Build font families hierarchy
  const sortedFamilies = [...fontFamilies.entries()]
    .sort((a, b) => b[1].count - a[1].count);

  const familyCategories = {
    heading: null,
    body: null,
    mono: null
  };

  sortedFamilies.forEach(([family, data]) => {
    const isHeading = data.elements.some(e => ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(e));
    const isMono = family.toLowerCase().includes('mono') || family.toLowerCase().includes('code');

    if (isMono && !familyCategories.mono) {
      familyCategories.mono = family;
    } else if (isHeading && !familyCategories.heading) {
      familyCategories.heading = family;
    } else if (!familyCategories.body) {
      familyCategories.body = family;
    }
  });

  // If heading not set, use body
  if (!familyCategories.heading && familyCategories.body) {
    familyCategories.heading = familyCategories.body;
  }

  // Build font sizes scale
  const sizesArray = [...fontSizes.keys()].filter(s =>
    fontSizes.get(s).count >= CONFIG.minOccurrences
  );

  const scaleInfo = detectScale(sizesArray);

  const fontSizeScale = {};
  sizesArray.sort((a, b) => a - b).forEach(size => {
    const name = generateSizeName(size, scaleInfo.base, sizesArray);
    fontSizeScale[name] = `${size}px`;
  });

  // Build font weights
  const fontWeightScale = {};
  [...fontWeights.entries()]
    .filter(([_, data]) => data.count >= CONFIG.minOccurrences)
    .forEach(([weight]) => {
      const name = CONFIG.weightNames[weight] || `w${weight}`;
      fontWeightScale[name] = weight;
    });

  // Build line heights
  const lineHeightScale = categorizeLineHeights(lineHeights);

  // Build letter spacing
  const letterSpacingScale = {};
  [...letterSpacings.entries()]
    .filter(([_, count]) => count >= CONFIG.minOccurrences)
    .sort((a, b) => a[1] - b[1])
    .forEach(([value], index) => {
      letterSpacingScale[`tracking-${index}`] = value;
    });

  return {
    typography: {
      fontFamilies: Object.fromEntries(
        Object.entries(familyCategories).filter(([_, v]) => v)
      ),
      fontSizes: fontSizeScale,
      fontWeights: fontWeightScale,
      lineHeights: lineHeightScale,
      letterSpacing: Object.keys(letterSpacingScale).length > 0 ? letterSpacingScale : undefined
    },
    scale: scaleInfo,
    stats: {
      totalFontsFound: fontFamilies.size,
      totalSizesFound: fontSizes.size,
      totalWeightsFound: fontWeights.size,
      elementsScanned: elements.length
    }
  };
}

// Export for use in Node.js context
if (typeof module !== 'undefined') {
  module.exports = {
    parseFontSize,
    parseLineHeight,
    cleanFontFamily,
    detectScale,
    generateSizeName,
    extractTypographyFromPage,
    CONFIG
  };
}

// Browser context execution helper
if (typeof window !== 'undefined') {
  window.extractTypographyFromPage = extractTypographyFromPage;
}
