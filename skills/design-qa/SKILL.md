---
name: design-qa
description: "디자인 파이프라인 7단계 QA. 생성된 코드와 실행 중 화면을 세 계층으로 검사해 .design/qa/report.md 에 PASS/FAIL 표와 위반 위치(file:line)를 남긴다 — (A) 정적 토큰 감사: brand_config 기준 한 화면 3색, radius 닫힌 스케일·이름-값 불일치, pill 버튼·네온 글로우·글래스모피즘·그라디언트 보더 기계 검출, (B) Playwright 동적 검사: 상태 매트릭스·반응형 뷰포트·axe 접근성·런타임 금지 효과·스크린샷, (C) 참조 이미지 대비 픽셀 diff(플러그인 유일 구현)와 15항목 체크리스트. 반복 커버리지 루프 최대 5회. Use when - 디자인 QA, 화면 검증, 시각 검수, visual regression, 픽셀 비교, 접근성 검사, 반응형 확인, 토큰 위반, screenshot QA, 디자인 규칙 위반 검사, 재현 결과 검증. NOT for - 화면·컴포넌트 생성이나 수정(design-ui), 참조 재현과 자기 수정 루프(design-recreate), 토큰 추출(design-tokens), 가드 테스트 작성(design-system)."
---

# design-qa

생성물이 브랜드 토큰과 디자인 규칙(CONTRACT §1-6)을 지키는지, 화면이 상태·뷰포트·접근성에서 깨지지 않는지, 참조와 얼마나 같은지를 **측정해서** 판정한다. 코드는 고치지 않는다.

## 입력

| 구분 | 경로 / 값 | 쓰는 계층 |
|---|---|---|
| 필수 | `.design/brand_config.json` | A (없으면 radius·팔레트 대조 규칙 SKIP, report 에 명시) |
| 필수 | 검사할 코드 경로 (design-ui / design-recreate 산출물, `.design/system/`, `.design/assets/*.html`) | A |
| 선택 | 실행 중 URL (dev 서버) 또는 서버 기동 명령 | B |
| 선택 | 참조 이미지 (`brand_config.assets.references`, 또는 design-recreate 가 쓴 캡처) | C |
| 선택 | `.design/brief.md` 의 화면 목록 → 검사할 route 목록 | B |
| 선택 | `.design/recreate-report.md` → 섹션별 좌표(Layer C 의 `--regions`) | C |

호출 맥락별 범위 (CONTRACT §4):

| 호출 맥락 | 계층 |
|---|---|
| From Scratch / Inspired / Modification | A + B |
| Recreation / Deconstruct / SNS Template | A + B + C |
| Assets only | A 만 (`.design/assets/`) |
| Design system only | A 만 (`.design/system/`) + design-system 의 가드 테스트 실행 결과 기록 |

## 출력

```
.design/qa/
  report.md               # 최종 PASS/FAIL 표 + 위반 file:line + 스크린샷 경로
  token-audit.json|.md    # Layer A 원자료
  dynamic-results.json    # Layer B 원자료 (items, coverage, failingKeys)
  pixel/*.json            # Layer C 원자료 (pixel-diff 출력)
  diff/*.png              # Layer C diff 이미지
  screenshots/<route>-<theme>-<width>.png
  screenshots/states/<route>-<theme>-<n>-<default|hover|focus>.png
```

QA 는 `.design/qa/` 밖에 쓰지 않는다.

## 준비 (최초 1회)

```bash
cd ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts && npm ci && npx playwright install chromium
```

이미 설치된 다른 Chromium 을 쓰려면 `QA_CHROMIUM_PATH=<실행파일>` 을 넘긴다.

## 절차

### Phase 0 — 범위 확정

1. `.design/brand_config.json` 존재 확인. 없으면 report 상단에 "brand_config 없음 — R2·R3·W1 SKIP" 을 적고 진행한다(멈추지 않는다).
2. 검사 경로, route 목록(brief 의 화면 목록), 참조 이미지 유무를 정해 report 머리에 적는다.
3. 위 표로 계층을 고른다.

