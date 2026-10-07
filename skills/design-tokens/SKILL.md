---
name: design-tokens
description: "디자인 파이프라인 2단계. 실행 중인 URL, 이미지(스크린샷·목업), 브랜드 가이드 PDF/AI 에서 색·타이포·간격·radius·그림자·모션·컴포넌트 토큰을 측정해 `.design/brand_config.draft.json`(CONTRACT §5 형태)과 `.design/tokens-report.md`(출처·그룹별 신뢰도·스크린샷)를 만들고, 기준을 넘으면 brand_config.json 으로 승격한다. URL 은 Playwright computed style, 이미지는 ImageMagick 픽셀값, 가이드는 문서에 적힌 값을 쓴다. Use when - 토큰 추출, 디자인 토큰, 스타일 추출, extract tokens, design tokens, 이 사이트 색/폰트, 이 사이트 폰트 뭐야, 이 이미지 색 뽑아줘, 브랜드 가이드 PDF 읽어서, 브랜드 가이드에서 토큰, reverse engineer design system, 참고 사이트 스타일 가져와 (Inspired·Recreation·Deconstruct 흐름의 첫 단계). NOT for - 참조를 똑같이 다시 만드는 재현(design-recreate), 토큰을 tailwind/css 변수/컴포넌트 코드로 만드는 디자인 시스템 생성(design-system), 브랜드가 없을 때 팔레트·타이포를 새로 정하는 일(design-brief)."
---

# design-tokens

참조(URL·이미지·브랜드 가이드)에서 **측정한 값만으로** brand_config 초안을 만든다. 추측한 값은 넣지 않는다.

## 입력

| 구분 | 내용 |
|---|---|
| 필수(셋 중 하나) | URL (`https://…`, `file://…`) · 이미지 (`.png/.jpg/.webp`) · 브랜드 가이드 (`.pdf`, PDF 호환 `.ai`) |
| 선택 | `--id`, `--name` (brand.id / brand.name 지정. 없으면 호스트명·페이지 제목에서 만든다) |
| 선택 | `.design/brief.md` 가 있으면 읽기만 한다(어떤 페이지를 대표로 볼지 힌트) |

모드 판별: `http(s)://` 또는 `file://` → URL 모드. 이미지 확장자 → 이미지 모드. `.pdf` / `.ai` → 가이드 모드.
여러 입력이 섞이면 가이드 > URL > 이미지 순으로 정본을 삼고, 나머지는 `notes` 에 보조 근거로 적는다.

## 출력 (`.design/` 기준, 이 단계가 쓰는 파일 전부)

| 파일 | 내용 |
|---|---|
| `brand_config.draft.json` | CONTRACT §5 의 키(brand · tokens · artStyle · visualSystem · motion · assets · components · platforms · brandKeywords · `_meta`). 출처는 `_meta.source`·`extractedAt` 에만, 신뢰도는 report 에만 둔다 |
| `tokens-report.md` | 출처, 추출 방식, 그룹별 신뢰도와 근거, 선택된 값, 버린 색·스냅된 radius, 비워 둔 필드, 스크린샷 링크, 승격 기록 |
| `tokens-evidence/raw.json` | 측정 원본(세 모드 공통 중간 형식) |
| `tokens-evidence/confidence.json` | 그룹별 점수, overall, 승격 가능 여부와 이유 |
| `tokens-evidence/*.png` | URL 모드: `desktop.png`(1920×1080), `mobile.png`(390×844). 가이드 모드: 렌더한 페이지 |
| `brand_config.json` | 승격 단계에서만 쓴다(Phase 4) |

## 절차

### Phase 0 — 준비

1. 대상 프로젝트 루트에서 작업한다. `.design/` 이 없으면 만든다.
2. `.design/brand_config.json` 이 이미 있으면 사용자에게 알린다. 이 단계는 그 파일을 덮어쓰지 않는다(승격은 Phase 4 규칙을 따른다).
3. 스크립트 의존성 설치(최초 1회). 설치 위치는 플러그인 디렉터리이고, 프로젝트에는 아무것도 설치하지 않는다.

```bash
cd "${CLAUDE_PLUGIN_ROOT}/skills/design-tokens/scripts" && npm ci && npx playwright install chromium
```

### Phase 1 — 추출 (모드별)

**A. URL 모드** — 한 번에 raw → draft → report 까지 간다.

