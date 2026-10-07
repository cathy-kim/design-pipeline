---
name: design-ui
description: 파이프라인 4단계 — 확정된 디자인 시스템(.design/system/)과 브리프(.design/brief.md)로 실제 UI 코드를 만든다. 모드 네 가지 component(React 컴포넌트) · page(화면/대시보드/폼, 기존 프로젝트 라우트 또는 단일 HTML) · landing-next(Next.js + Magic UI 랜딩) · artifact(React+shadcn 단일 HTML 번들), 그리고 기존 코드를 고치는 modify. 색·radius·타입은 system 토큰과 프리미티브만 쓰며 새 hex·임의 radius 를 만들지 않는다. system 이 없으면 생성하지 않고 design-system 으로 되돌린다. Use when - UI 만들어, 화면 구현, 컴포넌트 작성, 페이지 만들어, 랜딩페이지, 대시보드, React 컴포넌트, HTML/CSS, 아티팩트, 단일 HTML, 화면 수정, landing page, dashboard, component, artifact. NOT for - 요구사항 정리·화면 목록(design-brief), 디자인 시스템·토큰 코드 생성(design-system), 참조 URL/이미지 픽셀 재현(design-recreate), 이미지 에셋·카드뉴스·로고·인스타 카드(design-assets), 브라우저 QA·토큰 감사(design-qa)
---

# design-ui — UI 생성 (4단계)

## ① 역할

`.design/brief.md` 의 화면 목록을 `.design/system/` 의 토큰·프리미티브만으로 **동작하는 코드**로 만든다.
디자인 결정(팔레트·폰트·radius)은 이미 앞 단계에서 끝났다. 이 단계의 창의성은 **구성·계위·모션·디테일**에 있다 — [references/craft.md](references/craft.md).

## ② 입력

| 경로 | 필수 | 쓰임 |
|---|:-:|---|
| `.design/system/` | **필수** | tailwind.config.{ts|js} · tokens.css · tokens.shadcn.css · `primitives/web/`(Button·Input·Card·Nav, `index.ts` named export) · (mobile-rn) `primitives/native/` + nativewind.theme.js · `guards/` · manifest.json. UI 가 쓸 수 있는 값의 전부 |
| `.design/brand_config.json` | **필수** | 정본 토큰(roles·radius 스케일·motion·typography families). 스크립트가 shadcn 별칭을 여기서 해석 |
| `.design/brief.md` | **필수** (modify 제외) | 목표 · 화면 목록(S1…, P0/P1/P2) · 상태(States) · 톤 · 콘텐츠 · 제약 |
| 작업 프로젝트 | 선택 | `package.json` 이 있으면 그 프레임워크·경로 규칙을 따른다 |
| `mode=` 인자 | 선택 | 라우터가 `mode=<component\|page\|landing-next\|artifact\|modify>` 로 넘긴다. 없으면 Phase 1 표로 고른다 |

### Phase 0 게이트 (하드 룰)

```bash
test -d .design/system && test -f .design/brand_config.json && echo SYSTEM_OK || echo SYSTEM_MISSING
test -f .design/brief.md && echo BRIEF_OK || echo BRIEF_MISSING
```

- `SYSTEM_MISSING` → **코드를 한 줄도 쓰지 않는다.** 아래를 출력하고 멈춘다.
  ```
  design-ui 중단: .design/system/ (또는 brand_config.json) 이 없다.
  UI 는 디자인 시스템이 코드로 고정된 뒤에만 만든다 (계약 §1-1).
  다음: Skill(design-pipeline:design-system). brand_config.json 도 없으면 design-tokens(참조 있음) 또는 design-brief(참조 없음)부터.
  ```
- `BRIEF_MISSING` (modify 가 아닐 때) → 같은 방식으로 멈추고 `design-brief` 로 되돌린다.
- **modify 예외**: 계약 §4 Modification 은 system 을 선택 입력으로 둔다. system 이 없으면 **대상 프로젝트에 이미 있는 토큰(tailwind config·CSS 변수)만** 쓴다. 그것도 없으면 새 값을 만들지 말고 design-system 을 먼저 돌리라고 보고한다.

## ③ 출력

