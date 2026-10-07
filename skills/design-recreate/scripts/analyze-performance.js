#!/usr/bin/env node

/**
 * Performance Analysis Script
 *
 * Measures Core Web Vitals and other performance metrics using Playwright.
 * Provides ratings and recommendations based on Google's Web Vitals thresholds.
 *
 * Usage:
 *   node analyze-performance.js <url> [options]
 *
 * Examples:
 *   node analyze-performance.js https://example.com
 *   node analyze-performance.js https://react.dev --runs=3
 *   node analyze-performance.js https://tailwindcss.com --mobile
 */

const { chromium } = require('playwright');

// Web Vitals Thresholds (Good / Needs Improvement / Poor)
const THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
  TTI: { good: 3800, poor: 7300 }, // Time to Interactive
  TBT: { good: 200, poor: 600 },   // Total Blocking Time
  TTFB: { good: 800, poor: 1800 }  // Time to First Byte
};

/**
 * Get rating based on thresholds
 */
function getRating(metric, value) {
  const threshold = THRESHOLDS[metric];
  if (!threshold) return 'unknown';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Inject Web Vitals measurement script
 */
async function measureWebVitals(page) {
  // Measure FCP
  const fcp = await page.evaluate(() => {
    const fcpEntry = performance.getEntriesByType('paint')
      .find(e => e.name === 'first-contentful-paint');
    return fcpEntry ? Math.round(fcpEntry.startTime) : null;
  });

  // Measure LCP (requires observation)
  const lcp = await page.evaluate(() => {
    return new Promise(resolve => {
      let lcpValue = 0;

      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        lcpValue = Math.round(lastEntry.startTime);
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });

      // Wait for LCP to stabilize
      setTimeout(() => {
        observer.disconnect();
        resolve(lcpValue);
      }, 3000);
    });
  });

  // Measure CLS
  const cls = await page.evaluate(() => {
    return new Promise(resolve => {
      let clsValue = 0;

      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
      });

      observer.observe({ type: 'layout-shift', buffered: true });

      // Wait for CLS to accumulate
      setTimeout(() => {
        observer.disconnect();
        resolve(Math.round(clsValue * 1000) / 1000);
      }, 5000);
    });
  });

  return { fcp, lcp, cls };
}

/**
 * Measure navigation timing metrics
 */
async function measureNavigationTiming(page) {
  return await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    if (!nav) return null;

    return {
      // DNS lookup
      dnsLookup: Math.round(nav.domainLookupEnd - nav.domainLookupStart),

      // TCP connection
      tcpConnection: Math.round(nav.connectEnd - nav.connectStart),

      // TLS negotiation
      tlsNegotiation: nav.secureConnectionStart > 0
        ? Math.round(nav.connectEnd - nav.secureConnectionStart)
        : 0,

      // Time to First Byte
      ttfb: Math.round(nav.responseStart - nav.requestStart),

      // Response time
      responseTime: Math.round(nav.responseEnd - nav.responseStart),

      // DOM parsing
      domParsing: Math.round(nav.domInteractive - nav.responseEnd),

      // DOM Content Loaded
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart),

      // Load event
      loadEvent: Math.round(nav.loadEventEnd - nav.loadEventStart),

      // Total time
      totalTime: Math.round(nav.loadEventEnd - nav.startTime),

      // Transfer size
      transferSize: nav.transferSize || 0,
      encodedBodySize: nav.encodedBodySize || 0,
      decodedBodySize: nav.decodedBodySize || 0
    };
  });
}

/**
 * Measure resource timing
 */
async function measureResourceTiming(page) {
  return await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource');

    const byType = {};
    let totalSize = 0;
    let blockingResources = [];

    resources.forEach(r => {
      const type = r.initiatorType || 'other';

      if (!byType[type]) {
        byType[type] = { count: 0, size: 0, duration: 0 };
      }

      byType[type].count++;
      byType[type].size += r.transferSize || 0;
      byType[type].duration += r.duration || 0;

      totalSize += r.transferSize || 0;

      // Identify render-blocking resources
      if (r.renderBlockingStatus === 'blocking') {
        blockingResources.push({
          name: r.name,
          type: type,
          duration: Math.round(r.duration)
        });
      }
    });

    return {
      totalResources: resources.length,
      totalSize,
      byType: Object.entries(byType).map(([type, data]) => ({
        type,
        count: data.count,
        size: data.size,
        avgDuration: Math.round(data.duration / data.count)
      })),
      blockingResources: blockingResources.slice(0, 10)
    };
  });
}

/**
 * Measure Long Tasks (for TBT estimation)
 */