```bash
npx --prefix "${CLAUDE_PLUGIN_ROOT}/skills/design-tokens/scripts" tsx \
  "${CLAUDE_PLUGIN_ROOT}/skills/design-tokens/scripts/extract-all.ts" \
  --url https://example.com --design-dir .design [--id acme] [--name "Acme"]
```

스크립트가 하는 일:
- 1920×1080 헤드리스 Chromium 으로 로드(networkidle, 30s 타임아웃 후에도 렌더된 것으로 계속) → 데스크톱 스크린샷.
- 브라우저 모듈 다섯 개 주입: `scripts/extract-colors.js`(군집·사용처·빈도), `scripts/extract-typography.js`(패밀리·크기·굵기·행간·자간·스케일 비율), `scripts/extract-spacing.js`(기준 단위·스케일·gap·신뢰도), `scripts/extract-components.js`(button·card·input·badge·avatar·modal·nav·dropdown 공통 스타일), `scripts/extract-semantics.js`(배경·서피스·브랜드·텍스트 역할, radius·shadow·transition 빈도, 페이지 제목·로고 후보).
- 390×844 모바일 스크린샷 → `raw.json` → `scripts/to-brand-config.ts` 로 draft·report·confidence 작성.

로그인 뒤 페이지, 봇 차단, SPA 지연 로딩으로 비어 나오면(색 군집 < 3 또는 elementsScanned < 50) 대표 페이지 URL 을 바꾸거나 `file://` 로 저장한 HTML 을 넣는다. 여러 페이지가 필요하면 페이지마다 `--design-dir` 를 따로 주고 report 를 비교한 뒤 대표 하나를 고른다.

**B. 이미지 모드** — 절차 전문: [references/image-mode.md](references/image-mode.md)

1. `scripts/image-colors.sh` 로 히스토그램·3×3 영역 평균을 뽑는다.
2. 비전(Read 도구로 이미지 열기)으로 역할 영역의 픽셀 박스만 정한다. 색을 묻지 않는다.
3. 같은 스크립트에 박스를 넘겨 역할별 픽셀 정확 색을 얻는다.
4. 타이포·간격·radius·그리드는 픽셀 측정으로 **추정**하고 `notes` 에 추정이라고 적는다.
5. [references/raw-schema.md](references/raw-schema.md) 형식으로 `.design/tokens-evidence/raw.json` 을 쓰고 매퍼를 돌린다(아래 공통 명령).

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/design-tokens/scripts/image-colors.sh" ref.png > .design/tokens-evidence/image-colors.json
bash "${CLAUDE_PLUGIN_ROOT}/skills/design-tokens/scripts/image-colors.sh" ref.png 40,610,180,48 40,120,600,60 > .design/tokens-evidence/image-roles.json
```

**C. 가이드 모드** — 절차 전문: [references/guide-mode.md](references/guide-mode.md)

1. `pdftotext -layout` 으로 텍스트, `pdftoppm` 으로 색·타이포 페이지를 렌더한다.
2. 문서에 **적힌** HEX·서체·굵기·여백 규칙을 그대로 옮긴다. CMYK/Pantone 만 있으면 렌더한 스웨치를 `scripts/image-colors.sh` 로 읽는다.
3. 가이드의 역할 이름(Primary / Secondary)을 `roles.brand` 순서에 반영하고, 그대로 옮긴 그룹은 `confidence` 를 95~100 으로 둔다.
4. raw.json 을 쓰고 매퍼를 돌린다.

**B·C 공통 매퍼 호출**

```bash
npx --prefix "${CLAUDE_PLUGIN_ROOT}/skills/design-tokens/scripts" tsx \
  "${CLAUDE_PLUGIN_ROOT}/skills/design-tokens/scripts/to-brand-config.ts" \
  --raw .design/tokens-evidence/raw.json --design-dir .design [--id acme] [--name "Acme"]
