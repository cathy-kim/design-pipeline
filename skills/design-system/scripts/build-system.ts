#!/usr/bin/env node
// design-system generator: brand_config.json -> .design/system/
//
// Usage (Node >= 22.18 runs .ts directly; older Node: `npx tsx build-system.ts ...`):
//   node build-system.ts [--config .design/brand_config.json] [--out .design/system] [--force]
//   node build-system.ts --promote-brief .design/brief.md [--brand-id x --brand-name X] [--config .design/brand_config.json] [--force]
//   node build-system.ts --check [--config path]        # validate only, write nothing
//
// No dependencies beyond the Node standard library. Only erasable TypeScript syntax is used.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type Json = any
type Scale = Record<string, string | number>

const HERE = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------- canon
// Radius rule: the brand's tokens.radius.scale IS the canon for that brand (closed set).
// Named steps must strictly increase in this rank order ("sm": 2, "lg": 2 fails); a numeric name must
// equal its value ("6": 6). Fixed px per name is NOT required ("lg": 12 is fine). If any named step
// exists, "none": 0 plus at least two other named steps are required ({"lg": 2} alone fails).
// Numeric-only scales are allowed.
// The default table (brands/_template.json) is none0 sm2 md4 lg8 xl12 2xl16 3xl24 full9999.
// Kept identical to guards/radius-scale.test.ts.
export const RADIUS_RANK = ['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full']
const COLOR_GROUPS = ['primary', 'accent', 'neutral', 'semantic', 'roles']
const SEMANTIC_KEYS = ['success', 'warning', 'danger', 'info']

const DEFAULT_SPACING = { base: 4, scale: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } }
const DEFAULT_TYPE_SCALE = {
  display: { size: '40px', lineHeight: '1.15', weight: 700, letterSpacing: '-0.02em' },
  'title-lg': { size: '28px', lineHeight: '1.3', weight: 700 },
  'title-md': { size: '20px', lineHeight: '1.4', weight: 600 },
  'body-lg': { size: '17px', lineHeight: '1.6', weight: 400 },
  'body-md': { size: '15px', lineHeight: '1.6', weight: 400 },
  caption: { size: '13px', lineHeight: '1.4', weight: 400 },
  'button-md': { size: '15px', lineHeight: '1.2', weight: 600 },
}
const DEFAULT_COMPONENTS = {
  button: {
    radius: 'md',
    variants: {
      primary: { bg: 'primary', fg: 'primary.foreground', hoverBg: null, border: null },
      secondary: { bg: 'background', fg: 'text', hoverBg: 'surface', border: 'border' },
      ghost: { bg: null, fg: 'text', hoverBg: 'surface', border: null },
    },
    sizes: { sm: { height: 36, paddingX: '3', text: 'caption' }, md: { height: 44, paddingX: '4', text: 'button-md' } },
    states: { disabledOpacity: 0.4, focusRing: 'focus' },
  },
  input: { radius: 'md', height: 44, paddingX: '3', text: 'body-md', bg: 'background', fg: 'text', placeholder: 'textMuted', border: 'border', borderFocus: 'focus', borderError: 'danger' },
  card: { radius: 'lg', padding: '5', bg: 'surface', border: 'border', shadow: null },
  nav: { height: 56, paddingX: '4', bg: 'background', fg: 'textMuted', activeFg: 'text', indicator: 'primary', border: 'border', text: 'body-md' },
}

// ---------------------------------------------------------------- args
function parseArgs(argv: string[]) {
  const a: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (!k.startsWith('--')) continue
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) { a[k.slice(2)] = next; i++ } else a[k.slice(2)] = true
  }
  return a
}

// ---------------------------------------------------------------- color utils
export function parseColor(v: string): { r: number; g: number; b: number; a: number } | null {
  const s = v.trim().toLowerCase()
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/)
  if (m) {
    let h = m[1]
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 }
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/)
  if (m) {
    const al = m[4] ? (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1
    return { r: +m[1], g: +m[2], b: +m[3], a: al }
  }
  return null
}
const isColorLiteral = (v: unknown) => typeof v === 'string' && parseColor(v) !== null

// ---------------------------------------------------------------- load / validate
function die(msg: string): never {
  console.error(`build-system: ${msg}`)
  process.exit(1)
}

