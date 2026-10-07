# Artifact Bundle — 단일 HTML 아티팩트 (React + Tailwind + shadcn/ui)

> Anthropic `web-artifacts-builder` 스킬(Apache-2.0, 스킬 루트 `LICENSE.txt`)을 design-pipeline 에 맞게 고쳤다.
> 바뀐 점: shadcn 기본 회색 팔레트와 `--radius` 를 버리고 `.design/system/` 을 preset 으로 건다.

## 언제 이 모드인가

- 결과물이 **한 파일**이어야 할 때: claude.ai 아티팩트, 이메일 첨부, 오프라인 데모, 리뷰용 프로토타입.
- 상태 관리·라우팅·shadcn 컴포넌트가 필요한 복잡한 화면. 정적 한 장짜리면 `page` 모드의 HTML 출력이 더 가볍다.

**스택**: React 18+ · TypeScript · Vite(개발) · Parcel(번들) · Tailwind 3.4.1 · shadcn/ui 40+ 컴포넌트 · Radix UI.

## 1. 초기화

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/design-ui/scripts/init-artifact.sh" <project-dir> .design
```

스크립트가 하는 일:

1. `.design/system/` 과 `.design/brand_config.json` 이 없으면 **exit 2 로 멈춘다**(하드 룰).
2. Vite react-ts 생성 → Tailwind 3.4.1 · PostCSS · Radix · shadcn 의존성 설치.
3. `@/` → `src/` 별칭(tsconfig, vite).
4. shadcn 컴포넌트를 `src/components/ui/` 에 풀고,
5. `apply-system.mjs --shadcn` 으로:
   - `.design/system/` → `src/design-system/` 복사
   - `tailwind.config.cjs` = system preset + shadcn 의미 색 별칭. **preset 에 이미 있는 색 이름(primary, accent, border, background 등)은 덮지 않는다** — system theme 은 닫혀 있고 브랜드 팔레트가 정본이다
   - 별칭 값: `system/tokens.shadcn.css` 가 있으면 `hsl(var(--x) / <alpha-value>)`, 없으면 brand_config `roles` 에서 해석(새 색 없음)
   - `src/index.css` = `tokens.css` → `tokens.shadcn.css` import + tailwind 지시문. shadcn 기본 `:root` 블록과 `calc(var(--radius) - 2px)` 계열 radius 는 남기지 않는다
   - shadcn 의 hover 용 `bg-accent` → `bg-muted` (shadcn 의 accent 는 "hover 면" 이고, 우리 accent 는 브랜드 Accent 다)
   - 닫힌 radius 스케일에 없는 `rounded-*`(예: `rounded-xl`, `rounded-t-[10px]`) → 가장 가까운 스케일 이름

shadcn 별칭 대응(tokens.shadcn.css 가 없을 때의 fallback. 있으면 같은 이름의 CSS 변수를 쓴다):

| shadcn 이름 | brand_config 출처 |
|---|---|
| background / foreground | roles.background / roles.text |
| card, secondary, muted | roles.surface (muted-foreground = roles.textMuted) |
| popover | roles.elevated (없으면 background) |
| primary / primary-foreground | colors.primary.DEFAULT / .foreground |
| destructive | semantic.danger |
| border, input | roles.border |
| ring | roles.focus |
| accent | **정의하지 않음** — 브랜드 Accent 는 system preset 의 `accent`. shadcn 의 hover 용 `bg-accent` 는 `bg-muted` 로 교체 |

스크립트가 `WARN ... 못 찾은 shadcn 별칭` 을 출력하면, 그 클래스를 쓰는 shadcn 컴포넌트는 스타일 없이 렌더된다. 해당 컴포넌트를 쓰지 않거나 design-system 에 role 을 추가하고 다시 초기화한다. **여기서 hex 를 채워 넣지 않는다.**

## 2. 개발

- 시스템 프리미티브(`import { Button, Input, Card, Nav } from "@/design-system/primitives/web"`)를 먼저 쓴다. 없는 것만 shadcn(`@/components/ui/...`)에서 가져온다.
- 원형은 아바타·라디오·스위치 썸·점 표시에만. 텍스트 버튼은 시스템 radius.
- AI slop 회피: 과한 가운데 정렬, 보라 그라디언트, 모든 곳에 같은 radius, Inter 폰트 — 전부 피한다(`craft.md`).
- 확인: `pnpm exec tsc -b` 가 에러 0.

## 3. 번들

```bash
cd <project-dir>
bash "${CLAUDE_PLUGIN_ROOT}/skills/design-ui/scripts/bundle-artifact.sh"
```

- Parcel 로 빌드(소스맵 없음) → `html-inline` 으로 JS·CSS·에셋을 `bundle.html` 하나에 인라인.
- 루트에 `index.html` 이 있어야 한다.
- 외부 `http(s)://` 스크립트/스타일이 남으면 WARN 을 띄운다 — 단일 파일이 아니라는 뜻이니 고친다.

## 4. 전달

`bundle.html` 을 사용자에게 준다(대화 아티팩트로 붙이거나 경로 안내). 브라우저 확인은 design-qa 가 한다 — design-ui 는 번들 생성과 정적 점검까지만.

## 참고

- shadcn/ui 컴포넌트 문서: https://ui.shadcn.com/docs/components