### Phase 1 — Layer A: 정적 토큰 감사

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/token-audit.js <code-path> [.design/system] \
  --config .design/brand_config.json \
  --json .design/qa/token-audit.json --md .design/qa/token-audit.md
```

| 규칙 | 판정 | 무엇을 잡나 |
|---|---|---|
| R1 colors-per-screen | FAIL | 파일당 색 역할(neutral/primary/accent/팔레트 밖 색상군, semantic 제외) > 3 |
| R2 radius-scale | FAIL | brand 스케일 자체 (CONTRACT §5 확정 규칙, design-system `build-system.ts` 의 `radiusErrors()` 와 동일): 허용 이름은 none/sm/md/lg/xl/2xl/3xl/full + 숫자뿐(`xs`·`4xl` FAIL), 이름 단계가 있으면 `none: 0` + 두 단계 이상, 이름 단계 엄격 증가, 숫자 이름 = 값. 값 자체는 판정 안 함(순서가 맞으면 lg=12 PASS). 스케일은 `.design/brand_config.json` 에서만 읽는다 |
| R3 radius-off-scale | FAIL | 코드의 radius 값·Tailwind 이름이 스케일 밖, 토큰 정의(tailwind config, `--radius-*`)의 이름-값 불일치 |
| R4 pill-button | FAIL | 버튼에 `rounded-full` / `9999px` / `50%` (정사각 아이콘 버튼 예외) |
| R5 neon-glow | FAIL | 채도 높은 색 그림자 + blur ≥ 10px (text-shadow ≥ 8px) |
| R6 glassmorphism | FAIL | `backdrop-filter: blur()`, `backdrop-blur-*` |
| R7 gradient-border | FAIL | `border-image: *gradient`, mask-composite 트릭, gradient 래퍼 + 1~2px 패딩 |
| W1 off-palette-color | WARN | brand 팔레트 어디에도 속하지 않는 색 |

**예외 → WAIVED**: `brand_config.exceptions: [{ rule, scope, reason, evidence }]` 에 덮이는 위반은 PASS·FAIL 외의 세 번째 상태 **WAIVED** 가 된다. 예를 들어 rule `no-pill-button`, scope `components.button` 이면 버튼 pill 이 면제된다. 규칙 R1~R7 마다 rule 이름 별칭 표가 있고(`no-pill-button`·`no-pill` → R4 등), scope 는 경로 접두·점 경로·자유 문장 단어로 맞춘다. 표와 매칭 규칙은 static-rules.md 의 예외 절에 있다. WAIVED 는 실행을 막지 않지만 report 에 reason·evidence 를 인용해 **항상** 나열한다.

정확한 정규식과 분류 순서는 [references/static-rules.md](references/static-rules.md). exit 1 이면 (면제되지 않은) FAIL 이 있다.

### Phase 2 — Layer B: Playwright 동적 검사

서버가 이미 떠 있으면 바로, 아니면 `wait-for-server.js` 로 띄우고 끝나면 정리한다.

```bash
# 서버 기동 → 준비 대기 → 러너 실행 → 서버 종료 (러너의 exit code 로 끝남)
node ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/wait-for-server.js \
  --url http://localhost:3000 --start "npm run dev" --timeout 90000 -- \
  node ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/qa-runner.js http://localhost:3000 \
    --routes /,/pricing --viewports 375,768,1280 --themes light,dark --states --out .design/qa