```

복잡한 사이트·다수 이미지·긴 가이드는 `design-token-extractor` 에이전트에 위임한다. 프롬프트에 입력 경로, 모드, "raw.json 을 references/raw-schema.md 형식으로 쓰고 매퍼를 돌려라, 값을 지어내지 마라" 를 넣는다.

### Phase 2 — 매핑 규칙 (스크립트가 적용, 리뷰 시 확인)

전문: [references/brand-config-mapping.md](references/brand-config-mapping.md)

- **3색 규칙.** `primary` = 인터랙티브 요소에서 본 첫 유채색. `accent` = 그와 색상각 30° 이상 떨어진 다음 유채색(없으면 `null`, 승격 전에 사용자가 정해야 한다). `neutral` = 저채도 색을 명도별 0·50~950 단계에 배치(측정값만). `semantic` 은 success·warning·danger·info 만. 배경·서피스·본문·보조 텍스트·테두리·focus 는 `roles` 에 `"neutral.50"`·`"primary"` 같은 참조로 넣는다. 나머지 유채색은 draft 에서 빼고 report 에 적는다.
- **radius 는 브랜드 자신의 스케일.** 고정 사다리를 쓰지 않는다. 측정한 radius 를 ±1px 로 합치고 오름차순으로 정렬한 뒤 순위대로 `none`(0), `sm`, `md`, `lg`, `xl`, `2xl`, `3xl` 이름을 붙인다. 9999px·50% 는 `full` 이고, 이름이 모자라면 숫자 이름(`"40": 40`)을 쓴다. `xs` 는 쓰지 않는다. none 을 빼고 이름 붙은 단계가 둘 미만이면 전부 숫자 이름으로 둔다(CONTRACT §5 radius 규칙). 합치거나 버린 값은 report 에 남는다.
- **타이포.** 패밀리(heading·body·mono), px 숫자 스케일, 굵기, 행간. 스케일 판정 알고리즘: [references/typography-analysis.md](references/typography-analysis.md)
- **컴포넌트.** `components.<type> = { variants: { default: {...} }, states: {} }`. 감지 규칙: [references/component-extraction.md](references/component-extraction.md)
- **비워 두는 필드.** `brand.mood`·`philosophy`·`nameKr`, `artStyle.*`, `visualSystem.*`, `motion.feel`, `assets.logo`·`fonts`, `brandKeywords` 는 판단이지 측정이 아니다. `design-brief` 또는 사용자가 채운다.

### Phase 3 — 검토

1. `tokens-report.md` 를 읽고 사용자에게 요약한다: primary·accent·neutral 단계 수, 패밀리, radius 스케일, 그룹별 신뢰도, 버린 색.
2. 스크린샷과 대조한다. URL 모드에서 primary 가 페이지 인상과 다르면(예: 쿠키 배너 버튼 색) `raw.json` 의 `roles.brand` 순서를 고치고 매퍼를 다시 돌린다. 고친 사실을 `notes` 에 적는다.
3. draft 를 손으로 고쳤으면 매퍼를 다시 돌리지 않는다(덮어쓴다). 대신 report 끝에 무엇을 왜 고쳤는지 한 줄 남긴다.

### Phase 4 — 승격 (draft → brand_config.json)

임계값은 `scripts/to-brand-config.ts` 의 `THRESHOLDS` 한 곳에만 있다. 두 모드 모두 승격 전에 design-system 의 `build-system.ts --check` 를 draft 에 돌리고, 실패하면 아무것도 쓰지 않는다.

| 조건 | 자동 승격 기준 |
|---|---|
| 출처 | `url` 또는 `guide` (이미지 모드는 항상 사용자 확인) |
| colors | ≥ 85 |
| typography | ≥ 80 |
| overall | ≥ 80 (colors .35 · typography .30 · spacing .15 · radius .10 · effects .05 · components .05) |
| primary · accent | 둘 다 `null` 아님 (accent 가 없으면 사용자가 정한 뒤 `--confirm`) |
| 기존 파일 | `.design/brand_config.json` 이 없을 것(자동 승격은 절대 덮어쓰지 않는다) |

- **라우터(`design`) 또는 이 스킬이 자동 승격:** 아래 명령. 기준 미달이면 종료코드 2 와 이유를 출력하고 아무것도 쓰지 않는다.

```bash
npx --prefix "${CLAUDE_PLUGIN_ROOT}/skills/design-tokens/scripts" tsx \
  "${CLAUDE_PLUGIN_ROOT}/skills/design-tokens/scripts/promote.ts" --auto --design-dir .design
```

- **사용자 확인 승격:** 기준 미달이거나 이미지 모드면 report 요약과 함께 승인을 받는다. 승인 후 `--confirm`. 기존 brand_config.json 을 바꿔야 하면 사용자가 교체에 동의한 뒤 `--confirm --overwrite` (이전 파일은 `brand_config.prev.json` 으로 남는다).

```bash
npx --prefix "${CLAUDE_PLUGIN_ROOT}/skills/design-tokens/scripts" tsx \
  "${CLAUDE_PLUGIN_ROOT}/skills/design-tokens/scripts/promote.ts" --confirm --design-dir .design
