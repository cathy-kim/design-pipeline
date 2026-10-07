/**
 * extract-components.js
 *
 * Extracts component patterns from website DOM and styles.
 * Identifies common UI component signatures like buttons, cards, inputs.
 */

/**
 * Component extraction configuration
 */
const CONFIG = {
  // Component type signatures
  componentSignatures: {
    button: {
      selectors: ['button', '[role="button"]', 'a.btn', 'a.button', '.btn', '.button'],
      stylePatterns: ['cursor: pointer', 'display: inline-flex']
    },
    card: {
      selectors: ['.card', '[class*="card"]', 'article', '.panel'],
      stylePatterns: ['box-shadow', 'border-radius']
    },
    input: {
      selectors: ['input', 'textarea', 'select', '.input', '.form-control'],
      stylePatterns: ['border', 'outline']
    },
    badge: {
      selectors: ['.badge', '.tag', '.chip', '.label', '[class*="badge"]'],
      stylePatterns: ['display: inline', 'border-radius']
    },
    avatar: {
      selectors: ['.avatar', '[class*="avatar"]', '.profile-pic'],
      stylePatterns: ['border-radius: 50%', 'border-radius: 9999px']
    },
    modal: {
      selectors: ['.modal', '.dialog', '[role="dialog"]', '[class*="modal"]'],
      stylePatterns: ['position: fixed', 'z-index']
    },
    nav: {
      selectors: ['nav', '.nav', '.navbar', '.navigation', 'header nav'],
      stylePatterns: ['display: flex']
    },
    dropdown: {
      selectors: ['.dropdown', '.select', '[class*="dropdown"]', '[class*="menu"]'],
      stylePatterns: ['position: absolute', 'z-index']
    }
  }
};

/**
 * Extract style properties from computed styles
 * @param {CSSStyleDeclaration} styles
 * @returns {Object}
 */
function extractComponentStyles(styles) {
  return {
    // Layout
    display: styles.display,
    position: styles.position,
    flexDirection: styles.flexDirection !== 'row' ? styles.flexDirection : undefined,
    alignItems: styles.alignItems !== 'stretch' ? styles.alignItems : undefined,
    justifyContent: styles.justifyContent !== 'flex-start' ? styles.justifyContent : undefined,
    gap: styles.gap !== 'normal' ? styles.gap : undefined,

    // Sizing
    width: parseSize(styles.width),
    height: parseSize(styles.height),
    minHeight: parseSize(styles.minHeight),
    padding: normalizeSpacing(styles),

    // Appearance
    backgroundColor: normalizeColor(styles.backgroundColor),
    color: normalizeColor(styles.color),
    borderRadius: parseBorderRadius(styles.borderRadius),
    borderWidth: parseBorderWidth(styles),
    borderColor: normalizeColor(styles.borderColor),
    boxShadow: parseBoxShadow(styles.boxShadow),

    // Typography
    fontSize: styles.fontSize,
    fontWeight: styles.fontWeight !== '400' ? styles.fontWeight : undefined,
    lineHeight: styles.lineHeight !== 'normal' ? styles.lineHeight : undefined,
    textTransform: styles.textTransform !== 'none' ? styles.textTransform : undefined,

    // Interaction
    cursor: styles.cursor !== 'auto' ? styles.cursor : undefined,
    transition: parseTransition(styles.transition)
  };
}

/**
 * Parse size value
 */
function parseSize(value) {
  if (!value || value === 'auto' || value === '0px') return undefined;
  return value;
}

/**
 * Normalize spacing to shorthand
 */
function normalizeSpacing(styles) {
  const top = styles.paddingTop;
  const right = styles.paddingRight;
  const bottom = styles.paddingBottom;
  const left = styles.paddingLeft;

  if (top === '0px' && right === '0px' && bottom === '0px' && left === '0px') {
    return undefined;
  }

  if (top === bottom && left === right) {
    if (top === left) {
      return top;
    }
    return `${top} ${left}`;
  }

  return `${top} ${right} ${bottom} ${left}`;
}

/**
 * Normalize color value
 */
function normalizeColor(color) {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
    return undefined;
  }

  // Convert to hex if rgb
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  }

  return color;
}

/**
 * Parse border radius
 */
function parseBorderRadius(value) {
  if (!value || value === '0px') return undefined;

  // Check for circle
  if (value === '50%' || value === '9999px') {
    return 'full';
  }

  return value;
}

