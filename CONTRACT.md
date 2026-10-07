# design-pipeline — 단계 계약 (CONTRACT)

> 이 문서가 정본이다. 각 스킬 SKILL.md 는 이 계약을 어기지 않는다. 어긋나면 이 문서가 이긴다.
> Version 0.1.1 · 2026-10-07 (§3 중간 경로·§3-1 공용 CLI·§5 확장 키·radius 규칙 확정)

## 1. 원칙

1. **브랜드 → 디자인 시스템 → UI.** UI 코드는 디자인 시스템(토큰 + 컴포넌트)이 코드로 고정된 뒤에만 생성한다. 브리프에서 UI 로 바로 가는 경로는 없다.
2. **브랜드와 에셋은 입력 데이터다.** 스킬 본문에 브랜드 이름·색·폰트를 하드코딩하지 않는다. 전부 `brand_config` JSON 과 그 옆의 에셋 폴더에서 읽는다. 새 브랜드 = `brands/<id>.json` 한 파일 추가.
3. **한 기능은 한 곳에만.** 토큰 추출·레이어 빌드·픽셀 diff·Gemini 이미지 생성은 각각 한 스킬의 스크립트에만 있다. 다른 스킬은 `${CLAUDE_PLUGIN_ROOT}/skills/<owner>/scripts/...` 로 부른다.
4. **단계 간 전달은 파일로.** 작업 프로젝트의 `.design/` 디렉터리가 핸드오프 버스다(§3). 대화 메모리에 의존하지 않는다.
5. **비밀값은 환경변수로만.** `GEMINI_API_KEY`, `GOOGLE_AI_API_KEY` 등은 `process.env` 에서 읽는다. `.env` 파일은 리포에 넣지 않는다.
6. **디자인 규칙(워크스페이스 공통).** 한 화면 3색(Primary + Accent + Neutral). radius 는 브랜드 토큰의 닫힌 스케일만. pill 버튼·네온 글로우·글래스모피즘·그라디언트 보더 금지. 계위는 크기/무게 → 간격 → 명도 순, 색은 최후 수단. 네 가지 금지는 `design-qa` 가 기계적으로 잡는다. 브랜드가 근거와 함께 `exceptions[]` 에 등록한 항목만 WAIVED 로 통과시키며, 리포트에는 항상 남긴다.

## 2. 단계와 소유권

| # | 스킬 | 단계 | 입력 | 출력(`.design/` 기준) | 유일하게 소유하는 기능 |
|---|---|---|---|---|---|
| 0 | `design` | 라우터 | 자연어 요청 | 실행 계획(어느 단계를 어떤 순서로) | 요청 유형 분류(§4), 단계 호출 순서 |
| 1 | `design-brief` | 브리프 | 요청, 참조 URL/이미지, 기존 `brand_config` 유무 | `brief.md` | 요구사항 질문 흐름, 팔레트·타이포 "결정"(브랜드 없을 때만), 화면 목록·우선순위 |
| 2 | `design-tokens` | 토큰 추출 | URL, 이미지, 브랜드 가이드 PDF/AI | `brand_config.draft.json` + `tokens-report.md` | Playwright computed-style 추출, 이미지 토큰 추출, 가이드 문서 파싱 |
| 3 | `design-system` | 디자인 시스템 | `brand_config.json` (**필수**) | `system/` (tailwind.config · css vars · NativeWind theme · 컴포넌트 프리미티브 · 가드 테스트) | 토큰 → 코드 변환, 컴포넌트 프리미티브, 테마 프리셋, radius/색 가드 테스트 |
| 4 | `design-ui` | UI 생성 | `brief.md` + `system/` | 화면/컴포넌트 코드 (프로젝트 경로) | UI 코드 생성 4모드: `component` · `page` · `landing-next`(Next.js + Magic UI) · `artifact`(단일 HTML 번들, React+shadcn) |
| 5 | `design-recreate` | 재현 | 참조 URL/이미지 + (`system/` 있으면) | 재현 코드 + `recreate-report.md` | 그리드 섹셔닝, 3-Signal Depth Layer 분해, Layer-by-Layer 빌드, 재귀 자기 수정 |
| 6 | `design-assets` | 에셋 | `brand_config.json` + 문구/내용 | `assets/` (PNG/SVG/HTML/모션 코드) | Gemini 이미지 생성(단일 구현), 카드뉴스·광고·상세페이지 템플릿 조합, 로고 프롬프트, 모션(Framer Motion/CSS) |
| 7 | `design-qa` | QA | 위 산출물 + 실행 중 URL | `qa/report.md` + 스크린샷 | 정적 토큰 감사(3색·radius·금지 효과), Playwright 상태/반응형/접근성, 픽셀 diff(단일 구현: sharp + pixelmatch, ImageMagick 불필요), 15항목 체크리스트 |

