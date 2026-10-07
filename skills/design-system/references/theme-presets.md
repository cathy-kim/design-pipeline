# Theme presets → partial brand_config

Ten ready-made palettes and font pairings. Each is written as a **partial `brand_config.tokens`** (colors + typography families) so it can seed a brand when the brief has no brand and the user picks a preset instead of a custom palette.

Rules applied when converting the original 4-color themes:

- The 3-color rule allows only `primary`, `accent` and `neutral` (+ fixed `semantic`). A fourth chromatic color became a step of the group with the nearest hue, a `semantic` status, or was dropped. The "Dropped / moved" line says which.
- A neutral step must have chroma ≤ 0.12 (`(max-min)/255`). Tinted darks/lights that fail were moved into primary or replaced by a **derived** near-neutral (marked `derived`).
- Primary/accent steps must stay within 30° hue of their `DEFAULT`.
- Radius, spacing and type scale are not part of a preset. Add them in the brief decision or brand_config before building (the generator fills spacing/type/components with defaults and warns).
- Fonts are document fonts from the original kit (DejaVu, Free*). For web, keep them as the first family and let the system stack fall back.

Every block below passes `three-color.test.ts` when merged into a brand_config.

## How to use

1. Pick a preset with the user (show the "Best for" line, not the hex codes).
2. Copy its JSON into the brief decision block as `"tokens.colors"` and `"tokens.typography"`, or merge it into `.design/brand_config.json` under `tokens`.
3. Add `tokens.radius.scale` (e.g. `{"none":0,"sm":2,"md":4,"lg":8,"full":9999}`) and run the generator.

## 1. Ocean Depths — professional, calming

Best for corporate decks, finance reports, consulting.
Dropped / moved: none.

```json
{ "colors": {
    "primary": {"DEFAULT": "#2d8b8b", "foreground": "#f1faee"},
    "accent": {"DEFAULT": "#a8dadc", "foreground": "#1a2332"},
    "neutral": {"0": "#f1faee", "100": "#e4ede3", "200": "#d3dcd4", "500": "#7b8487", "950": "#1a2332"} },
  "typography": {"families": {"display": "DejaVu Sans, system-ui, sans-serif", "sans": "DejaVu Sans, system-ui, sans-serif"}} }
```

## 2. Sunset Boulevard — warm, energetic

Best for creative pitches, marketing, lifestyle and events.
Dropped / moved: coral `#f4a261` → `primary.300`. Warm sand `#e9c46a` dropped (4th hue). Deep teal `#264653` fails neutral chroma → `accent`; neutrals derived.

```json
{ "colors": {
    "primary": {"DEFAULT": "#e76f51", "foreground": "#ffffff", "300": "#f4a261"},
    "accent": {"DEFAULT": "#264653", "foreground": "#ffffff"},
    "neutral": {"0": "#fdfbf8", "100": "#f0eeeb", "200": "#dedcd9", "500": "#858380", "900": "#22201e"} },
  "typography": {"families": {"display": "DejaVu Serif, Georgia, serif", "sans": "DejaVu Sans, system-ui, sans-serif"}} }
```

## 3. Forest Canopy — natural, grounded

Best for sustainability, outdoor, wellness, organic products.
Dropped / moved: sage `#7d8471` → `neutral.500`. Dark text `neutral.900` derived.

```json
{ "colors": {
    "primary": {"DEFAULT": "#2d4a2b", "foreground": "#faf9f6"},
    "accent": {"DEFAULT": "#a4ac86", "foreground": "#2d4a2b"},
    "neutral": {"0": "#faf9f6", "100": "#edece9", "200": "#dcdbd8", "500": "#7d8471", "900": "#22261f"} },
  "typography": {"families": {"display": "FreeSerif, Georgia, serif", "sans": "FreeSans, system-ui, sans-serif"}} }
```

## 4. Modern Minimalist — clean grayscale

Best for tech, architecture portfolios, design showcases, data viz.
Dropped / moved: charcoal doubles as `neutral.900`. Accent is a low-saturation slate, so hierarchy must come from size/weight first.

```json
{ "colors": {
    "primary": {"DEFAULT": "#36454f", "foreground": "#ffffff"},
    "accent": {"DEFAULT": "#708090", "foreground": "#ffffff"},
    "neutral": {"0": "#ffffff", "100": "#f3f4f4", "200": "#e3e5e6", "300": "#d3d3d3", "500": "#90999e", "900": "#36454f"} },
  "typography": {"families": {"display": "DejaVu Sans, system-ui, sans-serif", "sans": "DejaVu Sans, system-ui, sans-serif"}} }
```

## 5. Golden Hour — rich, autumnal

Best for restaurants, hospitality, fall campaigns, artisan products.
Dropped / moved: warm beige `#d4b896` fails neutral chroma → `primary.200`. `neutral.0` derived.

