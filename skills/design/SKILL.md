---
name: design
description: UI/UX 디자인 파이프라인 라우터. 자연어 디자인 요청을 9개 유형(From Scratch 브랜드 유/무, Inspired, Recreation, Modification, Extraction, Deconstruct/SNS Template, Assets only, Design system only)으로 분류하고, design-brief · design-tokens · design-system · design-ui · design-recreate · design-assets · design-qa 를 정해진 순서로 호출하며, 단계 사이마다 `.design/` 핸드오프 산출물을 확인한다. 설계는 직접 하지 않는다. Use when - 디자인, 디자인 만들어줘, UI 만들어줘, 이거 똑같이, 스타일 참고해서, 디자인 수정, 토큰 추출, 이미지 분해, SNS 템플릿, 카드뉴스, 디자인 시스템, design, ui, ux, landing, dashboard, component, recreate, extract tokens. NOT for - 웹소설 설계(novel-design), 브랜드 아이덴티티 기획(brand-system)
---

# design — 파이프라인 라우터

## ① 역할

요청을 **분류**하고, 단계 **순서**를 정하고, 각 단계를 `Skill` 로 **호출**하고, 단계 사이 **핸드오프를 검증**한다.
라우터는 팔레트를 고르지 않고, 토큰을 뽑지 않고, 코드를 쓰지 않는다. 그 일은 전부 단계 스킬의 몫이다(계약 §2).
"브리프 → UI" 처럼 디자인 시스템을 건너뛰는 경로는 만들지 않는다(계약 §1-1).

## ② 입력 감지

요청 문자열과 첨부를 아래 순서로 본다. 여러 개가 겹치면 전부 기록한다.

| 신호 | 판별 | 기록 |
|---|---|---|
| URL | `http(s)://` 로 시작하는 토큰 | `ref.url` |
| 이미지 | `.png` `.jpg` `.jpeg` `.webp` `.gif` 경로, 또는 대화에 첨부된 이미지 | `ref.image` |
| 브랜드 가이드 | `.pdf` `.ai` 경로 + "가이드/브랜드북/BI" 언급 | `ref.guide` |
| 기존 코드 | 존재하는 디렉터리·`.tsx` `.jsx` `.html` `.css` `.vue` 경로, 또는 "이 화면/이 컴포넌트 고쳐줘" | `target.code` |
| 텍스트만 | 위 어느 것도 없음 | `ref = none` |

SNS 판별(Deconstruct 보다 먼저): 이미지가 Twitter/X·Instagram·LinkedIn·Facebook·Threads 의 표준 UI 크롬(아바타 + 유저네임 + 본문 + 인게이지먼트 바)을 담고 있으면 `sns = true`.
Deconstruct 판별: 이미지가 상세페이지·광고 배너처럼 배경 + 사진 + 텍스트 + 효과의 다층 템플릿이고, SNS UI 가 아니면 `deconstruct = true`.

### 브랜드 있음? (위에서부터 첫 일치)

1. 작업 프로젝트에 `.design/brand_config.json` 이 있고 비어 있지 않다 → **브랜드 있음**.
2. 사용자가 브랜드 id 를 말했고(예: "acme 로", "브랜드 acme") `${CLAUDE_PLUGIN_ROOT}/brands/` 에 `<id>.json` 이 있다 → `.design/` 을 만들고 그 파일을 `.design/brand_config.json` 으로 복사한다 → **브랜드 있음**.
   ```bash
   mkdir -p .design && cp "${CLAUDE_PLUGIN_ROOT}/brands/<id>.json" .design/brand_config.json
   ```
   `_template.json` 은 브랜드가 아니다. 일치 후보를 고를 때 제외한다. 이름이 없으면 그 폴더의 `*.json` 목록을 보여 주고 묻는다(⑤).
3. 그 외 → **브랜드 없음**.

## ③ 결정표 (계약 §4 원문)

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

괄호 단계는 조건부다. Inspired 의 (brief) 는 화면 목록이 요청에 없을 때, Deconstruct 의 (assets) 는 생성 이미지(아바타·배경·제품컷)가 필요할 때, Design system only 의 (tokens) 는 참조 URL/이미지/가이드가 있을 때 넣는다.

### 행별 호출 시퀀스

