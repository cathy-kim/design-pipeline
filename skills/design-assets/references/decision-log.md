# Decision Log — design-assets

2026-10-07 · 원본 스킬 통합 시 내린 결정. CONTRACT §1-3 "한 기능은 한 곳에만" 을 지키기 위한 기록이다.

## D1. Gemini 이미지 생성 구현은 하나만 남긴다

원본에는 Gemini 이미지 생성 코드가 세 갈래 있었다.

| 원본 | 방식 | 문제 |
|---|---|---|
| template-visual-generator `generate-mockup.ts` · `generate-slide-assets.ts` · `rebrand-mockup.ts` | `@google/generative-ai` SDK, `gemini-2.0-flash-exp-image-generation` | 프롬프트·출력 경로 하드코딩(특정 브랜드 색, 절대경로), 함수가 파일마다 복제됨 |
| brand-design-system `generate-image.ts` | 같은 SDK·모델, 로고/브랜디드 프롬프트 빌더 포함 | 브랜드 색 상수 하드코딩, `require.main` 이 ESM 패키지에서 동작하지 않음, 문서의 `--config` 옵션이 구현에 없음 |
| designclaw Stage 2 | 셸 3-Tier (gemini CLI → curl REST → placeholder) | 코드가 아닌 문서. URL 쿼리로 키 전달 |

**남긴 것:** brand-design-system `generate-image.ts` 를 뼈대로 삼았다. 이유는 세 가지다. 생성 함수와 프롬프트 빌더가 분리돼 있었다. 구조화된 Role/Task/Requirements/Negative 프롬프트 형식이 가장 완성돼 있었다. 브랜디드 이미지 개념이 이 스킬의 hero/card/ad 모드와 맞았다.
그 위에 아래를 합쳐 `scripts/generate-image.ts` 로 새로 썼다.

- designclaw 의 3-Tier fallback 개념. 단, Tier 를 "모델 1 → 모델 2 → placeholder" 로 재정의했다. 근거는 D2.
- template-visual-generator 의 섹션 프롬프트 템플릿(SUBJECT / COMPOSITION / STYLE / FORBIDDEN, negative space %).
- rebrand-mockup 의 이미지 입력(image-to-image)을 `--ref` 로.
- 브랜드 값은 전부 brand_config 에서 읽는다. 키는 `GEMINI_API_KEY` 하나에서만 읽는다(`GOOGLE_AI_API_KEY` 폴백 제거).

SDK 대신 REST `fetch` 를 쓴다. `@google/generative-ai` 는 지원이 끝난 패키지다. `seed`·`imageConfig.aspectRatio` 같은 새 필드를 타입 우회 없이 보내려면 REST 가 단순하다. 의존성도 0 이 된다.

기본 모델은 `gemini-3-pro-image-preview`(Tier 1)와 `gemini-3.1-flash-image-preview`(Tier 2)다. 원본의 `gemini-2.0-flash-exp-image-generation` 은 실험 모델이라 쓰지 않는다. `assets.imagePromptConfiguration.model / fallbackModel` 로 바꿀 수 있다.

실측(2026-10-07, placeholder 브랜드 acme):

| 시나리오 | 결과 |
|---|---|
| Tier 1, 4:5 요청 | 성공. 928x1152 JPEG 반환. 목표 크기와 달라서 manifest 에 `pixels` 필드를 추가함 |
| Tier 1 모델 강제 실패(404) | Tier 2 로 넘어가 성공. `--ref` 이미지 입력도 동작 |
| 키 없음 | Tier 3 placeholder SVG, 종료 코드 0. `--strict` 면 종료 코드 1 |

## D2. designclaw 의 "Tier 1 = gemini CLI" 는 버렸다

`gemini -p "..." --image` 는 공식 Gemini CLI 의 안정된 이미지 출력 계약이 아니다. 출력 파일 위치와 형식도 보장되지 않는다. 같은 REST 엔드포인트를 모델만 바꿔 두 번 시도하는 편이 재현 가능하다. 결과도 manifest 에 기록할 수 있다.

## D3. HTML 템플릿은 새로 썼다

template-visual-generator 의 `templates/*.html` 은 radius 12~24px 임의값, `box-shadow`, 그라디언트 오버레이, 별점 `#FFD700`, Handlebars 헬퍼(`eq`)를 썼다. CONTRACT §1-2 와 §1-6 에 걸려서 복사하지 않았다.
`templates/` 의 네 파일은 3색 CSS 변수와 닫힌 radius 두 개만 쓴다. compose.ts 의 작은 mustache 부분집합 렌더러로 채운다. 의존성은 없다.
레이아웃과 수치는 원본 template-specs 와 2026-03 SNS 스펙 리서치에서 가져왔다. 커버 88px, 본문 64/36px, 패딩 60/80, 스토리 세이프존 160/480/120 이 그 값이다.

## D4. 이관하지 않은 것

| 항목 | 이유 |
|---|---|
| Phase 5 픽셀 diff (antigravity visual-diff) | design-qa 소유 (CONTRACT §2) |
| Stitch MCP 렌더 경로, `stitch-mcp-guide.md` | 이 플러그인의 MCP 의존 목록에 없음. Puppeteer 하나로 통일 |
| `render-slides.ts`, `rebrand-all.ts`, brand-concept-slide 템플릿, mockups/ | 특정 프로젝트 슬라이드 덱 전용(하드코딩된 파일 목록·브랜드) |
| `generate-infographic.ts` (Chart.js 차트 PNG) | 이 단계 범위(카드·광고·상세·로고·히어로·모션) 밖. 필요하면 별도 모드로 추가 |
| agents/ (content-planner, visual-generator, template-assembler, qa-reviewer) | 플러그인 agents/ 에 없음. 기획은 이 스킬의 Phase 1 에서 직접, QA 는 design-qa |
| brand-design-system `.env` | 실제 키가 들어 있음. 복사 금지 |
| `../logo-generator`, `../philosophy-to-visual`, `generate-veo-motion.ts` 참조 | 대상이 존재하지 않음 |
| web-motion-generator glow · shine · border-beam · particles · MagicUI 효과 | 네온 글로우·그라디언트 보더 금지(§1-6). 대체 효과는 motion-patterns.md §4 |
| web-motion-generator `references/css-keyframes.md` 링크 | 원본에 파일이 없었음 → 이 스킬에서 새로 작성 |
| `branded-motion-generator` (Veo 영상) 라우팅 | 이 플러그인 밖. 영상 요청은 이 스킬 범위가 아님 |
| ui-designer `generate_design` 의 Instagram 카드 호출 | card 모드로 흡수(커버/콘텐츠 카드, 출처 표기 → data 카드 `source`) |

## D5. 렌더러

Puppeteer 를 쓴다. 번들 Chrome 이 실행되지 않는 환경이 있다. postinstall 이 막혔거나 아키텍처가 맞지 않는 경우로, `spawn Unknown system error -88` 이 난다. 그때는 `PUPPETEER_EXECUTABLE_PATH` 로 시스템 Chrome 을 지정한다. Puppeteer 가 직접 읽는 환경변수라 코드 변경이 없다.
