# Typography Analysis Guide

## Overview

This document describes algorithms and techniques for analyzing and extracting typography systems from websites.

---

## Font Family Analysis

### Detection Strategy

1. **Collect all font-family declarations**
2. **Clean and normalize values**
3. **Categorize by usage**

### Font Family Cleaning

```javascript
function cleanFontFamily(fontFamily) {
  return fontFamily
    .split(',')
    .map(f => f.trim().replace(/['"]/g, ''))
    // Remove system fonts
    .filter(f =>
      !f.startsWith('-apple-system') &&
      !f.startsWith('BlinkMacSystemFont') &&
      f !== 'system-ui' &&
      f !== 'Segoe UI'
    )
    .slice(0, 3)
    .join(', ');
}
```

### Categorization

| Category | Detection Method |
|----------|-----------------|
| Heading | Used in `<h1>-<h6>` elements |
| Body | Most frequently used font |
| Mono | Contains "mono", "code", or "courier" |

### Output

```json
{
  "fontFamilies": {
    "heading": "Inter, sans-serif",
    "body": "Inter, sans-serif",
    "mono": "JetBrains Mono, monospace"
  }
}
```

---

## Font Size Scale Detection

### Type Scale Theory

Common type scales use mathematical ratios:

| Name | Ratio | Description |
|------|-------|-------------|
| Minor Second | 1.067 | Subtle variation |
| Major Second | 1.125 | Standard scale |
| Minor Third | 1.2 | Modest progression |
| Major Third | 1.25 | **Most common** |
| Perfect Fourth | 1.333 | Strong progression |
| Augmented Fourth | 1.414 | √2, geometric |
| Perfect Fifth | 1.5 | Musical ratio |
| Golden Ratio | 1.618 | Classical proportion |

### Detection Algorithm

```javascript
function detectTypeScale(fontSizes) {
  // Step 1: Sort sizes ascending
  const sorted = [...new Set(fontSizes)].sort((a, b) => a - b);

  // Step 2: Calculate ratios between consecutive sizes
  const ratios = [];
  for (let i = 1; i < sorted.length; i++) {
    const ratio = sorted[i] / sorted[i - 1];
    if (ratio > 1 && ratio < 2) {
      ratios.push(ratio);
    }
  }

  // Step 3: Find average ratio
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

  // Step 4: Match to common ratio
  const commonRatios = [1.067, 1.125, 1.2, 1.25, 1.333, 1.414, 1.5, 1.618];
  const closest = commonRatios.reduce((prev, curr) =>
    Math.abs(curr - avgRatio) < Math.abs(prev - avgRatio) ? curr : prev
  );

  return {
    ratio: closest,
    averageRatio: avgRatio,
    confidence: calculateConfidence(ratios, closest)
  };
}
```

### Base Size Detection

The base size is typically:
- 16px (browser default)
- Most frequently used size
- Size closest to 16px in the scale

```javascript
function detectBaseSize(fontSizes, frequencies) {
  // Prefer 16px if present
  if (fontSizes.includes(16)) {
    return 16;
  }

  // Otherwise use most frequent size near 16px
  const nearBase = fontSizes.filter(s => s >= 14 && s <= 18);
  if (nearBase.length > 0) {
    return nearBase.reduce((best, size) =>
      frequencies[size] > frequencies[best] ? size : best
    );
  }

  // Fallback to most frequent
  return Object.entries(frequencies)
    .sort((a, b) => b[1] - a[1])[0][0];
}
```

### Scale Naming

```javascript
function generateScaleName(size, baseSize, allSizes) {
  const sorted = [...new Set(allSizes)].sort((a, b) => a - b);
  const index = sorted.indexOf(size);
  const baseIndex = sorted.indexOf(baseSize);

  const offset = index - baseIndex;

  const names = {
    '-4': '4xs',
    '-3': '3xs',
    '-2': '2xs',
    '-1': 'xs',
    '0': 'base',
    '1': 'lg',
    '2': 'xl',
    '3': '2xl',
    '4': '3xl',
    '5': '4xl',
    '6': '5xl',
    '7': '6xl',
    '8': '7xl',
    '9': '8xl'
  };

  // Special case: one step below base
  if (offset === -1) return 'sm';

  return names[offset.toString()] || `size-${size}`;
}
```

---

## Font Weight Analysis

### Standard Weights

| Value | Name | CSS Keyword |
|-------|------|-------------|
| 100 | Thin | thin |
| 200 | Extra Light | extralight |
| 300 | Light | light |
| 400 | Normal | normal |
| 500 | Medium | medium |
| 600 | Semi Bold | semibold |
| 700 | Bold | bold |
| 800 | Extra Bold | extrabold |
| 900 | Black | black |

### Detection