function get(obj: Json, path: string): Json {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

// Resolve a color reference ("primary", "primary.600", "neutral.0", "danger", "danger.soft", a role name, or a literal)
// to a literal color string. Returns null when it cannot be resolved.
export function resolveColor(colors: Json, ref: string, depth = 0): string | null {
  if (ref == null || depth > 6) return null
  if (isColorLiteral(ref)) return ref
  const tryVal = (v: Json): string | null => {
    if (v == null) return null
    if (typeof v === 'string') return resolveColor(colors, v, depth + 1)
    if (typeof v === 'object' && 'DEFAULT' in v) return tryVal(v.DEFAULT)
    return null
  }
  const [head, ...rest] = ref.split('.')
  const tail = rest.join('.')
  if (['primary', 'accent', 'neutral'].includes(head)) return tryVal(tail ? colors[head]?.[tail] : colors[head])
  if (head === 'semantic') return resolveColor(colors, tail, depth + 1)
  if (head === 'roles') return tryVal(colors.roles?.[tail])
  if (colors.semantic && head in colors.semantic) {
    const s = colors.semantic[head]
    return tryVal(tail ? (typeof s === 'object' ? s[tail] : undefined) : s)
  }
  if (colors.roles && head in colors.roles && !tail) return tryVal(colors.roles[head])
  return null
}

export function radiusErrors(scale: Record<string, unknown>): string[] {
  const errs: string[] = []
  const named = RADIUS_RANK.filter((n) => n in scale)
  if (named.some((n) => n !== 'none')) {
    if (scale.none !== 0) errs.push(`radius: a scale with named steps (${named.join(', ')}) must include "none": 0`)
    if (named.filter((n) => n !== 'none').length < 2) errs.push(`radius: a scale with named steps needs "none" plus at least two more named steps (has ${named.join(', ')}); or use numeric names only ("none" may stay as the zero step)`)
  }
  let prev: [string, number] | null = null
  for (const name of RADIUS_RANK) {
    const v = scale[name]
    if (typeof v !== 'number') continue
    if (prev && v <= prev[1]) errs.push(`radius "${name}": ${v} must be greater than "${prev[0]}" (${prev[1]}); named steps rise in order ${RADIUS_RANK.join(' < ')}`)
    prev = [name, v]
  }
  for (const [name, v] of Object.entries(scale)) {
    if (typeof v !== 'number' || v < 0 || !Number.isInteger(v)) { errs.push(`radius "${name}": value must be a non-negative integer px`); continue }
    if (RADIUS_RANK.includes(name)) continue
    if (!/^\d+$/.test(name)) errs.push(`radius "${name}": unknown step name; use ${RADIUS_RANK.join('/')} or the number itself ("${v}": ${v})`)
    else if (Number(name) !== v) errs.push(`radius "${name}": a numeric name must equal its value (got ${v})`)
  }
  return errs
}

export function validate(cfg: Json): string[] {
  const errs: string[] = []
  for (const k of ['brand.id', 'brand.name', 'tokens.colors.primary', 'tokens.colors.accent', 'tokens.colors.neutral', 'tokens.radius.scale']) {
    if (get(cfg, k) == null) errs.push(`missing required field ${k}`)
  }
  const colors = get(cfg, 'tokens.colors') || {}
  for (const k of Object.keys(colors)) if (!COLOR_GROUPS.includes(k)) errs.push(`tokens.colors.${k}: only ${COLOR_GROUPS.join('/')} are allowed (3-color rule)`)
  for (const k of Object.keys(colors.semantic || {})) if (!SEMANTIC_KEYS.includes(k)) errs.push(`tokens.colors.semantic.${k}: only ${SEMANTIC_KEYS.join('/')} are allowed`)
  for (const [role, ref] of Object.entries(colors.roles || {})) {
    if (resolveColor(colors, ref as string) == null) errs.push(`tokens.colors.roles.${role} -> "${ref}" does not resolve to a palette color`)
  }
  errs.push(...radiusErrors(get(cfg, 'tokens.radius.scale') || {}))
  const plats = cfg.platforms || []
  for (const p of plats) if (!['web', 'mobile-rn', 'print'].includes(p)) errs.push(`platforms: unknown "${p}"`)
  return errs
}

function withDefaults(cfg: Json): Json {
  const c = structuredClone(cfg)
  c.tokens.spacing = c.tokens.spacing?.scale ? c.tokens.spacing : (warn('tokens.spacing.scale missing -> default 4px scale'), DEFAULT_SPACING)
  c.tokens.typography ??= {}
  if (!c.tokens.typography.scale) { warn('tokens.typography.scale missing -> default scale'); c.tokens.typography.scale = DEFAULT_TYPE_SCALE }
  c.tokens.typography.families ??= { sans: 'system-ui, sans-serif' }
  c.tokens.effects ??= {}
  c.tokens.geometry ??= {}
  c.tokens.colors.roles ??= deriveRoles(c.tokens.colors)
  c.components ??= {}
  for (const k of Object.keys(DEFAULT_COMPONENTS) as (keyof typeof DEFAULT_COMPONENTS)[]) {
    if (!c.components[k]) {
      warn(`components.${k} missing -> default definition`)
      const def: Json = structuredClone(DEFAULT_COMPONENTS[k])
      if (k === 'input' && resolveColor(c.tokens.colors, 'danger') == null) def.borderError = null
      c.components[k] = def
    }
  }
  c.platforms ??= ['web']
  c.build ??= {}
  c.build.componentFramework ??= 'react'
  c.build.tailwindConfigFormat ??= 'ts'
  return c
}

function lightness(hex: string) {
  const c = parseColor(hex)!
  return (Math.max(c.r, c.g, c.b) + Math.min(c.r, c.g, c.b)) / 510
}

function deriveRoles(colors: Json): Record<string, string> {
  const steps = Object.entries(colors.neutral || {}).filter(([, v]) => typeof v === 'string' && parseColor(v as string)?.a === 1)
  steps.sort((a, b) => lightness(b[1] as string) - lightness(a[1] as string))
  if (steps.length < 3) die('cannot derive tokens.colors.roles: neutral needs at least 3 opaque steps')
  const at = (i: number) => `neutral.${steps[Math.min(steps.length - 1, Math.max(0, i))][0]}`
  const nearest = (target: number, from = 1) => {
    let best = from
    for (let i = from; i < steps.length; i++) if (Math.abs(lightness(steps[i][1] as string) - target) < Math.abs(lightness(steps[best][1] as string) - target)) best = i
    return at(best)
  }
  warn('tokens.colors.roles missing -> derived from neutral lightness order')
  return { background: at(0), surface: at(1), elevated: at(2), border: nearest(0.88), textMuted: nearest(0.45), text: at(steps.length - 1), focus: 'primary' }
}

let warnings: string[] = []
function warn(m: string) { warnings.push(m) }

// ---------------------------------------------------------------- promote brief
// brief.md carries one fenced block tagged `json brand-decision` whose keys are dotted
// brand_config paths ("tokens.colors", "tokens.typography", "brand.name", ...).
function deepMerge(into: Json, from: Json) {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && into[k] && typeof into[k] === 'object') deepMerge(into[k], v)
    else into[k] = v
  }
}

// Canonical decision block in brief.md: ```json brand-decision ... ``` (dotted brand_config keys).
// Legacy, undocumented: <!-- design-brief:brand_config:begin --> ... <!-- design-brief:brand_config:end -->
// is still parsed as a fallback. Do not document or extend it.
// Keys may be dotted paths ("tokens.colors") or nested objects mirroring brand_config.
function readDecision(md: string): Json {
  const fenced = md.match(/```json[ \t]+brand-decision[^\n]*\n([\s\S]*?)```/)
  const marked = md.match(/<!--\s*design-brief:brand_config:begin\s*-->([\s\S]*?)<!--\s*design-brief:brand_config:end\s*-->/)
  let body = fenced?.[1] ?? marked?.[1]
  if (body == null) die('no decision block in brief.md (```json brand-decision or design-brief:brand_config markers); route back to design-brief')
  body = body.replace(/^\s*```[a-z -]*\n/, '').replace(/```\s*$/, '')
  try { return JSON.parse(body) } catch (e) { die(`brief decision block is not valid JSON: ${(e as Error).message}`) }
}

