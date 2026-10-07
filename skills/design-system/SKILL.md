---
name: design-system
description: Stage 3 of the design pipeline. Turns `.design/brand_config.json` into code that UI work must use — a closed Tailwind theme, CSS variables, a NativeWind theme for React Native, component primitives (button, input, card, nav) and Vitest guard tests for the closed radius scale and the 3-color rule. Also promotes a brief's palette/typography decision into brand_config when there is no brand, and seeds brands from 10 theme presets. Use when - 디자인 시스템, design system, 디자인 시스템 만들어줘, 토큰을 코드로, tailwind config 만들어, css variables, CSS 변수, NativeWind theme, 컴포넌트 프리미티브, 테마 적용, theme preset, radius 가드, 3색 가드. NOT for - 토큰 추출 from URL/image/guide (design-tokens), 화면·페이지 생성 (design-ui), 로고·이미지·카드뉴스 (design-assets), 재현 (design-recreate).
---

# design-system

Brand tokens in, closed design-system code out. Nothing in `.design/system/` is invented here: every value comes from `brand_config.json`.

## 1. Input

| Path | Required | Notes |
|---|---|---|
| `.design/brand_config.json` | **yes** | Schema: `${CLAUDE_PLUGIN_ROOT}/brands/_template.json`, fields explained in `${CLAUDE_PLUGIN_ROOT}/brands/README.md` |
| `.design/brief.md` | only on the no-brand path | Must contain a `json brand-decision` block (Phase 1B) |
| `.design/brand_config.draft.json` | no | From design-tokens. Not read directly. Someone must promote it first |

**If `.design/brand_config.json` is missing, stop.** Do not write a palette yourself. Route back per CONTRACT §4:

- A known brand exists in `${CLAUDE_PLUGIN_ROOT}/brands/<id>.json` → copy it to `.design/brand_config.json`.
- A draft exists → ask the router/user to confirm it, then copy it to `brand_config.json`.
- A reference URL/image exists → run `design-tokens` first.
- No brand, no reference → run `design-brief` (it records the decision block), then Phase 1B here.

## 2. Output

```
.design/system/
  tailwind.config.ts|js     closed theme: colors, fontSize, spacing, borderRadius, shadows replace defaults
  tokens.css                :root CSS variables for every token (+ role vars pointing at palette vars)
  tokens.shadcn.css         shadcn/ui contract (--background, --primary, --ring, --radius …) as HSL channels
  nativewind.theme.js       only when platforms includes "mobile-rn"
  primitives/web/           Button, Input, Card, Nav (.tsx for react, primitives.html for html)
  primitives/native/        Button, Input, Card, Nav for React Native + NativeWind (mobile-rn only)
  guards/                   radius-scale.test.ts, three-color.test.ts, vitest.config.ts
  manifest.json             brand id, files, warnings, timestamp
```

This stage writes only `.design/system/` (and `.design/brand_config.json` in Phase 1B). It never edits app source.

## 3. Procedure

### Phase 1A — Brand exists

1. Confirm `.design/brand_config.json` exists and parses.
2. Validate without writing:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/design-system/scripts/build-system.ts --check
   ```

   Errors name the field and the rule (unknown color group, radius rank order or numeric-name mismatch, role pointing nowhere). Fix the brand_config, not the generator. If a fix changes a brand decision, ask before changing it.

### Phase 1B — No brand: promote the brief decision

`design-brief` writes one fenced block tagged `json brand-decision` in `brief.md`. Keys are dotted brand_config paths:

```json brand-decision
{
  "brand.id": "acme", "brand.name": "Acme",
  "tokens.colors": { "primary": {"DEFAULT": "#1F4FD8", "foreground": "#FFFFFF"},
                     "accent":  {"DEFAULT": "#E8590C", "foreground": "#FFFFFF"},
                     "neutral": {"0": "#FFFFFF", "100": "#F4F4F5", "200": "#E4E4E7", "500": "#71717A", "900": "#18181B"} },
  "tokens.typography": { "families": {"sans": "Pretendard, system-ui, sans-serif"} },
  "tokens.radius": { "scale": {"none": 0, "sm": 2, "md": 4, "lg": 8, "full": 9999} }
}
```

Promote it:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/design-system/scripts/build-system.ts --promote-brief .design/brief.md
```

