# raw.json → brand_config.draft.json

Implemented in `scripts/to-brand-config.ts`. This page documents the rules so a reviewer
can check a draft without reading code.

## Colors (3-color rule: primary + accent + neutral)

| Target | Rule |
|---|---|
| `primary` | First chromatic color (chroma = max−min channel ≥ 0.12) among `roles.brand` (in order), then palette clusters by occurrences |
| `accent` | Next chromatic candidate whose hue is ≥ 30° away from primary. `null` if none. A one-color brand is valid |
| `neutral` | Low-chroma (< 0.12) colors bucketed by HSL lightness to steps 0 (pure white), 50 … 950. Colors a role points at are placed first and never evicted; on a collision the later one takes the nearest free step. Other neutrals only fill free steps (most frequent first); the rest are dropped and reported. No step is synthesized |
| `roles.background / surface / text / textMuted / border` | References such as `"neutral.50"` or `"primary"`, which design-system resolves. Text colors must be neutral (links are not body text) and differ from the background by ≥ 30 HSL lightness (white CTA text is skipped). Border comes only from elements that draw a visible border. `roles.focus` = `"primary"`. A chromatic role color that is neither primary nor accent is left out and noted |
| `semantic` | Only `success` / `warning` / `danger` / `info` (design-system rejects other keys): a leftover chromatic candidate whose hue falls in green / yellow-orange / red |
| dropped | Any other chromatic color. Listed in the report, not in the draft |

## Typography

`families`, `scale` (px numbers), `weights`, `lineHeights` are copied from raw. Scale names
follow the base-relative naming of the typography extractor (`xs`, `sm`, `base`, `lg`, `xl`,
`3xl`…), see [typography-analysis.md](typography-analysis.md).

## Spacing and geometry

`spacing.scale` = raw scale converted to px numbers. The detected base unit goes to
`geometry.baseUnit`; an image-mode grid goes to `geometry.grid`.

## Radius — the brand's own scale, named by rank

There is no fixed ladder. The brand's `tokens.radius.scale` is its canon (CONTRACT §5 radius
rule, enforced by design-system's `build-system.ts --check` and guard tests).

1. Collect distinct measured radii in px. `9999px` and above, or any `%` value, become `full`.
2. Merge values within ±1px into the more frequent one (5 and 6 become 6 when 6 is used more).
3. Drop rare values: with 20 or more radius uses, a value needs at least 2 uses.
4. Sort ascending and name by rank: `none` = 0, then `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`.
   Values beyond the sixth get numeric names equal to the value (`"40": 40`). `full` = 9999.
5. If fewer than two named steps besides `none` result, every step gets a numeric name
   (`{"0": 0, "6": 6}`), because a named scale needs `none` plus at least two more.

Allowed names are exactly `none sm md lg xl 2xl 3xl full` plus numbers equal to their value.
`xs` is never emitted. Named steps rise strictly in that order by construction. Merged and
dropped values are listed in the report with their original px.

## Effects, motion, components

- `effects.shadows`: up to 3 most-used shadows, named `sm` / `md` / `lg` by blur radius.
- `motion.durations`: up to 3 most-used transition durations as `fast` / `base` / `slow`; `easingCurves.standard` = most-used timing function.
- `components.<type>` = `{ "variants": { "default": <common computed styles> }, "states": {} }`. See [component-extraction.md](component-extraction.md).

## Left empty on purpose

`_meta` carries `source`, `extractedAt` and `derived` (where `brand.id` / `brand.name` came from: `flag --id/--name`, `og:site_name`, `page/document title`, `url host` or `file name`); confidence stays in the report and
`tokens-evidence/confidence.json`.

`brand.nameKr`, `brand.mood`, `brand.philosophy`, `artStyle.*`, `visualSystem.*`, `motion.feel`,
`assets.logo`, `assets.fonts`, `brandKeywords`. These are judgments, not measurements. They come
from `design-brief` or the user. `assets.references` lists the evidence screenshots.

## Confidence (0–100 per group)

| Group | URL mode basis |
|---|---|
| colors | 85 + 15 × (share of clusters seen more than once); −15 when no brand color was seen on an interactive element; ≤ 40 when no chromatic color exists |
| typography | 80, +10 scale ratio detected, +5 ≥ 2 families, +5 ≥ 5 sizes |
| spacing | share of spacing uses that are multiples of the detected base unit |
| radius | share of radius uses kept as-is, i.e. not merged into a neighbor (floor 40; 50 when nothing measured) |
| effects | 80 with shadows, 60 without (flat is a valid result) |
| components | 80 when any component type was found, else 0 |
| motion | 70 when transitions were found, else 0 |

`overall` = colors .35 + typography .30 + spacing .15 + radius .10 + effects .05 + components .05.

Caps by source type (a raw `confidence` override is clamped to these):

| Group | url | image | guide |
|---|---|---|---|
| colors | 100 | 95 | 100 |
| typography | 100 | 60 | 100 |
| spacing | 100 | 50 | 100 |
| radius | 100 | 50 | 100 |
| effects | 100 | 40 | 100 |
| components | 100 | 40 | 100 |
| motion | 100 | 0 | 100 |

Image and guide modes default to 70/60/… unless the raw file sets `confidence`. A guide value
copied verbatim from the document may be scored 95–100; a value read off a guide's sample
image follows the image caps.

## Promotion thresholds

Defined once in `THRESHOLDS` in `scripts/to-brand-config.ts`:

- source type is `url` or `guide` (image mode always needs the user's confirmation)
- colors ≥ 85, typography ≥ 80, overall ≥ 80
- `tokens.colors.primary` is not null
- `tokens.colors.accent` is not null (design-system requires it)
- no `.design/brand_config.json` exists yet (auto-promotion never overwrites)
- in both modes, `promote.ts` first runs design-system's `build-system.ts --check` on the draft and refuses on failure
