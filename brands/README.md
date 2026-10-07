# brands/

One file per brand. `brands/<id>.json` is a `brand_config` (CONTRACT §5). Asset files live next to it in `brands/<id>/` and are referenced by relative path from `assets.*`.

`_template.json` is the canonical schema, filled with the placeholder brand **acme**. JSON has no comments, so every field is explained here.

| File | What it is |
|---|---|
| `_template.json` | Canonical schema with placeholder values. Copy it to start a brand. |
| `<id>.json` + `<id>/` | Your brand. This repo ships no real brand — every user creates their own from the template (see below). Keep private brand files out of shared forks or add them to `.gitignore`. |

## Add a brand

1. `cp brands/_template.json brands/<id>.json` and set `brand.id` to `<id>` (kebab-case, also used as file name).
2. Replace values. Delete optional blocks you cannot source instead of guessing. Use `null` for a known-unknown and list it in `_meta.unmapped`.
3. Put logo/font/reference files in `brands/<id>/` (keep files under 1 MB; list larger or rights-unclear files by path in `assets.references` instead of copying them).
4. Check it:

   ```bash
   python3 -m json.tool brands/<id>.json >/dev/null
   node skills/design-system/scripts/build-system.ts --check --config brands/<id>.json
   ```

5. In a project, copy it to `.design/brand_config.json` and run the `design-system` skill.

No brand file at all? design-brief records the palette and type decision as a fenced `json brand-decision` block in `.design/brief.md`, and design-system promotes it to `.design/brand_config.json`, filling radius, spacing, effects, geometry and motion from `_template.json`.

## Two rules the guards enforce

### Closed radius scale — the brand's scale is the canon

`tokens.radius.scale` is the radius canon for that brand. Only its steps exist: the generated Tailwind theme replaces the default radii, so `rounded-xl` does not exist unless `xl` is in the scale, and arbitrary `rounded-[6px]` fails the guard.

Four checks:

1. **Closed set.** Code may use only values in the scale.
2. **Named steps rise in rank.** The rank is `none < sm < md < lg < xl < 2xl < 3xl < full`. Each named step present must be larger than every smaller-ranked step present. `"sm": 2, "lg": 2` fails. `"md": 8, "sm": 12` fails.
3. **Numeric names equal their value.** `"6": 6` and `"18": 18` are valid. `"6": 7` fails. Any other name, such as `"soft": 6`, fails.
4. **A named scale is a real scale.** If any named step is present, `"none": 0` and at least two more named steps are required. `{"lg": 2}` alone fails. A scale with only numeric names, optionally with `"none": 0` as the zero step (`{"none": 0, "6": 6}`), is allowed.

A name does not have to carry a fixed px value. A product whose `rounded-lg` is 12px records `"lg": 12`, so generated classes match product code.

The default table in `_template.json`, used when a brand has no opinion, is:

| name | none | sm | md | lg | xl | 2xl | 3xl | full |
|---|---|---|---|---|---|---|---|---|
| px | 0 | 2 | 4 | 8 | 12 | 16 | 24 | 9999 |

### 3-color rule

One screen uses Primary + Accent + Neutral. `tokens.colors` may only contain:

- `primary` and `accent`: one hue each. Steps may vary in lightness but stay within 30° hue of `DEFAULT`. `foreground` (text on that color) is exempt.
- `neutral`: steps with chroma ≤ 0.12, i.e. `(max(r,g,b) − min(r,g,b)) / 255`. Transparent black/white (`rgb(0 0 0 / 0.09)`) is fine.
- `semantic` (optional): only `success`, `warning`, `danger`, `info`. Each is a color, a reference, or `{ "DEFAULT", "soft", "strong" }`.
- `roles` (optional): names for usage (`background`, `text`, `border`, …) that point at palette references. No new colors.

A fourth brand hue has nowhere to go. Fold it into the nearest group, make it a semantic status, or drop it.

## Field reference

### `brand`
| Field | Type | Meaning |
|---|---|---|
| `id` | string, required | kebab-case id. CSS/file prefix. |
| `name` | string, required | Display name. |
| `nameKr` | string \| null | Korean name. |
| `description` | string | One sentence. |
| `mood` | string[] | Tone adjectives used by brief/assets. |
| `philosophy` | string \| null | One-line voice principle. |