function slug(s: string) {
  return s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function promoteBrief(briefPath: string, outPath: string, opts: { force: boolean; id?: string; name?: string }) {
  if (!existsSync(briefPath)) die(`brief not found: ${briefPath}`)
  if (existsSync(outPath) && !opts.force) die(`${outPath} already exists; refusing to overwrite (pass --force)`)
  const draft = join(dirname(outPath), 'brand_config.draft.json')
  if (existsSync(draft)) die(`${draft} exists: the design-tokens draft wins over the brief palette. Confirm the draft and copy it to brand_config.json instead.`)
  const md = readFileSync(briefPath, 'utf8')
  const decision = readDecision(md)
  const cfg: Json = { $schema: 'design-pipeline/brand_config@0.1.0', brand: {}, tokens: {}, platforms: ['web'], _meta: { promotedFrom: briefPath, promotedAt: new Date().toISOString(), defaultsFrom: [] } }
  for (const [path, val] of Object.entries(decision)) {
    if (!path.includes('.')) { cfg[path] ??= {}; if (val && typeof val === 'object' && !Array.isArray(val)) deepMerge(cfg[path], val); else cfg[path] = val; continue }
    const keys = path.split('.')
    let o = cfg
    for (const k of keys.slice(0, -1)) o = o[k] ??= {}
    o[keys[keys.length - 1]] = val
  }
  // brand id/name: flags > decision > first H1 of the brief.
  if (opts.name) cfg.brand.name = opts.name
  if (opts.id) cfg.brand.id = opts.id
  if (!cfg.brand.name) {
    const h1 = md.match(/^#\s+(.+)$/m)?.[1]?.replace(/[*_`]/g, '').trim()
    if (!h1) die('brand.name is empty and the brief has no H1. Ask the user and pass --brand-name "<name>" --brand-id <id>.')
    cfg.brand.name = h1
    warn(`brand.name derived from brief title: "${h1}" (confirm with the user)`)
  }
  if (!cfg.brand.id) {
    cfg.brand.id = slug(cfg.brand.name) || 'project'
    warn(`brand.id derived: "${cfg.brand.id}" (pass --brand-id to set it)`)
  }
  // The brief decides palette and type only. Structure tokens come from the canonical template.
  const tplPath = resolve(HERE, '../../../brands/_template.json')
  const tpl: Json = existsSync(tplPath) ? JSON.parse(readFileSync(tplPath, 'utf8')) : null
  for (const k of ['radius', 'spacing', 'effects', 'geometry']) {
    if (cfg.tokens[k]) continue
    const v = tpl?.tokens?.[k] ?? (k === 'radius' ? { scale: { none: 0, sm: 2, md: 4, lg: 8, full: 9999 } } : k === 'spacing' ? DEFAULT_SPACING : {})
    cfg.tokens[k] = structuredClone(v)
    cfg._meta.defaultsFrom.push(`tokens.${k}`)
    warn(`tokens.${k} not decided in brief -> taken from brands/_template.json`)
  }
  if (!cfg.motion && tpl?.motion) { cfg.motion = structuredClone(tpl.motion); cfg._meta.defaultsFrom.push('motion') }
  const errs = validate(cfg)
  if (errs.length) die(`brief decision is incomplete:\n  - ${errs.join('\n  - ')}`)
  const full = withDefaults(cfg)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(full, null, 2) + '\n')
  console.log(`promoted ${briefPath} -> ${outPath}`)
  warnings.forEach((w) => console.log(`  warn: ${w}`))
}

// ---------------------------------------------------------------- token emitters
const px = (v: string | number) => (typeof v === 'number' ? (v === 0 ? '0' : `${v}px`) : v)
const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

// Flat map of tailwind color name -> literal (palette) or var() (roles).
function colorTable(colors: Json): { tw: Json; vars: [string, string][] } {
  const tw: Json = {}
  const vars: [string, string][] = []
  for (const g of ['primary', 'accent', 'neutral']) {
    const grp = colors[g]
    if (typeof grp === 'string') { tw[g] = resolveColor(colors, grp); vars.push([`--color-${g}`, tw[g]]); continue }
    tw[g] = {}
    for (const [k, v] of Object.entries(grp)) {
      const lit = resolveColor(colors, v as string)
      if (!lit) die(`tokens.colors.${g}.${k} -> "${v}" is not a color`)
      tw[g][k] = lit
      vars.push([k === 'DEFAULT' ? `--color-${g}` : `--color-${g}-${kebab(k)}`, lit])
    }
  }
  for (const [k, v] of Object.entries(colors.semantic || {})) {
    if (typeof v === 'string') { tw[k] = resolveColor(colors, v); vars.push([`--color-${k}`, tw[k]]); continue }
    tw[k] = {}
    for (const [s, sv] of Object.entries(v as Json)) {
      const lit = resolveColor(colors, sv as string)
      tw[k][s] = lit
      vars.push([s === 'DEFAULT' ? `--color-${k}` : `--color-${k}-${kebab(s)}`, lit!])
    }
  }
  for (const [role, ref] of Object.entries(colors.roles || {})) {
    const name = kebab(role)
    tw[name] = `var(--color-${name})`
    vars.push([`--color-${name}`, refToVar(colors, ref as string)])
  }
  return { tw, vars }
}

function refToVar(colors: Json, ref: string): string {
  if (isColorLiteral(ref)) return ref
  const [head, ...rest] = ref.split('.')
  const tail = rest.join('.')
  if (['primary', 'accent', 'neutral'].includes(head) || (colors.semantic && head in colors.semantic)) {
    return `var(--color-${head}${tail && tail !== 'DEFAULT' ? '-' + kebab(tail) : ''})`
  }
  if (head === 'semantic') return refToVar(colors, tail)
  return `var(--color-${kebab(head)})`
}

function typeEntries(cfg: Json) {
  const t = cfg.tokens.typography
  return Object.entries(t.scale as Record<string, Json>).map(([name, s]) => ({ name, ...s }))
}

function buildTheme(cfg: Json) {
  const tk = cfg.tokens
  const { tw: colors } = colorTable(tk.colors)
  const fontFamily: Json = {}
  for (const [k, v] of Object.entries(tk.typography.families || {})) fontFamily[k] = String(v).split(',').map((s) => s.trim())
  const fontSize: Json = {}
  for (const e of typeEntries(cfg)) {
    const opt: Json = {}
    if (e.lineHeight != null) opt.lineHeight = String(e.lineHeight)
    if (e.letterSpacing != null) opt.letterSpacing = String(e.letterSpacing)
    if (e.weight != null) opt.fontWeight = String(e.weight)
    fontSize[e.name] = [px(e.size), opt]
  }
  const fontWeight: Json = {}
  for (const [k, v] of Object.entries(tk.typography.weights || {})) fontWeight[k] = String(v)
  const spacing: Json = { px: '1px' }
  for (const [k, v] of Object.entries(tk.spacing.scale as Scale)) spacing[k] = px(v)
  const borderRadius: Json = {}
  for (const [k, v] of Object.entries(tk.radius.scale as Scale)) borderRadius[k] = k === 'full' ? '9999px' : px(v)
  const boxShadow: Json = { none: 'none' }
  for (const [k, v] of Object.entries(tk.effects?.shadows || {})) boxShadow[k] = v
  const theme: Json = {
    colors: { transparent: 'transparent', current: 'currentColor', ...colors },
    fontFamily, fontSize, spacing, borderRadius, boxShadow,
  }
  if (Object.keys(fontWeight).length) theme.fontWeight = fontWeight
  const bp = tk.geometry?.breakpoints
  if (bp) theme.screens = Object.fromEntries(Object.entries(bp).map(([k, v]) => [k, px(v as number)]))
  const extend: Json = {}
  const mw = tk.geometry?.maxWidths
  if (mw) extend.maxWidth = Object.fromEntries(Object.entries(mw).map(([k, v]) => [k, px(v as number)]))
  const m = cfg.motion || {}
  if (m.durations) extend.transitionDuration = Object.fromEntries(Object.entries(m.durations).map(([k, v]) => [k, typeof v === 'number' ? `${v}ms` : v]))
  if (m.easingCurves) extend.transitionTimingFunction = m.easingCurves
  if (Object.keys(extend).length) theme.extend = extend
  return theme
}

function emitTailwind(cfg: Json, outDir: string) {
  const theme = buildTheme(cfg)
  const content = ['./src/**/*.{ts,tsx,js,jsx,html,vue}', './app/**/*.{ts,tsx,js,jsx}', './components/**/*.{ts,tsx,js,jsx}', './.design/system/primitives/**/*.{ts,tsx,html}']
  const header = `// GENERATED by design-system/build-system.ts from brand_config "${cfg.brand.id}". Do not edit; change brand_config and rebuild.\n// theme is CLOSED (no extend for colors/radius/spacing): utilities outside the brand scale do not exist.\n`
  const body = JSON.stringify({ content, theme, plugins: [] }, null, 2)
  const fmt = cfg.build.tailwindConfigFormat === 'js' ? 'js' : 'ts'
  const file = fmt === 'ts'
    ? `${header}import type { Config } from 'tailwindcss'\n\nconst config: Config = ${body}\n\nexport default config\n`
    : `${header}/** @type {import('tailwindcss').Config} */\nmodule.exports = ${body}\n`
  writeFileSync(join(outDir, `tailwind.config.${fmt}`), file)
  return `tailwind.config.${fmt}`
}

function emitCss(cfg: Json, outDir: string) {
  const tk = cfg.tokens
  const lines: string[] = []
  const { vars } = colorTable(tk.colors)
  for (const [k, v] of vars) lines.push(`  ${k}: ${v};`)
  for (const [k, v] of Object.entries(tk.typography.families || {})) lines.push(`  --font-${kebab(k)}: ${v};`)
  for (const e of typeEntries(cfg)) {
    lines.push(`  --text-${e.name}: ${px(e.size)};`)
    if (e.lineHeight != null) lines.push(`  --text-${e.name}--line-height: ${e.lineHeight};`)
    if (e.letterSpacing != null) lines.push(`  --text-${e.name}--letter-spacing: ${e.letterSpacing};`)
    if (e.weight != null) lines.push(`  --text-${e.name}--font-weight: ${e.weight};`)
  }
  for (const [k, v] of Object.entries(tk.typography.weights || {})) lines.push(`  --font-weight-${k}: ${v};`)
  for (const [k, v] of Object.entries(tk.spacing.scale as Scale)) lines.push(`  --space-${String(k).replace('.', '_')}: ${px(v)};`)
  for (const [k, v] of Object.entries(tk.radius.scale as Scale)) lines.push(`  --radius-${k}: ${k === 'full' ? '9999px' : px(v)};`)
  for (const [k, v] of Object.entries(tk.effects?.shadows || {})) lines.push(`  --shadow-${k}: ${v};`)
  for (const [k, v] of Object.entries(cfg.motion?.durations || {})) lines.push(`  --duration-${k}: ${typeof v === 'number' ? v + 'ms' : v};`)
  for (const [k, v] of Object.entries(cfg.motion?.easingCurves || {})) lines.push(`  --ease-${k}: ${v};`)
  const css = `/* GENERATED by design-system/build-system.ts from brand_config "${cfg.brand.id}". Do not edit. */\n:root {\n${lines.join('\n')}\n}\n`
  writeFileSync(join(outDir, 'tokens.css'), css)
}

// shadcn/ui variable contract (HSL channels, used as hsl(var(--x))). Lets design-ui put shadcn
// components on top of the brand without its own token mapping. shadcn's --accent is a neutral hover
// surface, not the brand accent, so the brand accent is exposed separately as --brand-accent.
// Channels are always opaque: translucent colors are composited over `over` (the brand background),
// so consumers can write hsl(var(--x) / <alpha-value>) safely.
function hslChannels(color: string, over = '#ffffff'): string {
  const raw = parseColor(color)
  if (!raw) die(`cannot convert ${color} to HSL`)
  const bg = parseColor(over) ?? { r: 255, g: 255, b: 255, a: 1 }
  const mix = (f: number, b: number) => Math.round(f * raw.a + b * (1 - raw.a))
  const c = raw.a < 1 ? { r: mix(raw.r, bg.r), g: mix(raw.g, bg.g), b: mix(raw.b, bg.b), a: 1 } : raw
  const [R, G, B] = [c.r / 255, c.g / 255, c.b / 255]
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min, l = (max + min) / 2
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d) h = max === R ? 60 * (((G - B) / d) % 6) : max === G ? 60 * ((B - R) / d + 2) : 60 * ((R - G) / d + 4)
  const r1 = (n: number) => Math.round(n * 10) / 10
  const base = `${r1((h + 360) % 360)} ${r1(sat * 100)}% ${r1(l * 100)}%`
  return base
}

