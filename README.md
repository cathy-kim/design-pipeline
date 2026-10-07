# design-pipeline

**English summary.** `design-pipeline` is a Claude Code plugin that turns a design request into shipped UI through a fixed, file-based pipeline: **brand_config → design system → UI → assets → QA**. A router skill (`/design`) classifies the request (from scratch, inspired, recreation, modification, extraction, deconstruct/SNS, assets-only, design-system-only) and calls seven stage skills in order, checking a `.design/` handoff directory between stages. Brands are data, not code: add a brand by dropping one JSON file into `brands/`. UI code is only generated after the design system has been fixed in code, and `design-qa` mechanically enforces the workspace design rules (3 colors per screen, closed radius scale, no pill buttons / neon glow / glassmorphism / gradient borders).

---

## 무엇인가

디자인 요청 하나를 **브랜드 설정 → 디자인 시스템 → UI → 에셋 → QA** 순서로 처리하는 Claude Code 플러그인이다.

- `/design` 라우터가 요청 유형을 분류하고 단계 스킬을 정해진 순서로 부른다.
- 단계 사이 전달은 작업 프로젝트의 `.design/` 디렉터리로만 한다. 대화 기억에 의존하지 않는다.
- 브랜드 이름·색·폰트는 스킬 본문에 없다. 전부 `brand_config` JSON 에서 읽는다.
- UI 코드는 디자인 시스템이 코드로 고정된 뒤에만 만든다.

설계 원칙과 단계 간 계약의 정본은 [CONTRACT.md](CONTRACT.md) 다. 이 README 와 어긋나면 CONTRACT 가 이긴다.

## 단계

| # | 스킬 | 하는 일 | 출력 (`.design/` 기준) |
|---|---|---|---|
| 0 | `design` | 요청 분류, 단계 호출 순서, 핸드오프 검사 | 실행 계획 |
| 1 | `design-brief` | 요구사항 질문, 화면 목록, 브랜드 없을 때 팔레트·타이포 결정 | `brief.md` |
| 2 | `design-tokens` | URL·이미지·브랜드 가이드에서 토큰 추출 | `brand_config.draft.json`, `tokens-report.md` |
| 3 | `design-system` | 토큰을 코드로 변환, 컴포넌트 프리미티브, 가드 테스트 | `system/` |
| 4 | `design-ui` | 화면·컴포넌트 코드 생성 (component · page · landing-next · artifact) | 프로젝트 코드 |
| 5 | `design-recreate` | 참조 재현, 레이어 분해, 자기 수정 루프 | 재현 코드, `recreate-report.md` |
| 6 | `design-assets` | Gemini 이미지, 카드뉴스·광고·로고·모션 | `assets/` |
| 7 | `design-qa` | 정적 토큰 감사, Playwright 검사, 픽셀 diff, 15항목 체크리스트 | `qa/report.md` |

요청 유형별 호출 순서는 CONTRACT §4 의 표를 따른다.

## 설치 (팀원용)

Claude Code 안에서 실행한다.

```
/plugin marketplace add cathy-kim/design-pipeline
/plugin install design-pipeline@design-pipeline
```

이 리포는 **private** 이다. 설치 전에 두 가지가 필요하다.

1. `cathy-kim/design-pipeline` 리포에 대한 GitHub 읽기 권한. 리포 관리자에게 초대를 요청한다.
2. 로컬 `gh` CLI 인증. 아래 명령으로 로그인해 두면 marketplace 가 private 리포를 가져올 수 있다.

```bash
gh auth login
gh auth status   # github.com 계정이 Logged in 으로 보여야 한다
```

설치 뒤 `/design` 으로 시작한다.

```
/design acme 브랜드로 가격 페이지 만들어줘
/design 독서 모임 앱 대시보드 UI 만들어줘
/design https://example.com 이거 똑같이 만들어줘
```

## 브랜드 추가하기

브랜드 하나는 JSON 파일 하나다. 코드 수정은 필요 없다.

1. 템플릿을 복사한다.
   ```bash
   cp brands/_template.json brands/acme.json
   ```
2. `brand.id` 를 파일명과 같게(`acme`) 맞추고 `tokens`, `typography`, `radius.scale` 등을 채운다. 스키마는 CONTRACT §5 에 있다.
3. 로고·폰트·참조 이미지 같은 에셋 파일은 `brands/acme/` 폴더에 두고, JSON 의 `assets.*` 에서 상대경로로 가리킨다.
4. `radius.scale` 은 닫힌 스케일이다. 이름과 값이 어긋나면 design-system 의 가드 테스트가 실패한다.
5. `scripts/validate.sh` 로 JSON 유효성을 확인한다.

사용할 때는 요청에 브랜드 id 를 적는다. 라우터가 `brands/<id>.json` 을 작업 프로젝트의 `.design/brand_config.json` 으로 복사한다.

