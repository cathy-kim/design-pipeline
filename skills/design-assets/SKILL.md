---
name: design-assets
description: "6단계 에셋. brand_config.json 을 입력으로 Gemini 이미지(이 플러그인의 유일한 구현, 3-Tier fallback)를 만들고, 카드뉴스·광고·상세페이지·무드보드를 토큰 기반 HTML 템플릿으로 조합해 PNG 로 렌더하며, 로고 프롬프트와 웹 모션(Framer Motion · CSS keyframes)을 생성한다. 모든 산출물은 .design/assets/<mode>/ 에 쓰고 manifest.json 에 프롬프트·모델·시드·크기를 남긴다. Use when - 카드뉴스, 인스타 카드, 캐러셀, 광고 소재, 배너, 상세페이지 이미지, 로고 프롬프트, 무드보드, 히어로 이미지, 모션, 로고 애니메이션, Gemini 이미지, asset, creative. NOT for - 화면·컴포넌트 UI 코드(design-ui), 참조 이미지 레이어 분해·재현(design-recreate), 픽셀 diff·검증(design-qa), 토큰 추출(design-tokens)."
---

# design-assets

브랜드 설정을 데이터로 받아 마케팅·브랜드 에셋(이미지·렌더 PNG·로고 프롬프트·모션 코드)을 만든다.

## 1. 입력

| 구분 | 경로 / 값 | 비고 |
|---|---|---|
| **필수** | `.design/brand_config.json` | 없으면 멈추고 되돌린다(아래) |
| 필수 키 | `tokens.colors.primary`, `tokens.colors.neutral` | 3색 중 둘. accent 는 없으면 primary |
| 필수 키 | `assets.canvasSizes` | 권장 키: [references/card-templates.md](references/card-templates.md) §1 |
| 권장 키 | `artStyle`, `assets.imagePromptConfiguration`, `brand.mood`, `tokens.typography.families`, `tokens.radius.scale`, `assets.logo`, `visualSystem.logoDirection`, `motion` | 없으면 중립 기본값 |
| 선택 | 요청 문구·카피, 제품 사진, 참조 이미지 | content JSON 으로 정리 |
| 선택 | `.design/brief.md` | 있으면 톤·대상·채널을 여기서 읽는다 |
| 환경 | `GEMINI_API_KEY` | 이미지 생성에만 필요. 없으면 placeholder(Tier 3) |

**brand_config.json 이 없으면:** 에셋을 만들지 않는다. 참조 URL/이미지가 있으면 `design-tokens`, 없으면 `design-brief` 로 되돌린다. 라우터 `design` 이 호출했다면 그 사실을 보고하고 끝낸다. 스크립트도 이 경우 종료 코드 2로 끝난다.
브랜드 이름·색·폰트를 대화에서 받아 스크립트에 직접 넘기지 않는다(CONTRACT §1-2).

## 2. 출력

```
.design/assets/
  manifest.json                 # 모든 파일: file, mode, kind, prompt, model, tier, seed, size, pixels, sources, sha256, waived
  card/<slug>/card-NN.{html,png}
  card/<name>.png               # 카드 배경 이미지 (generate-image)
  ad/<slug>/<canvas>.{html,png}
  detail-page/<slug>/detail-page.{html,png}
  logo-prompt/prompts.json, <platform>.txt
  logo/<name>.png               # 로고 후보 이미지
  hero/<name>.png
  moodboard/<slug>/moodboard.{html,png}
  motion/<Name>Intro.tsx, <name>-intro.html, README.md
  <mode>/prompts/<name>.txt     # generate-image 가 쓴 프롬프트 원문
```

## 3. 모드

| 모드 | 무엇 | 도구 |
|---|---|---|
| `card` | 인스타 피드·스토리·캐러셀 카드뉴스 (cover · content · data · cta) | generate-image → compose |
| `ad` | 광고 소재, 배너 (여러 캔버스 동시) | generate-image → compose |
| `detail-page` | 상품 상세페이지 이미지 (860px 세로) | generate-image → compose |
| `logo-prompt` | 로고 프롬프트 (gemini · midjourney · dalle · ideogram) + 선택적으로 후보 이미지 | logo-prompt-builder → generate-image `--mode logo` |
| `hero` | 웹 히어로·키 비주얼 단일 이미지 | generate-image |
| `moodboard` | 이미지 타일 + 3색 스와치 + 폰트 견본 1장 | generate-image ×N → compose |
| `motion` | 로고 애니메이션, 인트로·등장 모션 (React + 독립 HTML) | 코드 작성 (스크립트 없음) |

