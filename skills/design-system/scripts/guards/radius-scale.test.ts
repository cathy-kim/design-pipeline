// Radius guard: the brand's radius scale is the canon for that brand and it is CLOSED.
// (a) only scale values may be used, (b) named steps strictly rise in rank none<sm<md<lg<xl<2xl<3xl<full
// ("sm": 2 with "lg": 2 fails), (c) a numeric name equals its value ("6": 6; "soft": 6 fails),
// (d) any named step requires "none": 0 plus at least two other named steps ({"lg": 2} alone fails).
// Source of truth: ../../brand_config.json (the .design/ handoff bus). No plugin imports, runs standalone.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SYSTEM = resolve(HERE, '..')
const CONFIG = process.env.BRAND_CONFIG ?? resolve(HERE, '../../brand_config.json')
const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'))
const scale: Record<string, number> = cfg.tokens?.radius?.scale ?? {}

// Same order as scripts/build-system.ts RADIUS_RANK.
const RANK = ['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full']

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
const allowedPx = new Set(Object.entries(scale).map(([k, v]) => (k === 'full' ? 9999 : v)))

describe('radius scale is closed and honest', () => {
  it('has at least one step', () => {
    expect(Object.keys(scale).length).toBeGreaterThan(0)
  })

  it.each(Object.entries(scale))('step "%s" = %s is a valid name', (name, value) => {
    expect(Number.isInteger(value) && value >= 0, `radius "${name}" must be a non-negative integer`).toBe(true)
    if (RANK.includes(name)) return
    expect(/^\d+$/.test(name), `unknown step name "${name}"; use ${RANK.join('/')} or the number itself`).toBe(true)
    expect(value, `numeric name "${name}" must equal its value`).toBe(Number(name))
  })

  it('named scale has none: 0 plus at least two more named steps', () => {
    const named = RANK.filter((n) => n in scale)
    if (!named.some((n) => n !== 'none')) return // numeric-only scales (optionally with "none") are allowed
    expect(scale.none, `named steps (${named.join(', ')}) require "none": 0`).toBe(0)
    expect(named.filter((n) => n !== 'none').length, `need "none" plus at least two named steps, have ${named.join(', ')}`).toBeGreaterThanOrEqual(2)
  })

  it('named steps rise in rank order', () => {
    const named = RANK.filter((n) => typeof scale[n] === 'number').map((n) => [n, scale[n]] as const)
    const bad = named.slice(1).filter(([, v], i) => v <= named[i][1]).map(([n, v], i) => `"${n}": ${v} is not above "${named[i][0]}": ${named[i][1]}`)
    expect(bad).toEqual([])
  })

  it('tokens.css declares exactly the brand steps', () => {
    const css = readFileSync(join(SYSTEM, 'tokens.css'), 'utf8')
    const declared = [...css.matchAll(/--radius-([A-Za-z0-9_-]+):\s*([^;]+);/g)].map((m) => m[1]).sort()
    expect(declared).toEqual(Object.keys(scale).sort())
  })

  it('generated code uses no off-scale radius', () => {
    const bad: string[] = []
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/\brounded(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?-(\[[^\]]+\]|[A-Za-z0-9.]+)/g)) {
        const step = m[1]
        if (step.startsWith('[')) bad.push(`${f}: arbitrary ${m[0]}`)
        else if (!(step in scale)) bad.push(`${f}: ${m[0]} is not in the brand scale`)
      }
      for (const m of src.matchAll(/border(?:-[a-z]+)?-radius\s*:\s*([\d.]+)px/g)) {
        if (!allowedPx.has(Number(m[1]))) bad.push(`${f}: border-radius ${m[1]}px`)
      }
      for (const m of src.matchAll(/border\w*Radius\s*:\s*([\d.]+)/g)) {
        if (!allowedPx.has(Number(m[1]))) bad.push(`${f}: borderRadius ${m[1]}`)
      }
    }
    expect(bad).toEqual([])
  })
})