| 모드 | 프레임워크 | 위치(작업 프로젝트 기준) | 파일 |
|---|---|---|---|
| `component` | React + TS + Tailwind (system preset). `platforms` 에 `mobile-rn` 이고 system 에 nativewind theme 이 있으면 React Native + NativeWind | 프로젝트 컴포넌트 디렉터리(`src/components/` · `components/` 관례를 따름) | `<Name>.tsx` 하나(+ 필요 시 `<Name>.stories.tsx` 는 프로젝트에 Storybook 이 있을 때만) |
| `page` | 프로젝트가 Next.js → App Router 라우트, Vite/CRA → 페이지 컴포넌트. 프로젝트가 없으면 **단일 HTML** | `app/<route>/page.tsx` · `src/pages/<Name>.tsx` · 또는 `ui/<screen-id>.html` | 화면 파일 + 그 화면 전용 하위 컴포넌트 |
| `landing-next` | Next.js App Router + Tailwind 3.4 + framer-motion + Magic UI | 새 디렉터리 `<project-dir>/` (기본 `landing/`) | `app/page.tsx`, `components/sections/*.tsx`, `components/ui/*`(Magic UI 복사본), `design-system/`(system 사본) |
| `artifact` | React + Vite + Tailwind 3.4.1 + shadcn/ui → Parcel 단일 파일 | 새 디렉터리 `<project-dir>/` (기본 `artifact/`) | `src/App.tsx` 외 + **`bundle.html`** |
| `modify` | 대상 코드의 기존 스택 그대로 | 대상 파일 제자리 | 변경된 파일만 |

`.design/` 에는 아무것도 쓰지 않는다(계약 §3 — 이 단계의 출력은 프로젝트 코드다). 만든 파일 경로 목록은 마지막 보고에 적어 design-qa 에 넘긴다.

## ④ 절차

### Phase 1 — 모드 결정

| 요청 신호 | 모드 |
|---|---|
| "컴포넌트", 버튼/카드/폼 필드/모달 하나 | `component` |
| 화면·페이지·대시보드·폼·목록·상세, brief 의 S-화면 | `page` |
| "랜딩페이지", 마케팅 페이지, 섹션 + 모션 | `landing-next` |
| "아티팩트", "단일 HTML", "파일 하나로", 공유용 인터랙티브 프로토타입 | `artifact` |
| 기존 파일 경로가 주어지고 "고쳐/바꿔/수정" | `modify` |

플랫폼 기본 캔버스: desktop 1440 × auto, mobile 375 × auto. Instagram·인쇄 캔버스는 design-assets 의 몫이다.

### Phase 2 — 시스템 인벤토리 (코드 쓰기 전)

`.design/system/` 을 읽고 작업 노트로 정리한다. 이 목록 밖의 값은 쓰지 않는다.

1. **색 이름**: preset 의 `colors` 키(예: `primary`, `primary-600`, `accent`, `neutral-*`, roles). 이 화면의 Primary · Accent · Neutral 을 하나씩 정한다(3색).
2. **radius 이름**: 닫힌 스케일(`brand_config.tokens.radius.scale`). 각 프리미티브가 어느 이름을 쓰는지(`components.*.radius`).
3. **타입 스케일**: display / title / body / caption 이름과 families.
4. **spacing 스케일**, **shadow 이름**, **motion**(durations, easingCurves).
5. **프리미티브 목록**: `primitives/web/` (웹 React — `import { Button, Input, Card, Nav } from "<경로>/primitives/web"`), `primitives/web/primitives.html` (componentFramework=html), `primitives/native/` (mobile-rn). 있는 것은 반드시 재사용, 없는 것(Badge·Dialog·Accordion 등)만 토큰으로 조립한다. 정확한 파일 목록은 `manifest.json` 의 `files`.

### Phase 3 — 계획 (From Scratch 흐름: 레이아웃 → 비주얼 → 피드백)

1. brief 의 **P0 화면부터**. 화면마다 목적 · 핵심 요소 · States(default/loading/empty/error) 를 확인.
2. craft.md §1 대로 방향 네 줄(목적·톤·제약·차별점)을 정한다.
3. 그리드 선택:

   | 화면 유형 | 권장 그리드 | 이유 |
   |---|---|---|
   | dashboard | regular | KPI 카드 균등 배치 |
   | landing | bento 또는 asymmetric | 시각적 임팩트 |
   | product / detail | golden ratio | 프리미엄 비례 |
   | list / form | regular 1열 | 가독성 |

4. 인터랙션 패턴(모달·바텀시트·확장·별도 페이지)은 [references/interaction-patterns.md](references/interaction-patterns.md) 의 결정 트리로 고른다.

### Phase 4 — 모드별 구현

**레이아웃 패스 → 비주얼 패스** 순서로 만든다. 레이아웃 패스는 Neutral 만으로 구조·간격·계위를 잡고, 비주얼 패스에서 Primary/Accent·모션·디테일을 얹는다. 색이 없어도 계위가 읽혀야 한다.

