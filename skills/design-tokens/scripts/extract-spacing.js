/**
 * extract-spacing.js
 *
 * Extracts spacing system from computed styles of a website.
 * Analyzes margins, paddings, gaps to identify base unit and scale.
 */

/**
 * Spacing extraction configuration
 */
const CONFIG = {
  // Minimum occurrences for a spacing value to be included
  minOccurrences: 3,
  // Common base units to detect
  commonBaseUnits: [4, 5, 6, 8, 10],
  // Maximum scale multiplier to include
  maxMultiplier: 32
};

/**
 * Parse spacing value to number (px)
 * @param {string} value - CSS spacing value
 * @returns {number|null}
 */
function parseSpacingValue(value) {
  if (!value || value === 'auto' || value === 'inherit' || value === 'initial') {
    return null;
  }

  const pxMatch = value.match(/([\d.]+)px/);
  if (pxMatch) return parseFloat(pxMatch[1]);

  const remMatch = value.match(/([\d.]+)rem/);
  if (remMatch) return parseFloat(remMatch[1]) * 16;

  const emMatch = value.match(/([\d.]+)em/);
  if (emMatch) return parseFloat(emMatch[1]) * 16;

  // Check for 0
  if (value === '0' || value === '0px') return 0;

  return null;
}

/**
 * Detect base spacing unit from collected values
 * @param {number[]} values - Array of spacing values
 * @returns {number} Detected base unit
 */
function detectBaseUnit(values) {
  // Filter to positive values and get unique
  const positiveValues = [...new Set(values.filter(v => v > 0))].sort((a, b) => a - b);

  if (positiveValues.length === 0) return 4;

  // Calculate GCD of common values
  const gcdCounts = {};

  CONFIG.commonBaseUnits.forEach(base => {
    let matchCount = 0;
    positiveValues.forEach(value => {
      if (value % base === 0 || Math.abs(value % base) < 0.5) {
        matchCount++;
      }
    });
    gcdCounts[base] = matchCount / positiveValues.length;
  });

  // Find best matching base unit
  let bestBase = 4;
  let bestScore = 0;

  Object.entries(gcdCounts).forEach(([base, score]) => {
    if (score > bestScore) {
      bestScore = score;
      bestBase = parseInt(base);
    }
  });

  return bestBase;
}

/**
 * Build spacing scale from detected base unit and values
 * @param {Map} spacingMap - Map of spacing values to counts
 * @param {number} baseUnit - Detected base unit
 * @returns {Object} Spacing scale
 */
function buildSpacingScale(spacingMap, baseUnit) {
  const scale = { '0': '0px' };

  // Get all values that meet minimum occurrences
  const significantValues = [...spacingMap.entries()]
    .filter(([_, count]) => count >= CONFIG.minOccurrences)
    .map(([value]) => value)
    .filter(v => v >= 0)
    .sort((a, b) => a - b);

  // Map values to scale names
  significantValues.forEach(value => {
    if (value === 0) return;

    const multiplier = Math.round(value / baseUnit);

    if (multiplier > 0 && multiplier <= CONFIG.maxMultiplier) {
      // Check if this multiplier is close to the value
      const expectedValue = multiplier * baseUnit;
      if (Math.abs(value - expectedValue) <= 1) {
        scale[multiplier.toString()] = `${expectedValue}px`;
      } else {
        // Non-standard value, use px naming
        scale[`px-${Math.round(value)}`] = `${Math.round(value)}px`;
      }
    }
  });

  return scale;
}

/**
 * Detect gap/grid spacing patterns
 * @param {Map} gapMap - Map of gap values to counts
 * @returns {Object} Gap patterns
 */
function detectGapPatterns(gapMap) {
  const gaps = {};

  [...gapMap.entries()]
    .filter(([_, count]) => count >= CONFIG.minOccurrences)
    .sort((a, b) => a[0] - b[0])
    .forEach(([value], index) => {
      const names = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
      const name = names[index] || `gap-${Math.round(value)}`;
      gaps[name] = `${Math.round(value)}px`;
    });

  return gaps;
}

/**
 * Main extraction function - to be called from browser context
 * @returns {Object} Extracted spacing data
 */
function extractSpacingFromPage() {
  const marginValues = [];
  const paddingValues = [];
  const gapValues = new Map();
  const allSpacingMap = new Map();

  const elements = document.querySelectorAll('*');

  const spacingProps = [
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'gap', 'rowGap', 'columnGap'
  ];

  elements.forEach(el => {
    const styles = getComputedStyle(el);

    // Margins
    ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'].forEach(prop => {
      const value = parseSpacingValue(styles[prop]);
      if (value !== null && value >= 0) {
        marginValues.push(value);
        allSpacingMap.set(value, (allSpacingMap.get(value) || 0) + 1);
      }
    });

    // Paddings
    ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach(prop => {
      const value = parseSpacingValue(styles[prop]);
      if (value !== null && value >= 0) {
        paddingValues.push(value);
        allSpacingMap.set(value, (allSpacingMap.get(value) || 0) + 1);
      }
    });

    // Gaps (for flexbox/grid)
    ['gap', 'rowGap', 'columnGap'].forEach(prop => {
      const value = parseSpacingValue(styles[prop]);
      if (value !== null && value > 0) {
        gapValues.set(value, (gapValues.get(value) || 0) + 1);
      }
    });
  });

  // Detect base unit
  const baseUnit = detectBaseUnit([...allSpacingMap.keys()]);

  // Build main spacing scale
  const spacingScale = buildSpacingScale(allSpacingMap, baseUnit);

  // Detect gap patterns
  const gapPatterns = detectGapPatterns(gapValues);

  // Calculate statistics
  const uniqueMargins = new Set(marginValues.filter(v => v > 0));
  const uniquePaddings = new Set(paddingValues.filter(v => v > 0));

  return {
    spacing: {
      base: `${baseUnit}px`,
      scale: spacingScale,
      gaps: Object.keys(gapPatterns).length > 0 ? gapPatterns : undefined
    },
    analysis: {
      baseUnit,
      confidence: calculateConfidence(allSpacingMap, baseUnit),
      mostUsedValues: getMostUsed(allSpacingMap, 5)
    },
    stats: {
      uniqueMarginValues: uniqueMargins.size,
      uniquePaddingValues: uniquePaddings.size,
      uniqueGapValues: gapValues.size,
      totalSpacingValues: allSpacingMap.size,
      elementsScanned: elements.length
    }
  };
}

/**
 * Calculate confidence score for base unit detection
 */
function calculateConfidence(spacingMap, baseUnit) {
  const values = [...spacingMap.entries()];
  let matchCount = 0;
  let totalWeight = 0;

  values.forEach(([value, count]) => {
    if (value === 0 || value % baseUnit === 0 || Math.abs(value % baseUnit) < 0.5) {
      matchCount += count;
    }
    totalWeight += count;
  });

  return totalWeight > 0
    ? Math.round((matchCount / totalWeight) * 100)
    : 0;
}

/**
 * Get most used spacing values
 */
function getMostUsed(spacingMap, limit) {
  return [...spacingMap.entries()]
    .filter(([value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value: `${value}px`, count }));
}

// Export for use in Node.js context
if (typeof module !== 'undefined') {
  module.exports = {
    parseSpacingValue,
    detectBaseUnit,
    buildSpacingScale,
    extractSpacingFromPage,
    CONFIG
  };
}

// Browser context execution helper
if (typeof window !== 'undefined') {
  window.extractSpacingFromPage = extractSpacingFromPage;
}
