---
name: design-recreate
description: "디자인 파이프라인 5단계. 참조 URL·이미지를 원본과 같아 보이게 재현한다. 입력 모드 판별(Website / Image / SNS Template) → 멀티 뷰포트 캡처 → 그리드 섹셔닝 + 레이아웃 그리드 감지 → 3-Signal Depth Layer 분해(겹침 > 시각적 무게 > 의미 역할) → Layer-by-Layer 빌드 → design-qa 픽셀 diff 를 부르는 재귀 자기 수정(전체 95% + 섹션 90% 또는 최대 5회) 순으로 진행하고, 재현 코드와 .design/recreate-report.md(섹션별 일치율, 남은 diff)를 남긴다. SNS 포스트는 매개변수화된 HTML 템플릿으로 낸다. Use when - 똑같이 만들어, 이거 재현, 레퍼런스 그대로, 이 사이트처럼, 이미지 분해, deconstruct, 레이어, 레이어 분해, pixel-perfect, 클론, 광고 소재 재현, 배너 클론, 상세페이지 재현, SNS 포스트 재현, 인스타 템플릿, 트윗 이미지 재현, recreate, clone this page, layer-by-layer build. NOT for - 참조물에서 토큰만 뽑기(design-tokens), 브리프 기반 신규 화면이나 '스타일만 참고'한 새 디자인(design-ui), 완성물의 QA 판정·15항목 체크리스트(design-qa), 새 이미지·광고 소재 생성(design-assets)."
---

# design-recreate

① **역할:** 참조 URL·이미지를 깊이 레이어로 분해해 아래에서부터 다시 쌓고, design-qa 의 픽셀 diff 로 섹션별 일치율을 재며 기준에 닿을 때까지 고친다.

## ② 입력

| 구분 | 입력 | 위치 |
|---|---|---|
| 필수 | 참조 URL **또는** 이미지(.png .jpg .jpeg .webp, 여러 장 가능) | 요청 |
| 선택 | 디자인 시스템 토큰·프리미티브 | `.design/system/` — 있으면 값은 여기서만 가져온다 |
| 선택 | 브랜드 토큰 | `.design/brand_config.json`, 없으면 `.design/brand_config.draft.json` (design-tokens 출력) |
| 선택 | 추출 근거 | `.design/tokens-report.md` — 신뢰도 low 값은 재측정한다 |
| 선택 | 출력 위치 | 프로젝트 경로(예: `app/landing/page.tsx`). 없으면 `.design/recreate/build/` |
| 선택 | 원본 금지 효과 유지 여부 | 사용자가 "원본 효과 그대로" 를 명시했을 때만 |

토큰이 전혀 없으면 측정값을 CSS 변수로 한곳에 선언해서 쓴다. 라우터 순서(tokens → recreate)를 따랐다면 draft 는 있어야 한다.

## ③ 출력

| 산출물 | 위치 |
|---|---|
| 재현 코드 | 지정 프로젝트 경로, 없으면 `.design/recreate/build/index.html` |
| SNS Template 모드 | `build/template.html` + `template.schema.json` + `template.sample.json` |
| 리포트 | `.design/recreate-report.md` — 판정, 섹션별 일치율, 반복 이력, 남은 diff, 규칙 대체, 토큰 이탈 |
| 작업 파일 | `.design/recreate/` — `captures/` `grid.json` `cells/` `elements.json` `sections.json` `analysis/` `plan/` `progress/` |

이 스킬은 `.design/` 에서 `recreate-report.md` 와 `recreate/` 만 쓴다. 다른 단계 산출물은 읽기만 한다.

## ④ 절차

```
Phase 0  입력 모드 판별
Phase 1  캡처 (멀티 뷰포트)
Phase 2  그리드 섹셔닝 + 레이아웃 그리드
Phase 3  요소 분석 (ImageMagick 측정 + Vision 구조)          ─ GATE-1
Phase 4  3-Signal Depth Layer 분해 + Layout Region → plan  ─ GATE-2
Phase 5  Layer-by-Layer 빌드                              ─ GATE-3
Phase 6  재귀 자기 수정 (design-qa 픽셀 diff)               ─ PASS / STOP
Phase 7  리포트 마감
```

각 Phase 에서 읽을 reference 는 하나다. 전부 미리 읽지 않는다.

### Phase 0 — 입력 모드 판별

