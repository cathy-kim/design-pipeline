#!/usr/bin/env node

/**
 * Network Capture Script
 *
 * Captures all network requests during page load and exports in HAR format.
 * Supports filtering by request type and provides timing analysis.
 *
 * Usage:
 *   node capture-network.js <url> [output.har]
 *
 * Examples:
 *   node capture-network.js https://example.com
 *   node capture-network.js https://example.com network.har
 *   node capture-network.js https://react.dev --filter=xhr,fetch
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REQUEST_TYPES = {
  DOCUMENT: 'document',
  STYLESHEET: 'stylesheet',
  IMAGE: 'image',
  MEDIA: 'media',
  FONT: 'font',
  SCRIPT: 'script',
  XHR: 'xhr',
  FETCH: 'fetch',
  WEBSOCKET: 'websocket',
  OTHER: 'other'
};

/**
 * Create HAR entry from request/response
 */
function createHAREntry(request, response, timing) {
  const url = new URL(request.url());

  const entry = {
    startedDateTime: new Date(timing.startTime).toISOString(),
    time: timing.totalTime,
    request: {
      method: request.method(),
      url: request.url(),
      httpVersion: 'HTTP/1.1',
      headers: Object.entries(request.headers()).map(([name, value]) => ({ name, value })),
      queryString: Array.from(url.searchParams).map(([name, value]) => ({ name, value })),
      cookies: [],
      headersSize: -1,
      bodySize: request.postData() ? request.postData().length : 0,
      postData: request.postData() ? {
        mimeType: request.headers()['content-type'] || 'application/octet-stream',
        text: request.postData()
      } : undefined
    },
    response: {
      status: response ? response.status() : 0,
      statusText: response ? response.statusText() : '',
      httpVersion: 'HTTP/1.1',
      headers: response ? Object.entries(response.headers()).map(([name, value]) => ({ name, value })) : [],
      cookies: [],
      content: {
        size: timing.responseSize || 0,
        mimeType: response ? response.headers()['content-type'] || 'application/octet-stream' : '',
        compression: 0
      },
      redirectURL: response ? response.headers()['location'] || '' : '',
      headersSize: -1,
      bodySize: timing.responseSize || 0
    },
    cache: {},
    timings: {
      blocked: timing.blocked || 0,
      dns: timing.dns || -1,
      connect: timing.connect || -1,
      send: timing.send || 0,
      wait: timing.wait || 0,
      receive: timing.receive || 0,
      ssl: timing.ssl || -1
    },
    serverIPAddress: '',
    connection: ''
  };

  return entry;
}

/**
 * Create HAR document structure
 */
function createHARDocument(entries, pageInfo) {
  return {
    log: {
      version: '1.2',
      creator: {
        name: 'Web Inspector - Playwright',
        version: '1.0.0'
      },
      pages: [{
        startedDateTime: pageInfo.startedDateTime,
        id: 'page_1',
        title: pageInfo.title,
        pageTimings: {
          onContentLoad: pageInfo.domContentLoaded,
          onLoad: pageInfo.loadTime
        }
      }],
      entries: entries.map(e => ({ ...e, pageref: 'page_1' }))
    }
  };
}

/**
 * Analyze network requests
 */
function analyzeNetwork(entries) {
  const byType = {};
  let totalSize = 0;
  let totalTime = 0;
  let slowestRequest = null;
  let largestRequest = null;

  entries.forEach(entry => {
    const type = getRequestType(entry);

    if (!byType[type]) {
      byType[type] = { count: 0, size: 0, time: 0, requests: [] };
    }

    byType[type].count++;
    byType[type].size += entry.response.content.size;
    byType[type].time += entry.time;
    byType[type].requests.push({
      url: entry.request.url,
      size: entry.response.content.size,
      time: entry.time,
      status: entry.response.status
    });

    totalSize += entry.response.content.size;
    totalTime = Math.max(totalTime, entry.time);

    if (!slowestRequest || entry.time > slowestRequest.time) {
      slowestRequest = {
        url: entry.request.url,
        time: entry.time,
        type
      };
    }

    if (!largestRequest || entry.response.content.size > largestRequest.size) {
      largestRequest = {
        url: entry.request.url,
        size: entry.response.content.size,
        type
      };
    }
  });

  return {
    summary: {
      totalRequests: entries.length,
      totalSize: formatBytes(totalSize),
      totalSizeBytes: totalSize,
      totalTime: Math.round(totalTime),
      byType: Object.entries(byType).map(([type, data]) => ({
        type,
        count: data.count,
        size: formatBytes(data.size),
        sizeBytes: data.size,
        avgTime: Math.round(data.time / data.count)
      }))
    },
    slowestRequest,
    largestRequest,
    errors: entries.filter(e => e.response.status >= 400).map(e => ({
      url: e.request.url,
      status: e.response.status,
      statusText: e.response.statusText
    })),
    redirects: entries.filter(e => e.response.status >= 300 && e.response.status < 400).map(e => ({
      url: e.request.url,
      status: e.response.status,
      redirectTo: e.response.redirectURL
    }))
  };
}

