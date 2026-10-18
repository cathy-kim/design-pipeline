// node --test skills/design-stitch/scripts/test/
// STATIC contract tests: 문서·매니페스트·게이트 스크립트만 검사한다. Stitch 를 호출하지 않으며 live E2E 가 아니다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const stitch = read('skills/design-stitch/SKILL.md');
const toolMap = read('skills/design-stitch/references/stitch-tool-map.md');
const checklist = read('skills/design-stitch/references/acceptance-checklist.md');
const router = read('skills/design/SKILL.md');
const ui = read('skills/design-ui/SKILL.md');
const contract = read('CONTRACT.md');
const snapshot = JSON.parse(read('skills/design-stitch/references/stitch-tools.snapshot.json')).tools;
const check = path.join(root, 'skills/design-stitch/scripts/check-stitch.mjs');

test('static: manifests register design-stitch at 0.3.0', () => {
  const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
  const market = JSON.parse(read('.claude-plugin/marketplace.json'));
  assert.ok(plugin.skills.includes('./skills/design-stitch/'));
  assert.equal(plugin.version, '0.3.0');
  assert.equal(market.plugins[0].version, '0.3.0');
  for (const s of plugin.skills) assert.ok(fs.existsSync(path.join(root, s, 'SKILL.md')), s);
});

test('static: frontmatter name/description and NOT-for boundary', () => {
  const fm = stitch.split('---')[1];
  assert.match(fm, /^name: design-stitch$/m);
  assert.match(fm, /^description: .*Use when - .*NOT for - .*design-ui/m);
  for (const m of ['audit', 'propose', 'refine', 'handoff']) assert.ok(fm.includes(m), m);
});

test('static: every mcp__stitch__ tool named in docs exists in the schema snapshot', () => {
  const names = new Set(snapshot.map((t) => t.name));
  assert.equal(names.size, 15);
  for (const doc of [stitch, toolMap, checklist, router, ui]) {
    for (const [, n] of doc.matchAll(/mcp__stitch__([a-z_]+)/g)) assert.ok(names.has(n), `invented tool ${n}`);
  }
  for (const bad of ['clone', 'export', 'upload_screenshot', 'publish', 'duplicate']) {
    assert.ok(![...names].some((n) => n.includes(bad)), bad);
  }
});

test('static: tool map lists each tool with its schema-required args', () => {
  for (const t of snapshot) {
    const row = toolMap.split('\n').find((l) => l.startsWith(`| \`mcp__stitch__${t.name}\``));
    assert.ok(row, `tool map row for ${t.name}`);
    const args = row.split('|')[2];
    for (const r of t.required) assert.ok(args.includes(`\`${r}\``), `${t.name} required ${r}`);
  }
  const readOnly = snapshot.filter((t) => t.readOnly).map((t) => t.name).sort();
  const section = toolMap.split('## Writes')[0];
  assert.deepEqual([...section.matchAll(/`mcp__stitch__([a-z_]+)`/g)].map((m) => m[1]).sort(), readOnly);
});