| 조건 | 모드 |
|---|---|
| 이미지가 X·Instagram·LinkedIn·Facebook·Threads 포스트 UI(아바타 + 이름 + 본문 + 인게이지먼트 바) | **SNS Template** — Phase 2·4 를 건너뛰는 Fast-Path. [references/layer-build.md](references/layer-build.md) §6 |
| 이미지 파일 | **Image** |
| `http(s)://` | **Website** |

판별 결과와 근거를 리포트 첫 줄에 적는다. 기존 재현물을 레퍼런스에 더 맞추라는 요청이면 Phase 6 부터 시작한다. 레퍼런스 없는 일반 수정은 이 스킬이 아니라 design-ui 다.

### Phase 1 — 캡처

규칙: [references/grid-rules.md](references/grid-rules.md) §1–2.

- **Website:** `multi-viewport-capture.js` 로 1920/768/375 를 캡처한다. 스크롤 리빌·인트로 오버레이가 있으면 `cap-page.js` 로 강제 노출한다. 비교 기준은 재현 대상 뷰포트 하나를 골라 `captures/reference.png` 로 둔다.
- **Image:** 원본을 `captures/reference.<ext>` 로 복사한다. 크기를 `magick identify` 로 기록한다. 재현 캔버스는 이 크기다.
- **Website 추가 측정:** 핵심 요소(제목, CTA, 카드, 내비)를 `inspect-element.js` 로 검사해 `elements.json` 에 남긴다. 폰트·이미지 원본은 `capture-network.js --filter=font,image` 로 찾는다.

### Phase 2 — 그리드 섹셔닝 + 레이아웃 그리드

규칙: [references/grid-rules.md](references/grid-rules.md) §3–4.

1. `grid-section-image.js` 로 N×M 셀을 만든다(폭에 따라 3×3~8×8). 셀마다 배경색·텍스트 유무·요소 종류·역할을 `cells/analysis.json` 에 모은다.
2. 레이아웃 그리드 7타입을 판별해 `grid.json` 에 남긴다. Website 는 `detect-layout-grid.js --all-viewports` 의 computed style 이 정답이다. Image 는 Vision 추론에 신뢰도 점수를 붙인다(< 0.5 면 Freeform).
3. 그리드 분석·이미지 섹셔닝·요소 검사는 별도 에이전트가 아니다. 이 Phase 를 직접 실행하거나, 재현 전체를 `design-reconstructor` 에 맡길 때 그 하위 단계로 넘긴다.
4. **의미 섹션**(header, hero, feature, footer…)을 레퍼런스 px 좌표로 `sections.json` 에 적는다. 단일 캔버스(광고, 포스트)는 `cells/grid-manifest.json` 을 섹션으로 쓴다. Phase 6 의 섹션 점수가 이 파일을 쓴다.

### Phase 3 — 요소 분석

규칙: [references/three-signal-layers.md](references/three-signal-layers.md) §1, 패턴이 있으면 [references/procedural-analysis.md](references/procedural-analysis.md).

1. `analyze-and-plan.sh` 가 `auto-analyze.ts` 를 돌린다. ImageMagick 메타·팔레트·배경 샘플 → Vision(gemini CLI → Gemini API → 수동 프롬프트 3단 폴백) 요소 분류·bounding box·3-Signal 입력 → 요소 크롭과 영역 색 측정.
2. Gemini 가 모두 실패하면(Tier 3) 스크립트가 수동 분석 프롬프트를 출력한다. 그 프롬프트대로 직접 이미지를 보고 `analysis/d1-elements.json` 을 쓴 뒤 `--skip-analyze` 로 다시 돌린다.
3. 색은 ImageMagick 값이 정답이다. Vision 색 추정을 CSS 에 쓰지 않는다.
4. PROCEDURAL(halftone, starburst, glitch, 반복 도형)이 있으면 procedural-analysis.md 의 주기·도형·투명도 측정을 해서 L1-B 파라미터를 얻는다.

**GATE-1:** `analysis/d1-metadata.json`, `d1-elements.json`, `d1-colors.json` 이 있고 크롭이 1개 이상.

### Phase 4 — 3-Signal Depth Layer 분해

규칙: [references/three-signal-layers.md](references/three-signal-layers.md) §2–5, Region 은 [references/grid-rules.md](references/grid-rules.md) §5.