## 4. 절차

### Phase 0 — 준비

1. `.design/brand_config.json` 존재와 필수 키를 확인한다. 없으면 §1 대로 되돌린다.
2. 요청을 모드에 매핑한다. 한 요청에 여러 모드가 있으면 모드별로 Phase 1~4 를 돈다.
3. 쓸 캔버스 키가 `assets.canvasSizes` 에 있는지 본다. 없으면 brand_config 에 키를 추가하자고 보고한다. 이 스킬은 brand_config 를 고치지 않는다.

### Phase 1 — 콘텐츠 기획 (card · ad · detail-page · moodboard)

문구를 짜고 content JSON 을 `.design/assets/<mode>/content.json` 에 쓴다. 스키마와 카피 규칙은 [references/card-templates.md](references/card-templates.md) §3 에 있다.

- card 는 5~10장으로 짠다. 1장 cover 는 후킹, 중간은 content 와 data, 마지막은 cta 다. 한 장에 한 메시지만 담는다.
- ad 는 headline 한 줄, CTA 동사, 프로모션은 accent 배지로 구성한다. 캔버스를 2~3개 고른다.
- detail-page 는 hero → benefits → steps → specs → reviews → faq 순서를 기본으로 하고 필요 없는 섹션은 뺀다.
- 이미지가 필요한 자리마다 **피사체 한 문장**을 정한다. 이미지 안에 글자를 넣지 않는다. 글자는 템플릿이 얹는다.

### Phase 2 — 이미지 생성 (Gemini, 단일 구현)

자리마다 `generate-image.ts` 를 한 번씩 순차로 부른다. 프롬프트는 brand_config 로 자동 조립된다. 3-Tier fallback 과 프롬프트 구조는 [references/image-generation.md](references/image-generation.md) 에만 정의돼 있다.

- 시드를 정해 두면(`--seed`) 같은 결과를 다시 만들기 쉽다. 정하지 않으면 무작위 시드가 manifest 에 남는다.
- 결과를 열어 본다. 글자가 섞였거나, 3색을 벗어난 지배 색이 있거나, 금지 효과가 보이면 시드를 바꿔 다시 만든다.
- 제품 사진 등 기존 이미지를 쓰면 생성은 건너뛰고 content JSON 에 경로만 넣는다.

### Phase 3 — 조합 · 렌더 (card · ad · detail-page · moodboard)

`compose.ts` 로 HTML 을 만들고 PNG 로 렌더한다. 템플릿은 `templates/card.html`, `templates/ad.html`, `templates/detail-page.html`, `templates/moodboard.html` 이고 공통 스타일은 `templates/base.css` 다.
브랜드 3색·폰트·radius·로고는 CSS 변수로 주입된다. 템플릿을 고칠 때도 하드코딩 색, 임의 radius, 그림자, 그라디언트, 블러는 넣지 않는다.

### Phase 4 — 로고 프롬프트 (logo-prompt)

1. `logo-prompt-builder.ts` 로 프롬프트를 만든다. 기본은 gemini 이고, 다른 도구도 쓸 계획이면 `--all-platforms` 를 준다.
2. 후보 이미지가 필요하면 `generate-image.ts --mode logo --prompt-file .design/assets/logo-prompt/prompts.json` 을 시드 3~4개로 돌린다.
3. AI 로고는 초안이다. 확정은 사람이 벡터로 다시 그려 `brands/<id>/` 에 넣는 일이다. 이 스킬은 `assets.logo` 를 쓰지 않는다.

규칙·타입·스타일은 [references/logo-prompt-guide.md](references/logo-prompt-guide.md) 에 있다.

### Phase 5 — 모션 (motion)

스크립트 없이 코드를 쓴다. 입력은 `brand.name`, `tokens.colors`, `motion.easingCurves·durations·feel`, 그리고 있으면 `assets.logo` SVG 다.

