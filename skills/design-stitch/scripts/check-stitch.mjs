#!/usr/bin/env node
// design-stitch 게이트 판정: node check-stitch.mjs <session.json> --gate <audit|handoff|implement>
// exit 0 통과 · 1 미달(이유를 stdout 에 한 줄씩) · 2 입력 오류. Stitch 를 호출하지 않는다(파일만 읽음).
import fs from 'node:fs';
import path from 'node:path';

const [file, flag, gate] = process.argv.slice(2);
if (!file || flag !== '--gate' || !['audit', 'handoff', 'implement'].includes(gate)) {
  console.error('usage: check-stitch.mjs <session.json> --gate <audit|handoff|implement>');
  process.exit(2);
}
let s;
try {
  s = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`check-stitch: cannot read ${file}: ${e.message}`);
  process.exit(2);
}
const dir = path.dirname(file);
const has = (p) => fs.existsSync(path.join(dir, p)) && fs.statSync(path.join(dir, p)).size > 0;
const writes = Array.isArray(s.writes) ? s.writes : [];
const fails = [];

if (gate === 'audit') {
  if (s.mode !== 'audit') fails.push(`mode is '${s.mode}', not audit`);
  if (writes.length) fails.push(`audit recorded ${writes.length} Stitch write(s); audit must be read-only`);
  for (const f of ['ux-frame.md', 'report.md']) if (!has(f)) fails.push(`${f} missing or empty`);
} else {
  const a = s.approval || {};
  const rev = s.revision;
  if (!s.project?.id) fails.push('project.id missing (G1 not verified)');
  if (a.status !== 'approved') fails.push(`approval.status is '${a.status ?? 'none'}', not approved`);
  if (!a.quote || !String(a.quote).trim()) fails.push('approval.quote missing (explicit user approval required)');
  if (a.revision !== rev) fails.push(`approval is for revision ${a.revision}, current revision is ${rev} (stale approval)`);
  const later = writes.filter((w) => w.revision > a.revision);
  if (later.length) fails.push(`${later.length} write(s) after the approved revision`);
  const open = writes.filter((w) => w.result === 'uncertain-unresolved');
  if (open.length) fails.push(`${open.length} unresolved uncertain write(s); reconcile before deciding`);
  const screens = Array.isArray(a.screens) ? a.screens : [];
  if (!screens.length) fails.push('approval.screens is empty');
  const known = new Set((s.screens || []).map((x) => x.sourceScreenId));
  for (const id of screens) {
    if (!known.has(id)) fails.push(`approved screen ${id} not in screens[] (source screen id expected)`);
    const ev = (s.evidence || []).find((e) => e.sourceScreenId === id && e.revision === a.revision);
    if (!ev) fails.push(`no image evidence for ${id} at revision ${a.revision}`);
    else if (!has(ev.image)) fails.push(`evidence image ${ev.image} missing on disk`);
  }
  if (gate === 'implement' && !has('handoff.md')) fails.push('handoff.md missing; run design-stitch mode=handoff first');
}

if (fails.length) {
  for (const f of fails) console.log(`FAIL ${gate}: ${f}`);
  process.exit(1);
}
console.log(`PASS ${gate}`);