```

조합(route × theme × viewport)마다 기록하는 항목:

| check | FAIL | WARN |
|---|---|---|
| `load` | HTTP ≥ 400, 이동 실패 | — |
| `responsive.overflow` | 가로 스크롤 발생 (넘친 요소 목록) | — |
| `responsive.touch-target` | 인터랙티브 요소 < 24px (인라인 링크 제외, WCAG 2.5.8) | < 44px, 폭 ≤ 768 |
| `responsive.min-font` | — | 글자 < 12px |
| `effects.*` | 런타임 computed style 의 글래스모피즘·pill 버튼(radius ≥ 높이/2)·그라디언트 보더·네온 글로우 | — |
| `a11y.axe` (가장 넓은 뷰포트) | critical / serious (WCAG 2.1 A·AA) | moderate / minor |
| `state.focus-visible` (`--states`) | focus 시 outline·shadow·border·bg 변화 없음 | — |
| `state.disabled` (`--states`) | — | disabled 인데 opacity·cursor 변화 없음 |

상태 매트릭스(Component × State × Theme × Viewport) 설계와 컴포넌트별 상태 목록은 [references/state-matrix-testing.md](references/state-matrix-testing.md).
**시나리오 위임 — `e2e-tester` 에이전트.** `qa-runner.js` 는 페이지 단위 기계 검사다. 그 밖의 시나리오는 `e2e-tester` 에 위임한다. 대상은 폼의 empty submit·에러·성공, loading·empty 상태, 키보드만으로 핵심 여정 완주, 대비 계산, FAIL 재실행으로 FLAKY 판별이다.
위임 프롬프트에는 URL, route 목록, `.design/brief.md` 의 핵심 여정, 이번 회차 `failingKeys` 를 넣는다. 결과는 `.design/qa/e2e.json` 과 `screenshots/e2e-*.png` 로 오고, report 의 B 계층에 FAIL·FLAKY 를 옮긴다. 에이전트는 제품 코드를 고치지 않는다.
MCP 도구로 직접 보충할 때의 도구 목록: [references/playwright-mcp-tools.md](references/playwright-mcp-tools.md).
베이스라인 스크린샷 회귀(이전 실행 대비)는 [references/visual-regression-guide.md](references/visual-regression-guide.md) 의 임계값 표를 쓰고, 비교 자체는 Phase 3 의 `pixel-diff.js` 로 한다.

### Phase 3 — Layer C: 참조 대비 픽셀 diff + 15항목

참조가 있을 때만. 참조와 같은 크기의 뷰포트 스크린샷을 비교한다.

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/pixel-diff.js <ref.png> <actual.png> \
  --threshold 0.02 --out .design/qa/diff/<name>.png > .design/qa/pixel/<name>.json
```

계약(인자·출력·exit code)은 아래 **스크립트** 절이 정본이다. 참조가 기준이고, 크기가 다르면 실제 이미지를 참조 크기로 리사이즈한다.

15항목의 6·12·15번은 design-qa 내부 옵션(계약 밖) `--samples`·`--regions` 로 잰다. 허용치는 design-qa 내부 옵션 `--sample-tolerance`(기본 5)·`--region-tolerance`(기본 10)로 조정한다.

**판정 위임 — `visual-comparator` 에이전트.** 뷰포트별 ref·actual 캡처와 (있으면) `brand_config.json` 을 넘긴다. 에이전트는 위 계약대로 `pixel-diff.js` 를 부른다. 그 위에 비전 5개 차원(layout·colors·typography·effects·responsive) 점수와 셀렉터 단위 수정 지시를 붙여 `.design/qa/visual-compare.json` 을 쓴다. QA 는 그 `passed`·`pixelDiff`·`fixes` 를 report 의 C 계층에 옮긴다. design-recreate 의 재현 루프 판정은 `recreate-step.sh` 가 하므로 이 에이전트를 거치지 않는다.

그다음 [references/checklist-15.md](references/checklist-15.md) 의 15항목을 하나씩 PASS/FAIL 로 판정한다. 13/15 이상 **그리고** PIXEL_COLOR_MATCH·pixel-diff PASS 여야 Layer C PASS.
이 스크립트를 고른 이유와 버린 구현은 [references/decision-log.md](references/decision-log.md).

### Phase 4 — 반복 커버리지 루프 (최대 5회)

목표는 Layer B 커버리지 100%(ERROR 0)와 FAIL 0 이다. 상세 알고리즘은 [references/iterative-coverage-loop.md](references/iterative-coverage-loop.md).

