# design-qa 결정 기록

## D1. 픽셀 diff 단일 구현 — `pixel-compare.ts` 계열을 남기고 `visual-diff.js` 는 버린다

후보 다섯 곳을 비교했다.

| 출처 | 방식 | 판단 |
|---|---|---|
| antigravity `scripts/visual-diff.js` | URL 두 개를 Playwright 로 열어 DOM 요소의 위치·크기·배경색·폰트 크기를 비교하고 감점식 점수 | **픽셀 diff 가 아니다.** 이미지 입력을 못 받는다(template-visual-generator 가 PNG 를 넘기던 호출은 동작하지 않았다). 요소 매칭이 "같은 태그 + y 차 100px 이내" 라 오탐이 많다 |
| design-workflow `scripts/pixel-compare.ts` | sharp 로 참조 크기에 맞춰 정규화 → pixelmatch → JSON | 이미지 두 장을 받는 실제 픽셀 diff. 참조가 기준이라는 규칙이 맞다. 단점: `tsx` 런타임 필요, 판정(pass/fail)·exit code 없음 |
| antigravity 5C / design-workflow D4.4 | ImageMagick 좌표 색상(`%[hex:p{x,y}]`), 크롭 dominant color | 15번 PIXEL_COLOR_MATCH 의 근거. 셸 루프라 재사용 불가 |
| designclaw 4.2 | `magick compare -metric RMSE` | 점수만 있고 diff 비율·판정 없음 |
| template-visual-generator Phase 5 | visual-diff.js 를 PNG 로 호출 | 위 이유로 원래 깨져 있던 호출 |

결정: `scripts/pixel-diff.js` 하나.

- 엔진: pixel-compare.ts 의 sharp 정규화 + pixelmatch(`includeAA: false`). TypeScript 를 plain ESM JS 로 옮겨 `tsx` 의존을 없앴다.
- 병합: ImageMagick 좌표 색 비교와 영역 dominant color 를 sharp raw 버퍼 위에서 계산한다(`--samples`, `--regions`). `magick` 바이너리가 없어도 돈다.
  영역 색은 ImageMagick `-colors 1` 대신 **평균색**이다. 단색 영역에서는 같은 값이고, 혼합 영역에서는 평균이 더 안정적이다.
- 추가: `--threshold`(허용 불일치 비율)로 PASS/FAIL 판정, exit code(0/1/2), 종횡비 불일치 경고, 알파 이미지는 흰 배경으로 평탄화.
- CLI 는 다른 스킬이 부르는 계약이다. 인자 이름을 바꾸면 design-recreate, design-assets 를 같이 고친다.

CONTRACT §3-1(v0.1.1)이 이 CLI 를 정본으로 적는다: `pass`·`pixelScore`·`mismatchedPixels`·`totalPixels`·`diffImagePath`, exit 0/1/2, `--threshold`·`--out` 과 선택 옵션 `--color-threshold`·`--samples`·`--regions`. 섹션 점수용 `--crop` 은 두지 않고 호출자가 먼저 자른다.

버린 것: visual-diff.js 의 DOM 레이아웃 비교는 픽셀 diff 가 아니라 구조 비교다. 그 역할(라이브 URL vs 로컬 구현의 레이아웃 차이)은 design-recreate 의 자기 수정 루프 몫이며, 필요하면 그쪽이 스크린샷을 찍어 `pixel-diff.js` 를 부른다.

## D2. Codex/Gemini Vision 70% + pixel 30% 혼합 점수는 가져오지 않는다

design-workflow `visual-verdict.sh` 는 외부 CLI(codex)의 비전 점수를 70% 섞었다. QA 판정이 외부 모델 가용성에 묶이고 재현이 안 된다.
대신 정성 판단은 15항목 체크리스트(사람 눈 기준, Claude 가 Read 로 비교)로, 정량 판단은 pixel-diff 로 분리했다. 두 결과를 합산하지 않고 각각 PASS/FAIL 로 적는다.

## D3. Layer B 는 Playwright 스크립트, MCP 는 보조

screen-qa 는 Playwright MCP 도구 호출을 전제로 했다. MCP 는 세션마다 붙어 있다는 보장이 없고 반복 실행 결과를 파일로 남기지 않는다.
`qa-runner.js` 를 기본으로 하고, 인터랙션 시나리오(폼 입력, 모달 열기)처럼 스크립트로 일반화하기 어려운 상태만 MCP 도구로 보충한다(`references/playwright-mcp-tools.md`).

## D4. with_server.py 대신 `wait-for-server.js`

screen-qa 는 webapp-testing 스킬의 `scripts/with_server.py` 를 불렀다. 플러그인 밖 스킬에 대한 의존이라 끊었다.
`wait-for-server.js` 는 Node 18+ 내장 `fetch` 만 쓴다. 서버 기동(`--start`) → 응답 대기 → 명령 실행 → 서버 정리(프로세스 그룹 종료)를 한 번에 한다.

## D5. 정적 감사는 정규식, AST 아님

대상 코드가 CSS/SCSS/TSX/HTML/Vue 로 섞여 있어 파서 하나로 덮을 수 없다. 금지 패턴 네 가지는 문법적으로 짧고 독특해서 정규식으로 충분하다.
정적 감사가 놓치는 런타임 값(CSS 변수, 테마 전환)은 Layer B 의 computed-style 검사가 같은 네 금지를 다시 잡는다. 두 계층이 겹치는 것은 의도다.

## D6. Iterative coverage loop 상한

screen-qa 의 루프(목표 100%, 최대 5회, 개선 5%p 미만이면 조기 종료, 95% 이상이면 수용)를 그대로 쓰되, 반복 대상은 `dynamic-results.json` 의 `failingKeys` 로 한정한다(`--only`).
QA 는 코드를 고치지 않는다. 루프 안에서 FAIL 을 고치는 것은 호출한 단계(design-ui / design-recreate)이고, QA 는 매 회 재측정만 한다.
