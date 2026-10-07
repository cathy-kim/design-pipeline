#!/usr/bin/env node
/**
 * pixel-diff.js — design-pipeline 의 유일한 픽셀 diff 구현 (owner: design-qa).
 *
 * 기반: design-workflow/pixel-compare.ts (sharp 정규화 + pixelmatch)
 * 병합: antigravity 5C / design-workflow D4.4 의 ImageMagick 좌표 색상 비교(PIXEL_COLOR_MATCH)
 *       와 영역 평균색 비교를 sharp 로 프로세스 안에서 수행 (magick 바이너리 불필요).
 *
 * Usage:
 *   node pixel-diff.js <ref.png> <actual.png> [--threshold 0.02] [--out diff.png]
 *        [--color-threshold 0.1] [--samples "x,y;x,y"] [--regions "WxH+X+Y;..."]
 *        [--sample-tolerance 5] [--region-tolerance 10]
 *
 * --threshold        허용 불일치 픽셀 비율 (0~1, 기본 0.02 = 2%)
 * --color-threshold  pixelmatch 픽셀 단위 색 민감도 (0~1, 기본 0.1)
 * --samples          참조 이미지 좌표계의 샘플 좌표. 생략 시 네 모서리 안쪽 + 중앙 5개
 * --regions          영역 평균색 비교 (ImageMagick crop 문법)
 *
 * stdout: JSON 한 줄. exit 0 = PASS, 1 = FAIL, 2 = 입력/실행 오류.
 * 참조 이미지가 기준이다. 실제 이미지는 참조 크기로 리사이즈된다(비율 차이는 경고로 보고).
 */
import fs from 'node:fs';
import path from 'node:path';

function usage(code) {
  process.stderr.write(
    'Usage: node pixel-diff.js <ref.png> <actual.png> [--threshold 0.02] [--out diff.png]\n' +
      '       [--color-threshold 0.1] [--samples "x,y;x,y"] [--regions "WxH+X+Y;..."]\n' +
      '       [--sample-tolerance 5] [--region-tolerance 10]\n'
  );
  process.exit(code);
}

function parseArgs(argv) {
  const opts = {
    threshold: 0.02,
    colorThreshold: 0.1,
    out: null,
    samples: null,
    regions: [],
    sampleTolerance: 5,
    regionTolerance: 10,
  };
  const positional = [];
  const keyMap = {
    threshold: 'threshold',
    'color-threshold': 'colorThreshold',
    out: 'out',
    samples: 'samples',
    regions: 'regions',
    'sample-tolerance': 'sampleTolerance',
    'region-tolerance': 'regionTolerance',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') usage(0);
    if (!a.startsWith('--')) {
      positional.push(a);
      continue;
    }
    let [k, v] = a.slice(2).split(/=(.*)/s);
    if (v === undefined) v = argv[++i];
    const key = keyMap[k];
    if (!key || v === undefined) usage(2);
    opts[key] = v;
  }
  if (positional.length < 2) usage(2);
  for (const k of ['threshold', 'colorThreshold', 'sampleTolerance', 'regionTolerance']) {
    opts[k] = Number(opts[k]);
    if (!Number.isFinite(opts[k])) usage(2);
  }
  if (typeof opts.samples === 'string') {
    opts.samples = opts.samples
      .split(';')
      .filter(Boolean)
      .map((p) => p.split(',').map(Number));
  }
  if (typeof opts.regions === 'string') {
    opts.regions = opts.regions
      .split(';')
      .filter(Boolean)
      .map((r) => {
        const m = r.match(/^(\d+)x(\d+)\+(\d+)\+(\d+)$/);
        if (!m) usage(2);
        return { spec: r, w: +m[1], h: +m[2], x: +m[3], y: +m[4] };
      });
  }
  return { ref: path.resolve(positional[0]), actual: path.resolve(positional[1]), ...opts };
}

const hex = (rgb) => '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
const maxChannelDelta = (a, b) => Math.max(...a.map((c, i) => Math.abs(c - b[i])));

function pixelAt(buf, width, x, y) {
  const o = (y * width + x) * 4;
  return [buf[o], buf[o + 1], buf[o + 2]];
}

