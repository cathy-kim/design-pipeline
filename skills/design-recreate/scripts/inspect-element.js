#!/usr/bin/env node

/**
 * Element Inspector Script
 *
 * Generates robust CSS selectors for DOM elements using Playwright.
 * Supports multiple selector strategies and validates uniqueness.
 *
 * Usage:
 *   node inspect-element.js <url> [selector]
 *
 * Examples:
 *   node inspect-element.js https://example.com
 *   node inspect-element.js https://example.com "button.primary"
 *   node inspect-element.js https://example.com "#main-nav > ul > li:first-child"
 */

const { chromium } = require('playwright');

const SELECTOR_STRATEGIES = {
  ID: 'id',
  CLASS: 'class',
  ATTRIBUTE: 'attribute',
  TAG: 'tag',
  NTH_CHILD: 'nth-child',
  COMBINED: 'combined'
};

/**
 * Generate multiple CSS selector strategies for an element
 */
async function generateSelectors(page, selector) {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) {
      return { error: `Element not found: ${sel}` };
    }

    const selectors = {};

    // ID selector
    if (element.id) {
      selectors.id = `#${element.id}`;
    }

    // Class selector
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        selectors.class = '.' + classes.join('.');
      }
    }

    // Attribute selectors
    const attributes = {};
    const priorityAttrs = ['data-testid', 'data-test', 'data-cy', 'name', 'type', 'role', 'aria-label'];
    priorityAttrs.forEach(attr => {
      if (element.hasAttribute(attr)) {
        attributes[attr] = element.getAttribute(attr);
        if (!selectors.attribute) {
          selectors.attribute = `[${attr}="${element.getAttribute(attr)}"]`;
        }
      }
    });

    // Tag selector
    selectors.tag = element.tagName.toLowerCase();

    // Nth-child selector
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element) + 1;
      const sameTagSiblings = siblings.filter(s => s.tagName === element.tagName);

      if (sameTagSiblings.length > 1) {
        const tagIndex = sameTagSiblings.indexOf(element) + 1;
        selectors.nthChild = `${element.tagName.toLowerCase()}:nth-of-type(${tagIndex})`;
      } else {
        selectors.nthChild = `${element.tagName.toLowerCase()}:nth-child(${index})`;
      }
    }

    // Combined selector (most specific)
    let combined = element.tagName.toLowerCase();
    if (element.id) {
      combined += `#${element.id}`;
    }
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        combined += '.' + classes.slice(0, 2).join('.');
      }
    }
    selectors.combined = combined;

    // XPath
    function getXPath(el) {
      if (el.id) {
        return `//*[@id="${el.id}"]`;
      }
      if (el === document.body) {
        return '/html/body';
      }
      const parent = el.parentElement;
      if (!parent) {
        return '/' + el.tagName.toLowerCase();
      }
      const siblings = Array.from(parent.children).filter(s => s.tagName === el.tagName);
      const index = siblings.indexOf(el) + 1;
      const suffix = siblings.length > 1 ? `[${index}]` : '';
      return getXPath(parent) + '/' + el.tagName.toLowerCase() + suffix;
    }

    // Element info
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);

    return {
      element: {
        tagName: element.tagName,
        id: element.id || null,
        className: element.className || null,
        attributes: attributes,
        textContent: element.textContent?.slice(0, 100) || null,
        innerHTML: element.innerHTML?.slice(0, 200) || null
      },
      selectors: selectors,
      xpath: getXPath(element),
      dimensions: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        top: Math.round(rect.top),
        left: Math.round(rect.left)
      },
      styles: {
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        position: computedStyle.position,
        color: computedStyle.color,
        backgroundColor: computedStyle.backgroundColor,
        fontSize: computedStyle.fontSize,
        fontFamily: computedStyle.fontFamily
      }
    };
  }, selector);
}

/**
 * Validate selector uniqueness
 */