```

승격 시 `tokens-report.md` 끝에 `## Promoted` 기록이 붙는다. 사용자가 "Extraction 만"(토큰만 뽑아줘) 요청했으면 승격하지 않고 draft 에서 멈춰도 된다.

## 스크립트 목록

| 파일 | 실행 위치 | 역할 |
|---|---|---|
| `scripts/extract-all.ts` | Node (tsx) | URL 모드 오케스트레이터 |
| `scripts/extract-colors.js` · `scripts/extract-typography.js` · `scripts/extract-spacing.js` · `scripts/extract-components.js` · `scripts/extract-semantics.js` | 브라우저(주입) | computed style 측정 |
| `scripts/to-brand-config.ts` | Node (tsx) | raw → §5 draft, 신뢰도, report. `THRESHOLDS` 정의 |
| `scripts/promote.ts` | Node (tsx) | draft → brand_config.json |
| `scripts/image-colors.sh` | bash + ImageMagick 7 | 이미지 픽셀 색 증거 |

의존성: `scripts/package.json` + `scripts/package-lock.json` (playwright, tsx). 이미지 모드는 `magick`, 가이드 모드는 poppler(`pdftotext`, `pdftoppm`). 비밀값은 쓰지 않는다. Gemini CLI 를 보조 비전으로 쓸 때도 키는 `process.env` 의 `GEMINI_API_KEY` 만 쓴다.

## 완료 조건 (전부 파일로 검증)

```bash
test -f .design/brand_config.draft.json && test -f .design/tokens-report.md && test -f .design/tokens-evidence/raw.json && test -f .design/tokens-evidence/confidence.json
python3 -c "import json;d=json.load(open('.design/brand_config.draft.json'));k={'brand','tokens','artStyle','visualSystem','motion','assets','components','platforms','brandKeywords','_meta'};assert set(d)==k,set(d)^k;t=d['tokens'];assert {'colors','typography','spacing','radius','effects','geometry'}<=set(t);c=t['colors'];assert c['primary'];assert set(c)<={'primary','accent','neutral','semantic','roles'};assert set(c['semantic'])<={'success','warning','danger','info'};print('draft OK')"
# 승격 전 필수: design-system 검사기 통과(종료코드 0, "brand_config OK". "warn:" 줄은 실패 아님). Node < 22.18 이면 node 대신 npx tsx
DS="${CLAUDE_PLUGIN_ROOT}/skills/design-system"; node "$DS/scripts"/build-system.ts --check --config "$PWD/.design/brand_config.draft.json"
grep -q '^## Confidence' .design/tokens-report.md && grep -q '^## Screenshots' .design/tokens-report.md
```

- URL 모드: `tokens-evidence/desktop.png`, `mobile.png` 존재.
- 이미지 모드: `tokens-evidence/image-colors.json`, `image-roles.json` 존재, raw 의 `meta.colorMethod` 가 `pixel`.
- draft 가 위 `--check` 를 통과한다. 실패하면(종료코드 1, `- <field>: <rule>` 줄) 해당 필드를 고치기 전에는 승격하지 않는다. `promote.ts` 도 같은 검사를 먼저 돌리고 실패하면 거부한다.
- `brand.id`·`brand.name` 이 비어 있지 않고, 어디서 왔는지(`url host`, `og:site_name`, `page/document title`, `--id/--name`)가 `_meta.derived` 에 적혀 있다.
- 승격했다면 `.design/brand_config.json` 이 draft 와 같고 report 에 `## Promoted` 가 있다.

## 다음 단계

| 요청 유형(CONTRACT §4) | 다음 |
|---|---|
| Extraction | 여기서 끝. report 요약과 draft 경로를 전달 |
| Inspired | (필요하면 `design-brief`) → `design-system` (brand_config.json 필수: 승격 먼저) |
| Recreation · Deconstruct · SNS Template | `design-recreate` (draft 또는 brand_config 를 읽기만 한다) |
| Design system only | `design-system` |

승격 전에 3단계 이후로 가야 하면 Phase 4 로 돌아간다. 결정 근거와 버린 추출기: [references/decision-log.md](references/decision-log.md)