흡수 매핑(원본 스킬 → 새 스킬):

| 원본 (작성자 로컬 스킬 디렉터리) | 새 스킬 |
|---|---|
| ui-designer (질문 흐름, 화면 목록) · color-palette-advisor | design-brief |
| design-system-extractor · antigravity Phase 3 · design-workflow 유형 E | design-tokens |
| brand-design-system (토큰·컴포넌트 부분) · theme-factory · 프로젝트 전용 브랜드 스킬 2개(모바일 디자인 시스템·브랜드 토큰 스킬 — 본문에서 제거하고 `brands/<id>.json` 입력 데이터로 외부화, 리포에 미포함) | design-system |
| frontend-design · ui-designer (생성 부분) · web-artifacts-builder · landing-page-creator · design-workflow 유형 C | design-ui |
| antigravity (P1·P2·P4·P5) · design-workflow 유형 A·B·D·F 와 D1~D3 · designclaw (분해·조합 단계) | design-recreate |
| template-visual-generator · brand-design-system (이미지·로고 부분) · designclaw (광고 생성 단계) · web-motion-generator | design-assets |
| screen-qa · design-qa-reviewer · antigravity 5B/5C · design-workflow D4 · designclaw 4.2 | design-qa |
| design-workflow (7유형 분기만) | design |

## 3. 핸드오프 버스 `.design/`

작업 프로젝트 루트의 `.design/` 아래. 각 단계는 **자기 출력만 쓰고** 앞 단계 출력은 읽기만 한다.

```
.design/
  brief.md                 # 1. 목표·대상·화면 목록·우선순위·결정된 톤 (브랜드 없을 때 팔레트/타이포 결정 포함)
  brand_config.json        # 정본 브랜드 설정 (brands/<id>.json 복사 또는 2단계 draft 승격). 3~7단계의 필수 입력
  brand_config.draft.json  # 2. 추출 결과. 사람 또는 라우터가 확인 후 brand_config.json 으로 승격
  tokens-report.md         # 2. 추출 근거(어디서 무슨 값을, 신뢰도)
  tokens-evidence/         # 2. raw.json, confidence.json, 추출 당시 스크린샷 (근거 보관)
  system/                  # 3. tailwind.config.{js|ts} | tokens.css | tokens.shadcn.css | nativewind.theme.js(mobile-rn 일 때) | primitives/{web,native}/ | guards/*.test.ts
  recreate/                # 5. 작업 디렉터리: grid.json, cells/, elements.json, build/, progress/iteration-log.json, progress/fix-<N>.md
  recreate-report.md       # 5. 섹션별 일치율, 남은 diff, 금지 효과 대체 기록
  assets/                  # 6. 생성물. manifest.json 에 프롬프트·모델·시드·목표/실제 크기 기록
  qa/report.md             # 7. PASS/FAIL/WAIVED 항목표 + 스크린샷 경로
  qa/screenshots/
  qa/visual-compare.json   # 7. 픽셀 비교 중간 결과
  qa/e2e.json              # 7. Playwright 상태·반응형·접근성 중간 결과
```

### 3-1. 단계 간 공용 CLI 계약