1. `auto-plan.ts` 가 요소마다 깊이를 배정한다. 배경은 z0. 겹침에서 위인 요소는 아래 요소보다 높은 z. 겹침이 없어도 시각적 무게 ≥ 0.75 면 한 단계 승격. 우선순위는 겹침 > 무게 > 역할.
2. `--brand-config` 를 주면 텍스트 폰트 패밀리를 브랜드 토큰에서 가져온다.
3. 크롭으로 쓸 수 없는 작은 RAW_IMAGE 는 `asset_request` 가 붙는다(`--asset-prompts`).
4. 같은 z 안에서 정렬 축을 공유하는 요소를 Region(flex-column / flex-row / grid)으로 묶어 plan 에 적는다. 다른 z 끼리, 겹치는 쌍끼리, 40% 이상 hero, 1개짜리는 묶지 않는다.
5. 배정 결과를 눈으로 검토한다. 겹침 판정이 틀렸으면 `d1-elements.json` 의 `overlaps_above` 를 고치고 `--skip-analyze` 로 plan 만 다시 만든다.

**GATE-2:** `plan/deconstruct-plan.json` 에 `depthLayers`, `layers`, `buildOrder` 가 있다.

### Phase 5 — Layer-by-Layer 빌드

규칙: [references/layer-build.md](references/layer-build.md), 질감은 [references/texture-catalog.md](references/texture-catalog.md).

1. **depth-major** 로 쌓는다. z0 → z1 → … 각 z 안에서는 L0 배경 → L1-A 이미지 → L1-B 절차 패턴 → L2 구조/Region → L3 컴포넌트 → L4 질감 → L5 텍스트.
2. z 하나를 끝낼 때마다 렌더해서 확인한다.
3. Region 은 컨테이너만 absolute, 자식은 flow. 웹 페이지는 섹션을 문서 흐름으로 쌓고 섹션 안에서만 레이어를 쓴다.
4. RAW_IMAGE 는 레퍼런스 크롭(양 변 100px 이상)을 쓴다. 안 되면 `design-assets` 스킬에 `asset_request` 를 넘겨 받는다. 이 스킬은 이미지를 생성하지 않는다.
5. 텍스트는 HTML 로만 쓴다. 이미지로 만들지 않는다.
6. 값은 `.design/system/` 토큰 → `brand_config` 토큰 → 측정값 CSS 변수 순으로 가져온다. radius 는 닫힌 스케일로 스냅한다.
7. 금지 효과(pill 버튼, 네온 글로우, 글래스모피즘, 그라디언트 보더)는 layer-build.md §5 대로 대체하고 리포트에 적는다. 사용자가 원본 그대로를 명시했을 때만 남기고 "의도된 규칙 예외" 로 적는다.
8. SNS Template 모드는 콘텐츠를 `data-slot` 슬롯으로 빼고 schema·sample JSON 을 함께 낸다.

**GATE-3:** 재현 코드가 렌더되고, 레퍼런스와 같은 뷰포트의 스크린샷이 나온다.

### Phase 6 — 재귀 자기 수정

`recreate-step.sh` 한 번이 한 반복이다. 스크립트는 판정만 하고 코드를 고치지 않는다.

```
loop:
  recreate-step.sh 실행
    exit 0  PASS     → Phase 7
    exit 10 CONTINUE → progress/fix-<N>.md 를 읽고, 실패 섹션을 소유한 z / Region 만 고친다 → 다시 실행
    exit 3  STOP     → Phase 7 (최대 반복 또는 정체)
    exit 2  ERROR    → 원인(렌더 실패, 의존성)을 고치고 같은 반복을 다시 실행
```

| 기준 | 값 |
|---|---|
| 합격 | 전체 일치율 ≥ **95%** **그리고** 모든 섹션 ≥ **90%** |
| 최대 반복 | **5** |
| 정체 중단 | 직전 두 반복 연속 개선 < **1.0%p** |
| 일치율 정의 | design-qa `pixel-diff.js` 의 `pixelScore`. 후보 이미지는 참조 크기로 맞춰진다. 섹션은 두 이미지를 ImageMagick 으로 같은 좌표에서 잘라 비교한다 |

수정 원칙:

