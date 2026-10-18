#!/usr/bin/env node
// 실제 Stitch 스키마(`stitch-mcp --list-tools` 출력 JSON)와 정적 스냅샷을 비교한다.
// node schema-drift.mjs <tools.json>   exit 0 일치 · 1 차이 · 2 입력 오류. 네트워크 호출 없음.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const snap = JSON.parse(fs.readFileSync(path.join(here, '..', 'references', 'stitch-tools.snapshot.json'), 'utf8')).tools;
let live;
try {
  const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  live = Array.isArray(raw) ? raw : raw.tools;
  if (!Array.isArray(live)) throw new Error('expected an array of tools');
} catch (e) {
  console.error(`schema-drift: ${e.message}`);
  process.exit(2);
}
const norm = (t) => JSON.stringify({ readOnly: Boolean(t.annotations?.readOnlyHint), required: [...(t.inputSchema?.required || [])].sort() });
const liveBy = new Map(live.map((t) => [t.name, norm(t)]));
const diffs = [];
for (const t of snap) {
  const want = JSON.stringify({ readOnly: t.readOnly, required: t.required });
  if (!liveBy.has(t.name)) diffs.push(`removed upstream: ${t.name}`);
  else if (liveBy.get(t.name) !== want) diffs.push(`changed: ${t.name} snapshot=${want} live=${liveBy.get(t.name)}`);
}
for (const name of liveBy.keys()) if (!snap.some((t) => t.name === name)) diffs.push(`new upstream: ${name}`);
for (const d of diffs) console.log(d);
console.log(diffs.length ? `schema-drift: ${diffs.length} difference(s)` : `schema-drift: match (${snap.length} tools)`);
process.exit(diffs.length ? 1 : 0);