async function measureLongTasks(page, duration = 5000) {
  return await page.evaluate((dur) => {
    return new Promise(resolve => {
      const longTasks = [];

      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          longTasks.push({
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime),
            name: entry.name
          });
        }
      });

      observer.observe({ type: 'longtask', buffered: true });

      setTimeout(() => {
        observer.disconnect();

        // Calculate TBT (sum of long task durations above 50ms threshold)
        const tbt = longTasks.reduce((sum, task) => {
          return sum + Math.max(0, task.duration - 50);
        }, 0);

        resolve({
          count: longTasks.length,
          tbt: Math.round(tbt),
          tasks: longTasks.slice(0, 10)
        });
      }, dur);
    });
  }, duration);
}

/**
 * Get LCP element details
 */
async function getLCPElement(page) {
  return await page.evaluate(() => {
    return new Promise(resolve => {
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];

        observer.disconnect();

        if (lastEntry && lastEntry.element) {
          const el = lastEntry.element;
          const rect = el.getBoundingClientRect();

          resolve({
            tagName: el.tagName,
            id: el.id || null,
            className: el.className || null,
            src: el.src || el.currentSrc || null,
            size: Math.round(lastEntry.size),
            dimensions: {
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            }
          });
        } else {
          resolve(null);
        }
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, 3000);
    });
  });
}

/**
 * Generate recommendations based on metrics
 */