화면이 둘 이상이면(component·page 모드) 화면 단위로 `layout-designer` 에이전트에 위임할 수 있다. 위임 프롬프트에 화면 ID · 대상 파일 경로 · Phase 2 인벤토리 · Phase 3 방향 네 줄을 넣고, 돌아온 파일을 Phase 5 로 함께 점검한다. 같은 파일을 두 에이전트에 맡기지 않는다.

#### component
- 입력: 컴포넌트 이름 · 변형(variants) · 상태 · props.
- system 프리미티브를 감싸거나 조합한다. 변형은 `cva` 또는 프로젝트 관례. `brand_config.components.<name>` 에 정의가 있으면 그 variants/sizes/states 를 그대로 따른다.
- Props 는 `interface`, 함수형 컴포넌트, 파일당 export 컴포넌트 하나.
- 접근성: 인터랙티브 요소 라벨, focus ring 은 `ring`/focus role 색, 터치 타겟 ≥ `geometry.touchTarget`.

#### page
- 기존 프로젝트: 라우팅 관례를 따라 화면 파일을 만들고, 그 프로젝트의 tailwind 설정이 system preset 을 쓰는지 확인한다. 안 쓰면 preset 연결을 먼저 제안·적용한다(프로젝트 설정 변경이므로 보고에 명시).
- 프로젝트가 없을 때: `ui/<screen-id>.html` 단일 파일. `system/tokens.css` 내용을 `<style>` 에 인라인하고 모든 값은 `var(--…)` 로만 참조한다. 외부 CDN 의존 없음.
- brief 의 States 를 전부 구현한다(loading skeleton, empty, error 메시지 포함).

#### landing-next
```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/design-ui/scripts/init-landing.sh" landing .design
```
- 섹션 구성·순서: [references/landing-sections.md](references/landing-sections.md). brief 가 섹션을 지정했으면 그것이 이긴다.
- Magic UI 선택·금지 목록·대체표·복사 후 점검: [references/magic-ui-patterns.md](references/magic-ui-patterns.md). rainbow-button · neon-gradient-card · shine-border · border-beam · aurora/gradient 텍스트는 쓰지 않는다.
- 폰트: `brand_config.tokens.typography.families` 를 `app/layout.tsx` 에서 설정(`next/font/local` 로 `assets.fonts`, 또는 `next/font/google`). create-next-app 기본 폰트는 바꾼다.
- 섹션은 `components/sections/<name>.tsx`, `app/page.tsx` 는 조합만.

#### artifact
```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/design-ui/scripts/init-artifact.sh" artifact .design
# ... src/ 에서 개발 ...
cd artifact && pnpm exec tsc -b && bash "${CLAUDE_PLUGIN_ROOT}/skills/design-ui/scripts/bundle-artifact.sh"
```
- 스캐폴드가 shadcn 을 시스템 토큰으로 재스킨한다(별칭 표·radius 교정·accent 충돌 처리): [references/artifact-bundle.md](references/artifact-bundle.md).
- 시스템 프리미티브 우선, 없는 것만 `@/components/ui/*`.
- 결과물은 `artifact/bundle.html` 하나.

#### modify (계약 §4 Modification)
1. 대상 파일과 그 파일이 import 하는 스타일 소스(tailwind config, CSS 변수, 프리미티브)를 먼저 읽는다.
2. 요청된 변경만 한다. 주변 리팩터링·"하는 김에" 수정 금지.
3. 바꾸는 줄에서 새 hex·임의 radius·금지 효과가 생기지 않게 한다. 기존 코드에 이미 있는 위반은 **고치지 않고** 보고에 목록으로 남긴다(범위 밖 — design-qa/사용자가 결정).
4. 빌드/타입체크를 다시 돌린다.

### Phase 5 — 자기 점검

1. 빌드/타입체크(⑥ 표의 명령)가 exit 0.
2. design-system 의 가드 테스트를 앱 코드에 돌린다(가드는 design-system 소유, 여기서는 실행만):
   ```bash
   GUARD_SCAN_DIRS=<만든 코드 디렉터리들, 예: src,app,components> npx vitest run --config .design/system/guards/vitest.config.ts
   ```
   스캐폴드 모드에서는 프로젝트 안의 사본 `design-system/guards/` 가 아니라 원본 `.design/system/guards/` 를 쓴다.
3. craft.md §6 체크리스트.
4. (선택) Gemini 2차 의견 — 아래 ⑤. 점수가 낮으면 고치되, 최종 판정은 design-qa 다.

