# Color hierarchy by touchpoint (S1–S4)

The 3-color rule fixes **which** colors exist. This table sets **how much** of each a touchpoint may use. Pick the stage from the asset type, then apply the ratio with the brand's `primary`, `accent` and `neutral`.

| Stage | Name | Ratio | Touchpoints | Audience |
|---|---|---|---|---|
| S1 | Primary identity | 75 : 25 (primary + neutral) | Business card, official documents, logo | New users |
| S2 | Structured communication | 60 : 30 : 10 (neutral : primary : accent) | Website, ads, presentations, product UI | General users |
| S3 | Rich information | 50 : 25 : 15 : 10 (neutral : primary : accent : semantic) | eBook, infographic, newsletter, dashboards | Engaged users |
| S4 | Creative freedom | primary ≥ 20 %, rest free within the palette | Blog, social, illustration | Existing users |

Product screens are S2 by default. Status colors (`semantic`) enter only at S3 and only to carry status, never decoration.

Selection:

```
asset type → touchpoint → stage → ratio applied to tokens.colors
```

Hierarchy inside a screen still goes size/weight → spacing → lightness before color (CONTRACT §1-6). Raising a color's share is the last resort.
