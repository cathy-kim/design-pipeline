# Decision log — one token extractor

Before this skill there were three URL token extractors:

1. `design-system-extractor/scripts/extract-all.ts` + four browser modules
   (`extract-colors.js`, `extract-typography.js`, `extract-spacing.js`, `extract-components.js`).
2. `antigravity/scripts/extract-design-tokens.js` (single file, CommonJS).
3. `design-workflow` type E, which only called (2) through a path that did not exist
   (`open-antigravity/...`). It added no logic of its own.

## Choice: (1) as the base, with (2)'s semantic pass ported in

| Criterion | (1) extract-all.ts set | (2) extract-design-tokens.js |
|---|---|---|
| Values | Measured, with occurrence counts and ΔE-style clustering | Colors measured; **type scale synthesized** from an average ratio; **spacing scale synthesized** from base × fixed multipliers; **radius scale hard-coded** (`sm 4 / md 8 / lg 16 / xl 24 / full`) regardless of the site |
| Semantic roles | None (names like `background-1`, `blue-3`) | background / surface / brand / text from element context (area, z-index, interactive + saturation) |
| Typography | Families by heading/body/mono, sizes with base-relative names, weights, line heights, letter spacing, scale ratio detection | One family for heading and body, synthesized sizes, fixed line heights |
| Spacing | Base unit + measured scale + gaps + confidence score | Base unit + synthesized scale |
| Components | button, card, input, badge, avatar, modal, nav, dropdown signatures | None |
| Radius / shadows | Only inside component styles | Collected page-wide |
| Confidence | Per group heuristics | None |
| Output | JSON + report | JSON + Tailwind config + CSS variables |
| Deps | playwright, tsx (+ lock) | playwright (+ sharp in the shared package, unused here) |

CONTRACT §5 needs semantic `primary` / `accent` / `neutral`, a closed radius scale, and
per-group confidence for promotion. (1) is closer: its values are measured and it already
scores confidence. Its gap was semantic roles and page-wide radius/shadow data, which is
exactly what (2) did better. A hard-coded radius scale contradicts the rule that the brand's own scale is canon,
so (2)'s scale was not kept. Radii are named by rank from measured values instead.

## What changed

- Copied unchanged: the four browser modules and `package-lock.json` (root name updated).
- Added `scripts/extract-semantics.js`: (2)'s context-aware role detection, rewritten to
  return ranked measured values; page-wide radius, shadow and transition counts; page
  title / site name / description / logo candidates.
- Rewrote `scripts/extract-all.ts`: writes into `.design/` instead of `./output`, takes
  desktop + mobile screenshots, injects the semantics module, emits `raw.json` and calls
  the mapper. The original skill doc invoked `scripts/extract-all.js`, which never existed;
  every invocation now targets the `.ts` file through `tsx`.
- Added `scripts/to-brand-config.ts` (raw → §5 draft + report + confidence),
  `scripts/promote.ts` (draft → brand_config.json) and `scripts/image-colors.sh`
  (ImageMagick pixel evidence for image and guide modes).

## What (2) did better and is not carried over

- **Tailwind config and CSS variable emitters.** Generating code from tokens is stage 3
  (`design-system`). The emitters stay in the source skill; design-system owns this now.
- **Named modular scale lookup** (Major Third, Perfect Fourth…). (1) snaps the ratio to the
  same list of numbers but does not print the name. The ratio is in `raw.json`
  (`typographyScale.ratio`); naming it is cosmetic.
- **Single-file, zero-build CommonJS script.** (1) needs `tsx`. Accepted: `npx tsx` works
  without a build step, and one module per token group is easier to maintain.

## Also not carried over

- `design-system-extractor/data/design-tokens-schema.json` and `references/design-tokens-spec.md`:
  schema for that skill's own output format, replaced by CONTRACT §5.
- `antigravity/references/design-tokenization.md`: recommends glassmorphism and color-glow
  shadows, which CONTRACT §1-6 forbids. Its color-role and scale algorithms are documented in
  [brand-config-mapping.md](brand-config-mapping.md) and [typography-analysis.md](typography-analysis.md).
- Grid sectioning (`grid-section-image.js`), layout grid detection, texture and annotation
  analysis: owned by `design-recreate`.
