# Token → code map

How each `brand_config` field becomes code in `.design/system/`. The generator (`build-system.ts`) implements exactly this table. If you hand-edit output, follow the same mapping, then rebuild instead.

## Colors

| brand_config | Tailwind class | CSS variable | Notes |
|---|---|---|---|
| `tokens.colors.primary.DEFAULT` | `bg-primary`, `text-primary` | `--color-primary` | CTA background, links, focus |
| `tokens.colors.primary.foreground` | `text-primary-foreground` | `--color-primary-foreground` | Text on primary. Excluded from hue check |
| `tokens.colors.primary.<step>` | `bg-primary-600` | `--color-primary-600` | Hover/pressed/tint steps of the same hue |
| `tokens.colors.accent.*` | `bg-accent`, `bg-accent-<step>` | `--color-accent[-step]` | Badge, tag, highlight. One hue |
| `tokens.colors.neutral.<step>` | `bg-neutral-<step>` | `--color-neutral-<step>` | Surfaces, text, borders. Chroma ≤ 0.12 |
| `tokens.colors.semantic.<status>` | `text-danger`, `bg-danger-soft` | `--color-danger[-soft]` | Only success / warning / danger / info |
| `tokens.colors.roles.<role>` | `bg-background`, `text-text-muted` | `--color-<role>: var(--color-…)` | Roles point at palette refs; Tailwind uses the var so a theme swap is one CSS file |

A color reference is `group`, `group.step`, a semantic status (`danger`, `danger.soft`) or a role name. A literal hex is allowed only inside the three groups and `semantic`.

## Typography

| brand_config | Tailwind | CSS variable | Native |
|---|---|---|---|
| `typography.families.<name>` | `font-<name>` | `--font-<name>` | not used; see `nativeFaces` |
| `typography.scale.<name>` `{size,lineHeight,weight,letterSpacing}` | `text-<name>` (size + line-height + tracking + weight) | `--text-<name>`, `--text-<name>--line-height`, … | `text-<name>`; px line height computed; `clamp()` → its minimum |
| `typography.weights.<name>` | `font-<name>` | `--font-weight-<name>` | `font-face-<weight>` when `nativeFaces` has it |
| `typography.nativeFaces.<weight>` | — | — | `fontFamily["face-<weight>"]` (RN needs one family per weight) |

## Spacing, radius, effects, geometry

| brand_config | Tailwind | CSS variable |
|---|---|---|
| `spacing.scale.<k>` (px) | `p-<k>`, `gap-<k>`, `px-<k>` | `--space-<k>` (`.` → `_`) |
| `radius.scale.<k>` (px) | `rounded-<k>` | `--radius-<k>` |
| `effects.shadows.<k>` | `shadow-<k>` | `--shadow-<k>` |
| `geometry.breakpoints.<k>` | `sm:`, `md:` … (screens) | — |
| `geometry.maxWidths.<k>` | `max-w-<k>` | — |
| `motion.durations.<k>` (ms) | `duration-<k>` | `--duration-<k>` |
| `motion.easingCurves.<k>` | `ease-<k>` | `--ease-<k>` |

Colors, spacing, radius, fontSize and shadows **replace** the Tailwind defaults (closed theme). `rounded-xl` or `bg-red-500` do not exist unless the brand defines them. Max widths, durations and easing extend.

## Components → primitives

| brand_config | Primitive | Used fields |
|---|---|---|
| `components.button` | `Button` | `radius`, `variants.<v>.{bg,fg,hoverBg,pressedBg,border}`, `sizes.<s>.{height,paddingX,text,weight}`, `states.{disabledOpacity,focusRing,focusRingWidth}` |
| `components.input` | `Input` | `radius,height,paddingX,text,bg,fg,placeholder,border,borderFocus,borderError` |
| `components.card` | `Card` | `radius,padding,bg,border,shadow` |
| `components.nav` | `Nav` (web: link bar, native: tab bar) | `height,paddingX,bg,fg,activeFg,indicator,border,text,weight` |

`radius` must be a key of `tokens.radius.scale`. `paddingX`/`padding` must be keys of `tokens.spacing.scale`. `text` must be a key of `typography.scale`. Any color field takes a color reference. `null` omits the class. A missing component falls back to a role-based default and the build prints a warning.

Extra fields on a component (e.g. `sizes` on card, `pressedOpacity`) are kept for `design-ui` but not generated.

## shadcn/ui contract (`tokens.shadcn.css`)

Opaque HSL channels for `hsl(var(--x) / <alpha-value>)`. Translucent brand colors (e.g. hairline borders) are composited over `--background`. Each variable takes the first role or palette ref that exists.

| shadcn var | Source (first that resolves) |
|---|---|
| `--background` / `--foreground` | `background` / `text` |
| `--card`, `--popover` | `card`→`surface`, `elevated` |
| `--primary` / `--primary-foreground` | `primary` / `primary.foreground` |
| `--secondary`, `--muted`, `--accent` | neutral surfaces (`elevated`, `surface`). shadcn's accent is a hover surface |
| `--muted-foreground` | `textMuted` |
| `--destructive` | `danger` |
| `--border` / `--input` / `--ring` | `border` / `borderStrong` / `focus` |
| `--brand-accent` | brand `accent` |
| `--radius` | the card radius step (else button, else `md`) |