- If `.design/brand_config.draft.json` exists, promotion refuses: the design-tokens draft wins over the brief palette.
- Refuses to overwrite an existing `brand_config.json` unless `--force` is passed. Ask before forcing.
- design-brief always fills `brand.id` and `brand.name`. For a hand-written brief without them, ask the user and pass `--brand-name "<name>" --brand-id <id>`.
- `primary`, `accent`, `neutral` are required. The brief decides palette and type only. Radius, spacing, effects, geometry and motion come from `${CLAUDE_PLUGIN_ROOT}/brands/_template.json` and are recorded in `_meta.defaultsFrom`. Missing roles are derived from neutral lightness. Missing spacing, type scale and components get defaults. Each default is printed as a warning and kept in `manifest.json`.
- If the user wants a ready palette instead of a custom one, pick from [references/theme-presets.md](references/theme-presets.md) and paste the preset JSON into the decision block before promoting.

### Phase 2 — Generate

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/design-system/scripts/build-system.ts
# options: --config <path>  --out <dir>
```

Node ≥ 22.18 runs the `.ts` file directly. On older Node use `npx tsx` with the same arguments. No packages are needed to generate.

The mapping from each field to classes and variables is in [references/token-component-map.md](references/token-component-map.md). Read it before hand-editing anything, then rebuild instead of editing.

### Phase 3 — Wire into the project (only if the user asked for integration)

- **Tailwind v3**: point the project's `tailwind.config` at the generated one (re-export it, or `presets: [require('./.design/system/tailwind.config.js')]`), and import `tokens.css` once in the global stylesheet.
- **shadcn/ui**: import `tokens.shadcn.css` after `tokens.css`, and drop shadcn's own `:root` variable block. Keep shadcn's `hsl(var(--primary))` color entries only under `theme.extend` names the brand theme does not define, or the brand palette is overwritten. shadcn's `--accent` is a neutral hover surface. The brand accent is `--brand-accent`.
- **Tailwind v4**: add `@config "../.design/system/tailwind.config.ts";` (path relative to the CSS file) plus `@import` of `tokens.css`.
- **React Native**: see the platform section below.
- Copy primitives into the app's component folder only when asked. Keep the generated header so later rebuilds can be diffed.

### Phase 4 — Run the guards

```bash
npx vitest run --config .design/system/guards/vitest.config.ts
# also scan app code:
GUARD_SCAN_DIRS=src,app,components npx vitest run --config .design/system/guards/vitest.config.ts
```

Needs `vitest` in the project (`npm i -D vitest`). The guards read `.design/brand_config.json` and need no plugin files.

| Guard | Fails when |
|---|---|
| `radius-scale.test.ts` | Named steps do not rise in rank `none<sm<md<lg<xl<2xl<3xl<full` (`"sm": 2, "lg": 2`), a numeric name differs from its value, named steps exist without `none`: 0 plus two more (`{"lg": 2}` alone), an unknown name is used (`"soft": 6`), `tokens.css` radius vars differ from the scale, or scanned code uses `rounded-[…]`, a `rounded-<step>` not in the scale, or a `border-radius`/`borderRadius` px value not in the scale |
| `three-color.test.ts` | `tokens.colors` has a group other than primary/accent/neutral/semantic/roles, semantic has a status outside success/warning/danger/info, a primary/accent step drifts > 30° hue, a neutral step has chroma > 0.12, a role does not resolve, or scanned code has a hex/rgb literal outside the palette or a default Tailwind color class (`bg-red-500`) |

When a guard fails on app code, fix the app code. When it fails on brand_config, fix the brand_config and say what changed. Never loosen a guard to make it pass. An approved departure belongs in `brand_config.exceptions` with evidence, and design-qa reads it.

## 4. Rules for generated code

- The theme is **closed**. Colors, spacing, radius, font sizes and shadows replace Tailwind's defaults. If a class is missing, the brand lacks the token. Add it to brand_config or use an existing one. Do not add arbitrary values.
- Primitives use role classes (`bg-background`, `text-text-muted`) and palette classes (`bg-primary`), never literals.
- Hierarchy order: size/weight → spacing → lightness → color last. Per touchpoint color ratios are in [references/color-hierarchy.md](references/color-hierarchy.md).
- Banned everywhere (CONTRACT §1-6): pill buttons, neon glow, glassmorphism, gradient borders. A brand that really uses a pill button records it in `exceptions` (see the radius rule in `${CLAUDE_PLUGIN_ROOT}/brands/README.md`).
- Interactive primitives keep visible focus (`focus-visible:outline-*` on web), `disabled` handling, and accessible roles (`aria-current`, `accessibilityRole`).

## 5. Platform: mobile-rn (React Native + NativeWind v4)

Generated when `platforms` contains `"mobile-rn"`: `nativewind.theme.js` and `primitives/native/`.

Use the theme in the app's `tailwind.config.js`:

```js
const brandTheme = require('./.design/system/nativewind.theme.js')
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: brandTheme, // closed: replaces defaults
}
```

Rules for RN code written on top of it:

1. **Tokens first.** Every color, spacing and radius comes from the theme. Exact px values use bracket notation only for sizes the brand fixes (`h-[52px]`). No inline `style={{ padding: 20 }}` for tokenized properties.
2. **One text component, one input, one button.** Screens do not use bare RN `Text` or `TextInput`. Use the generated `Input`/`Button`, and one app-level text component whose `type` prop maps to `typography.scale` names. design-ui creates it if the app has none. Sheets, checkboxes and radios are built once as brand components, not per screen.
3. **One font family per weight.** RN cannot synthesize weights. `typography.nativeFaces` maps weight → font file name, and the theme exposes `font-face-<weight>`. Use those classes, not `font-bold`.
4. **Absolute line heights.** The theme converts unitless line heights to px. `clamp()`/`rem` sizes collapse to their minimum. Check the build warnings.
5. **No hover.** Pressed state uses `active:` classes (from `pressedBg`, else `hoverBg`). Pressable opacity feedback stays in the 0.7–0.8 range.
6. **No CSS variables.** Roles are resolved to literal colors in the native theme. Dark mode needs a second brand_config or a NativeWind `vars()` layer, never hard-coded hex.
7. **Screen layout.** Use the brand's `geometry` values for screen padding, section gaps and header heights. A typical structure is screen container → optional header → scroll content with horizontal padding → sections → fixed bottom action area with safe area.
8. **Components are function components with typed props.** Do not use `React.FC`.
9. **Accessibility.** Set `accessibilityRole` and `accessibilityState`. Meet the brand's `touchTarget`.

## 6. Completion conditions (all checkable)

- [ ] `.design/brand_config.json` exists and `build-system.ts --check` exits 0.
- [ ] `.design/system/manifest.json` exists and lists `tailwind.config.*`, `tokens.css`, `guards/`, and `primitives/web` and/or `primitives/native` matching `platforms`.
- [ ] `nativewind.theme.js` exists if and only if `platforms` contains `mobile-rn`.
- [ ] `npx vitest run --config .design/system/guards/vitest.config.ts` passes (paste the summary line).
- [ ] Every warning in `manifest.json` was reported to the user (defaults used, values skipped).
- [ ] If Phase 1B ran: `brand_config.json` has `_meta.promotedFrom` and the user saw the promoted palette.

## 7. Next

- **design-ui** builds screens with `.design/system/` and `brief.md`. It imports primitives and must stay inside the closed theme.
- **design-qa** reruns the guards with `GUARD_SCAN_DIRS` on the produced UI and adds the static audit for the four bans.
- "Design system only" requests (CONTRACT §4) end here: hand over the guard run to design-qa.