### `tokens.colors`
See the 3-color rule. A **color reference** is `group` (its `DEFAULT`), `group.step`, a semantic status (`danger`, `danger.soft`), or a role name. Literals are `#rgb`, `#rrggbb`, `#rrggbbaa`, or `rgb(r g b / a)`.

### `tokens.typography`
| Field | Meaning |
|---|---|
| `families.<name>` | CSS font stack. Common names: `sans`, `display`, `mono`, `wordmark`. |
| `nativeFaces.<weight>` | React Native font file name per numeric weight (RN cannot synthesize weights). Only needed for `mobile-rn`. |
| `scale.<name>` | `{ size, lineHeight, weight?, letterSpacing? }`. `size` is px, rem or `clamp()`. `lineHeight` unitless or px. |
| `weights.<name>` | Named numeric weights. Components refer to these names. |
| `lineHeights.<name>` | Named unitless line heights (documentation and design-ui). |
| `compositions` | Optional named text styles that are more than a size (e.g. tabular figures). Not generated; read by design-ui. |

### `tokens.spacing`
`base` (px unit) and `scale` (`{ key: px }`). Keys become `p-<key>`, `gap-<key>`. Component `padding`/`paddingX` refer to these keys. If `scale` is `null` the generator uses a 4px default and warns.

### `tokens.radius`
`scale` — closed radius scale, see above.

### `tokens.effects`
`shadows.<name>` CSS box-shadow strings. Glow shadows (colored, large blur) are banned by CONTRACT §1-6. Other keys (e.g. `focusOutline`) are documentation.

### `tokens.geometry`
`breakpoints.<name>` px, `maxWidths.<name>` px, `touchTarget` px. Other keys (header height, screen padding) are documentation for design-ui.

### `artStyle`, `visualSystem`, `motion`
Read by design-assets and design-ui. `motion.durations.<name>` in ms and `motion.easingCurves.<name>` become `duration-<name>` / `ease-<name>`.

### `assets`
| Field | Meaning |
|---|---|
| `logo.<variant>` | Relative path under `brands/`, e.g. `acme/logo-wordmark.svg`, or `null`. |
| `fonts.<family>` | `{ file, license }` relative paths. Keep OFL license files with fonts. |
| `references` | Mood/reference images. Relative paths, or absolute source paths for files not copied. |
| `hero`, `moodBoard` | Path or `null`. |
| `canvasSizes.<name>` | `"WxH"` string, or `{ "width": N }` for a fixed-width, free-height canvas. Read by design-assets (see below). |
| `imagePromptConfiguration` | Style and avoid lists for image generation. |

`assets.canvasSizes` keys that design-assets templates require. Every brand carries all of them. Brand-specific sizes may be added next to them.

| Key | Value | Used for |
|---|---|---|
| `instagram-feed` | `1080x1350` | 4:5 feed post / card news |
| `instagram-story` | `1080x1920` | Story / reel cover |
| `instagram-square` | `1080x1080` | Square feed post |
| `web-hero` | `1920x1080` | Web hero image |
| `ad-square` | `1080x1080` | Square ad |
| `ad-landscape` | `1200x628` | Link / landscape ad |
| `ad-story` | `1080x1920` | Story ad |
| `detail-page` | `{ "width": 860 }` | Product detail page: fixed width, height follows content |
| `moodboard` | `1920x1080` | Mood board sheet |
| `logo-square` | `1024x1024` | Logo / app icon render |

### `components`
Primitive definitions. See `skills/design-system/references/token-component-map.md` for every field. Colors are references, `radius` is a radius-scale key, paddings are spacing keys, `text` is a typography-scale key.

### `build` (optional)
| Field | Values | Default |
|---|---|---|
| `componentFramework` | `react` \| `html` (web primitives) | `react` |
| `tailwindConfigFormat` | `ts` \| `js` | `ts` |

`mobile-rn` primitives are always React Native + NativeWind.

### `exceptions` (optional)
Approved departures from a CONTRACT §1-6 rule, each `{ rule, scope, reason, evidence }`. design-qa reads this list. An exception without `evidence` is not an exception.

### `platforms`
Any of `web`, `mobile-rn`, `print`. `mobile-rn` adds `nativewind.theme.js` and native primitives.

### `brandKeywords`
Strings for copy and asset prompts.

### `_meta` (optional)
Provenance, never read by the generator: `source`, `sourceAliases` (original token name → this schema), `derived` (values computed rather than copied), `sourceDrift` (contradictions found in the source), `unmapped` (what could not be mapped and why).
