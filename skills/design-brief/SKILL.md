---
name: design-brief
description: "디자인 파이프라인 1단계. 요청을 최대 3라운드 질문으로 구체화해 목표·대상·화면 목록(P0/P1/P2)·톤·제약을 .design/brief.md 로 고정하고, 브랜드(brand_config)가 없을 때만 팔레트(Sector×Positioning×Mood×Philosophy 3축)와 타이포 방향을 결정해 brand_config 토큰 키 그대로 적는다. Use when - 디자인 브리프, 요구사항 정리, 화면 목록, 화면 설계 전에, 무엇을 만들지 정리, 디자인 질문, 컬러 팔레트 정해줘, 브랜드 컬러 없음, 색 조합 추천, 타이포 방향, design brief, requirements, screen inventory, clarify design request, pick a palette, brand colors from scratch. NOT for - 참조 URL/이미지/가이드 PDF 에서 토큰 추출(design-tokens), brand_config 를 코드 토큰·컴포넌트로 변환(design-system), 화면·컴포넌트 코드 생성(design-ui), 이미 brand_config 가 있는데 색만 다시 뽑기(브랜드 수정은 design-tokens 또는 brands/<id>.json 편집)."
---

# design-brief

① **역할:** 디자인 요청을 질문으로 구체화해 `.design/brief.md` 한 파일로 고정한다. 브랜드가 없으면 팔레트와 타이포 방향도 여기서 결정한다. 코드는 만들지 않는다.

## ② 입력

| 구분 | 입력 | 위치 |
|---|---|---|
| 필수 | 사용자 요청(자연어) | 대화 |
| 선택 | 기존 브랜드 설정 | `.design/brand_config.json` — 있으면 팔레트 결정을 건너뛴다 |
| 선택 | 추출된 토큰 초안 | `.design/brand_config.draft.json`, `.design/tokens-report.md` (Inspired 흐름에서 design-tokens 가 먼저 돈 경우) — 톤·제약 근거로 읽기만 한다 |
| 선택 | 참조 URL/이미지 | 대화 또는 프로젝트 경로 — 브리프의 `참조` 칸에 기록만 한다. 토큰 추출은 하지 않는다 |
| 선택 | 기존 brief | `.design/brief.md` — 있으면 갱신 모드(§④ Phase 0) |

앞 단계 산출물은 **읽기만** 한다. 이 스킬이 쓰는 파일은 `.design/brief.md` 하나뿐이다.

## ③ 출력

- `.design/brief.md` — 템플릿 [references/brief-template.md](references/brief-template.md) 의 절 구조 그대로.
  - §1 목표 · §2 대상 사용자 · §3 화면 목록과 우선순위 · §4 톤 · §5 콘텐츠 · §6 제약 · §7 가정과 미결 · §8 팔레트·타이포 결정
  - §8 은 `brand_config.json` 이 없을 때만 언어 태그 `json brand-decision` 인 fenced 블록 하나를 담는다. 키는 brand_config 점 경로 `brand.id`, `brand.name`, `brand.mood`, `brand.philosophy`, `tokens.colors`(primary·accent·neutral·semantic), `tokens.typography`(families·scale·weights·lineHeights)이고 값의 모양은 `brands/_template.json` 과 같다. design-system 의 `--promote-brief` 가 이 블록을 경로별로 대입해 `brand_config.json` 을 만든다.
  - radius·spacing·roles·components 는 brief 가 정하지 않는다(design-system 소유).
  - 브랜드가 있으면 §8 은 `브랜드 있음: .design/brand_config.json (brand.id = …)` 한 줄이다.

`brand_config.json` 자체는 쓰지 않는다. 승격은 design-system(또는 라우터)의 몫이다.

## ④ 절차

### Phase 0 — 상태 확인

1. 프로젝트 루트에 `.design/` 이 없으면 만든다.
2. `.design/brand_config.json` 존재 여부로 **브랜드 분기**를 정한다: 있음 → `BRAND=existing`, 없음 → `BRAND=none`.
3. `.design/brief.md` 가 이미 있으면 **갱신 모드**: 기존 내용을 읽고, 바뀐 요구만 질문한다. 절 구조는 유지하고 바뀐 칸만 고친다. §7 에 "갱신: {날짜} {무엇}" 행을 추가한다.
4. `.design/brand_config.draft.json` 이 있으면 읽어 톤·색 단서로 쓴다. draft 는 아직 정본이 아니므로 `BRAND` 판정에는 쓰지 않는다. 단 draft 가 있는데 `BRAND=none` 이면, 팔레트를 새로 만들지 말고 §8 에 "draft 승격 대기: .design/brand_config.draft.json" 이라고 쓰고 Phase 4 를 건너뛴다(색 결정 주체가 둘이 되지 않도록).

