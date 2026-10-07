# agents/

design-pipeline 스킬이 실행을 맡기는 서브에이전트 다섯 개. 각 파일은 YAML 프론트매터(`name`, `description`, `tools`, `model`)를 갖고, `.design/` 핸드오프 버스(CONTRACT §3)만 읽고 쓴다.

| 에이전트 | 위임하는 스킬 | 모델 | 이유 |
|---|---|---|---|
| `design-token-extractor` | `design-tokens` | sonnet | computed style 집계와 의미 역할 배정에 판단이 필요하지만 설계 수준은 아니다. 출력은 `brand_config.draft.json` + `tokens-report.md` |
| `design-reconstructor` | `design-recreate` | opus | 그리드 분석·이미지 섹셔닝·요소 검사, 그리드 섹셔닝, Depth Layer 분해, 레이어별 빌드, 재귀 수정까지 긴 루프와 공간 추론이 필요하다 |
| `visual-comparator` | `design-qa` (픽셀 레이어 판정) | sonnet | 픽셀 diff 는 `pixel-diff.js` 가 하고, 에이전트는 diff 이미지를 보고 원인과 수정 지시를 쓴다. 비전 판단이 필요해 haiku 는 부족하다. design-recreate 루프의 판정은 이 에이전트가 아니라 `recreate-step.sh` 가 `pixel-diff.js` 를 직접 불러 낸다 |
| `e2e-tester` | `design-qa` | haiku | 정해진 뷰포트·상태·axe 시나리오를 반복 실행하는 기계적 작업이다. 판단보다 실행량이 많다 |
| `layout-designer` | `design-ui` | sonnet | 브리프와 시스템 인벤토리 안에서 화면을 조합한다. 새 토큰을 만들지 않으므로 opus 까지는 필요 없다 |

## 원본 출처 (흡수 매핑)

| 에이전트 | 합친 원본 (`claude-workspace-meta/.claude/`) |
|---|---|
| `design-token-extractor` | `agents/design-token-extractor.md`, `skills/design-system-extractor/agents/token-extractor.md` |
| `design-reconstructor` | `agents/design-reconstructor.md`, `skills/antigravity/agents/{grid-analyzer,image-sectioner,element-inspector}.md`, design-workflow D1~D3 의 Depth Layer 규칙 |
| `visual-comparator` | `agents/visual-comparator.md`, `skills/antigravity/agents/visual-verifier.md` |
| `e2e-tester` | `agents/e2e-tester.md` (반응형·재시도 루프) |
| `layout-designer` | `agents/layout-designer.md` (피드백 반복), `agents/ui-designer.md` 의 생성·검증 부분 (질문 흐름은 `design-brief` 로 감) |

## 공통 규칙

- 스크립트는 소유 스킬의 것만 `${CLAUDE_PLUGIN_ROOT}/skills/<owner>/scripts/...` 로 부른다. 에이전트가 같은 기능을 다시 구현하지 않는다.
- 판정(visual-comparator, e2e-tester)과 수정(design-reconstructor, layout-designer)은 다른 에이전트가 한다.
- 브랜드 이름·색·폰트를 본문에 하드코딩하지 않는다. 값은 `.design/brand_config.json` 과 `.design/system/` 에서 읽는다.
