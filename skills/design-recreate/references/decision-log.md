# Decision Log — design-recreate

세 개의 이미지→레이어 HTML 재현 경로(antigravity, design-workflow 유형 A·B·D·F·G, designclaw)를 하나로 합치며 내린 결정. 2026-10-07.

## 병합

| # | 결정 | 이유 |
|---|---|---|
| 1 | 입력 판별은 SNS Template → Image → Website 순으로 하나만 둔다 | antigravity 의 Dual Mode 와 design-workflow 의 G 우선 판별이 같은 일을 했다 |
| 2 | design-workflow 유형 A(Recreation), F(Deconstruct), antigravity P1·P2·P4, designclaw Stage 0·1·3 을 하나의 Phase 흐름으로 합친다 | 셋 다 "분석 → 깊이 레이어 → 아래서부터 조립 → 비교·수정" 이었다 |
| 3 | 유형 B(Inspired) 는 이 스킬의 모드로 두지 않는다 | 계약 §4 에서 Inspired 는 tokens → system → ui 경로다. recreate 가 할 일이 아니다 |
| 4 | 유형 D(Modification) 는 "레퍼런스에 다시 맞추기" 만 받는다 | 계약 §4 에서 일반 수정은 design-ui 수정 모드다. 기존 재현물을 레퍼런스에 더 가깝게 고치는 경우만 Phase 6 루프로 들어온다 |
| 5 | 깊이 배정 공식은 designclaw 판(semanticBoost cta 1.0 / headline 0.7 …)을 정본으로 한다 | design-workflow D1.2 프롬프트의 boost 표(cta 0.7, headline 0.5 …)와 값이 달랐다. designclaw 쪽이 role 목록이 완전하고 상세 참조 문서까지 있었다 |
| 6 | Plan 을 두 축으로 바꾼다: `depthLayers[]`(z, 3-Signal) + `layers[]`(L0–L5 method). 빌드는 depth-major | design-workflow v3.5 문서는 동적 depth layer 를 말하는데 `auto-plan.ts` 는 고정 L0–L5 만 냈다. 문서와 스크립트가 어긋나 있었다. `auto-plan.ts` 에 `assignDepthLayers()` 를 넣어 맞췄다 |
| 7 | D1 분석 프롬프트에 3-Signal 입력(semantic_role, overlaps_above, font_size_px, font_weight, color_contrast)을 추가한다 | 기존 프롬프트는 깊이 배정에 필요한 신호를 받지 않았다 |
| 8 | 자기 수정 루프는 `recreate-step.sh` 한 번 = 한 반복으로 둔다 | 원본 `auto-verify-loop.sh` 는 수정 없이 같은 HTML 을 N 번 재채점했다. 고치는 주체는 에이전트이므로 스크립트는 판정과 지시만 낸다 |
| 9 | 합격선: 전체 ≥ 95% AND 모든 섹션 ≥ 90%. 최대 5회. 직전 두 번 연속 개선 < 1.0%p 면 정체로 중단 | 원본은 90%(design-workflow, 15항목 13개), 85점(designclaw, Vision 70% + pixel 30%), 7회 등 제각각이었다. 기준을 순수 픽셀 일치율로 통일하고, 전체 평균이 큰 실패 섹션을 가리지 못하게 섹션 하한을 둔다. 5회와 정체 감지는 designclaw 의 plateau 규칙을 따른다 |
| 10 | Vision 비교(codex)는 수정 힌트로만 쓰고 합격 판정에 넣지 않는다 | 판정은 재현 가능한 수치여야 한다. Vision 점수는 같은 입력에도 흔들린다 |
| 11 | `cap-mobile.js` · `cap-localhost-temp.js` 를 `cap-page.js` 하나로 일반화 | 둘 다 특정 프로젝트 절대경로와 localhost:3000 을 박아 둔 일회성 스크립트였다. 공통 기능(리빌 클래스 강제, 인트로 제거, 뷰포트)만 옵션으로 남겼다 |
| 12 | `design-pipeline.sh` 를 `analyze-and-plan.sh` 로 줄인다 | 원래 D1→D4 전체를 돌렸지만 D3 은 사람/에이전트 몫이었고 D4 는 design-qa 와 recreate-step 으로 갈렸다 |
| 13 | 두 `package.json`(antigravity, design-workflow) 을 하나로 합치고 lock 을 새로 만든다 | 한 스킬의 scripts/ 는 의존성 한 벌 |
| 14 | `gemini-analyze.ts` 의 Tier 1 에서 GNU `timeout` 을 뺀다 | macOS 기본 셸에 없다. `execSync` 의 timeout 옵션이 같은 일을 한다 |
| 15 | `gemini-analyze.ts` 는 `GEMINI_API_KEY` 다음 `GOOGLE_AI_API_KEY` 를 읽는다 | 계약 §1-5 의 두 이름 |

