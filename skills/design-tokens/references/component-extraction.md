# Component Extraction Guide

## Overview

This document describes how to identify and extract common UI component patterns from websites using DOM analysis and computed styles.

---

## Component Identification Strategy

### 1. Selector-Based Detection

Each component type has associated selectors:

```javascript
const selectors = {
  button: ['button', '[role="button"]', '.btn', '.button'],
  card: ['.card', 'article', '.panel', '[class*="card"]'],
  input: ['input', 'textarea', 'select', '.input'],
  badge: ['.badge', '.tag', '.chip', '.label'],
  avatar: ['.avatar', '[class*="avatar"]'],
  modal: ['.modal', '.dialog', '[role="dialog"]'],
  nav: ['nav', '.nav', '.navbar'],
  dropdown: ['.dropdown', '[class*="menu"]']
};
```

### 2. Style Pattern Detection

Some components are identified by their style patterns:

```javascript
const stylePatterns = {
  button: {
    required: ['cursor: pointer'],
    common: ['display: inline-flex', 'border-radius']
  },
  card: {
    required: ['box-shadow'],
    common: ['border-radius', 'overflow: hidden']
  },
  avatar: {
    required: ['border-radius: 50%', 'border-radius: 9999px'],
    common: ['overflow: hidden']
  }
};
```

### 3. Semantic Detection

Look for ARIA attributes and semantic HTML:

```javascript
const semanticPatterns = {
  button: ['[role="button"]', 'button[type]'],
  dialog: ['[role="dialog"]', '[aria-modal="true"]'],
  nav: ['[role="navigation"]', 'nav'],
  menu: ['[role="menu"]', '[role="menuitem"]']
};
```

---

## Component Types

### Button

**Identification:**
- `<button>` elements
- Elements with `role="button"`
- Links with `.btn` or `.button` class
- `cursor: pointer` with hover effects

**Extracted Properties:**
```javascript
{
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 16px',
  fontSize: '14px',
  fontWeight: 500,
  lineHeight: 1.5,
  borderRadius: '6px',
  borderWidth: '1px',
  backgroundColor: '#FFFFFF',
  color: '#111827',
  cursor: 'pointer',
  transition: 'all 150ms'
}
```

**Variants to Detect:**
- Primary (filled)
- Secondary (outlined)
- Ghost (transparent)
- Link (underline on hover)
- Icon-only (square aspect ratio)

---

### Card

**Identification:**
- `.card` class or contains "card"
- `<article>` elements with shadows
- Container with border-radius + shadow/border

**Extracted Properties:**
```javascript
{
  display: 'flex',
  flexDirection: 'column',
  padding: '24px',
  borderRadius: '8px',
  backgroundColor: '#FFFFFF',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  border: '1px solid #E5E7EB'
}
```

**Sub-components:**
- Card Header
- Card Body
- Card Footer
- Card Image

---

### Input

**Identification:**
- `<input>`, `<textarea>`, `<select>`
- `.input`, `.form-control` classes
- Elements with visible border and padding

**Extracted Properties:**
```javascript
{
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  fontSize: '14px',
  lineHeight: 1.5,
  borderRadius: '6px',
  borderWidth: '1px',
  borderColor: '#D1D5DB',
  backgroundColor: '#FFFFFF',
  color: '#111827',
  outline: 'none'
}
```

**States to Detect:**
- Default
- Focus (ring/outline)
- Error (red border)
- Disabled (opacity)

---

### Badge / Tag

**Identification:**
- `.badge`, `.tag`, `.chip`, `.label`
- Small inline elements with background
- Usually contains short text

**Extracted Properties:**
```javascript
{
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  fontSize: '12px',
  fontWeight: 500,
  lineHeight: 1.25,
  borderRadius: '9999px',
  backgroundColor: '#EFF6FF',
  color: '#1D4ED8'
}
```

---

### Avatar

**Identification:**
- `.avatar` class
- Circular images
- `border-radius: 50%` or `border-radius: 9999px`

**Extracted Properties:**
```javascript
{
  display: 'inline-block',
  width: '40px',
  height: '40px',
  borderRadius: '9999px',
  backgroundColor: '#E5E7EB',
  overflow: 'hidden'
}
```