async function validateSelector(page, selector) {
  return await page.evaluate((sel) => {
    const matches = document.querySelectorAll(sel);
    return {
      selector: sel,
      matchCount: matches.length,
      isUnique: matches.length === 1,
      matches: Array.from(matches).slice(0, 5).map(el => ({
        tagName: el.tagName,
        id: el.id || null,
        className: el.className || null
      }))
    };
  }, selector);
}

/**
 * Inspect all interactive elements on the page
 */
async function inspectAllInteractive(page) {
  return await page.evaluate(() => {
    const interactiveSelectors = [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[onclick]',
      '[tabindex]'
    ];

    const elements = [];
    interactiveSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          elements.push({
            tagName: el.tagName,
            type: el.type || null,
            id: el.id || null,
            className: el.className || null,
            text: el.textContent?.trim().slice(0, 50) || null,
            href: el.href || null,
            dimensions: {
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              x: Math.round(rect.x),
              y: Math.round(rect.y)
            }
          });
        }
      });
    });

    return {
      count: elements.length,
      elements: elements.slice(0, 50) // Limit to first 50
    };
  });
}

/**
 * Generate CSS path to element
 */
async function getCSSPath(page, selector) {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return null;

    const path = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break; // ID is unique, stop here
      }

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          selector += '.' + classes[0];
        }
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(s =>
          s.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = parent;
    }

    return path.join(' > ');
  }, selector);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: node inspect-element.js <url> [selector]

Arguments:
  url       - The URL to inspect
  selector  - Optional CSS selector to inspect a specific element

Examples:
  node inspect-element.js https://example.com
  node inspect-element.js https://example.com "button.primary"
  node inspect-element.js https://example.com "#main-nav"

Output:
  JSON object with element info, selectors, and dimensions
    `);
    process.exit(0);
  }

  const url = args[0];
  const selector = args[1];

  console.error(`Launching browser for: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    console.error('Page loaded successfully');

    let result = {};

    if (selector) {
      // Inspect specific element
      console.error(`Inspecting element: ${selector}`);

      const selectorInfo = await generateSelectors(page, selector);

      if (selectorInfo.error) {
        result = { error: selectorInfo.error };
      } else {
        // Validate all generated selectors
        const validations = {};
        for (const [strategy, sel] of Object.entries(selectorInfo.selectors)) {
          if (sel) {
            validations[strategy] = await validateSelector(page, sel);
          }
        }

        const cssPath = await getCSSPath(page, selector);

        result = {
          url,
          originalSelector: selector,
          ...selectorInfo,
          cssPath,
          validations,
          recommendedSelector: getRecommendedSelector(selectorInfo.selectors, validations)
        };
      }
    } else {
      // Inspect all interactive elements
      console.error('Inspecting all interactive elements');

      const interactive = await inspectAllInteractive(page);
      const pageInfo = await page.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        documentElement: {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight
        }
      }));

      result = {
        url,
        page: pageInfo,
        interactiveElements: interactive
      };
    }

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.log(JSON.stringify({ error: error.message }, null, 2));
    process.exit(1);
  } finally {
    await browser.close();
  }
}

function getRecommendedSelector(selectors, validations) {
  // Priority: data-testid > id > unique class > combined
  const priority = ['attribute', 'id', 'class', 'combined', 'nthChild'];

  for (const strategy of priority) {
    const sel = selectors[strategy];
    const validation = validations[strategy];

    if (sel && validation && validation.isUnique) {
      return {
        selector: sel,
        strategy,
        reason: strategy === 'attribute'
          ? 'Data attributes are most stable for testing'
          : strategy === 'id'
          ? 'IDs are unique by design'
          : `${strategy} selector is unique on this page`
      };
    }
  }

  return {
    selector: selectors.combined || selectors.tag,
    strategy: 'combined',
    reason: 'No unique selector found, using combined approach'
  };
}

main().catch(console.error);