function getRequestType(entry) {
  const mimeType = entry.response.content.mimeType.toLowerCase();
  const url = entry.request.url.toLowerCase();

  if (mimeType.includes('html')) return 'document';
  if (mimeType.includes('css')) return 'stylesheet';
  if (mimeType.includes('javascript') || mimeType.includes('ecmascript')) return 'script';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('font')) return 'font';
  if (mimeType.includes('video') || mimeType.includes('audio')) return 'media';
  if (mimeType.includes('json')) return 'xhr';

  if (url.includes('.css')) return 'stylesheet';
  if (url.includes('.js')) return 'script';
  if (url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)/)) return 'image';
  if (url.match(/\.(woff|woff2|ttf|otf|eot)/)) return 'font';

  return 'other';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: node capture-network.js <url> [output.har]

Arguments:
  url        - The URL to capture network requests from
  output.har - Optional output file path (default: stdout)

Options:
  --filter=types  - Filter by request types (comma-separated)
                    Types: document,stylesheet,script,image,font,xhr,media,other

Examples:
  node capture-network.js https://example.com
  node capture-network.js https://example.com network.har
  node capture-network.js https://react.dev --filter=xhr,fetch

Output:
  HAR 1.2 format JSON with network timing analysis
    `);
    process.exit(0);
  }

  const url = args[0];
  let outputFile = null;
  let filterTypes = null;

  args.slice(1).forEach(arg => {
    if (arg.startsWith('--filter=')) {
      filterTypes = arg.replace('--filter=', '').split(',');
    } else if (!arg.startsWith('--')) {
      outputFile = arg;
    }
  });

  console.error(`Launching browser for: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  const requests = new Map();
  const responses = new Map();
  const timings = new Map();

  // Track request start times
  page.on('request', request => {
    const id = request.url() + request.method();
    requests.set(id, request);
    timings.set(id, {
      startTime: Date.now(),
      blocked: 0,
      dns: -1,
      connect: -1,
      send: 0,
      wait: 0,
      receive: 0,
      ssl: -1
    });
  });

  // Track response times
  page.on('response', async response => {
    const request = response.request();
    const id = request.url() + request.method();
    responses.set(id, response);

    const timing = timings.get(id);
    if (timing) {
      timing.wait = Date.now() - timing.startTime;

      try {
        const body = await response.body().catch(() => Buffer.from(''));
        timing.responseSize = body.length;
        timing.receive = Date.now() - timing.startTime - timing.wait;
        timing.totalTime = Date.now() - timing.startTime;
      } catch {
        timing.responseSize = 0;
        timing.receive = 0;
        timing.totalTime = Date.now() - timing.startTime;
      }
    }
  });

  try {
    const startTime = Date.now();
    const startedDateTime = new Date().toISOString();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    const loadTime = Date.now() - startTime;
    const domContentLoaded = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return nav ? Math.round(nav.domContentLoadedEventEnd) : 0;
    });

    console.error(`Page loaded in ${loadTime}ms`);
    console.error(`Captured ${requests.size} requests`);

    // Build HAR entries
    const entries = [];

    for (const [id, request] of requests) {
      const response = responses.get(id);
      const timing = timings.get(id) || {
        startTime: Date.now(),
        totalTime: 0,
        responseSize: 0
      };

      const entry = createHAREntry(request, response, timing);

      // Apply filter if specified
      if (filterTypes) {
        const type = getRequestType(entry);
        if (!filterTypes.includes(type)) continue;
      }

      entries.push(entry);
    }

    // Sort by start time
    entries.sort((a, b) =>
      new Date(a.startedDateTime) - new Date(b.startedDateTime)
    );

    const pageInfo = {
      startedDateTime,
      title: await page.title(),
      domContentLoaded,
      loadTime
    };

    const har = createHARDocument(entries, pageInfo);
    const analysis = analyzeNetwork(entries);

    const result = {
      har,
      analysis
    };

    const output = JSON.stringify(result, null, 2);

    if (outputFile) {
      fs.writeFileSync(outputFile, output);
      console.error(`HAR saved to: ${outputFile}`);

      // Print summary to stderr
      console.error('\n--- Network Analysis Summary ---');
      console.error(`Total Requests: ${analysis.summary.totalRequests}`);
      console.error(`Total Size: ${analysis.summary.totalSize}`);
      console.error(`Total Time: ${analysis.summary.totalTime}ms`);
      console.error('\nBy Type:');
      analysis.summary.byType.forEach(t => {
        console.error(`  ${t.type}: ${t.count} requests, ${t.size}, avg ${t.avgTime}ms`);
      });

      if (analysis.slowestRequest) {
        console.error(`\nSlowest Request: ${analysis.slowestRequest.time}ms`);
        console.error(`  ${analysis.slowestRequest.url}`);
      }

      if (analysis.largestRequest) {
        console.error(`\nLargest Request: ${formatBytes(analysis.largestRequest.size)}`);
        console.error(`  ${analysis.largestRequest.url}`);
      }

      if (analysis.errors.length > 0) {
        console.error(`\nErrors: ${analysis.errors.length}`);
        analysis.errors.forEach(e => {
          console.error(`  ${e.status} ${e.url}`);
        });
      }
    } else {
      console.log(output);
    }

  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.log(JSON.stringify({ error: error.message }, null, 2));
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