```
max_iterations: 5        # 상한. 넘기지 않는다
min_improvement: 5       # 2회차부터, 커버리지 개선이 5%p 미만이면 조기 종료
acceptable_coverage: 95  # 상한 도달 시 이 이상이면 ACCEPTABLE, 아니면 STALLED
retry_strategy: targeted # 실패 조합만 재실행
```

1. 1회차는 전체 실행.
2. `dynamic-results.json` 의 `failingKeys` 를 읽는다. ERROR 는 원인(서버 미기동, 타임아웃, 셀렉터)을 고쳐 재측정한다. FAIL 은 **호출한 단계**(design-ui / design-recreate)에 file:line 과 함께 넘겨 고치게 하고, 고친 뒤 재측정한다.
3. 재실행은 해당 조합만: `qa-runner.js <url> --only "/@light@375,/pricing@dark@1280"` — 다른 조합 결과는 보존된다.
4. Layer A·C 도 같은 회차에 다시 돌린다(수정이 다른 규칙을 깨지 않았는지).
5. 회차마다 report 의 "반복 기록" 표에 `회차 | 커버리지 | FAIL | WARN | 조치` 를 한 줄 추가한다.
6. 5회 후에도 FAIL 이 남으면 멈추고 남은 FAIL 을 그대로 보고한다. "거의 같다"로 PASS 처리하지 않는다.

### Phase 5 — report 작성

`.design/qa/report.md` 를 아래 형식으로 쓴다. Layer A 의 표는 `token-audit.md` 를 그대로 붙인다.

```markdown
# QA Report — <화면/작업 이름>
- 일시 / 대상 경로 / URL / brand_config / 참조 이미지
- 최종 판정: **PASS | FAIL** (A: PASS, B: FAIL, C: N/A)

## 요약
| 계층 | 항목 | 결과 | 건수 | 근거 |
|---|---|---|---|---|
| A | R1 한 화면 3색 | FAIL | 1 | `src/app/page.tsx:42` |
| B | a11y.axe | FAIL | 2 | `/@light@1280` color-contrast x3 |
| C | PIXEL_COLOR_MATCH | PASS | — | `.design/qa/pixel/home.json` |

## 위반 (FAIL 먼저, 그다음 WARN)
| 계층 | 규칙 | 위치(file:line 또는 route@theme@width) | 내용 | 스크린샷 |

## WAIVED (brand_config.exceptions — 판정에서 제외, 항상 나열)
| 규칙 | 원래 심각도 | 위치 | 예외 rule / scope | 사유(reason) | 근거(evidence) |

## 반복 기록
| 회차 | 커버리지 | FAIL | WARN | 조치 |

## 권고 (사람 판단, 판정에 넣지 않음)
```

판정 규칙: 한 계층이라도 FAIL 이 있으면 최종 FAIL. SKIP·N/A 는 이유를 적는다. WARN·WAIVED 는 판정에 영향 없음. WAIVED 는 0건이 아니면 반드시 표로 남긴다.

## 스크립트

