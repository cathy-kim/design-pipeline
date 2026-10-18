---
name: design-stitch
description: 파이프라인 UI/UX 단계 — 화면 설계를 Google Stitch MCP 로 한다. 현재 앱·브랜드 근거와 실제 Stitch project/screen/design system 을 확인하고, 목표·IA·여정·상태·반응형·접근성 매트릭스를 세운 뒤 Stitch 화면을 생성/수정하고, 실제 이미지를 내려받아 비교하고, revision 단위 명시적 승인에서 멈춘다. 모드 audit(읽기 전용) · propose(기본, 1방향) · refine(선택한 화면만) · handoff(승인된 revision 의 문서만, 생성 없음). 제품 코드는 바꾸지 않는다 — 구현은 승인 뒤 별도 요청으로 design-ui 가 한다. Use when - UIUX 개편, 화면 설계, 리디자인, 와이어프레임, 사용자 여정, 시안, Stitch, stitch 프로젝트, UX 감사, 화면 리뷰, design review, UX audit, redesign, screen mockup. NOT for - 승인된 디자인의 코드 구현(design-ui), 참조 픽셀 재현·SNS·상세페이지 분해(design-recreate), 카드뉴스·로고·이미지 에셋(design-assets), 토큰 추출(design-tokens)
---

# design-stitch — Stitch UI/UX 단계

## ① 역할

화면을 **Stitch 에서** 설계하고, revision 단위로 **명시적 승인**을 받은 디자인만 구현 쪽(design-ui)에 문서로 넘긴다.
이 스킬은 제품 코드를 한 줄도 바꾸지 않는다. 도구 이름·인자·ID 규칙은 [references/stitch-tool-map.md](references/stitch-tool-map.md) — 호출 예시를 쓰기 전에 반드시 읽는다.

## ② 입력

| 경로 | 필수 | 쓰임 |
|---|:-:|---|
| `mode=` | 선택 | `audit` · `propose`(기본) · `refine` · `handoff`. 라우터가 넘긴다 |
| 대상 앱 | 선택 | 기존 라우트·컴포넌트·토큰 파일, 실행 URL. 있으면 G1 근거 필수 |
| `.design/brand_config.json` · `.design/system/` | 선택 | 있으면 Stitch 프롬프트의 색·타입·radius 정본. 없으면 대상 앱 토큰 |
| `.design/brief.md` | 선택 | 화면 목록·상태. 없으면 G2 에서 짧게 만든다 |
| `project=` / `screens=` | 선택 | 사용자가 지목한 Stitch project id, source screen id 들 |
| `.design/stitch/session.json` | refine·handoff 필수 | 이전 revision·승인 기록 |

## ③ 출력 (`.design/stitch/`)

| 파일 | 내용 |
|---|---|
| `session.json` | project·design system·screen ID(source/instance 구분), `revision`, 쓰기 기록, 이미지 근거, 승인 상태 — 형식은 [references/acceptance-checklist.md](references/acceptance-checklist.md) §session.json |
| `ux-frame.md` | 목표·IA·여정·상태×뷰포트 매트릭스·접근성 기준·이어받은 결정 |
| `r<rev>/<sourceScreenId>.png` | `get_screen` 이 돌려준 `screenshot.downloadUrl` 에서 받은 실제 이미지 |
| `report.md` | AS-IS↔TO-BE, changelog, 커버리지, 승인 상태, Stitch 링크 |
| `handoff.md` | **handoff 모드만.** 승인된 revision 의 화면별 컴포넌트·상태·토큰·수용 기준 |

## ④ 절차

### Phase 0 — 모드 먼저 (아래 게이트보다 우선)

모드는 게이트 순서보다 먼저 정한다. 모드가 허용하지 않는 게이트는 **건너뛰는 것이 아니라 호출 자체가 금지**다.

| 모드 | 실행하는 게이트 | 쓰기 |
|---|---|---|
| `audit` | G1 → G2 → 보고 | **0건.** Stitch 읽기 도구만, repo 는 읽기만 |
| `propose` (기본) | G1 → G2 → G3 → G4 → G5 | Stitch 생성 1방향 |
| `refine` | G1(재확인) → G3(지목된 화면만) → G4 → G5 | `edit_screens` / `generate_variants`, 사용자가 고른 source screen 만 |
| `handoff` | 승인 검사 → G6 | **Stitch 쓰기 0건.** `generate_*`·`edit_screens` 호출 금지. 문서만 |