호출 이름은 플러그인 네임스페이스 `design-pipeline:<stage>` 를 쓴다. 같은 이름의 다른 스킬이 없으면 `design-brief` 처럼 bare 이름도 된다. `args` 에는 원 요청과 ②에서 감지한 값을 그대로 넘긴다.

**From Scratch · 브랜드 있음**
```
Skill(skill="design-pipeline:design-brief",  args="<요청> | brand=present")
Skill(skill="design-pipeline:design-system", args="brand_config=.design/brand_config.json")
Skill(skill="design-pipeline:design-ui",     args="mode=<component|page|landing-next|artifact> | <요청>")
Skill(skill="design-pipeline:design-qa",     args="target=<실행 URL 또는 산출 경로>")
```

**From Scratch · 브랜드 없음, 참조 없음**
```
Skill(skill="design-pipeline:design-brief",  args="<요청> | brand=none | decide=palette,typography")
Skill(skill="design-pipeline:design-system", args="promote=.design/brief.md")   # brief 결정 → .design/brand_config.json
Skill(skill="design-pipeline:design-ui",     args="mode=<...> | <요청>")
Skill(skill="design-pipeline:design-qa",     args="target=<...>")
```

**Inspired**
```
Skill(skill="design-pipeline:design-tokens", args="source=<ref.url|ref.image|ref.guide>")
# draft 승격: brand_config.json 이 없으면 brand_config.draft.json 을 사용자에게 요약해 보이고 승인 시 복사
Skill(skill="design-pipeline:design-brief",  args="<요청> | brand=present")   # 화면 목록이 없을 때만
Skill(skill="design-pipeline:design-system", args="brand_config=.design/brand_config.json")
Skill(skill="design-pipeline:design-ui",     args="mode=<...> | <요청>")
Skill(skill="design-pipeline:design-qa",     args="target=<...>")
```

**Recreation**
```
Skill(skill="design-pipeline:design-tokens",   args="source=<ref.url|ref.image>")
Skill(skill="design-pipeline:design-recreate", args="ref=<ref.url|ref.image> | mode=recreation")
Skill(skill="design-pipeline:design-qa",       args="target=<재현 결과> | diff-against=<ref>")
```

**Modification**
```
# .design/system/ 가 있으면 그 경로를 args 로 넘긴다(읽기 전용). 없으면 생략.
Skill(skill="design-pipeline:design-ui", args="mode=modify | target=<target.code> | system=.design/system | <수정 요청>")
Skill(skill="design-pipeline:design-qa", args="target=<target.code 실행 URL 또는 경로>")
```

**Extraction**
```
Skill(skill="design-pipeline:design-tokens", args="source=<ref.url|ref.image|ref.guide>")
```

**Deconstruct / SNS Template**
```
Skill(skill="design-pipeline:design-tokens",   args="source=<ref.image>")
Skill(skill="design-pipeline:design-recreate", args="ref=<ref.image> | mode=<deconstruct|sns>")
Skill(skill="design-pipeline:design-assets",   args="from=.design/recreate-report.md")   # 생성 이미지가 필요할 때만
Skill(skill="design-pipeline:design-qa",       args="target=<재현 결과> | diff-against=<ref.image>")
```

**Assets only**
```
Skill(skill="design-pipeline:design-assets", args="kind=<cardnews|ad|logo|motion|detail-page> | <문구/내용>")
Skill(skill="design-pipeline:design-qa",     args="target=.design/assets | static-only")
```

**Design system only**
```
Skill(skill="design-pipeline:design-tokens", args="source=<...>")   # 참조가 있을 때만
Skill(skill="design-pipeline:design-system", args="brand_config=.design/brand_config.json")
Skill(skill="design-pipeline:design-qa",     args="target=.design/system | guards-only")
```

### brand_config 게이트

system · ui · recreate(시스템 사용 시) · assets 를 부르기 전에 `.design/brand_config.json` 이 있어야 한다(계약 §4 마지막 문단).
- 없고 `brand_config.draft.json` 이 있다 → draft 요약(색·폰트·radius 스케일)을 보여 주고 승인받아 승격한다.
- 둘 다 없고 참조가 있다 → design-tokens 로 되돌린다.
- 둘 다 없고 참조도 없다 → design-brief(팔레트 결정 포함)로 되돌린다.