1. 타임라인을 정한다. 기본은 2.4s 로고 인트로다. 심볼 → 글자별 → 언더라인 → 태그라인 순서로 등장한다.
2. React 버전 `.design/assets/motion/<Name>Intro.tsx` 를 쓴다. Framer Motion(`motion/react`)과 `useReducedMotion` 을 쓴다. 근거: [references/motion-patterns.md](references/motion-patterns.md).
3. 독립 HTML 버전 `.design/assets/motion/<name>-intro.html` 을 쓴다. 순수 CSS keyframes 와 Replay 버튼을 넣고 `prefers-reduced-motion` 에 대응한다. 근거: [references/css-keyframes.md](references/css-keyframes.md).
4. 사용법 `README.md` 를 쓰고, 세 파일을 manifest 에 `kind: "code"`, `model: null` 로 남긴다. 아래 manifest 항목 추가 스니펫을 쓴다.
5. 네온 글로우, shine, border-beam, 파티클 글로우, 글래스모피즘은 쓰지 않는다. 대체 효과는 motion-patterns.md §4 에 있다.

## 5. 스크립트 호출

최초 1회 의존성을 설치한다. 시스템 Chrome 을 쓸 거면 브라우저 다운로드를 건너뛰어도 된다.

```bash
S="${CLAUDE_PLUGIN_ROOT}/skills/design-assets/scripts"
(cd "$S" && npm ci)
# 번들 Chrome 이 실행되지 않으면 (spawn ... -88 등):
export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

작업 프로젝트 루트에서 실행한다(`.design/` 을 찾는다). 다른 위치면 `--design-dir <path>`.

```bash
# 이미지 — Gemini 3-Tier. --subject | --prompt | --prompt-file 중 하나
npx --prefix "$S" tsx "$S/generate-image.ts" --mode card --name cover-bg \
  --subject "a calm desk with a notebook, morning light" --canvas instagram-feed --seed 7
npx --prefix "$S" tsx "$S/generate-image.ts" --mode hero --name hero-main --subject "..." --canvas web-hero --dry-run
npx --prefix "$S" tsx "$S/generate-image.ts" --mode ad --name ad-bg --subject "..." --canvas ad-square --ref ./product.png
#   --model <id>  Tier 1 모델 덮어쓰기 · --strict  placeholder 대신 실패 · --dry-run  프롬프트만

# 조합 · 렌더
npx --prefix "$S" tsx "$S/compose.ts" --mode card        --content .design/assets/card/content.json
npx --prefix "$S" tsx "$S/compose.ts" --mode ad          --content .design/assets/ad/content.json
npx --prefix "$S" tsx "$S/compose.ts" --mode detail-page --content .design/assets/detail-page/content.json
npx --prefix "$S" tsx "$S/compose.ts" --mode moodboard   --content .design/assets/moodboard/content.json
#   --no-render  HTML 만

# 로고 프롬프트 → 후보 이미지
npx --prefix "$S" tsx "$S/logo-prompt-builder.ts" --all-platforms --industry tech
npx --prefix "$S" tsx "$S/generate-image.ts" --mode logo --name logo-a \
  --prompt-file .design/assets/logo-prompt/prompts.json --canvas logo-square --seed 1
```

| 스크립트 | 역할 |
|---|---|
| `scripts/generate-image.ts` | Gemini 이미지 생성 단일 구현. 프롬프트 조립, 3-Tier, manifest |
| `scripts/compose.ts` | 템플릿 + 브랜드 CSS 변수 + content → HTML → Puppeteer PNG |
| `scripts/logo-prompt-builder.ts` | brand_config → 플랫폼별 로고 프롬프트 |
| `scripts/logo-framework.ts` | 로고 타입·스타일·업종·성격 사전, 플랫폼별 modifier/negative |
| `scripts/lib.ts` | brand_config 로딩, 3색·폰트·radius·캔버스 해석, manifest 기록 |

다른 스킬이 이미지를 만들어야 하면 자체 구현 없이 `${CLAUDE_PLUGIN_ROOT}/skills/design-assets/scripts/generate-image.ts` 를 부른다. design-recreate 의 generated-image 레이어가 그 예다. 출력 모드는 가장 가까운 것을 고른다. 보통 `hero` 다.

manifest 에 코드 산출물(motion)을 남길 때:

```bash
python3 - <<'PY'
import json, datetime, pathlib
p = pathlib.Path('.design/assets/manifest.json'); m = json.loads(p.read_text()) if p.exists() else {"version": 1, "brandId": None, "entries": []}
for name in ['AcmeIntro.tsx', 'acme-intro.html', 'README.md']:   # .design/ 기준 경로로 기록
    f = str(pathlib.PurePosixPath('assets', 'motion', name))
    m['entries'] = [e for e in m['entries'] if e['file'] != f] + [{"file": f, "mode": "motion", "kind": "code", "prompt": None, "model": None, "seed": None, "size": None, "createdAt": datetime.datetime.utcnow().isoformat() + 'Z'}]