```json
{ "colors": {
    "primary": {"DEFAULT": "#f4a900", "foreground": "#4a403a", "200": "#d4b896"},
    "accent": {"DEFAULT": "#c1666b", "foreground": "#ffffff"},
    "neutral": {"0": "#fbf8f4", "100": "#f0ede9", "200": "#e2deda", "500": "#9a938e", "900": "#4a403a"} },
  "typography": {"families": {"display": "FreeSans, system-ui, sans-serif", "sans": "FreeSans, system-ui, sans-serif"}} }
```

## 6. Arctic Frost — cool, precise

Best for healthcare, clean tech, pharma, winter sports.
Dropped / moved: ice blue `#d4e4f7` → `primary.100`. Silver is the accent. Dark text `neutral.900` derived.

```json
{ "colors": {
    "primary": {"DEFAULT": "#4a6fa5", "foreground": "#ffffff", "100": "#d4e4f7"},
    "accent": {"DEFAULT": "#c0c0c0", "foreground": "#1f2933"},
    "neutral": {"0": "#fafafa", "100": "#ededee", "200": "#dbddde", "500": "#82878d", "900": "#1f2933"} },
  "typography": {"families": {"display": "DejaVu Sans, system-ui, sans-serif", "sans": "DejaVu Sans, system-ui, sans-serif"}} }
```

## 7. Desert Rose — soft, sophisticated

Best for fashion, beauty, weddings, interiors, boutiques.
Dropped / moved: clay `#b87d6d` → `primary.700`, sand `#e8d5c4` → `primary.100` (both fail neutral chroma). Burgundy is the accent. Neutrals derived.

```json
{ "colors": {
    "primary": {"DEFAULT": "#d4a5a5", "foreground": "#2a2326", "100": "#e8d5c4", "700": "#b87d6d"},
    "accent": {"DEFAULT": "#5d2e46", "foreground": "#ffffff"},
    "neutral": {"0": "#fdfbf9", "100": "#f0eeec", "200": "#dfdddb", "500": "#898485", "900": "#2a2326"} },
  "typography": {"families": {"display": "FreeSans, system-ui, sans-serif", "sans": "FreeSans, system-ui, sans-serif"}} }
```

## 8. Tech Innovation — bold, high contrast

Best for startups, launches, AI/ML, digital transformation.
Dropped / moved: none. Cyan `#00ffff` is a flat highlight only. Never use it as a glow or gradient border (§1-6 bans).

```json
{ "colors": {
    "primary": {"DEFAULT": "#0066ff", "foreground": "#ffffff"},
    "accent": {"DEFAULT": "#00ffff", "foreground": "#1e1e1e"},
    "neutral": {"0": "#ffffff", "100": "#f2f2f2", "200": "#e0e0e0", "500": "#838383", "900": "#1e1e1e"} },
  "typography": {"families": {"display": "DejaVu Sans, system-ui, sans-serif", "sans": "DejaVu Sans, system-ui, sans-serif"}} }
```

## 9. Botanical Garden — fresh, organic

Best for garden centers, food, farm-to-table, natural products.
Dropped / moved: terracotta `#b7472a` (4th hue) → `semantic.danger`. Dark text `neutral.900` derived.

```json
{ "colors": {
    "primary": {"DEFAULT": "#4a7c59", "foreground": "#ffffff"},
    "accent": {"DEFAULT": "#f9a620", "foreground": "#1f2421"},
    "neutral": {"0": "#f5f3ed", "100": "#e8e7e1", "200": "#d7d6d0", "500": "#7f817d", "900": "#1f2421"},
    "semantic": {"danger": "#b7472a"} },
  "typography": {"families": {"display": "DejaVu Serif, Georgia, serif", "sans": "DejaVu Sans, system-ui, sans-serif"}} }
```

## 10. Midnight Galaxy — dramatic, cosmic (dark)

Best for entertainment, gaming, nightlife, luxury, creative agencies.
Dropped / moved: deep purple base `#2b1e3e` fails neutral chroma → `primary.900`. Darkest neutral derived. This is a dark theme: map roles `background → neutral.950`, `text → neutral.50`.

```json
{ "colors": {
    "primary": {"DEFAULT": "#4a4e8f", "foreground": "#e6e6fa", "900": "#2b1e3e"},
    "accent": {"DEFAULT": "#a490c2", "foreground": "#17141c"},
    "neutral": {"50": "#e6e6fa", "100": "#d5d5e8", "300": "#a8a7b7", "600": "#6a6875", "950": "#17141c"},
    "roles": {"background": "neutral.950", "surface": "primary.900", "text": "neutral.50", "textMuted": "accent", "border": "primary", "focus": "accent"} },
  "typography": {"families": {"display": "FreeSans, system-ui, sans-serif", "sans": "FreeSans, system-ui, sans-serif"}} }
```