```javascript
function extractFontWeights(elements) {
  const weights = new Map();

  elements.forEach(el => {
    const weight = parseInt(getComputedStyle(el).fontWeight);
    weights.set(weight, (weights.get(weight) || 0) + 1);
  });

  // Filter to significant weights
  const significant = [...weights.entries()]
    .filter(([_, count]) => count >= 3)
    .map(([weight]) => weight);

  // Map to names
  const named = {};
  significant.forEach(weight => {
    named[weightToName(weight)] = weight;
  });

  return named;
}
```

---

## Line Height Analysis

### Categories

| Range | Name | Use Case |
|-------|------|----------|
| 1.0-1.2 | none/tight | Display text, headings |
| 1.2-1.35 | tight | Headings |
| 1.35-1.5 | snug | Compact body text |
| 1.5-1.6 | normal | Body text |
| 1.6-1.8 | relaxed | Long-form content |
| >1.8 | loose | Improved readability |

### Detection Algorithm

```javascript
function analyzeLineHeights(elements) {
  const lineHeights = [];

  elements.forEach(el => {
    const style = getComputedStyle(el);
    const fontSize = parseFloat(style.fontSize);
    const lineHeight = style.lineHeight;

    let ratio;
    if (lineHeight === 'normal') {
      ratio = 1.2; // Browser default
    } else if (lineHeight.endsWith('px')) {
      ratio = parseFloat(lineHeight) / fontSize;
    } else {
      ratio = parseFloat(lineHeight);
    }

    if (ratio && !isNaN(ratio)) {
      lineHeights.push(Math.round(ratio * 100) / 100);
    }
  });

  return categorizeLineHeights([...new Set(lineHeights)]);
}

function categorizeLineHeights(ratios) {
  const result = {};

  ratios.sort((a, b) => a - b).forEach(lh => {
    if (lh <= 1.2) result.none = lh;
    else if (lh <= 1.35) result.tight = lh;
    else if (lh <= 1.5) result.snug = lh;
    else if (lh <= 1.6) result.normal = lh;
    else if (lh <= 1.8) result.relaxed = lh;
    else result.loose = lh;
  });

  return result;
}
```

---

## Letter Spacing Analysis

### Common Patterns

| Value | Name | Use Case |
|-------|------|----------|
| -0.05em | tighter | Dense headings |
| -0.025em | tight | Headings |
| 0 | normal | Body text |
| 0.025em | wide | Buttons, labels |
| 0.05em | wider | All caps |
| 0.1em | widest | Decorative |

### Detection

```javascript
function extractLetterSpacing(elements) {
  const spacings = new Map();

  elements.forEach(el => {
    const ls = getComputedStyle(el).letterSpacing;
    if (ls && ls !== 'normal') {
      spacings.set(ls, (spacings.get(ls) || 0) + 1);
    }
  });

  return [...spacings.entries()]
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .reduce((acc, [value], index) => {
      const names = ['tighter', 'tight', 'normal', 'wide', 'wider', 'widest'];
      acc[names[index] || `tracking-${index}`] = value;
      return acc;
    }, {});
}
```

---

## Typography Token Output

### Complete Structure

```json
{
  "typography": {
    "fontFamilies": {
      "heading": "Inter, sans-serif",
      "body": "Inter, sans-serif",
      "mono": "JetBrains Mono, monospace"
    },
    "fontSizes": {
      "xs": "12px",
      "sm": "14px",
      "base": "16px",
      "lg": "18px",
      "xl": "20px",
      "2xl": "24px",
      "3xl": "30px",
      "4xl": "36px"
    },
    "fontWeights": {
      "normal": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    },
    "lineHeights": {
      "tight": 1.25,
      "snug": 1.375,
      "normal": 1.5,
      "relaxed": 1.625
    },
    "letterSpacing": {
      "tight": "-0.025em",
      "normal": "0em",
      "wide": "0.025em"
    }
  },
  "scale": {
    "base": 16,
    "ratio": 1.25,
    "detected": true
  }
}
```

### CSS Custom Properties Output

```css
:root {
  /* Font Families */
  --font-heading: Inter, sans-serif;
  --font-body: Inter, sans-serif;
  --font-mono: JetBrains Mono, monospace;

  /* Font Sizes */
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;
  --text-4xl: 36px;

  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* Line Heights */
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;

  /* Letter Spacing */
  --tracking-tight: -0.025em;
  --tracking-normal: 0em;
  --tracking-wide: 0.025em;
}
```

---

## Validation Rules

### Font Families

- At least one font family detected
- Valid CSS font-family syntax
- Fallback fonts present

### Font Sizes

- Minimum 3 sizes detected
- Base size between 14-18px
- Scale ratio between 1.0-2.0

### Font Weights

- At least 2 weights detected
- Values are multiples of 100
- Range 100-900

### Line Heights

- At least 2 line heights
- Values between 1.0-3.0
- Includes "normal" category

---

## References

- [Type Scale Calculator](https://type-scale.com/)
- [Modular Scale](https://www.modularscale.com/)
- [MDN: font-size](https://developer.mozilla.org/en-US/docs/Web/CSS/font-size)
- [Google Fonts](https://fonts.google.com/)