test('static: source screen id vs instance id rule and no-retry rule are stated', () => {
  assert.match(toolMap, /selectedScreenIds` = \*\*source screen ID\*\*/);
  assert.match(toolMap, /NOT\*\* the source screen id/);
  assert.match(toolMap, /재전송 금지/);
  assert.match(stitch, /같은 쓰기를 다시 보내지 않는다/);
  assert.ok(!/4591407258540771727/.test(stitch), 'example project must not be a default in SKILL.md');
});

test('static: mode dispatch precedes gates; handoff forbids generation', () => {
  assert.ok(stitch.indexOf('Phase 0 — 모드 먼저') < stitch.indexOf('### G1'));
  const handoffRow = stitch.split('\n').find((l) => l.startsWith('| `handoff`'));
  assert.match(handoffRow, /쓰기 0건/);
  assert.match(handoffRow, /호출 금지/);
  assert.match(stitch, /구현 지시도, 공개·발행 승인도 아니다/);
});

test('static: router dispatches modes before the ordered table and stops before ui', () => {
  const early = router.indexOf('## ②-1 조기 모드 분기');
  assert.ok(early > 0 && early < router.indexOf('## ③ 결정표'));
  assert.match(router, /`handoff` .*`design-stitch` `mode=handoff` 만 — brief·system·generate·ui 호출 금지/);
  for (const row of router.split('\n').filter((l) => l.startsWith('| **From Scratch**') || l.startsWith('| **Inspired**'))) {
    assert.ok(row.includes('stitch(propose)') && !row.includes('ui'), row);
  }
  const fromScratch = router.split('**From Scratch · 브랜드 있음**')[1].split('**Inspired**')[0];
  assert.ok(!fromScratch.includes('design-ui'), 'From Scratch block must not auto-call design-ui');
  for (const legacy of ['design-recreate', 'design-assets', 'design-tokens']) assert.ok(router.includes(legacy), legacy);
});

test('static: design-ui and CONTRACT carry the Stitch implement gate', () => {
  assert.match(ui, /check-stitch\.mjs" \.design\/stitch\/session\.json --gate implement/);
  assert.match(ui, /디자인 승인은 구현 지시가 아니다/);
  assert.match(contract, /\| 3a \| `design-stitch` \|/);
  assert.match(contract, /조기 모드 분기가 이 표보다 먼저다/);
  const tableRows = (doc) => doc.split('\n').filter((l) => /^\| \*\*(From Scratch|Inspired|Modification|Implementation)\*\*/.test(l));
  assert.deepEqual(tableRows(router), tableRows(contract), 'router table must equal CONTRACT §4');
});

// check-stitch.mjs 는 로컬 파일만 읽는 실행 스크립트다 — 픽스처로 직접 돌린다(여전히 Stitch 호출 없음).
function session(over = {}, files = ['r2/s1.png', 'ux-frame.md', 'report.md']) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-stitch-'));
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), 'x');
  }
  const s = {
    mode: 'propose', project: { id: 'p1', verifiedBy: 'get_project' }, revision: 2,
    screens: [{ sourceScreenId: 's1', instanceId: 'i1' }],
    writes: [{ revision: 1, tool: 'generate_screen_from_text', result: 'ok' }, { revision: 2, tool: 'edit_screens', result: 'ok' }],
    evidence: [{ revision: 2, sourceScreenId: 's1', image: 'r2/s1.png', via: 'get_screen' }],
    approval: { status: 'approved', revision: 2, screens: ['s1'], quote: '이걸로 진행', at: '2026-10-18T00:00:00Z' },
    ...over,
  };
  fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify(s));
  return path.join(dir, 'session.json');
}
const gate = (file, g) => spawnSync(process.execPath, [check, file, '--gate', g], { encoding: 'utf8' });

test('check-stitch: approved current revision passes handoff; implement needs handoff.md', () => {
  assert.equal(gate(session(), 'handoff').status, 0);
  assert.equal(gate(session(), 'implement').status, 1);
  assert.equal(gate(session({}, ['r2/s1.png', 'handoff.md']), 'implement').status, 0);
});

test('check-stitch: stale, pending, unquoted, unresolved or imageless approvals fail', () => {
  const cases = {
    stale: { revision: 3, writes: [{ revision: 3, tool: 'edit_screens', result: 'ok' }] },
    staleRevisionOnly: { revision: 3 },
    pending: { approval: { status: 'pending', revision: 2, screens: ['s1'], quote: '' } },
    unquoted: { approval: { status: 'approved', revision: 2, screens: ['s1'], quote: ' ' } },
    unresolved: { writes: [{ revision: 2, tool: 'edit_screens', result: 'uncertain-unresolved' }] },
    instanceIdConfusion: {
      approval: { status: 'approved', revision: 2, screens: ['i1'], quote: '승인' },
      evidence: [{ revision: 2, sourceScreenId: 'i1', image: 'r2/s1.png', via: 'get_screen' }],
    },
  };
  for (const [name, over] of Object.entries(cases)) assert.equal(gate(session(over), 'handoff').status, 1, name);
  assert.equal(gate(session({}, []), 'handoff').status, 1, 'missing image');
});

test('check-stitch: audit must be read-only; bad input exits 2', () => {
  assert.equal(gate(session({ mode: 'audit', writes: [] }), 'audit').status, 0);
  assert.equal(gate(session({ mode: 'audit' }), 'audit').status, 1);
  assert.equal(spawnSync(process.execPath, [check, '/nonexistent.json', '--gate', 'audit']).status, 2);
  assert.equal(spawnSync(process.execPath, [check, 'x.json', '--gate', 'generate']).status, 2);
});