**Sizes:**
- xs: 24px
- sm: 32px
- md: 40px
- lg: 48px
- xl: 64px

---

### Modal / Dialog

**Identification:**
- `.modal`, `.dialog` classes
- `role="dialog"`
- `position: fixed` with high z-index

**Extracted Properties:**
```javascript
{
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  maxWidth: '500px',
  width: '100%',
  padding: '24px',
  borderRadius: '12px',
  backgroundColor: '#FFFFFF',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  zIndex: 50
}
```

---

### Navigation

**Identification:**
- `<nav>` element
- `.nav`, `.navbar`, `.navigation`
- Contains links in flex/grid layout

**Extracted Properties:**
```javascript
{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 24px',
  backgroundColor: '#FFFFFF',
  borderBottom: '1px solid #E5E7EB'
}
```

---

### Dropdown

**Identification:**
- `.dropdown`, `.select`, `.menu`
- `position: absolute` child of button/trigger
- Contains list of items

**Extracted Properties:**
```javascript
{
  position: 'absolute',
  top: '100%',
  left: 0,
  minWidth: '160px',
  padding: '4px 0',
  borderRadius: '8px',
  backgroundColor: '#FFFFFF',
  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
  border: '1px solid #E5E7EB',
  zIndex: 10
}
```

---

## Extraction Algorithm

### Step 1: DOM Query

```javascript
function findComponents(type) {
  const selectors = CONFIG.componentSignatures[type].selectors;
  const elements = [];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (isVisible(el)) {
        elements.push(el);
      }
    });
  });

  return elements;
}
```

### Step 2: Style Collection

```javascript
function collectStyles(element) {
  const computed = getComputedStyle(element);

  return {
    display: computed.display,
    padding: combinePadding(computed),
    borderRadius: computed.borderRadius,
    backgroundColor: normalizeColor(computed.backgroundColor),
    // ... other properties
  };
}
```

### Step 3: Pattern Aggregation

```javascript
function findCommonPattern(samples) {
  const propertyFrequency = {};

  samples.forEach(sample => {
    Object.entries(sample.styles).forEach(([prop, value]) => {
      if (!propertyFrequency[prop]) {
        propertyFrequency[prop] = {};
      }
      propertyFrequency[prop][value] =
        (propertyFrequency[prop][value] || 0) + 1;
    });
  });

  // Find most common value for each property
  const common = {};
  Object.entries(propertyFrequency).forEach(([prop, values]) => {
    const sorted = Object.entries(values).sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] > samples.length / 2) {
      common[prop] = sorted[0][0];
    }
  });

  return common;
}
```

### Step 4: Validation

```javascript
function validateComponent(type, styles) {
  const required = CONFIG.componentSignatures[type].stylePatterns;

  return required.every(pattern => {
    return Object.entries(styles).some(([prop, value]) =>
      `${prop}: ${value}`.includes(pattern)
    );
  });
}
```

---

## Output Format

### Per-Component Token

```json
{
  "button": {
    "borderRadius": "6px",
    "padding": "8px 16px",
    "fontSize": "14px",
    "fontWeight": 500,
    "height": "40px",
    "transition": "all 150ms"
  }
}
```

### Analysis Data

```json
{
  "button": {
    "found": 24,
    "commonStyles": { /* ... */ },
    "samples": [
      { "selector": "button", "classes": ["btn", "btn-primary"] },
      { "selector": ".button", "classes": ["button", "is-primary"] }
    ]
  }
}
```

---

## Best Practices

### 1. Sample Size

Collect at least 3-5 samples per component type for reliable pattern detection.

### 2. Visibility Check

Always filter out hidden elements:

```javascript
function isVisible(el) {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    rect.width > 10 &&
    rect.height > 10
  );
}
```

### 3. Class Filtering

Ignore utility classes and state classes:

```javascript
const ignoreClasses = [
  'hidden', 'visible', 'active', 'disabled',
  'hover', 'focus', 'selected', 'open'
];
```

### 4. Specificity

When multiple patterns match, prefer:
1. Semantic HTML elements (`<button>` over `.btn`)
2. ARIA roles over class names
3. More specific selectors over generic ones

---

## References

- [WAI-ARIA Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN: CSS Computed Style](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle)
