// node --test test/  — token-audit.js 의 exceptions(WAIVED)·radius 정본 규칙 픽스처 테스트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const audit = path.join(here, '..', 'token-audit.js');
const fixture = path.join(here, 'fixtures', 'pill-button');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'design-qa-test-'));

function run(config) {
  const out = path.join(tmp, `out-${Math.random().toString(36).slice(2)}.json`);
  let code = 0;
  try {
    execFileSync(process.execPath, [audit, fixture, '--config', config, '--json', out], { stdio: 'pipe' });
  } catch (e) {
    code = e.status;
  }
  return { code, result: JSON.parse(fs.readFileSync(out, 'utf8')) };
}
const writeConfig = (name, obj) => {
  const f = path.join(tmp, name);
  fs.writeFileSync(f, JSON.stringify(obj, null, 2));
  return f;
};
const brandPath = path.join(here, 'fixtures', 'pill-brand.json'); // _template.json + pill 예외 + lg=12 스케일
const brand = JSON.parse(fs.readFileSync(brandPath, 'utf8'));
const pill = (r) => r.violations.filter((v) => v.rule === 'pill-button');
const status = (r, id) => r.summary.find((s) => s.id === id).status;

test('pill-brand: no-pill-button 예외가 버튼 pill 을 WAIVED 로 바꾸고 실행을 막지 않는다', () => {
  const { code, result } = run(brandPath);
  const p = pill(result);
  assert.equal(p.length, 1, '아이콘 버튼(size-10)은 원래 예외라 pill 위반은 1건');
  assert.equal(p[0].severity, 'WAIVED');
  assert.equal(p[0].waivedFrom, 'FAIL');
  assert.equal(p[0].waiver.rule, 'no-pill-button');
  assert.equal(p[0].waiver.reason, brand.exceptions[0].reason);
  assert.equal(p[0].waiver.evidence, brand.exceptions[0].evidence);
  assert.equal(status(result, 'pill-button'), 'WAIVED');
  assert.equal(result.pass, true);
  assert.equal(code, 0);
});

test('같은 코드, 예외 없음 → FAIL', () => {
  const { code, result } = run(writeConfig('no-exc.json', { ...brand, exceptions: [] }));
  assert.equal(pill(result)[0].severity, 'FAIL');
  assert.equal(status(result, 'pill-button'), 'FAIL');
  assert.equal(result.pass, false);
  assert.equal(code, 1);
});

test('칩 전용 예외(no-pill, scope "chip, circular badge")는 버튼을 면제하지 않는다', () => {
  const cfg = writeConfig('chip-exc.json', {
    ...brand,
    exceptions: [{ rule: 'no-pill', scope: 'chip, circular badge (rounded-full)', reason: 'chips only', evidence: 'x' }],
  });
  const { result } = run(cfg);
  assert.equal(pill(result)[0].severity, 'FAIL');
});

test('radius: 픽스처 스케일(lg=12, 숫자 이름) 은 R2 PASS', () => {
  const { result } = run(brandPath);
  assert.equal(status(result, 'radius-scale'), 'PASS');
});

const r2 = (scale) => run(writeConfig(`r2-${Math.random().toString(36).slice(2)}.json`, { tokens: { radius: { scale } } })).result.violations
  .filter((v) => v.rule === 'radius-scale').map((v) => v.message);

test('radius: lg=12 이어도 순서가 맞으면 PASS', () => {
  assert.deepEqual(r2({ none: 0, sm: 4, md: 8, lg: 12, full: 9999 }), []);
});

test('radius: 숫자 이름만 있는 스케일은 PASS', () => {
  assert.deepEqual(r2({ none: 0, 6: 6, 10: 10 }), []);
});

test('radius: xs·4xl 은 unknown step name 으로 FAIL', () => {
  const m = r2({ none: 0, xs: 1, sm: 2, md: 4, '4xl': 32 });
  assert.ok(m.some((x) => x.startsWith('radius "xs": unknown step name')));
  assert.ok(m.some((x) => x.startsWith('radius "4xl": unknown step name')));
});

test('radius: 이름 있는 단계가 lg 하나뿐이면 FAIL (none:0 + 두 단계 이상 필요)', () => {
  const m = r2({ lg: 2 });
  assert.ok(m.some((x) => x.includes('must include "none": 0')));
  assert.ok(m.some((x) => x.includes('needs "none" plus at least two more named steps')));
});

test('radius: 순서 역전·같은 값·숫자 이름 불일치·정수 아닌 값은 FAIL', () => {
  const m = r2({ none: 0, sm: 6, md: 6, lg: 4, 8: 10, xl: '12px' });
  assert.ok(m.some((x) => x.startsWith('radius "md": 6 must be greater than "sm" (6)')));
  assert.ok(m.some((x) => x.startsWith('radius "lg": 4 must be greater than "md" (6)')));
  assert.ok(m.some((x) => x === 'radius "8": a numeric name must equal its value (got 10)'));
  assert.ok(m.some((x) => x === 'radius "xl": value must be a non-negative integer px'));
});