브랜드 JSON 이 없다면 두 길이 있다.
- 참조 URL·이미지·브랜드 가이드 PDF 가 있으면 design-tokens 가 `brand_config.draft.json` 을 만든다. 확인 후 승격한다.
- 아무것도 없으면 design-brief 가 팔레트·타이포를 결정하고, design-system 이 그 결정을 `brand_config.json` 으로 승격한다.

## 환경변수

| 변수 | 쓰는 곳 | 필수 여부 |
|---|---|---|
| `GEMINI_API_KEY` | design-assets 의 이미지 생성, Gemini 기반 이미지 분석 | 해당 단계를 쓸 때만 |

그 밖의 키·경로는 하드코딩하지 않는다. 비밀값은 셸 환경변수로만 넘기고 `.env` 파일은 리포에 넣지 않는다.

```bash
export GEMINI_API_KEY=...   # 셸 프로필 또는 비밀 관리 도구에서 주입
```

## `.design/` 핸드오프 버스

작업 프로젝트 루트에 생긴다. 각 단계는 자기 출력만 쓰고, 앞 단계 출력은 읽기만 한다.

```
.design/
  brief.md                 # 1. 목표·대상·화면 목록·우선순위·톤
  brand_config.json        # 정본 브랜드 설정. 3~7단계의 필수 입력
  brand_config.draft.json  # 2. 추출 결과. 확인 후 brand_config.json 으로 승격
  tokens-report.md         # 2. 추출 근거와 신뢰도
  system/                  # 3. tailwind.config · tokens.css · nativewind theme · primitives · guards
  recreate-report.md       # 5. 섹션별 일치율, 남은 diff
  assets/                  # 6. 생성물 + manifest.json (프롬프트·모델·시드)
  qa/report.md             # 7. PASS/FAIL 항목표
  qa/screenshots/
```

라우터는 단계마다 해당 산출물이 있고 비어 있지 않은지 확인한다. 없으면 그 단계에서 멈추고 어느 단계가 실패했는지 보고한다.
작업 프로젝트에서는 `.design/` 을 `.gitignore` 에 넣을지 팀 규칙으로 정한다. `brand_config.json` 과 `system/` 은 커밋하는 편이 재현에 유리하다.

## 검증

플러그인 구조를 바꾼 뒤에는 리포 루트에서 실행한다.

```bash
bash scripts/validate.sh
```

검사 항목은 다음과 같다.
- `.claude-plugin/plugin.json` 이 가리키는 스킬·에이전트 파일이 존재한다.
- 각 SKILL.md 프론트매터 `name` 이 디렉터리명과 같고 `description` 이 있다.
- SKILL.md 안의 `references/` · `scripts/` 상대경로와 `${CLAUDE_PLUGIN_ROOT}/...` 경로가 실제로 존재한다.
- `brands/*.json` 이 유효한 JSON 이다.

마지막 줄이 `validate: PASS` 여야 한다.

## 디자인 규칙

모든 단계가 따르고 design-qa 가 기계적으로 검사한다.

- 한 화면 3색: Primary + Accent + Neutral.
- radius 는 브랜드 토큰의 닫힌 스케일 값만 쓴다.
- pill 버튼, 네온 글로우, 글래스모피즘, 그라디언트 보더 금지.
- 계위는 크기·무게 → 간격 → 명도 순으로 나누고, 색은 마지막 수단이다.

## 원본 스킬 → 새 스킬

이 플러그인은 기존 개인 스킬들을 단계별로 흡수했다. CONTRACT §2 의 매핑이다.

| 원본 | 새 스킬 |
|---|---|
| ui-designer (질문 흐름, 화면 목록) · color-palette-advisor | design-brief |
| design-system-extractor · antigravity Phase 3 · design-workflow 유형 E | design-tokens |
| brand-design-system (토큰·컴포넌트 부분) · theme-factory · 프로젝트 전용 브랜드 스킬 2개(모바일 디자인 시스템·브랜드 토큰 스킬 — `brands/<id>.json` 입력으로 외부화, 리포에 미포함) | design-system |
| frontend-design · ui-designer (생성 부분) · web-artifacts-builder · landing-page-creator · design-workflow 유형 C | design-ui |
| antigravity (P1·P2·P4·P5) · design-workflow 유형 A·B·D·F 와 D1~D3 · designclaw (분해·조합 단계) | design-recreate |
| template-visual-generator · brand-design-system (이미지·로고 부분) · designclaw (광고 생성 단계) · web-motion-generator | design-assets |
| screen-qa · design-qa-reviewer · antigravity 5B/5C · design-workflow D4 · designclaw 4.2 | design-qa |
| design-workflow (7유형 분기만) | design |

## 경계

- 웹소설 설계는 이 플러그인 범위가 아니다(`novel-design`).
- 브랜드 아이덴티티 기획(네이밍·철학·전략)은 범위가 아니다(`brand-system`). 이 플러그인은 그 결과가 `brand_config` JSON 으로 정리된 뒤부터 맡는다.
