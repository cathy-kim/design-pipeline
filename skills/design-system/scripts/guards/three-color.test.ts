// 3-color guard: one screen = Primary + Accent + Neutral (+ a fixed semantic set for status).
// Checks the brand_config palette structure and that generated/scanned code uses no color outside it.
// Source of truth: ../../brand_config.json. No plugin imports, runs standalone.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SYSTEM = resolve(HERE, '..')
const CONFIG = process.env.BRAND_CONFIG ?? resolve(HERE, '../../brand_config.json')
const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'))
const colors = cfg.tokens?.colors ?? {}

const GROUPS = ['primary', 'accent', 'neutral', 'semantic', 'roles']
const SEMANTIC = ['success', 'warning', 'danger', 'info']
const HUE_TOLERANCE = 30 // degrees a primary/accent step may drift from its DEFAULT
const NEUTRAL_MAX_CHROMA = 0.12 // (max-min)/255 for an opaque neutral step
const TAILWIND_FAMILIES = ['slate', 'gray', 'zinc', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose']

type RGBA = { r: number; g: number; b: number; a: number }
function parse(v: string): RGBA | null {
  const s = v.trim().toLowerCase()
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/)
  if (m) {
    let h = m[1]
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 }
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/)
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] ? (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]) : 1 }
  return null
}
function hsl({ r, g, b }: RGBA) {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min, l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d) h = max === R ? 60 * (((G - B) / d) % 6) : max === G ? 60 * ((B - R) / d + 2) : 60 * ((R - G) / d + 4)
  return { h: (h + 360) % 360, s, l, chroma: d }
}
const hueDist = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

function resolveRef(ref: unknown, depth = 0): string | null {
  if (typeof ref !== 'string' || depth > 6) return null
  if (parse(ref)) return ref
  const val = (v: unknown): string | null => (v && typeof v === 'object' && 'DEFAULT' in (v as object) ? val((v as any).DEFAULT) : resolveRef(v, depth + 1))
  const [head, ...rest] = ref.split('.')
  const tail = rest.join('.')
  if (['primary', 'accent', 'neutral'].includes(head)) return val(tail ? colors[head]?.[tail] : colors[head])
  if (head === 'semantic') return resolveRef(tail, depth + 1)
  if (head === 'roles') return val(colors.roles?.[tail])
  if (colors.semantic && head in colors.semantic) return val(tail ? colors.semantic[head]?.[tail] : colors.semantic[head])
  if (colors.roles && head in colors.roles && !tail) return val(colors.roles[head])
  return null
}

function entries(group: string): [string, string][] {
  const g = colors[group]
  if (typeof g === 'string') return [['DEFAULT', g]]
  return Object.entries(g ?? {}).map(([k, v]) => [k, resolveRef(v as string) ?? String(v)])
}

// Every literal the brand allows, normalised to 'r,g,b,a'.
const key = (c: RGBA) => `${c.r},${c.g},${c.b},${Math.round(c.a * 100)}`
const palette = new Set<string>()
for (const g of ['primary', 'accent', 'neutral']) for (const [, v] of entries(g)) { const c = parse(v); if (c) palette.add(key(c)) }
for (const v of Object.values(colors.semantic ?? {})) {
  for (const x of typeof v === 'object' ? Object.values(v as object) : [v]) { const r = resolveRef(x); const c = r && parse(r); if (c) palette.add(key(c)) }
}
for (const c of [{ r: 0, g: 0, b: 0, a: 0 }]) palette.add(key(c)) // transparent

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'guards' || e.startsWith('.git')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|jsx?|vue|svelte|html|css|scss)$/.test(e)) out.push(p)
  }
  return out
}
const scanDirs = [join(SYSTEM, 'primitives'), ...(process.env.GUARD_SCAN_DIRS ?? '').split(',').filter(Boolean).map((d) => resolve(process.cwd(), d.trim()))]
const files = scanDirs.flatMap((d) => walk(d))
const brandColorNames = new Set<string>([...['primary', 'accent', 'neutral'], ...Object.keys(colors.semantic ?? {}), ...Object.keys(colors.roles ?? {}).map((r) => r.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase())])

describe('three-color palette', () => {
  it('only primary / accent / neutral (+ semantic, roles) groups exist', () => {
    for (const g of ['primary', 'accent', 'neutral']) expect(colors[g], `tokens.colors.${g} is required`).toBeTruthy()
    expect(Object.keys(colors).filter((k) => !GROUPS.includes(k))).toEqual([])
  })

  it('semantic set is the fixed status set', () => {
    expect(Object.keys(colors.semantic ?? {}).filter((k) => !SEMANTIC.includes(k))).toEqual([])
  })

  it.each(['primary', 'accent'])('%s is one hue', (g) => {
    const base = parse(resolveRef(g) ?? '')
    expect(base, `${g}.DEFAULT must be a color`).toBeTruthy()
    const h0 = hsl(base!).h
    const off = entries(g)
      .filter(([k]) => k !== 'foreground')
      .map(([k, v]) => [k, parse(v)] as const)
      .filter(([, c]) => c && c.a === 1)
      .map(([k, c]) => [k, hsl(c!)] as const)
      .filter(([, x]) => x.s > 0.2 && x.l > 0.12 && x.l < 0.92 && hueDist(x.h, h0) > HUE_TOLERANCE)
      .map(([k, x]) => `${g}.${k} hue ${Math.round(x.h)} vs ${Math.round(h0)}`)
    expect(off).toEqual([])
  })

  it('neutral has no chroma', () => {
    const loud = entries('neutral')
      .map(([k, v]) => [k, parse(v)] as const)
      .filter(([, c]) => c && hsl(c).chroma > NEUTRAL_MAX_CHROMA)
      .map(([k]) => `neutral.${k}`)
    expect(loud).toEqual([])
  })

  it('every role resolves into the palette', () => {
    const broken = Object.entries(colors.roles ?? {}).filter(([, ref]) => resolveRef(ref) == null).map(([r, ref]) => `${r} -> ${ref}`)
    expect(broken).toEqual([])
  })

  it('generated and scanned code uses no off-palette color', () => {
    const bad: string[] = []
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g)) {
        const c = parse(m[0])
        if (c && !palette.has(key(c))) bad.push(`${f}: ${m[0]}`)
      }
      for (const m of src.matchAll(/\b(?:bg|text|border|ring|outline|fill|stroke|from|to|via)-([a-z]+)-(\d{2,3})\b/g)) {
        if (TAILWIND_FAMILIES.includes(m[1]) && !brandColorNames.has(m[1])) bad.push(`${f}: ${m[0]} is a default Tailwind color`)
      }
    }
    expect(bad).toEqual([])
  })
})
