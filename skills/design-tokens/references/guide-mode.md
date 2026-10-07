# Guide mode — tokens from a brand guide (PDF / AI)

A brand guide *states* its values. Copy what is stated; measure only what is not.

## 1. Get the text and pages

```bash
pdfinfo guide.pdf                      # page count
pdftotext -layout guide.pdf .design/tokens-evidence/guide.txt
pdftoppm -r 110 -png guide.pdf .design/tokens-evidence/guide-page
```

`.ai` files saved with PDF compatibility (the Illustrator default) open with the same tools.
If `pdftotext` returns nothing, the file is not PDF-compatible or is outlined text: render
pages with `pdftoppm` (or ask the user for a PDF export) and continue from images.
Poppler (`pdftotext`, `pdftoppm`) is the expected toolset; the Read tool can also read PDF
pages directly (≤ 20 pages per call).

## 2. Pull stated values

Search the text for, in order:

| Group | Look for |
|---|---|
| colors | `HEX`, `#RRGGBB`, `RGB`, `CMYK`, `Pantone`/`PMS`, names like Primary / Secondary / Accent / Neutral |
| typography | typeface names, weights ("Bold", "700"), size tables, leading/line-height |
| spacing / grid | clear-space rules, margins, column counts, baseline grid |
| radius / effects | corner radius, shadow specs (often absent: leave empty) |
| logo | clear space, minimum size, do/don't pages, logo file names |
| tone | mood words, personality, voice: goes to `notes` for `design-brief`, not into tokens |

```bash
grep -nE '#[0-9A-Fa-f]{6}|HEX|RGB|CMYK|Pantone|PMS' .design/tokens-evidence/guide.txt
```

Rules:
- When a color is given in several systems, take HEX. If only RGB, convert. If only CMYK or
  Pantone, render that swatch page and read the pixel with
  `scripts/image-colors.sh` (step 3 of [image-mode.md](image-mode.md)); mark it `colorMethod: "pixel"` in `notes`.
- The guide's own role names win: "Primary" → `roles.brand[0]`, "Secondary/Accent" → `roles.brand[1]`.
  More than one secondary color is common; list them all and let the mapper keep one accent
  (the rest are reported as dropped; that is the 3-color rule, not data loss).
- Print-only typefaces without a web version: record both the stated face and the web
  substitute the guide names; if it names none, leave the substitute empty and say so.

## 3. Write raw.json

`meta.sourceType: "guide"`, `meta.colorMethod: "stated"`, `roles.brandSource: "stated"`,
`evidence.screenshots`: the rendered pages that contain the color and type specs.
Set `confidence` per group: 95–100 for groups copied verbatim, the image-mode caps for
groups measured off sample images, and omit groups the guide does not cover.

## 4. Logo and font files

Do not download or copy brand files into the draft. List the logo pages and any font file
names in `notes`; `assets.logo` and `assets.fonts` stay empty until the files exist in the
brand's asset folder.