- 낮은 섹션부터 고친다. diff 이미지(`progress/sections-<N>/<id>-diff.png`)를 직접 본다.
- 반복 1–3 은 CSS/HTML 수정만 한다. 반복 4 에서도 같은 섹션이 실패하면 그 섹션의 깊이 배정·Region 을 다시 본다(Phase 4). 반복 5 에서는 요소 분석부터 다시 한다(Phase 3).
- 금지 효과를 대체한 섹션은 기준 미달이 정상이다. 대체 때문인지 diff 로 확인하고 리포트에 적는다. 그 섹션을 맞추려고 금지 효과를 되살리지 않는다.
- "거의 같다" 로 넘어가지 않는다. 사람 눈에 차이가 보이면 고친다.
- 비교·원인 분석을 `visual-comparator` 에이전트에, 빌드·수정 전체를 `design-reconstructor` 에이전트에 맡길 수 있다. 두 역할을 같은 에이전트가 하지 않는다.

### Phase 7 — 리포트 마감

`recreate-step.sh` 가 매 반복 `.design/recreate-report.md` 를 다시 쓴다(판정, 섹션별 일치율, 반복 이력, 남은 diff, vision 메모). 마지막에 아래 절을 손으로 덧붙인다.

- **입력 모드와 근거**
- **깊이 레이어 요약** — z 별 요소와 배정 사유
- **규칙 대체** — 원본 위치 · 원본 효과 · 대체 효과
- **의도된 규칙 예외** — 있을 때만
- **토큰 이탈** — 측정값과 스냅한 토큰이 크게 다른 항목
- **RAW_IMAGE 출처** — 크롭 / design-assets 생성, 외부 배포 시 저작권 주의 항목
- **반복 패턴** — 이번에 반복된 실패 원인(예: 특정 폰트가 일관되게 작게 렌더됨). 같은 패턴이 여러 프로젝트에서 3회 이상 나오면 references 에 규칙으로 올릴 후보다

## ⑤ 스크립트

설치(처음 한 번):

```bash
S=${CLAUDE_PLUGIN_ROOT}/skills/design-recreate/scripts
(cd $S && npm ci && npx playwright install chromium)
(cd ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts && npm ci)   # 픽셀 diff 소유자
```

시스템 의존성: Node 18+, ImageMagick 7(`magick`), python3. Puppeteer 가 내려받은 Chrome 이 없으면 `PUPPETEER_EXECUTABLE_PATH` 로 설치된 Chrome 을 가리킨다. Gemini 키는 환경변수 `GEMINI_API_KEY` 또는 `GOOGLE_AI_API_KEY` 로만 받는다. 없으면 gemini CLI → 수동 분석으로 내려간다.

```bash
S=${CLAUDE_PLUGIN_ROOT}/skills/design-recreate/scripts
W=.design/recreate

# Phase 1 — 캡처
node $S/multi-viewport-capture.js <url> $W/captures
node $S/cap-page.js <url> $W/captures/reference.png --viewport=1440x900 --reveal=.reveal --remove=.intro-overlay [--fold]
node $S/inspect-element.js <url> "<selector>"
node $S/capture-network.js <url> $W/network.har --filter=font,image
node $S/analyze-performance.js <url>                                   # 필요할 때만

# Phase 2 — 그리드
node $S/detect-layout-grid.js <url> --all-viewports --output=$W/grid.json
node $S/grid-section-image.js $W/captures/reference.png $W/cells --rows=4 --cols=4
node $S/grid-overlay.js $W/captures/reference.png $W/grid-overlay.png --cols=12 --gutter=24 --margin=64

# Phase 3–4 — 분석 + 깊이 레이어 plan (GATE-1, GATE-2 포함)
bash $S/analyze-and-plan.sh $W --brand-config=.design/brand_config.draft.json [--asset-prompts] [--gemini-tier=3] [--skip-analyze]
#   개별 실행: (cd $S && npx tsx auto-analyze.ts <ref> <abs>/analysis)
#             (cd $S && npx tsx auto-plan.ts <abs>/analysis <abs>/plan --brand-config=<abs>/brand_config.json)

# Phase 5 — 렌더 확인
(cd $S && npx tsx render-screenshot.ts <abs>/build/index.html <abs>/progress/check.png --width=W --height=H)

# Phase 6 — 자기 수정 한 반복 (design-qa pixel-diff.js 호출)
bash $S/recreate-step.sh $W --reference=$W/captures/reference.png \
  (--html=$W/build/index.html | --url=http://localhost:3000/<route>) \
  --sections=$W/sections.json [--threshold=95] [--section-threshold=90] [--max-iterations=5] [--no-vision]
```