| 스크립트 | 역할 | 다른 스킬이 호출 |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/token-audit.js` | Layer A | design-system(가드 보조), design-assets |
| `${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/qa-runner.js` | Layer B | — |
| `${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/pixel-diff.js` | Layer C, 플러그인 유일 픽셀 diff | **design-recreate, design-assets** (안정 CLI) |
| `${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/wait-for-server.js` | 서버 기동·대기·정리 | — |

### pixel-diff 계약 (CONTRACT §3-1 과 동일 — design-recreate, design-assets, visual-comparator 가 이대로 호출)

다른 스킬은 픽셀 비교를 자체 구현하지 않고 이것만 부른다. `.sh` 변형은 없다.

```
node ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/pixel-diff.js <ref.png> <actual.png> [--threshold 0.02] [--out diff.png] [--color-threshold 0.1] [--samples "x,y;..."] [--regions "WxH+X+Y;..."]
stdout 한 줄 JSON: {"pass": bool, "pixelScore": 0-100, "mismatchedPixels": int, "totalPixels": int, "diffImagePath": path|null}
종료 코드: 0 비교됨·통과, 1 비교됨·실패, 2 입력/실행 오류. 크기가 다르면 actual 을 ref 크기로 맞춘다.
섹션 점수는 호출자가 두 이미지를 같은 영역으로 먼저 crop 한 뒤 호출한다(--crop 없음; design-recreate 는 ImageMagick 으로 자른다). 구현은 sharp + pixelmatch 다.
```

| 인자 | 기본 | 의미 |
|---|---|---|
| `--threshold` | 0.02 | 허용 불일치 픽셀 비율(0~1). `--threshold=0.02` 형식도 받는다 |
| `--out` | 없음 | diff 이미지 경로. 없으면 저장하지 않는다 |
| `--color-threshold` | 0.1 | design-qa 내부용, 계약 밖. pixelmatch 픽셀 단위 색 민감도 |
| `--samples` | 모서리 안쪽 5% 네 점 + 중앙 | design-qa 내부용, 계약 밖. ref 좌표계의 점 색 비교(채널 차 ≤ 5) |
| `--regions` | 없음 | design-qa 내부용, 계약 밖. 영역 평균색 비교(채널 차 ≤ 10), ImageMagick crop 문법 |

다른 스킬은 `--threshold`·`--out` 만 쓴다. `--color-threshold`·`--samples`·`--regions` 는 15항목 측정을 위한 design-qa 내부 옵션이며 계약 밖이라 예고 없이 바뀔 수 있다.

- `pass` = 불일치 비율 ≤ threshold **그리고** 샘플·영역 검사 통과. 샘플 기본값은 항상 돌므로 `pass` 에 포함된다.
- 계약 필드 외 출력(`mismatchRatio`, `checks`, `samples[]`, `regions[]`, `aspectRatioMismatch`, `dimensions`)은 참고용이다.
- exit 2 이면 stdout 은 `{"pass":false,"error":"..."}` 이고, 잘못된 인자일 때는 stderr 에 사용법이 나온다. 의존성(sharp·pixelmatch·pngjs)이 없을 때도 2 다. `scripts/package.json` 에 선언돼 있으니 `npm ci` 로 설치한다.

### 테스트

```bash
cd ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts && node --test test/
```

정적 감사의 exceptions·radius 규칙 픽스처 테스트다. 픽스처 브랜드(pill 예외 등록) 의 pill 버튼 → WAIVED, 같은 코드에 예외 없음 → FAIL, 칩 전용 예외는 버튼 미면제, 픽스처 스케일(lg=12·숫자 이름) R2 PASS, 순서·숫자 이름·허용 밖 이름 R2 FAIL 을 확인한다.

## 완료 조건

검증 가능한 것만:

1. `.design/qa/report.md` 가 있고 최종 판정 줄(`PASS` 또는 `FAIL`)과 계층별 결과가 있다.
2. Layer A 를 돌렸다: `.design/qa/token-audit.json` 이 있고 report 의 A 행 수가 그 `summary` 와 같다. 모든 FAIL 에 `file:line` 이 있다. `violations` 중 `severity: "WAIVED"` 인 항목 수만큼 report 의 WAIVED 표에 행이 있다.
3. Layer B 범위였다면: `.design/qa/dynamic-results.json` 의 `coverage` 가 100 이거나 반복 기록에 STALLED/ACCEPTABLE 사유가 있고, `screenshots/` 에 route × theme × viewport 개수만큼 PNG 가 있다.
4. Layer C 범위였다면: `.design/qa/pixel/*.json` 과 15항목 표가 report 에 있다.
5. 반복 회차가 5 이하다.

## 다음 단계

- 최종 PASS → 라우터(`design`)에 완료를 알린다.
- FAIL → 위반 표를 들고 생성 단계로 돌아간다: 코드 규칙 위반·반응형·접근성은 `design-ui`, 참조 불일치는 `design-recreate`, 토큰 정의(radius 이름-값, 팔레트) 문제는 `design-system`, brand 스케일 자체 문제(R2)는 `brand_config.json` 을 고칠 `design-tokens`/사람 확인.
- 고친 뒤에는 Phase 4 루프로 재측정한다.