function emitShadcn(cfg: Json, outDir: string) {
  const colors = cfg.tokens.colors
  const first = (...refs: string[]) => {
    for (const r of refs) { const v = resolveColor(colors, r); if (v) return v }
    return null
  }
  const neutralSteps = Object.entries(colors.neutral || {}).filter(([, v]) => parseColor(v as string)?.a === 1).map(([k]) => `neutral.${k}`)
  const lightest = neutralSteps[0] ?? 'background'
  const map: [string, string | null][] = [
    ['background', first('background', lightest)],
    ['foreground', first('text', 'heading', 'textStrong')],
    ['card', first('card', 'surface', 'background')],
    ['card-foreground', first('text')],
    ['popover', first('elevated', 'background')],
    ['popover-foreground', first('text')],
    ['primary', first('primary')],
    ['primary-foreground', first('primary.foreground', 'background')],
    ['secondary', first('elevated', 'surface')],
    ['secondary-foreground', first('text')],
    ['muted', first('surface', 'elevated')],
    ['muted-foreground', first('textMuted', 'hint', 'text')],
    ['accent', first('surface', 'elevated')],
    ['accent-foreground', first('text')],
    ['destructive', first('danger')],
    ['destructive-foreground', first('danger.foreground', 'primary.foreground', 'background')],
    ['border', first('border', 'divider')],
    ['input', first('borderStrong', 'border')],
    ['ring', first('focus', 'primary')],
    ['brand-accent', first('accent')],
    ['brand-accent-foreground', first('accent.foreground', 'background')],
  ]
  const bgLit = map[0][1] ?? '#ffffff'
  const lines = map.filter(([, v]) => v).map(([k, v]) => `  --${k}: ${hslChannels(v!, bgLit)};`)
  const missing = map.filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) warn(`shadcn: no brand color for --${missing.join(', --')} (left unset)`)
  const scale = cfg.tokens.radius.scale
  const rKey = cfg.components?.card?.radius ?? cfg.components?.button?.radius ?? ('md' in scale ? 'md' : Object.keys(scale)[0])
  const rVal = scale[rKey]
  lines.push(`  --radius: ${rKey === 'full' || rVal === 9999 ? '9999px' : px(rVal)};`)
  warn(`shadcn: --radius = radius "${rKey}". shadcn derives lg/md/sm as --radius, -2px, -4px; those steps may fall outside the closed scale, so map shadcn radii to brand steps in the tailwind config instead of calc()`)
  const css = `/* GENERATED by design-system/build-system.ts from brand_config "${cfg.brand.id}". Do not edit.\n   shadcn/ui variable contract: opaque HSL channels for hsl(var(--x) / <alpha-value>). Translucent brand colors are\n   composited over --background. --accent is shadcn's neutral hover\n   surface; the brand accent is --brand-accent. Import after tokens.css. */\n:root {\n${lines.join('\n')}\n}\n`
  writeFileSync(join(outDir, 'tokens.shadcn.css'), css)
}