- 모드가 없으면 `propose`. 요청이 평가·질문뿐이면 `audit`.
- `refine` 은 사용자가 화면(스크린샷·이름·ID)을 명시해야 한다. 고른 화면이 없으면 묻는다 — 추측해서 고치지 않는다.
- `handoff` 는 시작 전에 검사한다. exit 0 이 아니면 G6 를 하지 않고 이유를 보고한다.
  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/skills/design-stitch/scripts/check-stitch.mjs" .design/stitch/session.json --gate handoff
  ```
- 구현(design-ui)은 이 스킬의 모드가 아니다. 승인 뒤 사용자가 **따로** 구현을 요청할 때 라우터가 부른다.

### G1 Evidence — 근거와 실제 ID

1. 대상 앱: 관련 라우트·컴포넌트·토큰 파일 경로, 실행 화면 캡처(있으면). 기존 브랜드·화면은 근거 없이 다시 디자인하지 않는다 — 바꾸는 이유를 G2 에 적는다.
2. Stitch: `list_projects` → `get_project` → `list_screens` → `list_design_systems`. 지목된 project 가 없으면 목록을 보이고 고르게 한다. 특정 프로젝트를 기본값으로 쓰지 않는다.
3. ID 두 종류(source screen ID / screen instance ID)를 `session.json` 에 따로 적는다. 추측한 ID 로 쓰기 도구를 부르지 않는다.

### G2 UX frame

목표 1–3개, IA, 핵심 여정, 화면별 상태(empty · loading · error · ready · permission-denied), 반응형(390 · 768 · 1440 중 해당 폭), 접근성(키보드 순서 · focus · 대비 AA) 을 `ux-frame.md` 표로 확정한다.
이전 대화·`.design/` 문서의 결정은 이어받고 다시 묻지 않는다. 질문은 진행이 막히는 것만, 한 번에 하나.

### G3 Stitch 생성/수정 (`audit`·`handoff` 는 오지 않는다)

- 한 번에 한 쓰기, G1 에서 확인한 ID 로만. 성공한 쓰기마다 `revision` 을 1 올리고 `writes[]` 에 기록한다.
- 기본은 **강한 1방향**. variants 는 의미 있는 trade-off 가 있거나 사용자가 요청할 때만(`variantCount` 2–3), 이유를 적는다.
- 프롬프트에는 화면 목적·상태·토큰 이름/값만. 비밀값·개인정보·실제 고객 데이터 금지.
- **timeout·연결 오류면 같은 쓰기를 다시 보내지 않는다.** tool map §Timeout 대로 `list_screens`/`get_project` 로 대조한 뒤에만 다음 결정을 한다. 대조 전에는 승인·handoff·다음 쓰기 모두 금지.
- 도구가 세션에 없으면 같은 백엔드 CLI 릴레이로 폴백한다(tool map §CLI). 둘 다 안 되면 막혔다고 보고한다 — 손으로 만든 HTML 을 Stitch 결과로 내놓지 않는다.

### G4 이미지 근거와 비교

- 각 화면을 `get_screen` 으로 다시 읽고, 돌려받은 `screenshot.downloadUrl` 만 내려받아 `r<rev>/` 에 저장한다(readback). URL 을 조립하지 않는다.
- AS-IS(현재 앱) ↔ TO-BE 비교, changelog, 상태×뷰포트 커버리지를 `report.md` 에 적는다. 이미지로 확인 안 된 상태는 `missing` 으로 남긴다.
- 스크린샷은 **시각 근거일 뿐**이다. 키보드·focus·로딩 전환 같은 인터랙션은 `visual only` 로 표기하고, 실제 조작 검증(E2E)은 구현 뒤 design-qa 의 몫이다.
- `htmlCode.downloadUrl` 을 보여 줄 때는 "Stitch 파생 프로토타입 — 프로덕션 구현 아님" 이라고 붙인다.

### G5 승인 (revision 단위)

Stitch 링크·이미지·근거를 보이고 상태를 기록한다: `pending` | `approved` | `changes-requested`.
- `approved` 는 사용자의 명시적 발화("승인", "이걸로 진행")를 그대로 인용하고, 그 시점의 `revision` 과 화면 ID 를 묶는다. 이후 쓰기가 한 건이라도 있으면 그 승인은 무효다.
- 디자인 승인은 **구현 지시도, 공개·발행 승인도 아니다.** 어느 것도 추론하지 않는다.

### G6 Handoff (`handoff` 모드에서만)

`check-stitch.mjs --gate handoff` 가 exit 0 일 때 `handoff.md` 를 쓴다: 화면별 source screen ID · 이미지 경로 · 컴포넌트 · 상태 · 토큰 · 수용 기준 · 범위 밖 항목. 코드·티켓 생성·Stitch 쓰기는 없다.

## ⑤ 스크립트

| 스크립트 | 용도 |
|---|---|
| `node ${CLAUDE_PLUGIN_ROOT}/skills/design-stitch/scripts/check-stitch.mjs <session.json> --gate <audit\|handoff\|implement>` | 게이트 판정. exit 0 통과 · 1 미달(이유 출력) · 2 입력 오류. `implement` 는 handoff 조건 + `handoff.md` 존재 |
| `node ${CLAUDE_PLUGIN_ROOT}/skills/design-stitch/scripts/schema-drift.mjs <tools.json>` | 실제 `--list-tools` 출력과 `references/stitch-tools.snapshot.json` 비교(이름·readOnly·required). 0 일치 · 1 차이 |
| `node --test ${CLAUDE_PLUGIN_ROOT}/skills/design-stitch/scripts/test/contract.test.mjs` | **정적** 계약 테스트. 실제 Stitch 호출 없음 |

## ⑥ 완료 조건

| 모드 | 조건 | 확인 |
|---|---|---|
| audit | `writes` 0건, `ux-frame.md`·`report.md` 존재 | `check-stitch.mjs --gate audit` exit 0 |
| propose·refine | 쓰기마다 결과 기록, 화면마다 `r<rev>/` 실제 이미지, 승인 상태 기록 | [acceptance-checklist.md](references/acceptance-checklist.md) G1–G5 |
| handoff | 승인 revision = 현재 revision, `handoff.md` 존재 | `check-stitch.mjs --gate implement` exit 0 |

보고에는 실제 Stitch 링크(`https://stitch.withgoogle.com/projects/<id>`)와 이미지 경로만 적는다. 확인하지 않은 링크·ID 는 쓰지 않는다.

## ⑦ 다음 단계

- `pending`/`changes-requested` → 사용자 피드백으로 `refine`.
- `approved` → 사용자가 원하면 `handoff`. 구현은 사용자가 **별도로** 요청할 때만 라우터가 `design-ui`(Phase 0 Stitch 게이트) → `design-qa` 로 간다.