| 스크립트 | 하는 일 |
|---|---|
| `multi-viewport-capture.js` | 1920/768/375 스크린샷 |
| `cap-page.js` | 한 뷰포트 캡처, 리빌 클래스 강제·오버레이 제거 |
| `inspect-element.js` | 셀렉터 생성 + computed style |
| `capture-network.js` | HAR, 폰트·이미지 원본 URL |
| `analyze-performance.js` | Core Web Vitals (선택) |
| `detect-layout-grid.js` | CSS Grid/Flex 컨테이너 → 그리드 타입·반응형 |
| `grid-section-image.js` | N×M 셀 + `grid-manifest.json` + 오버레이 |
| `grid-overlay.js` | 감지한 컬럼 그리드를 이미지 위에 그림 |
| `auto-analyze.ts` · `gemini-analyze.ts` · `prompts/d1-analysis-prompt.txt` | 요소 분석 (ImageMagick + Vision 3단 폴백) |
| `auto-plan.ts` | 3-Signal 깊이 배정 + method 그룹 → `deconstruct-plan.json` |
| `analyze-and-plan.sh` | 위 둘 + GATE-1·2 |
| `render-screenshot.ts` | HTML → PNG (Puppeteer) |
| `recreate-step.sh` · `prompts/visual-verdict-prompt.txt` | 한 반복: 렌더 → design-qa 픽셀 diff(전체 + 섹션) → vision 힌트(codex, 선택) → 로그·수정 지시·리포트 → PASS / CONTINUE / STOP |

픽셀 diff 는 이 스킬에 없다. 소유자 design-qa 의 스크립트를 `recreate-step.sh` 가 아래 형식으로 부른다.

```bash
QA=${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts
node $QA/pixel-diff.js <ref.png> <actual.png> --out <diff.png>
# stdout 한 줄 JSON {"pass","pixelScore","mismatchedPixels","totalPixels","diffImagePath"} · exit 0 pass, 1 fail(둘 다 비교됨), 2 오류
# 섹션은 recreate-step.sh 가 두 이미지를 먼저 잘라서 넘긴다. pixel-diff.js 에는 crop 옵션이 없다
```

토큰 추출은 design-tokens, 이미지 생성은 design-assets 의 것이다.

## ⑥ 완료 조건

검증 가능한 것만 적는다.

- [ ] `.design/recreate/captures/reference.*` 가 있다.
- [ ] Image·Website 모드: `.design/recreate/grid.json` 과 `cells/grid-manifest.json` 이 있다. Website 모드면 `elements.json` 도 있다.
- [ ] `.design/recreate/plan/deconstruct-plan.json` 에 `depthLayers` 가 1개 이상, 모든 요소에 `reason` 이 있다(SNS Template 모드 제외).
- [ ] 재현 코드가 출력 위치에 있고 `render-screenshot.ts` 또는 `cap-page.js` 로 렌더된다.
- [ ] `.design/recreate/progress/iteration-log.json` 의 마지막 항목이 `.design/recreate-report.md` 의 판정·일치율과 같다.
- [ ] 리포트 판정이 PASS 이거나, STOP 이면 남은 diff 섹션마다 diff 이미지 경로와 원인이 적혀 있다.
- [ ] 리포트에 규칙 대체·토큰 이탈·RAW_IMAGE 출처 절이 있다(해당 없으면 "없음").
- [ ] SNS Template 모드: `template.html` 의 모든 `data-slot` 이 `template.schema.json` 에 있고, `template.sample.json` 으로 채운 렌더가 비교 대상이다.
- [ ] 재현 코드에 금지 효과가 없다. 단, 리포트 "의도된 규칙 예외" 에 적은 것은 제외.

## ⑦ 다음 단계

- **design-qa** 를 부른다. 정적 토큰 감사(3색·radius·금지 효과), 반응형·상태·접근성, 15항목 체크리스트는 거기서 판정한다. 리포트의 "의도된 규칙 예외" 를 함께 넘긴다.
- STOP 으로 끝났으면 남은 diff 를 사용자에게 보여 주고 계속 고칠지 정한다. 기준을 낮춰서 PASS 로 만들지 않는다.
- 작은 RAW_IMAGE 를 design-assets 에 넘겼다면, 받은 에셋을 넣은 뒤 Phase 6 을 한 번 더 돌린다.
- SNS Template 결과로 여러 장을 찍어야 하면 design-assets 에 `template.html` 과 schema 를 넘긴다.

설계 결정과 버린 것: [references/decision-log.md](references/decision-log.md).