### Phase 6 — 피드백 반복

사용자 피드백 또는 design-qa 의 FAIL 항목 중 소유 단계가 design-ui 인 것(화면 코드의 색·radius·상태·반응형)을 받아 Phase 4 로 돌아간다. 토큰 값 자체가 문제면 design-system 의 몫이다 — 여기서 값을 바꾸지 않는다.

## ⑤ 스크립트

| 스크립트 | 용도 |
|---|---|
| `${CLAUDE_PLUGIN_ROOT}/skills/design-ui/scripts/init-artifact.sh <dir> [.design]` | artifact 스캐폴드(Vite + Tailwind 3.4.1 + shadcn) + 시스템 적용. system 없으면 exit 2 |
| `${CLAUDE_PLUGIN_ROOT}/skills/design-ui/scripts/bundle-artifact.sh` | artifact 프로젝트 루트에서 `bundle.html` 생성. 외부 리소스 남으면 WARN |
| `${CLAUDE_PLUGIN_ROOT}/skills/design-ui/scripts/init-landing.sh <dir> [.design]` | landing-next 스캐폴드(Next.js App Router + Tailwind 3.4 + framer-motion) + 시스템 적용. system 없으면 exit 2 |
| `node ${CLAUDE_PLUGIN_ROOT}/skills/design-ui/scripts/apply-system.mjs --project <dir> [--design .design] [--alias-root src\|.] [--shadcn] [--force]` | 위 두 init 이 부른다. 기존 Tailwind 3 프로젝트에 system preset 을 붙일 때 단독으로도 쓴다(새 스캐폴드 전용 — 메인 CSS 를 다시 쓴다) |
| `npx tsx ${CLAUDE_PLUGIN_ROOT}/skills/design-ui/scripts/validate-with-gemini.ts <file> [--design .design] [--platform web\|mobile] [--title …] [--json]` | Gemini CLI 2차 의견. brand_config + system preset 을 프롬프트에 넣는다. exit 0 통과 · 1 미달 · 2 입력 없음 · 3 검증 안 됨(CLI 없음/미인증 — 통과 아님). 인증은 gemini CLI 가 `process.env` 에서 직접 읽는다 |

shadcn 컴포넌트 원본은 `scripts/shadcn-components.tar.gz`(init-artifact 가 풀어 쓴다). init 스크립트와 bundle 스크립트는 Anthropic web-artifacts-builder(Apache-2.0)에서 왔다 — 라이선스는 스킬 루트 `LICENSE.txt`.

## ⑥ 완료 조건 (전부 검증 가능해야 한다)

| # | 조건 | 확인 방법 |
|---|---|---|
| 1 | Phase 0 게이트 통과(또는 modify 예외 조건 충족) | 게이트 명령 출력 `SYSTEM_OK` |
| 2 | brief 의 P0 화면이 전부 파일로 존재하고 각 화면의 States 가 구현됨 | 보고에 화면 ID → 파일 경로 표 |
| 3 | 빌드/타입체크 exit 0 | component·page: 프로젝트의 `tsc --noEmit` 또는 `build` · landing-next: `pnpm build` · artifact: `pnpm exec tsc -b` 후 `bundle.html` 존재 · 단일 HTML page: 파일이 외부 URL 없이 열림 |
| 4 | system 밖의 값이 없음 — 새 hex/rgb, 임의 radius `rounded-[…]`, 금지 효과(pill 텍스트 버튼·네온 글로우·글래스모피즘·그라디언트 보더) | Phase 5 가드 테스트 exit 0, 그리고 최종 판정은 **design-qa 정적 토큰 감사 PASS**(아래 ⑦) |
| 5 | modify: 요청 범위 밖 변경 없음 | `git diff --stat` 이 보고한 파일과 일치 |
| 6 | 보고에 만든/바꾼 파일 경로 전부 + 실행 URL(dev 서버를 띄웠다면) | 보고문 |

## ⑦ 다음 단계

```
Skill(skill="design-pipeline:design-qa", args="target=<만든 파일 경로들 | 실행 URL>")
```

- design-qa 가 정적 토큰 감사(3색·radius·금지 효과)와 Playwright 상태/반응형/접근성 검사를 한다.
- FAIL 중 화면 코드 문제 → design-ui 재호출(Phase 6). 토큰 값·프리미티브 문제 → design-system.
- 랜딩·아티팩트에 쓸 이미지(히어로, 일러스트)가 필요하면 design-assets 로 생성하고 경로만 받아 쓴다. 여기서 이미지를 생성하지 않는다.