// React Native has no CSS vars, no rem/clamp and needs absolute line heights.
function toPxNumber(v: string | number): number | null {
  if (typeof v === 'number') return v
  const s = String(v).trim()
  let m = s.match(/^(-?[\d.]+)px$/)
  if (m) return +m[1]
  m = s.match(/^(-?[\d.]+)rem$/)
  if (m) return +m[1] * 16
  m = s.match(/^clamp\(\s*([\d.]+)(px|rem)/)
  if (m) return m[2] === 'rem' ? +m[1] * 16 : +m[1]
  return null
}

function emitNativeWind(cfg: Json, outDir: string) {
  const tk = cfg.tokens
  const colors: Json = {}
  const { tw } = colorTable(tk.colors)
  for (const [k, v] of Object.entries(tw)) {
    if (typeof v === 'string' && v.startsWith('var(')) colors[k] = resolveColor(tk.colors, (tk.colors.roles || {})[camel(k)] ?? k)
    else colors[k] = v
  }
  const fontSize: Json = {}
  for (const e of typeEntries(cfg)) {
    const size = toPxNumber(e.size)
    if (size == null) { warn(`native: typography "${e.name}" size ${e.size} has no px equivalent, skipped`); continue }
    const lh = e.lineHeight == null ? null : /px$/.test(String(e.lineHeight)) ? toPxNumber(e.lineHeight) : Math.round(size * parseFloat(e.lineHeight) * 10) / 10
    fontSize[e.name] = lh == null ? `${size}px` : [`${size}px`, { lineHeight: `${lh}px` }]
  }
  const fontFamily: Json = {}
  for (const [w, face] of Object.entries(tk.typography.nativeFaces || {})) fontFamily[`face-${w}`] = [face]
  const spacing: Json = {}
  for (const [k, v] of Object.entries(tk.spacing.scale as Scale)) spacing[k] = px(v)
  const borderRadius: Json = {}
  for (const [k, v] of Object.entries(tk.radius.scale as Scale)) borderRadius[k] = k === 'full' ? '9999px' : px(v)
  const theme = { colors: { transparent: 'transparent', ...colors }, fontSize, fontFamily, spacing, borderRadius }
  const file = `// GENERATED by design-system/build-system.ts from brand_config "${cfg.brand.id}". Do not edit.\n` +
    `// Use in the React Native app's tailwind.config.js:\n` +
    `//   const brandTheme = require('./.design/system/nativewind.theme.js')\n` +
    `//   module.exports = { content: ['./src/**/*.{ts,tsx}'], presets: [require('nativewind/preset')], theme: brandTheme }\n` +
    `module.exports = ${JSON.stringify(theme, null, 2)}\n`
  writeFileSync(join(outDir, 'nativewind.theme.js'), file)
}

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

// ---------------------------------------------------------------- primitives
// Color ref -> tailwind color name ("primary.600" -> "primary-600", "primary" -> "primary", "textMuted" -> "text-muted")
function cls(colors: Json, ref: string | null | undefined): string | null {
  if (ref == null) return null
  if (resolveColor(colors, ref) == null) die(`component color "${ref}" does not resolve to the palette`)
  const [head, ...rest] = ref.split('.')
  const tail = rest.join('.')
  if (head === 'semantic' || head === 'roles') return cls(colors, tail)
  if (!tail || tail === 'DEFAULT') return kebab(head)
  return `${kebab(head)}-${kebab(tail)}`
}

function radiusCls(cfg: Json, key: string | number | undefined): string {
  if (key == null) return ''
  const scale = cfg.tokens.radius.scale
  if (!(String(key) in scale)) die(`component radius "${key}" is not in tokens.radius.scale (${Object.keys(scale).join(', ')})`)
  return `rounded-${key}`
}

function spaceKey(cfg: Json, key: string | undefined, prop: string): string {
  if (key == null) return ''
  if (!(String(key) in cfg.tokens.spacing.scale)) die(`component ${prop} "${key}" is not in tokens.spacing.scale`)
  return `${prop}-${key}`
}

function textCls(cfg: Json, key: string | undefined, native: boolean, weight?: string): string {
  if (!key) return ''
  if (!(key in cfg.tokens.typography.scale)) die(`component text "${key}" is not in tokens.typography.scale`)
  const out = [`text-${key}`]
  if (weight) {
    const weights = cfg.tokens.typography.weights || {}
    if (!(weight in weights)) die(`component weight "${weight}" is not in tokens.typography.weights`)
    if (native) {
      const face = (cfg.tokens.typography.nativeFaces || {})[String(weights[weight])]
      if (face) out.push(`font-face-${weights[weight]}`)
    } else out.push(`font-${weight}`)
  } else if (native) {
    const w = cfg.tokens.typography.scale[key].weight
    if (w != null && (cfg.tokens.typography.nativeFaces || {})[String(w)]) out.push(`font-face-${w}`)
  }
  return out.join(' ')
}

const pre = (colors: Json, prefix: string, ref: string | null | undefined) => (ref == null ? '' : `${prefix}-${cls(colors, ref)}`)
const j = (...xs: (string | null | false | undefined)[]) => xs.filter(Boolean).join(' ')

function buttonClasses(cfg: Json, native: boolean) {
  const b = cfg.components.button
  const c = cfg.tokens.colors
  const dur = cfg.motion?.durations?.base != null ? 'duration-base' : ''
  const base = j('flex-row items-center justify-center', !native && 'inline-flex transition-colors', !native && dur, radiusCls(cfg, b.radius))
  const variants: Record<string, string> = {}
  for (const [name, v] of Object.entries(b.variants as Record<string, Json>)) {
    const bg = cls(c, v.bg)
    const hover = cls(c, v.hoverBg)
    const pressed = cls(c, v.pressedBg)
    const border = cls(c, v.border)
    variants[name] = j(bg ? `bg-${bg}` : 'bg-transparent', border && `border border-${border}`, hover && !native && `hover:bg-${hover}`, (pressed ?? (native ? hover : null)) && `active:bg-${pressed ?? hover}`)
  }
  const textVariants: Record<string, string> = {}
  for (const [name, v] of Object.entries(b.variants as Record<string, Json>)) textVariants[name] = pre(c, 'text', v.fg)
  const sizes: Record<string, string> = {}
  const textSizes: Record<string, string> = {}
  for (const [name, s] of Object.entries(b.sizes as Record<string, Json>)) {
    sizes[name] = j(s.height != null && `h-[${s.height}px]`, spaceKey(cfg, s.paddingX, 'px'))
    textSizes[name] = textCls(cfg, s.text, native, s.weight)
  }
  const op = b.states?.disabledOpacity
  const disabled = op != null ? (native ? `opacity-[${op}]` : `disabled:opacity-[${op}] disabled:cursor-not-allowed`) : ''
  const ring = b.states?.focusRing && !native ? `focus-visible:outline focus-visible:outline-${b.states.focusRingWidth ?? 2} focus-visible:outline-offset-2 focus-visible:outline-${cls(c, b.states.focusRing)}` : ''
  return { base, variants, textVariants, sizes, textSizes, disabled, ring }
}

function fieldClasses(cfg: Json, native: boolean) {
  const i = cfg.components.input
  const c = cfg.tokens.colors
  return {
    base: j('w-full border', radiusCls(cfg, i.radius), i.height != null && `h-[${i.height}px]`, spaceKey(cfg, i.paddingX, 'px'), textCls(cfg, i.text, native, i.weight), pre(c, 'bg', i.bg), pre(c, 'text', i.fg), pre(c, 'border', i.border),
      !native && pre(c, 'placeholder:text', i.placeholder), !native && i.borderFocus && `focus:outline-none ${pre(c, 'focus:border', i.borderFocus)}`),
    error: pre(c, 'border', i.borderError),
    placeholderColor: i.placeholder ? resolveColor(c, i.placeholder) : null,
  }
}

function cardClasses(cfg: Json) {
  const k = cfg.components.card
  const c = cfg.tokens.colors
  return j(radiusCls(cfg, k.radius), spaceKey(cfg, k.padding, 'p'), pre(c, 'bg', k.bg), k.border && `border ${pre(c, 'border', k.border)}`, k.shadow && k.shadow !== 'none' && `shadow-${k.shadow}`)
}

function navClasses(cfg: Json, native: boolean) {
  const n = cfg.components.nav
  const c = cfg.tokens.colors
  return {
    bar: j('flex-row items-stretch', !native && 'flex', n.height != null && `h-[${n.height}px]`, spaceKey(cfg, n.paddingX, 'px'), pre(c, 'bg', n.bg), n.border && `border-b ${pre(c, 'border', n.border)}`),
    item: j('items-center justify-center border-b-2', !native && 'flex', spaceKey(cfg, n.itemPaddingX ?? '3', 'px')),
    itemIdle: 'border-transparent',
    itemActive: pre(c, 'border', n.indicator) || 'border-transparent',
    text: textCls(cfg, n.text, native, n.weight),
    textIdle: pre(c, 'text', n.fg),
    textActive: pre(c, 'text', n.activeFg),
  }
}

const defaultSize = (names: string[]) => names.find((n) => n === 'md' || n === 'medium') ?? names[0]
const lit = (o: Json) => JSON.stringify(o, null, 2)

function emitReactPrimitives(cfg: Json, dir: string) {
  const b = buttonClasses(cfg, false)
  const f = fieldClasses(cfg, false)
  const n = navClasses(cfg, false)
  const hdr = `// GENERATED by design-system from brand_config "${cfg.brand.id}". Classes come only from the closed theme.\n`
  const vNames = Object.keys(b.variants)
  const sNames = Object.keys(b.sizes)
  writeFileSync(join(dir, 'Button.tsx'), `${hdr}import type { ButtonHTMLAttributes } from 'react'

const BASE = '${b.base} ${b.ring} ${b.disabled}'.trim()
const VARIANTS = ${lit(Object.fromEntries(vNames.map((k) => [k, `${b.variants[k]} ${b.textVariants[k]}`])))} as const
const SIZES = ${lit(Object.fromEntries(sNames.map((k) => [k, `${b.sizes[k]} ${b.textSizes[k]}`])))} as const

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
}

export function Button({ variant = '${vNames[0]}', size = '${defaultSize(sNames)}', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={[BASE, VARIANTS[variant], SIZES[size], className].filter(Boolean).join(' ')} {...rest} />
}
`)
  writeFileSync(join(dir, 'Input.tsx'), `${hdr}import type { InputHTMLAttributes } from 'react'

const BASE = '${f.base}'
const ERROR = '${f.error}'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export function Input({ invalid, className, ...rest }: InputProps) {
  return <input aria-invalid={invalid || undefined} className={[BASE, invalid && ERROR, className].filter(Boolean).join(' ')} {...rest} />
}
`)
  writeFileSync(join(dir, 'Card.tsx'), `${hdr}import type { HTMLAttributes } from 'react'

const BASE = '${cardClasses(cfg)}'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={[BASE, className].filter(Boolean).join(' ')} {...rest} />
}
`)
  writeFileSync(join(dir, 'Nav.tsx'), `${hdr}export interface NavItem { label: string; href: string }

export interface NavProps {
  items: NavItem[]
  activeHref?: string
  'aria-label'?: string
}

export function Nav({ items, activeHref, 'aria-label': label = 'Main' }: NavProps) {
  return (
    <nav aria-label={label} className="${n.bar}">
      {items.map((it) => {
        const active = it.href === activeHref
        return (
          <a key={it.href} href={it.href} aria-current={active ? 'page' : undefined}
            className={['${n.item} ${n.text}', active ? '${n.itemActive} ${n.textActive}' : '${n.itemIdle} ${n.textIdle}'].join(' ')}>
            {it.label}
          </a>
        )
      })}
    </nav>
  )
}
`)
  writeFileSync(join(dir, 'index.ts'), `${hdr}export { Button } from './Button'\nexport { Input } from './Input'\nexport { Card } from './Card'\nexport { Nav } from './Nav'\n`)
}

function emitHtmlPrimitives(cfg: Json, dir: string) {
  const b = buttonClasses(cfg, false)
  const f = fieldClasses(cfg, false)
  const n = navClasses(cfg, false)
  const s0 = defaultSize(Object.keys(b.sizes))
  const html = `<!-- GENERATED by design-system from brand_config "${cfg.brand.id}". Copy the class strings; do not add colors or radii outside the theme. -->
${Object.keys(b.variants).map((v) => `<button type="button" class="${j(b.base, b.ring, b.disabled, b.variants[v], b.textVariants[v], b.sizes[s0], b.textSizes[s0])}">${v}</button>`).join('\n')}

<input class="${f.base}" placeholder="Placeholder" />
<input class="${j(f.base, f.error)}" aria-invalid="true" />

<div class="${cardClasses(cfg)}">Card</div>

<nav aria-label="Main" class="${n.bar}">
  <a href="#" aria-current="page" class="${j(n.item, n.itemActive, n.text, n.textActive)}">Active</a>
  <a href="#" class="${j(n.item, n.itemIdle, n.text, n.textIdle)}">Item</a>
</nav>
`
  writeFileSync(join(dir, 'primitives.html'), html)
}

function emitNativePrimitives(cfg: Json, dir: string) {
  const b = buttonClasses(cfg, true)
  const f = fieldClasses(cfg, true)
  const n = navClasses(cfg, true)
  const hdr = `// GENERATED by design-system from brand_config "${cfg.brand.id}" for React Native + NativeWind v4.\n`
  const vNames = Object.keys(b.variants)
  const sNames = Object.keys(b.sizes)
  writeFileSync(join(dir, 'Button.tsx'), `${hdr}import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, Text } from 'react-native'

const BASE = '${b.base}'
const VARIANTS = ${lit(b.variants)} as const
const LABEL_VARIANTS = ${lit(b.textVariants)} as const
const SIZES = ${lit(b.sizes)} as const
const LABEL_SIZES = ${lit(b.textSizes)} as const

export interface ButtonProps {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  disabled?: boolean
  loading?: boolean
  onPress?: () => void
  className?: string
  children: ReactNode
}

export function Button({ variant = '${vNames[0]}', size = '${defaultSize(sNames)}', disabled, loading, onPress, className, children }: ButtonProps) {
  const off = disabled || loading
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }} disabled={off} onPress={onPress}
      className={[BASE, VARIANTS[variant], SIZES[size], ${b.disabled ? `off && '${b.disabled}', ` : ''}className].filter(Boolean).join(' ')}>
      {loading ? <ActivityIndicator /> : typeof children === 'string'
        ? <Text className={[LABEL_VARIANTS[variant], LABEL_SIZES[size]].join(' ')}>{children}</Text>
        : children}
    </Pressable>
  )
}
`)
  writeFileSync(join(dir, 'Input.tsx'), `${hdr}import { TextInput, type TextInputProps } from 'react-native'

const BASE = '${f.base}'
const ERROR = '${f.error}'

export interface InputProps extends TextInputProps {
  invalid?: boolean
  className?: string
}

export function Input({ invalid, className, ...rest }: InputProps) {
  return <TextInput placeholderTextColor=${f.placeholderColor ? `"${f.placeholderColor}"` : '{undefined}'} className={[BASE, invalid && ERROR, className].filter(Boolean).join(' ')} {...rest} />
}
`)
  writeFileSync(join(dir, 'Card.tsx'), `${hdr}import { View, type ViewProps } from 'react-native'

const BASE = '${cardClasses(cfg)}'

export function Card({ className, ...rest }: ViewProps & { className?: string }) {
  return <View className={[BASE, className].filter(Boolean).join(' ')} {...rest} />
}
`)
  writeFileSync(join(dir, 'Nav.tsx'), `${hdr}import { Pressable, Text, View } from 'react-native'

export interface NavItem { label: string; value: string }

export interface NavProps {
  items: NavItem[]
  value: string
  onChange: (value: string) => void
}

// Tab bar: one row, active item marked by the indicator border.
export function Nav({ items, value, onChange }: NavProps) {
  return (
    <View accessibilityRole="tablist" className="${n.bar}">
      {items.map((it) => {
        const active = it.value === value
        return (
          <Pressable key={it.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(it.value)}
            className={['${n.item}', active ? '${n.itemActive}' : '${n.itemIdle}'].join(' ')}>
            <Text className={['${n.text}', active ? '${n.textActive}' : '${n.textIdle}'].join(' ')}>{it.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
`)
  writeFileSync(join(dir, 'index.ts'), `${hdr}export { Button } from './Button'\nexport { Input } from './Input'\nexport { Card } from './Card'\nexport { Nav } from './Nav'\n`)
}

// ---------------------------------------------------------------- guards
function emitGuards(outDir: string) {
  const g = join(outDir, 'guards')
  mkdirSync(g, { recursive: true })
  for (const f of ['radius-scale.test.ts', 'three-color.test.ts', 'vitest.config.ts']) copyFileSync(join(HERE, 'guards', f), join(g, f))
}

// ---------------------------------------------------------------- main
function main() {
  const args = parseArgs(process.argv.slice(2))
  const configPath = resolve(String(args.config ?? '.design/brand_config.json'))
  if (args['promote-brief']) return promoteBrief(resolve(String(args['promote-brief'])), configPath, { force: !!args.force, id: args['brand-id'] as string | undefined, name: args['brand-name'] as string | undefined })

  if (!existsSync(configPath)) die(`${configPath} not found. Copy brands/<id>.json to .design/brand_config.json, promote a draft from design-tokens, or run --promote-brief. Do not invent a brand here.`)
  let raw: Json
  try { raw = JSON.parse(readFileSync(configPath, 'utf8')) } catch (e) { die(`invalid JSON in ${configPath}: ${(e as Error).message}`) }
  const errs = validate(raw)
  if (errs.length) die(`brand_config failed validation:\n  - ${errs.join('\n  - ')}`)
  const cfg = withDefaults(raw)
  if (args.check) { console.log('brand_config OK'); warnings.forEach((w) => console.log(`  warn: ${w}`)); return }

  const outDir = resolve(String(args.out ?? join(dirname(configPath), 'system')))
  mkdirSync(outDir, { recursive: true })
  const written: string[] = []
  written.push(emitTailwind(cfg, outDir))
  emitCss(cfg, outDir); written.push('tokens.css')
  emitShadcn(cfg, outDir); written.push('tokens.shadcn.css')
  const plats: string[] = cfg.platforms
  if (plats.includes('mobile-rn')) { emitNativeWind(cfg, outDir); written.push('nativewind.theme.js') }
  const fw = cfg.build.componentFramework
  if (plats.includes('web') || plats.includes('print') || !plats.includes('mobile-rn')) {
    const d = join(outDir, 'primitives', 'web'); mkdirSync(d, { recursive: true })
    if (fw === 'html') emitHtmlPrimitives(cfg, d)
    else if (fw === 'react') emitReactPrimitives(cfg, d)
    else die(`build.componentFramework "${fw}" is not supported for web (react | html)`)
    written.push(`primitives/web (${fw})`)
  }
  if (plats.includes('mobile-rn')) {
    const d = join(outDir, 'primitives', 'native'); mkdirSync(d, { recursive: true })
    emitNativePrimitives(cfg, d); written.push('primitives/native (react-native)')
  }
  emitGuards(outDir); written.push('guards/')
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ brand: cfg.brand.id, source: configPath, generatedAt: new Date().toISOString(), platforms: plats, framework: fw, files: written, warnings }, null, 2) + '\n')
  console.log(`design-system: wrote ${outDir}`)
  written.forEach((w) => console.log(`  + ${w}`))
  warnings.forEach((w) => console.log(`  warn: ${w}`))
}

main()