function generateRecommendations(metrics, lcpElement, resources) {
  const recommendations = [];

  // FCP recommendations
  if (metrics.fcp && getRating('FCP', metrics.fcp) !== 'good') {
    recommendations.push({
      metric: 'FCP',
      priority: 'high',
      issue: `First Contentful Paint is ${metrics.fcp}ms`,
      suggestion: 'Reduce server response time, eliminate render-blocking resources, or preload critical resources'
    });
  }

  // LCP recommendations
  if (metrics.lcp && getRating('LCP', metrics.lcp) !== 'good') {
    const lcpRec = {
      metric: 'LCP',
      priority: 'high',
      issue: `Largest Contentful Paint is ${metrics.lcp}ms`,
      suggestion: 'Optimize the LCP element loading'
    };

    if (lcpElement) {
      if (lcpElement.tagName === 'IMG') {
        lcpRec.suggestion = `Optimize LCP image: Add loading="eager", preload, or use responsive images. Element: ${lcpElement.src || lcpElement.className}`;
      } else if (lcpElement.tagName === 'VIDEO') {
        lcpRec.suggestion = 'Preload video poster image and optimize video loading';
      } else {
        lcpRec.suggestion = `Ensure LCP text element renders quickly. Check web fonts and CSS. Element: ${lcpElement.tagName}.${lcpElement.className}`;
      }
    }

    recommendations.push(lcpRec);
  }

  // CLS recommendations
  if (metrics.cls && getRating('CLS', metrics.cls) !== 'good') {
    recommendations.push({
      metric: 'CLS',
      priority: 'medium',
      issue: `Cumulative Layout Shift is ${metrics.cls}`,
      suggestion: 'Add explicit width/height to images and embeds, avoid inserting content above existing content'
    });
  }

  // TBT recommendations
  if (metrics.tbt && getRating('TBT', metrics.tbt) !== 'good') {
    recommendations.push({
      metric: 'TBT',
      priority: 'high',
      issue: `Total Blocking Time is ${metrics.tbt}ms`,
      suggestion: 'Break up long tasks, defer non-critical JavaScript, use web workers for heavy computation'
    });
  }

  // TTFB recommendations
  if (metrics.ttfb && getRating('TTFB', metrics.ttfb) !== 'good') {
    recommendations.push({
      metric: 'TTFB',
      priority: 'high',
      issue: `Time to First Byte is ${metrics.ttfb}ms`,
      suggestion: 'Optimize server response time, use CDN, implement caching'
    });
  }

  // Resource recommendations
  if (resources && resources.blockingResources.length > 3) {
    recommendations.push({
      metric: 'Resources',
      priority: 'medium',
      issue: `${resources.blockingResources.length} render-blocking resources detected`,
      suggestion: 'Defer non-critical CSS/JS, inline critical CSS, use async/defer for scripts'
    });
  }

  return recommendations;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: node analyze-performance.js <url> [options]

Arguments:
  url         - The URL to analyze

Options:
  --runs=N    - Number of test runs to average (default: 1)
  --mobile    - Emulate mobile device
  --throttle  - Apply network throttling (3G-like)

Examples:
  node analyze-performance.js https://example.com
  node analyze-performance.js https://react.dev --runs=3
  node analyze-performance.js https://tailwindcss.com --mobile

Output:
  JSON object with Core Web Vitals, ratings, and recommendations
    `);
    process.exit(0);
  }

  const url = args[0];
  let runs = 1;
  let mobile = false;
  let throttle = false;

  args.slice(1).forEach(arg => {
    if (arg.startsWith('--runs=')) {
      runs = parseInt(arg.replace('--runs=', ''), 10);
    } else if (arg === '--mobile') {
      mobile = true;
    } else if (arg === '--throttle') {
      throttle = true;
    }
  });

  console.error(`Analyzing performance for: ${url}`);
  console.error(`Runs: ${runs}, Mobile: ${mobile}, Throttle: ${throttle}`);

  const browser = await chromium.launch({ headless: true });

  const contextOptions = {
    viewport: mobile
      ? { width: 375, height: 667 }
      : { width: 1920, height: 1080 },
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  };

  const allMetrics = [];

  try {
    for (let i = 0; i < runs; i++) {
      console.error(`\nRun ${i + 1}/${runs}...`);

      const context = await browser.newContext(contextOptions);
      const page = await context.newPage();

      // Apply throttling if requested
      if (throttle) {
        const client = await context.newCDPSession(page);
        await client.send('Network.emulateNetworkConditions', {
          offline: false,
          downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
          uploadThroughput: 750 * 1024 / 8, // 750 Kbps
          latency: 40
        });
      }

      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

      // Wait for page to stabilize
      await page.waitForTimeout(2000);

      // Measure all metrics
      const webVitals = await measureWebVitals(page);
      const navTiming = await measureNavigationTiming(page);
      const resources = await measureResourceTiming(page);
      const longTasks = await measureLongTasks(page);
      const lcpElement = await getLCPElement(page);

      allMetrics.push({
        webVitals,
        navTiming,
        resources,
        longTasks,
        lcpElement
      });

      await context.close();
    }

    // Average metrics if multiple runs
    const avgMetrics = {
      fcp: Math.round(allMetrics.reduce((s, m) => s + (m.webVitals.fcp || 0), 0) / runs),
      lcp: Math.round(allMetrics.reduce((s, m) => s + (m.webVitals.lcp || 0), 0) / runs),
      cls: Math.round(allMetrics.reduce((s, m) => s + (m.webVitals.cls || 0), 0) * 1000 / runs) / 1000,
      tbt: Math.round(allMetrics.reduce((s, m) => s + (m.longTasks.tbt || 0), 0) / runs),
      ttfb: Math.round(allMetrics.reduce((s, m) => s + (m.navTiming?.ttfb || 0), 0) / runs)
    };

    // Get ratings
    const ratings = {
      fcp: getRating('FCP', avgMetrics.fcp),
      lcp: getRating('LCP', avgMetrics.lcp),
      cls: getRating('CLS', avgMetrics.cls),
      tbt: getRating('TBT', avgMetrics.tbt),
      ttfb: getRating('TTFB', avgMetrics.ttfb)
    };

    // Calculate overall score (simplified)
    const scoreWeights = { fcp: 0.1, lcp: 0.25, cls: 0.25, tbt: 0.3, ttfb: 0.1 };
    const ratingScores = { good: 100, 'needs-improvement': 50, poor: 0 };

    const overallScore = Math.round(
      Object.entries(ratings).reduce((score, [metric, rating]) => {
        return score + (scoreWeights[metric] || 0) * (ratingScores[rating] || 0);
      }, 0)
    );

    // Use last run's detailed data for recommendations
    const lastRun = allMetrics[allMetrics.length - 1];
    const recommendations = generateRecommendations(
      avgMetrics,
      lastRun.lcpElement,
      lastRun.resources
    );

    const result = {
      url,
      timestamp: new Date().toISOString(),
      device: mobile ? 'mobile' : 'desktop',
      runs,
      metrics: {
        coreWebVitals: {
          FCP: { value: avgMetrics.fcp, unit: 'ms', rating: ratings.fcp },
          LCP: { value: avgMetrics.lcp, unit: 'ms', rating: ratings.lcp },
          CLS: { value: avgMetrics.cls, unit: '', rating: ratings.cls }
        },
        additionalMetrics: {
          TBT: { value: avgMetrics.tbt, unit: 'ms', rating: ratings.tbt },
          TTFB: { value: avgMetrics.ttfb, unit: 'ms', rating: ratings.ttfb }
        }
      },
      overallScore,
      lcpElement: lastRun.lcpElement,
      navigationTiming: lastRun.navTiming,
      resources: {
        total: lastRun.resources.totalResources,
        totalSize: lastRun.resources.totalSize,
        byType: lastRun.resources.byType,
        blockingCount: lastRun.resources.blockingResources.length
      },
      longTasks: {
        count: lastRun.longTasks.count,
        tbt: lastRun.longTasks.tbt
      },
      recommendations
    };

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.log(JSON.stringify({ error: error.message }, null, 2));
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