### Phase 1 — 요청 분석

요청문·참조·리포에서 아래 필드를 채운다. 추론한 값은 §7 가정 표 후보로 적어 둔다.

| 필드 | 값 |
|---|---|
| `design_type` | landing_page · dashboard · form · list · detail · profile · product_page · sns_card |
| `platform` | web · mobile-rn · print (SNS 캔버스는 print 아닌 web + 고정 캔버스로 본다) |
| `purpose` | 핵심 목적·전환 목표 |
| `content` | 반드시 들어갈 요소 |
| `audience` | 주 사용자·맥락 |
| `tone` | 분위기 단어 |
| `constraints` | 스택·다국어·기한·접근성 |

필드 우선순위(P1 → P3)와 "묻지 말고 가정할 것" 기준은 [references/question-bank.md](references/question-bank.md) §2.

### Phase 2 — 구체화 질문 (최대 3라운드)

- **도구:** AskUserQuestion 이 있으면 라운드마다 한 번 호출(문항 ≤3, 문항당 선택지 2~4). 없으면 번호 목록 산문으로 같은 문항을 낸다. 형식 예시는 question-bank §4.
- **라운드 구성:**
  - R1 — P1 공백(purpose · content · platform).
  - R2 — P2(audience · tone) + Phase 3 의 화면 목록 초안 확인("빠진 화면/뺄 화면, P0 맞나요?").
  - R3 — `BRAND=none` 이면 팔레트 3축(Sector · Positioning · Mood/Philosophy). `BRAND=existing` 이면 남은 제약.
- 요청이 이미 충분하면 질문 없이 요약 확인 한 번으로 끝낸다.
- 3라운드 뒤에도 빈 칸은 **가정으로 채우고** §7 에 근거와 함께 적는다. 4번째 라운드는 열지 않는다.
- 유형별 핵심 질문과 문구는 question-bank §5~§7.
- 자율 실행(사용자가 응답할 수 없는 맥락)이면 질문 대신 전부 가정으로 채우고 §7 의 확정 여부를 `가정` 으로 둔다.

### Phase 3 — 화면 목록과 우선순위

1. `purpose` 를 이루는 최소 사용자 흐름을 적는다(예: 진입 → 확인 → 행동).
2. 흐름의 각 단계를 화면(또는 SNS 카드 한 장)으로 쪼개 `S1, S2, …` ID 를 붙인다.
3. 우선순위를 매긴다.
   - **P0** — 없으면 목표 달성 불가. 1~3개.
   - **P1** — 목표 흐름에 필요하지만 P0 다음.
   - **P2** — 있으면 좋음. 이번 범위에서 빠질 수 있음.
4. 화면마다 목적 한 줄, 핵심 요소 3~6개, 필요한 상태(default · loading · empty · error · success 중 해당)를 적는다.
5. P0 가 3개를 넘으면 R2 에서 범위를 다시 묻는다(질문 라운드가 남았을 때). 남지 않았으면 목표에 가장 가까운 3개만 P0 로 두고 나머지를 P1 로 내린 뒤 §7 에 기록한다.

### Phase 4 — 팔레트·타이포 결정 (`BRAND=none` 일 때만)

`BRAND=existing` 이면 이 Phase 를 건너뛴다. 기존 브랜드의 색·폰트를 다시 정하지 않는다.

1. **3축 확정.** Sector(+Sub-position) · Positioning · Mood(1~3) × Philosophy(1). 값 목록과 각 조합의 범위는
   [references/sector-mapping.md](references/sector-mapping.md) 와 [references/mood-philosophy-mapping.md](references/mood-philosophy-mapping.md).