## ④ 핸드오프 검사

단계 호출이 끝날 때마다 아래 산출물이 **존재하고 비어 있지 않은지** 확인한다. 실패하면 다음 단계를 부르지 않는다.

| 끝난 단계 | 확인할 경로 (`.design/` 기준) |
|---|---|
| design-brief | `brief.md` |
| design-tokens | `brand_config.draft.json` 과 `tokens-report.md` |
| design-system | `brand_config.json`, `system/` 아래 파일 1개 이상 |
| design-ui | 단계가 보고한 화면/컴포넌트 파일 경로 전부 |
| design-recreate | `recreate-report.md` |
| design-assets | `.design/assets` 디렉터리 안의 `manifest.json` 과 생성물 1개 이상 |
| design-qa | `qa/report.md` |

```bash
test -s .design/brief.md || echo "HANDOFF FAIL: design-brief -> .design/brief.md"
test -n "$(ls -A .design/system 2>/dev/null)" || echo "HANDOFF FAIL: design-system -> .design/system"
A=.design/assets; test -s "$A/manifest.json" || echo "HANDOFF FAIL: design-assets -> manifest.json"
test -s .design/qa/report.md || echo "HANDOFF FAIL: design-qa -> .design/qa/report.md"
```

검사 실패 시 보고 형식(그리고 멈춘다):
```
STOPPED at <stage>
expected: .design/<path>
found: <없음 | 0 bytes | 빈 디렉터리>
completed: <앞서 통과한 단계 목록>
next: <같은 단계 재호출에 필요한 입력 또는 원인>
```

## ⑤ 모호할 때

유형이 하나로 정해지지 않으면 `AskUserQuestion` 으로 **한 질문, 최대 4개 선택지**를 묻는다. 선택지는 결정표 행에 1:1 로 대응시킨다.

| 흔한 모호함 | 선택지(→ 결정표 행) |
|---|---|
| 참조 이미지/URL만 있고 의도 불명 | 똑같이 재현(Recreation) · 스타일만 참고해 새로(Inspired) · 분해 후 재구성(Deconstruct) · 토큰만 추출(Extraction) |
| "디자인 해줘" + 텍스트만 | 화면/페이지 만들기(From Scratch) · 디자인 시스템만(Design system only) · 카드뉴스/광고 이미지(Assets only) |
| 기존 코드 + 참조 이미지 | 참조대로 기존 코드 수정(Modification) · 참조를 새로 재현(Recreation) |
| 브랜드 미상 | `brands/` 의 id 목록(최대 3개) · 브랜드 없이 새로 결정 |

## ⑥ 완료 조건

- 실행은 design-qa 가 `.design/qa/report.md` 를 쓰고 ④ 검사를 통과해야 끝난다.
- 예외: **Extraction** 은 `brand_config.draft.json` + `tokens-report.md` 확인으로 끝난다. **Design system only** 는 design-qa 가 가드 테스트 결과를 담은 `qa/report.md` 를 쓰면 끝나고, 참조도 QA 대상도 없어 qa 를 생략한 경우 `system/` 의 가드 테스트 파일 존재로 끝난다.
- report.md 에 FAIL 항목이 있으면 "완료" 라고 보고하지 않는다. FAIL 항목과 그 항목의 소유 단계(예: radius 위반 → design-system 또는 design-ui)를 적고, 그 단계를 재호출할지 사용자에게 알린다.
- 최종 보고: 유형, 실행한 단계 순서, 각 단계 산출물 경로, QA PASS/FAIL 개수.

## ⑦ Quick start

```
/design acme 브랜드로 가격 페이지 만들어줘        # brands/acme.json 복사 → brief → system → ui → qa
/design 독서 모임 앱 대시보드 UI 만들어줘          # 브랜드 없음 → brief(팔레트 결정) → system → ui → qa
/design https://example.com 이거 똑같이 만들어줘   # tokens → recreate → qa
/design ./ref/post.png 이 인스타 포스트 재현        # SNS Template: tokens → recreate → qa
/design https://example.com 토큰만 뽑아줘          # Extraction: tokens 만
/design acme 로 카드뉴스 5장                       # Assets only: assets → qa(정적 감사)
```
