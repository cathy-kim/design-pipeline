/**
 * promote.ts
 *
 * Promotes .design/brand_config.draft.json to .design/brand_config.json.
 *
 *   --auto      promote only if tokens-evidence/confidence.json says eligible
 *               (thresholds live in to-brand-config.ts THRESHOLDS) and no
 *               brand_config.json exists yet. Exit 2 when not eligible.
 *   --confirm   the user explicitly approved this draft; promote regardless of score.
 *   --overwrite allow replacing an existing brand_config.json (backup kept as
 *               brand_config.prev.json). Requires --confirm.
 *
 * Both modes first run design-system's validator on the draft and refuse on failure:
 *   node ${CLAUDE_PLUGIN_ROOT}/skills/design-system/scripts/build-system.ts --check --config <abs draft>
 * (Node >= 22.18 runs .ts directly; older Node falls back to tsx with the same args.)
 *
 * Usage:
 *   npx tsx promote.ts --auto [--design-dir .design]
 *   npx tsx promote.ts --confirm [--overwrite] [--design-dir .design]
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const i = args.indexOf('--design-dir');
const designDir = i === -1 ? '.design' : args[i + 1];
const auto = args.includes('--auto');
const confirm = args.includes('--confirm');
const overwrite = args.includes('--overwrite');

const draftPath = path.join(designDir, 'brand_config.draft.json');
const finalPath = path.join(designDir, 'brand_config.json');
const confPath = path.join(designDir, 'tokens-evidence', 'confidence.json');
const reportPath = path.join(designDir, 'tokens-report.md');

function fail(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

if (auto === confirm) fail('Pass exactly one of --auto or --confirm');
if (!fs.existsSync(draftPath)) fail(`missing ${draftPath}; run extraction first`);
const draft = JSON.parse(fs.readFileSync(draftPath, 'utf-8'));
const required = ['brand', 'tokens', 'artStyle', 'visualSystem', 'motion', 'assets', 'components', 'platforms', 'brandKeywords'];
const missing = required.filter(k => !(k in draft));
if (missing.length) fail(`draft is not CONTRACT §5 shaped; missing: ${missing.join(', ')}`);
if (!draft.tokens?.colors?.primary) fail('draft has no tokens.colors.primary; cannot promote');

// Gate: the draft must pass design-system's --check (same rules stage 3 enforces).
const buildSystem = path.resolve(HERE, '../../design-system/scripts/build-system.ts');
if (!fs.existsSync(buildSystem)) fail(`cannot validate: ${buildSystem} not found (design-system skill missing)`);
const [maj, min] = process.versions.node.split('.').map(Number);
const nativeTs = maj > 22 || (maj === 22 && min >= 18);
const localTsx = path.join(HERE, 'node_modules', '.bin', 'tsx');
const [cmd, pre] = nativeTs ? [process.execPath, [] as string[]]
  : fs.existsSync(localTsx) ? [localTsx, [] as string[]] : ['npx', ['-y', 'tsx']];
const check = spawnSync(cmd, [...pre, buildSystem, '--check', '--config', path.resolve(draftPath)], { encoding: 'utf-8' });
const checkOut = `${check.stdout || ''}${check.stderr || ''}`.trim();
if (check.status !== 0 || !/brand_config OK/.test(checkOut)) {
  fail(`draft failed design-system --check; not promoting:\n${checkOut}`);
}
console.log(checkOut.split('\n').filter(l => /brand_config OK|warn:/.test(l)).join('\n'));

const exists = fs.existsSync(finalPath);
let mode: string;
if (auto) {
  if (exists) fail(`${finalPath} already exists; auto-promotion never overwrites. Ask the user, then use --confirm --overwrite.`, 2);
  if (!fs.existsSync(confPath)) fail(`missing ${confPath}`, 2);
  const conf = JSON.parse(fs.readFileSync(confPath, 'utf-8'));
  if (!conf.promotion?.eligible) fail(`not eligible for auto-promotion: ${(conf.promotion?.why || []).join('; ')}`, 2);
  mode = `auto (overall ${conf.confidence?.overall})`;
} else {
  if (exists && !overwrite) fail(`${finalPath} already exists; pass --overwrite after the user approves replacing it`);
  if (exists) fs.copyFileSync(finalPath, path.join(designDir, 'brand_config.prev.json'));
  mode = exists ? 'user-confirmed, replaced previous (brand_config.prev.json)' : 'user-confirmed';
}

fs.copyFileSync(draftPath, finalPath);
if (fs.existsSync(reportPath)) {
  fs.appendFileSync(reportPath, `\n## Promoted\n\n- ${new Date().toISOString()} — ${mode}\n`);
}
console.log(`promoted: ${finalPath} (${mode})`);