2. **온도 해소.** Mood > Philosophy > Sector 순으로 이긴다. 금지 조합(SR-11)은 [references/sophistication-rules.md](references/sophistication-rules.md) 표로 걸러낸다.
3. **3역할로 접기.** Base→`neutral`(hue·chroma 만 정함), Support→`primary`, Accent→`accent`. 4번째 이상 색은 버린다(CONTRACT §1-6 한 화면 3색). 규칙: [references/palette-to-tokens.md](references/palette-to-tokens.md) §1~§2.
4. **타이포 방향.** Mood/Philosophy 로 `families`, 화면 성격(밀도)으로 `ratio`·`base`, 그리고 `weights`, `lineHeights` 를 정한다. 역할 이름 스케일(display … button-md)은 스크립트가 펼친다. 표: palette-to-tokens §3.
5. **brand.id·name.** 프로젝트·서비스 이름에서 정한다(id 는 kebab-case). R1~R3 답이나 리포에서 알 수 없으면 `project` 로 두고 §7 에 가정으로 적는다.
6. **확정·검증.** 입력 JSON 을 작업 임시 파일로 쓰고 스크립트를 돌린다(§⑤). exit 1 이면 sophistication-rules 의 "오류 자동 교정 가이드" 대로 OKLCH 값을 고쳐 재실행한다. 최대 3회. 그래도 FAIL 이면 남은 FAIL 행과 원인을 §7 미결에 적고 사용자에게 보고한다(가짜 PASS 금지).
7. **기록.** 스크립트 출력의 `brand_decision` 을 §8 의 `json brand-decision` 블록에 **수정 없이** 붙이고, `checks` 를 근거 표로, `warnings`(감마 클리핑 등)는 표 아래에 옮긴다.

### Phase 5 — brief.md 작성과 확인

1. 템플릿대로 `.design/brief.md` 를 쓴다. 절 제목·순서와 `json brand-decision` 태그를 바꾸지 않는다.
2. 완료 검사 스크립트를 돌린다(§⑤). FAIL 이면 고친다.
3. 사용자에게 요약을 보여준다: P0 화면, 톤, (브랜드 없음이면) primary/accent/neutral HEX 와 폰트. 수정 요청이 오면 갱신 모드로 반영한다.

## ⑤ 스크립트 호출

Node 18+ 만 필요하다(의존성 없음).

팔레트 확정·검증 (Phase 4):

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/design-brief/scripts/palette-decide.mjs" /path/to/palette-input.json
# exit 0 = FAIL 없음 · 1 = 규칙 FAIL 있음 · 2 = 입력 형식 오류
```

입력 JSON 형식과 각 키의 뜻은 palette-to-tokens §4. 출력은 `brand_decision`(brief 에 그대로 붙일 JSON), `oklch`(감마 보정 후 값), `checks`(SR-01·02·03·04·05·07·09·10 PASS/WARN/FAIL), `warnings`.

brief 완료 검사 (Phase 5):

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/design-brief/scripts/check-brief.mjs" <project-root>
# PASS: ... 또는 FAIL: <사유> 줄들 · exit 0/1
```

검사 내용: 8개 절의 존재와 순서, 화면 표의 `S<n>` 행과 P0 개수(1~3), 브랜드 분기와 §8 의 일치, `brand-decision` 블록의 점 경로 키·HEX 형식·foreground, 3색 초과 색 역할 없음, 기본 컴포넌트가 쓰는 `body-md`·`button-md`·`caption` 스케일 존재, radius 미포함, 근거 표에 FAIL 행 없음.

## ⑥ 완료 조건

모두 파일과 명령 결과로 확인한다.

1. `.design/brief.md` 가 존재한다.
2. `check-brief.mjs <project-root>` 가 `PASS` 를 출력하고 exit 0 이다.
3. `BRAND=none` 이면: §8 `brand-decision` 블록이 `palette-decide.mjs` 의 마지막 실행 출력 `brand_decision` 과 동일하고, 그 실행이 exit 0 이다.
4. `BRAND=existing` 이면: `.design/brand_config.json` 이 이 단계 전후로 바뀌지 않았다(이 스킬은 쓰지 않는다).
5. 질문 라운드가 3을 넘지 않았다(brief 머리말의 `질문 라운드 n/3`).

## ⑦ 다음 단계

| 상황 | 다음 |
|---|---|
| `BRAND=existing` | `design-system` → `design-ui` (brief.md 의 P0 화면부터) → `design-qa` |
| `BRAND=none`, 결정 블록 있음 | `design-system` 이 `--promote-brief .design/brief.md` 로 `brand_config.json` 을 만든다 → `design-ui` → `design-qa` |
| `BRAND=none`, draft 승격 대기 | 라우터 또는 사용자가 `brand_config.draft.json` 을 `brand_config.json` 으로 승격 → `design-system` |
| 참조를 "똑같이" 만들고 싶다는 답이 나옴 | brief 는 그대로 두고 라우터에 Recreation 흐름(`design-tokens` → `design-recreate`)을 권한다 |
| 산출물이 에셋(카드뉴스·광고·로고)뿐 | `design-assets` (brand_config 필요. 없으면 위 승격 먼저) |

UI 코드는 `design-system` 의 `system/` 이 생긴 뒤에만 만든다(CONTRACT §1-1). brief 에서 바로 `design-ui` 로 넘기지 않는다.