p.write_text(json.dumps(m, indent=2, ensure_ascii=False) + '\n')
PY
```

## 6. 완료 조건

검증 가능한 것만 적는다. 전부 `.design/` 산출물로 확인한다.

- [ ] 요청한 모드마다 `.design/assets/<mode>/` 에 산출물이 있다. card 는 계획한 장 수만큼 PNG, ad 는 캔버스 수만큼 PNG, detail-page 와 moodboard 는 PNG 1장, logo-prompt 는 `prompts.json`, motion 은 `.tsx` · `.html` · `README.md`.
- [ ] `.design/assets/manifest.json` 이 유효한 JSON 이고, 위 파일 각각에 항목이 있다. 이미지는 `prompt` · `model` · `seed` · `size` 가 null 이 아니다.
- [ ] 이미지 항목 중 `tier: 3`(placeholder) 이 없다. 있으면 키가 없거나 생성이 실패한 것이다. 이 경우 완료라고 하지 않고, 남은 파일과 `note` 의 사유를 그대로 보고한다.
- [ ] 렌더 PNG 의 `pixels` 가 캔버스 `size` 와 같다. 상세페이지는 폭만 같으면 된다.
- [ ] 생성 HTML/TSX 에 금지 패턴이 없다. 브랜드 `exceptions[]` 로 승인된 버튼 pill 은 대체하지 않고 브랜드 값을 쓴다. 이때 manifest 항목에 `waived: {rule, scope, reason}` 이 남아 있어야 한다(design-qa 가 WAIVED 처리). 예외가 없는 pill 만 WARN 과 함께 스케일 값으로 대체된다.

```bash
grep -rnE 'box-shadow|backdrop-filter|filter:\s*blur|(linear|radial)-gradient|border-radius:\s*(9999|999|50%)' \
  .design/assets --include='*.html' --include='*.tsx' --include='*.css' || echo "no forbidden effects"
python3 -c "import json;m=json.load(open('.design/assets/manifest.json'));bad=[e['file'] for e in m['entries'] if e.get('tier')==3];print('placeholders:',bad or 'none')"
```

- [ ] 렌더 PNG 를 직접 열어 본다. 글자 잘림, 겹침, 이미지 위 글자 대비, 스토리 세이프존 침범이 없어야 한다.

## 7. 다음 단계

- 라우터 순서 "Assets only" 를 따라 `design-qa` 를 정적 감사만으로 호출한다. 3색·radius·금지 효과를 검사하고, 입력은 `.design/assets/` 다.
- Deconstruct / SNS Template 흐름이면 `design-recreate` 가 이 스킬의 이미지를 레이어로 쓴다. 그 뒤 `design-qa` 로 간다.
- 브랜드 값을 바꿔야 하면 brand_config 를 고친다. 그 일은 design-tokens 나 사람 몫이다. 이 스킬에서 고치지 않는다.

## 참조

| 문서 | 내용 |
|---|---|
| [references/image-generation.md](references/image-generation.md) | 프롬프트 구조, imagePromptConfiguration 키, 3-Tier fallback 정의, seed·크기, 배경 제거 |
| [references/card-templates.md](references/card-templates.md) | canvasSizes 권장 키, CSS 변수 매핑, content JSON 스키마(card·ad·detail-page·moodboard) |
| [references/logo-prompt-guide.md](references/logo-prompt-guide.md) | 로고 5원칙, 타입·스타일, 플랫폼별 형식, CLI |
| [references/motion-patterns.md](references/motion-patterns.md) | Framer Motion 패턴, 로고 인트로 타임라인, 허용 강조 효과 |
| [references/css-keyframes.md](references/css-keyframes.md) | 독립 HTML 키프레임 세트, 골격, reduced-motion |
| [references/decision-log.md](references/decision-log.md) | 세 Gemini 구현 중 무엇을 남겼고 왜, 이관하지 않은 항목 |
