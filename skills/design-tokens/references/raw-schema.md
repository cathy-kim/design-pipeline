# raw.json — the shared intermediate

All three input modes produce one file, `.design/tokens-evidence/raw.json`.
`scripts/to-brand-config.ts` is the only code that turns it into the CONTRACT §5 draft,
so URL, image and guide extractions are scored and named the same way.

URL mode writes it automatically (`scripts/extract-all.ts`). Image and guide modes
write it by hand (or via the `design-token-extractor` agent) and then run the mapper.

## Shape

```jsonc
{
  "meta": {
    "source": "https://example.com | path/to/ref.png | path/to/guide.pdf",   // required
    "sourceType": "url | image | guide",                                    // required
    "extractedAt": "ISO-8601",
    "colorMethod": "computed | pixel | stated | vision"  // how color values were obtained
  },
  // Clustered palette. name is free-form; only value/usage/occurrences are read.
  "colors": { "<name>": { "value": "#RRGGBB", "usage": ["backgroundColor", "color", "borderColor"], "occurrences": 12 } },
  // Context roles. brand[] is ordered: first = primary candidate.
  "roles": {
    "background": { "base": "#FFFFFF", "isDark": false },
    "surface": [{ "value": "#F7F7F7", "count": 3 }],
    "brand":   [{ "value": "#2F5BEA", "count": 9 }],
    "text":    [{ "value": "#1A1A1A", "count": 40 }, { "value": "#6B6B66", "count": 8 }],
    "border":  [{ "value": "#E5E5E0", "count": 6 }],
    "brandSource": "interactive-elements | stated | pixel | none"
  },
  "typography": {
    "fontFamilies": { "heading": "Georgia", "body": "Inter", "mono": "JetBrains Mono" },
    "fontSizes":   { "sm": "14px", "base": "16px", "lg": "20px" },   // px strings or numbers
    "fontWeights": { "normal": 400, "bold": 700 },
    "lineHeights": { "tight": 1.25, "normal": 1.5 }
  },
  "typographyScale": { "base": 16, "ratio": 1.25, "detected": true },
  "spacing": { "base": "4px", "scale": { "1": "4px", "2": "8px", "4": "16px" } },
  "spacingConfidence": 90,
  "radii":   [{ "value": 6, "count": 14 }, { "value": "full", "count": 3 }],  // measured px or "full"
  "shadows": [{ "value": "0 1px 3px rgba(0,0,0,.1)", "count": 5 }],
  "motion":  { "durations": [{ "value": "0.2s", "count": 6 }], "easings": [{ "value": "ease-out", "count": 6 }] },
  "components": { "button": { "borderRadius": "6px", "padding": "8px 16px" } },
  "grid": { "type": "regular", "columns": 12, "gutter": 24, "margin": 64 },     // optional
  "page": { "title": "...", "siteName": "...", "description": "...", "logoCandidates": [] },
  "evidence": { "screenshots": [".design/tokens-evidence/desktop.png"] },
  // Optional per-group overrides (0-100). Capped by source type, see brand-config-mapping.md.
  "confidence": { "colors": 95, "typography": 60 },
  "notes": ["free text lines copied into tokens-report.md"]
}
```

Every field except `meta.source` and `meta.sourceType` is optional. Missing groups
produce empty objects in the draft and a low score in the report. Never invent a
value to fill a group: an empty group is honest, a guessed one poisons stage 3.
