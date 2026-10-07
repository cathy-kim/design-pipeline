# Image mode — tokens from a screenshot, mockup or photo

Principle: **never ask a vision model "what color is this?"**. The vision model says
*where* to look and *what role* a region plays. `scripts/image-colors.sh` reads the real
pixel values. Typography, spacing and radius can only be estimated, so their confidence is
capped (see [brand-config-mapping.md](brand-config-mapping.md)).

## Steps

1. **Metadata + palette evidence**

   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/skills/design-tokens/scripts/image-colors.sh" ref.png > .design/tokens-evidence/image-colors.json
   ```

   Output: width, height, top-12 quantized histogram, 3×3 grid area averages.

2. **Role map (vision).** Open the image with the Read tool (Claude vision) or Gemini CLI if
   installed and list the regions that carry a role, as pixel boxes `x,y,w,h`:
   page background, surface/card, primary CTA fill, secondary/accent element, heading text,
   body text, muted text, divider/border. Ask for boxes, not colors.

3. **Pixel-exact role colors.** Re-run with those boxes; each returns an area-averaged hex:

   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/skills/design-tokens/scripts/image-colors.sh" ref.png 40,610,180,48 40,120,600,60 > .design/tokens-evidence/image-roles.json
   ```

   For thin text strokes, use a box that sits inside the glyph stem, or take the darkest
   histogram entry near the text; anti-aliasing lightens edges.

4. **Typography estimate.** Measure cap height or x-height in px from the image, convert with
   the canvas width (1080 px social canvas, 1440 / 1920 px desktop, 390 px mobile).
   Classify families by anatomy (serif / sans / mono, geometric / humanist / grotesque,
   stroke contrast, terminal shape) and name the closest family as an *estimate*.

5. **Spacing, radius, grid estimate.** Measure repeated gaps and corner radii in px.
   Classify the layout grid (regular, modular, baseline, golden-ratio, bento, asymmetric,
   freeform) with columns, gutter and margin when visible.

6. **Write raw.json** per [raw-schema.md](raw-schema.md) with
   `meta.sourceType: "image"`, `meta.colorMethod: "pixel"` (or `"vision"` if step 3 was
   skipped; the mapper then scores colors ≤ 70), `roles.brandSource: "pixel"`, measured
   values in `radii` / `spacing`, the grid in `grid`, and the image path in
   `evidence.screenshots`. Then run the mapper.

## Gates before running the mapper

- `image-colors.json` and `image-roles.json` exist in `.design/tokens-evidence/`.
- Every color in `roles` came from `image-roles.json`, not from a vision answer.
- Typography sizes are labeled as estimates in `notes`.

## Out of scope here

Texture recipes (paper grain, ruled lines, film noise), overlay annotations (hand-drawn
circles, highlighter), layer decomposition and grid sectioning of the image into cells
belong to `design-recreate`. Record what you saw in `notes`; do not tokenize it.