**픽셀 diff (design-qa 소유, 다른 단계는 호출만):**
```
node ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/pixel-diff.js <ref.png> <actual.png> [--threshold 0.02] [--out diff.png] [--color-threshold 0.1] [--samples "x,y;..."] [--regions "WxH+X+Y;..."]
stdout 한 줄 JSON: {"pass": bool, "pixelScore": 0-100, "mismatchedPixels": int, "totalPixels": int, "diffImagePath": path|null}
종료 코드: 0 비교됨·통과, 1 비교됨·실패, 2 입력/실행 오류. 크기가 다르면 actual 을 ref 크기로 맞춘다.
섹션 점수는 호출자가 두 이미지를 같은 영역으로 먼저 crop 한 뒤 호출한다(--crop 없음; design-recreate 는 ImageMagick 으로 자른다). 구현은 sharp + pixelmatch 다.
```

**brief → brand_config 승격 (design-system 소유):** `brief.md` §8 의 fenced ```json brand-decision 블록(키는 `tokens.colors` 같은 brand_config 점 경로 또는 중첩 객체) 을 읽어 `brand_config.json` 으로 만든다. brief 는 색과 타이포만 정하고 radius·spacing·effects·geometry·motion 은 `brands/_template.json` 기본값을 쓰며 `_meta.defaultsFrom` 에 기록한다. `brand_config.draft.json`(design-tokens 추출) 이 있으면 승격을 거부한다 — 추출 초안이 brief 팔레트보다 우선한다.

**재현 루프 판정 (design-recreate 소유):** `scripts/recreate-step.sh` 가 pixel-diff 를 불러 종료 코드 0 PASS(전체 ≥95 이고 모든 섹션 ≥90) / 10 CONTINUE / 3 STOP(5회 도달 또는 2회 연속 개선 <1.0%p) / 2 ERROR 를 낸다. 에이전트는 이 코드를 읽을 뿐 자체 임계값을 갖지 않는다.

## 4. 라우터 `design` 의 분류와 호출 순서

| 요청 유형 | 조건 | 순서 |
|---|---|---|
| **From Scratch** | 브랜드 있음 | brief → system → ui → qa |
| **From Scratch** | 브랜드 없음, 참조 없음 | brief(팔레트 결정 포함) → system(brief 결정을 brand_config 로 승격) → ui → qa |
| **Inspired** | 참조 URL/이미지 "스타일 참고" | tokens → (brief) → system → ui → qa |
| **Recreation** | "똑같이" | tokens → recreate → qa |
| **Modification** | 기존 코드 수정 | (system 있으면 읽기) → ui(수정 모드) → qa |
| **Extraction** | "토큰 뽑아줘" | tokens 만 |
| **Deconstruct / SNS Template** | 이미지 분해·재구성, SNS 포스트 재현 | tokens → recreate → (assets) → qa |
| **Assets only** | 카드뉴스·광고·로고·모션 | assets → qa(정적 감사만) |
| **Design system only** | "디자인 시스템 만들어줘" | (tokens) → system → qa(가드 테스트) |

라우터는 **설계를 직접 하지 않는다.** 분류하고, 각 단계를 `Skill` 로 호출하고, 단계 사이에 `.design/` 산출물이 생겼는지 확인한다. `brand_config.json` 이 없는데 3단계 이후로 가야 하면 2단계나 1단계로 되돌린다.

## 5. `brand_config` 스키마 (unified-tokens 호환, `brands/_template.json` 이 정본)

```
{
  "brand":   { "id", "name", "nameKr", "description", "mood": [], "philosophy" },
  "tokens":  { "colors": { "primary", "accent", "neutral": {...scale}, "semantic": {...} },
               "typography": { "families", "scale", "weights", "lineHeights" },
               "spacing": { "scale" }, "radius": { "scale": {name: px} },   // 닫힌 스케일. 이름과 값이 어긋나면 가드 실패
               "effects": { "shadows" }, "geometry": {} },
  "artStyle": { "artStyleId", "artStyleName", "negative": [] },
  "visualSystem": { "logoDirection", "iconStyle", "illustration" },
  "motion":   { "feel", "easingCurves", "durations" },
  "assets":   { "logo": {paths}, "fonts": {paths}, "references": [paths], "hero", "moodBoard",
                "canvasSizes": {}, "imagePromptConfiguration": {} },
  "components": { "button", "input", "card", "nav", ... },   // 프리미티브의 변형·상태 정의
  "platforms": ["web" | "mobile-rn" | "print"],
  "brandKeywords": [],
  "build":      { "componentFramework": "react" | "html" | "react-native", "tailwindConfigFormat": "ts" | "js" },
  "exceptions": [ { "rule", "scope", "reason", "evidence" } ],   // 승인된 규칙 예외. design-qa 는 해당 위반을 WAIVED 로 표기(PASS 도 FAIL 도 아님)
  "_meta":      { "source", "extractedAt", "defaultsFrom": [] }  // 출처 기록. 생성기는 읽지 않는다
}
```

`tokens.colors.roles` 는 색을 의미 역할(background, surface, text, border, …)에 매핑한다.

**radius 규칙(확정).** 브랜드의 `tokens.radius.scale` 이 그 브랜드의 정본이다. 이름별 고정 px 는 요구하지 않는다. 가드는 세 가지를 본다: ① 코드에 스케일 밖 값이 없을 것(`rounded-[7px]`, `borderRadius: 7` 금지) ② 이름 있는 단계는 none < sm < md < lg < xl < 2xl < 3xl < full 순서로 값이 strictly 증가할 것(이름이 있으면 `none` 과 최소 두 단계가 더 있어야 한다) ③ 숫자 이름은 값과 같을 것(`"10": 10`). 허용 이름은 위 8개와 숫자뿐이다(`xs` 없음). `_template.json` 기본은 none0 sm2 md4 lg8 xl12 2xl16 3xl24 full9999 이고, 브랜드가 lg=12 로 정해도 순서만 맞으면 통과한다. 이것은 워크스페이스 규칙 "프로젝트가 닫힌 radius 정본을 토큰에 고정하고 가드 테스트로 강제하면 그 정본을 따른다" 와 같은 원칙이다.

에셋 파일(로고·폰트·참조 이미지)은 `brands/<id>/` 폴더에 두고 `assets.*` 에서 상대경로로 가리킨다.

## 6. SKILL.md 작성 규격

- 프론트매터 `name` = 디렉터리명. `description` 은 한 문단, "Use when - ..." 트리거 열거, 끝에 "NOT for - ..." 로 이웃 단계와의 경계를 적는다.
- 본문 순서: ① 역할 한 줄 ② 입력(필수/선택, `.design/` 경로) ③ 출력 ④ 절차(Phase) ⑤ 스크립트 호출법(`${CLAUDE_PLUGIN_ROOT}/skills/<me>/scripts/...`) ⑥ 완료 조건(검증 가능한 것만) ⑦ 다음 단계 안내.
- 길이 상한 400줄. 넘치면 `references/` 로 내린다. references 는 **실제로 존재하는 파일만** 링크한다.
- 스크립트 경로는 전부 `${CLAUDE_PLUGIN_ROOT}` 기준 절대경로. `~/.claude/skills/...` 참조 금지.
- 에이전트 호출은 `agents/` 의 이름으로. 에이전트 파일은 YAML 프론트매터(`name`, `description`, `tools`, `model`) 필수.
- 실제 프로젝트·브랜드 고유 이름은 본문에서 제거한다. 예시가 필요하면 `brands/_template.json` 의 placeholder 브랜드를 쓴다.
- `.env`, `node_modules`, `data/generated` 는 복사하지 않는다. `package.json` 과 lock 은 복사한다.

## 7. 완료 정의

`scripts/validate.sh` 가 PASS 이고, 각 스킬의 "완료 조건" 이 `.design/` 산출물의 존재와 내용으로 검증되며, `design-qa` 가 §1-6 네 가지 금지를 기계적으로 검출한다.