## 다른 스킬로 보낸 것 (계약 §1-3 "한 기능은 한 곳에만")

| 원본 | 보낸 곳 | 여기서는 |
|---|---|---|
| antigravity `visual-diff.js`, design-workflow `pixel-compare.ts`, designclaw 4.2 `magick compare` | design-qa | `${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/pixel-diff.js` 를 호출만 한다. 섹션 점수는 호출자(recreate-step.sh)가 두 이미지를 ImageMagick 으로 같은 좌표에서 자른 뒤 같은 스크립트에 넣어 얻는다. 잘라내기는 diff 가 아니므로 소유권 규칙에 걸리지 않는다 |
| antigravity 5B · design-workflow D4.4 15항목 체크리스트 | design-qa | 쓰지 않는다. recreate 의 판정은 픽셀 일치율 |
| antigravity `extract-design-tokens.js`, Phase 3 토큰화, design-workflow 유형 E | design-tokens | `.design/brand_config.draft.json` 을 읽기만 한다 |
| designclaw Stage 2 Gemini 이미지 생성, design-workflow L1-A Gemini 생성 | design-assets | 크롭으로 안 되는 RAW_IMAGE 만 `asset_request` 로 넘긴다 |
| design-workflow 유형 C(From Scratch) | design-ui | — |

## 버린 것

| 원본 | 이유 |
|---|---|
| designclaw Stage 5 "패턴 학습 + 관련 스킬 SKILL.md 자동 업그레이드" | 범위 밖. 실행 중에 다른 스킬 문서를 고치는 것은 검토 없는 변경이다. **아이디어는 남긴다:** 반복 실패 패턴(예: 특정 한글 폰트가 일관되게 작게 렌더됨, 생성 이미지에 원치 않는 그림자)을 `recreate-report.md` 의 "반복 패턴" 으로 모아 두고, 같은 패턴이 여러 프로젝트에서 3회 이상 나오면 사람이 references 에 규칙으로 올린다 |
| design-workflow 의 open-antigravity 스킬 스크립트 호출 | 그런 스킬이 없다. 토큰 추출은 design-tokens 로 갔다 |
| 원본 예시의 실제 브랜드·상품명·프로젝트명 | 계약 §6. 예시는 일반 이름으로 바꿨다 |
| texture catalog 의 글래스모피즘·네온 글로우·텍스트 글로우·네온 분할 조명 | 계약 §1-6 금지 효과. 대체 규칙은 layer-build.md §5 |
| antigravity `hooks/cleanup.sh` (Stop 훅) | 플러그인 훅은 스킬 단위가 아니다. 중간 산출물은 `.design/recreate/` 한곳에 모이므로 정리 대상이 명확하다 |
| antigravity Phase 0 "레퍼런스 6개 전부 먼저 읽기" | 토큰 낭비. SKILL.md 가 Phase 마다 필요한 reference 하나만 가리킨다 |
| 원본 Puppeteer 인라인 heredoc (designclaw Stage 3) | `render-screenshot.ts` 와 중복 |

## 열린 항목

없음.

## 닫힌 항목

- **pixel-diff 인터페이스 (2026-10-07 닫음).** 정본은 디스크의 design-qa `pixel-diff.js` 와 CONTRACT §3-1(0.1.1)이다. 필드는 `pass`·`pixelScore`·`mismatchedPixels`·`totalPixels`·`diffImagePath`, 종료 코드는 0 pass / 1 fail / 2 error, 플래그는 `--threshold`·`--out` 뿐이다. `recreate-step.sh` 는 `--out` 만 넘기고 exit 0 과 1 을 모두 "비교됨" 으로 본다. 섹션은 호출자가 잘라서 넘긴다. 한때 검토한 `--crop`·`matchPercent` 사양과 그 폴백은 지웠다.
- 루프 안의 원인 분석·수정 지시는 `visual-comparator` 에이전트, 빌드·수정은 `design-reconstructor` 에이전트가 맡는다(plugin `agents/`). 원본의 그리드 분석 · 이미지 섹셔닝 · 요소 검사 역할은 별도 에이전트가 아니라 이 스킬의 Phase 1–2(자체 스크립트)이자 design-reconstructor 의 하위 단계다. 플러그인이 내보내는 에이전트 다섯 개 외의 이름은 참조하지 않는다.