function regionMean(buf, width, height, { x, y, w, h }) {
  const x1 = Math.min(width, x + w);
  const y1 = Math.min(height, y + h);
  const sum = [0, 0, 0];
  let n = 0;
  for (let yy = y; yy < y1; yy++) {
    for (let xx = x; xx < x1; xx++) {
      const p = pixelAt(buf, width, xx, yy);
      sum[0] += p[0];
      sum[1] += p[1];
      sum[2] += p[2];
      n++;
    }
  }
  return n ? sum.map((s) => s / n) : null;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  let sharp, pixelmatch, PNG;
  try {
    sharp = (await import('sharp')).default;
    pixelmatch = (await import('pixelmatch')).default;
    ({ PNG } = await import('pngjs'));
  } catch (e) {
    throw new Error(`dependency missing (${e.message.split('\n')[0]}) — run: cd \${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts && npm ci`);
  }
  for (const f of [o.ref, o.actual]) {
    if (!fs.existsSync(f)) throw new Error(`image not found: ${f}`);
  }

  const refMeta = await sharp(o.ref).metadata();
  const actMeta = await sharp(o.actual).metadata();
  const width = refMeta.width;
  const height = refMeta.height;
  const aspectDelta = Math.abs(refMeta.width / refMeta.height - actMeta.width / actMeta.height);
  const aspectRatioMismatch = aspectDelta / (refMeta.width / refMeta.height) > 0.02;

  const toRaw = (f) =>
    sharp(f).resize(width, height, { fit: 'fill' }).flatten({ background: '#ffffff' }).ensureAlpha().raw().toBuffer();
  const [refBuf, actBuf] = await Promise.all([toRaw(o.ref), toRaw(o.actual)]);

  const diff = new Uint8Array(width * height * 4);
  const mismatched = pixelmatch(new Uint8Array(refBuf), new Uint8Array(actBuf), diff, width, height, {
    threshold: o.colorThreshold,
    includeAA: false,
    alpha: 0.1,
  });
  const total = width * height;
  const mismatchRatio = mismatched / total;

  let diffPath = null;
  if (o.out) {
    diffPath = path.resolve(o.out);
    fs.mkdirSync(path.dirname(diffPath), { recursive: true });
    const png = new PNG({ width, height });
    png.data = Buffer.from(diff);
    fs.writeFileSync(diffPath, PNG.sync.write(png));
  }

  // PIXEL_COLOR_MATCH: 동일 좌표 색상 비교 (기본: 모서리 안쪽 5% + 중앙)
  const ix = Math.max(0, Math.round(width * 0.05));
  const iy = Math.max(0, Math.round(height * 0.05));
  const points = o.samples || [
    [ix, iy],
    [width - 1 - ix, iy],
    [ix, height - 1 - iy],
    [width - 1 - ix, height - 1 - iy],
    [Math.floor(width / 2), Math.floor(height / 2)],
  ];
  const samples = points.map(([x, y]) => {
    const cx = Math.min(width - 1, Math.max(0, x));
    const cy = Math.min(height - 1, Math.max(0, y));
    const r = pixelAt(refBuf, width, cx, cy);
    const a = pixelAt(actBuf, width, cx, cy);
    const delta = maxChannelDelta(r, a);
    return { x: cx, y: cy, ref: hex(r), actual: hex(a), delta, pass: delta <= o.sampleTolerance };
  });

  const regions = o.regions.map((rg) => {
    const r = regionMean(refBuf, width, height, rg);
    const a = regionMean(actBuf, width, height, rg);
    if (!r || !a) return { region: rg.spec, error: 'out of bounds', pass: false };
    const delta = Math.round(maxChannelDelta(r, a));
    return { region: rg.spec, ref: hex(r), actual: hex(a), delta, pass: delta <= o.regionTolerance };
  });

  const pixelPass = mismatchRatio <= o.threshold;
  const samplesPass = samples.every((s) => s.pass);
  const regionsPass = regions.every((r) => r.pass);
  const result = {
    pass: pixelPass && samplesPass && regionsPass,
    mismatchRatio: Number(mismatchRatio.toFixed(5)),
    threshold: o.threshold,
    pixelScore: Number(((1 - mismatchRatio) * 100).toFixed(2)),
    mismatchedPixels: mismatched,
    totalPixels: total,
    dimensions: { width, height },
    actualDimensions: { width: actMeta.width, height: actMeta.height },
    aspectRatioMismatch,
    diffImagePath: diffPath,
    checks: { pixel: pixelPass, pixelColorMatch: samplesPass, regions: regionsPass },
    samples,
    regions,
  };
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(result.pass ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write(JSON.stringify({ pass: false, error: err.message }) + '\n');
  process.exit(2);
});