/**
 * Parse border width
 */
function parseBorderWidth(styles) {
  const width = styles.borderWidth;
  if (!width || width === '0px') return undefined;

  // Check if all sides are equal
  const top = styles.borderTopWidth;
  const right = styles.borderRightWidth;
  const bottom = styles.borderBottomWidth;
  const left = styles.borderLeftWidth;

  if (top === right && right === bottom && bottom === left) {
    return top;
  }

  return width;
}

/**
 * Parse box shadow
 */
function parseBoxShadow(value) {
  if (!value || value === 'none') return undefined;

  // Simplify common shadow patterns
  if (value.includes('0px 1px 2px') || value.includes('0 1px 2px')) {
    return 'sm';
  }
  if (value.includes('0px 1px 3px') || value.includes('0 1px 3px')) {
    return 'DEFAULT';
  }
  if (value.includes('0px 4px 6px') || value.includes('0 4px 6px')) {
    return 'md';
  }
  if (value.includes('0px 10px 15px') || value.includes('0 10px 15px')) {
    return 'lg';
  }
  if (value.includes('0px 20px 25px') || value.includes('0 20px 25px')) {
    return 'xl';
  }

  return value;
}

/**
 * Parse transition
 */
function parseTransition(value) {
  if (!value || value === 'none' || value === 'all 0s ease 0s') {
    return undefined;
  }

  // Extract just the property and duration
  const match = value.match(/(\w+)\s+([\d.]+m?s)/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }

  return value.length > 50 ? value.substring(0, 50) + '...' : value;
}

/**
 * Find and analyze components on page
 */
function findComponents() {
  const components = {};

  Object.entries(CONFIG.componentSignatures).forEach(([type, config]) => {
    const samples = [];

    config.selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const styles = getComputedStyle(el);
          const rect = el.getBoundingClientRect();

          // Skip hidden or very small elements
          if (rect.width < 10 || rect.height < 10) return;
          if (styles.display === 'none' || styles.visibility === 'hidden') return;

          samples.push({
            selector,
            tagName: el.tagName.toLowerCase(),
            classes: el.className ? el.className.split(' ').filter(c => c).slice(0, 5) : [],
            styles: extractComponentStyles(styles)
          });
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });

    if (samples.length > 0) {
      // Find most common pattern
      const commonStyles = findCommonStyles(samples);

      components[type] = {
        found: samples.length,
        commonStyles,
        samples: samples.slice(0, 3).map(s => ({
          selector: s.selector,
          classes: s.classes
        }))
      };
    }
  });

  return components;
}

/**
 * Find common styles across samples
 */
function findCommonStyles(samples) {
  if (samples.length === 0) return {};
  if (samples.length === 1) return cleanStyles(samples[0].styles);

  const common = {};
  const firstStyles = samples[0].styles;

  Object.entries(firstStyles).forEach(([prop, value]) => {
    if (value === undefined) return;

    // Check if majority of samples have similar value
    let matchCount = 0;
    samples.forEach(sample => {
      if (sample.styles[prop] === value) {
        matchCount++;
      }
    });

    if (matchCount > samples.length / 2) {
      common[prop] = value;
    }
  });

  return cleanStyles(common);
}

/**
 * Remove undefined values from styles object
 */
function cleanStyles(styles) {
  const cleaned = {};
  Object.entries(styles).forEach(([key, value]) => {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  });
  return cleaned;
}

/**
 * Main extraction function - to be called from browser context
 * @returns {Object} Extracted component data
 */
function extractComponentsFromPage() {
  const components = findComponents();

  // Build simplified component tokens
  const componentTokens = {};

  Object.entries(components).forEach(([type, data]) => {
    if (Object.keys(data.commonStyles).length > 0) {
      componentTokens[type] = data.commonStyles;
    }
  });

  return {
    components: componentTokens,
    analysis: components,
    stats: {
      componentTypesFound: Object.keys(components).length,
      totalComponentsFound: Object.values(components).reduce((sum, c) => sum + c.found, 0)
    }
  };
}

// Export for use in Node.js context
if (typeof module !== 'undefined') {
  module.exports = {
    extractComponentStyles,
    findComponents,
    extractComponentsFromPage,
    CONFIG
  };
}

// Browser context execution helper
if (typeof window !== 'undefined') {
  window.extractComponentsFromPage = extractComponentsFromPage;
}
