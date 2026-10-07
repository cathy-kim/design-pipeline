# Templates — card · ad · detail-page · moodboard

`scripts/compose.ts` 가 `templates/<mode>.html` 에 브랜드 CSS 변수와 content JSON 을 채워 렌더한다.
템플릿에는 브랜드 값이 하나도 없다. 색·폰트·radius·로고는 전부 `brand_config.json` 에서 주입된다.

## 1. 캔버스 — `assets.canvasSizes` 권장 키

brand_config 에 없는 키를 쓰면 compose/generate-image 가 있는 키 목록을 보여 주며 멈춘다. 값은 `{ "width", "height" }` 또는 `"1080x1350"`.

| 키 | 크기 | 용도 |
|---|---|---|
| `instagram-feed` | 1080x1350 (4:5) | 카드뉴스 기본 (card 기본값) |
| `instagram-square` | 1080x1080 | 정사각 피드 |
| `instagram-story` | 1080x1920 (9:16) | 스토리·릴스 커버. 세이프존 적용 |
| `ad-square` | 1080x1080 | 광고 기본 (ad 기본값) |
| `ad-landscape` | 1200x628 | 링크 광고·배너 |
| `ad-story` | 1080x1920 | 스토리 광고 |
| `detail-page` | width 860, height 없음 | 상세페이지 (세로 가변, fullPage 캡처) |
| `web-hero` | 1920x1080 | 웹 히어로 (brands/_template.json 의 키 이름) |
| `moodboard` | 1920x1080 | 무드보드 |
| `logo-square` | 1024x1024 | 로고 후보 |

## 2. 브랜드 → CSS 변수 (compose.ts 가 주입)

| 변수 | 출처 |
|---|---|
| `--c-primary` / `--c-accent` | `tokens.colors.primary` / `accent`. 객체면 `DEFAULT` → base → value → 500 순 (accent 없으면 primary) |
| `--c-bg` / `--c-fg` / `--c-muted` | `tokens.colors.roles.background · text · textMuted` (예: `"neutral.0"`). roles 가 없으면 neutral 스케일 hex 값의 가장 밝은 값 / 가장 어두운 값 / 중간값. `rgb()` 값은 건너뛴다 |
| `--f-head` / `--f-body` | `tokens.typography.families.heading·body` (없으면 display·sans·첫 값) |
| `--r-card` | `components.card.radius` 이름 → `tokens.radius.scale`, 없으면 md → sm → 스케일의 가장 작은 양수 |
| `--r-control` | `components.button.radius` 이름 → scale, 없으면 sm → 가장 작은 양수. `full`(999 이상)은 pill 이라 건너뛰고 WARN 을 낸다(§1-6). 단 `exceptions[]` 에 `{"rule":"no-pill-button","scope":"components.button"}` 이 있으면 브랜드 값을 그대로 쓰고, 렌더 산출물의 manifest 항목에 `"waived": {rule, scope, reason}` 을 남긴다(design-qa 가 WAIVED 로 표기) |
| `--u` | 캔버스 폭 / 1080 (상세페이지는 / 860). 템플릿 px 는 모두 `calc(Npx*var(--u))` |
| `--r-tag` | 배지·스텝 번호·캡션·스와치. `components.badge.radius` → sm → 가장 작은 양수. 버튼 pill 예외는 여기에 적용되지 않는다 |
| 로고 | `assets.logo` 문자열, 또는 객체의 wordmark → primary → default → symbol 순 첫 실재 파일(.ico 제외). 없으면 `brand.name` 텍스트 |
| 폰트 파일 | `assets.fonts` `{ family: 경로 }` 또는 `{ family: { file } }` → `@font-face` |

에셋 상대경로는 다음 순서로 찾는다: `.design/` → `.design/brand-assets/` → `$BRAND_ASSETS_DIR` → `${CLAUDE_PLUGIN_ROOT}/brands/`. `brands/<id>.json` 의 경로(예: `acme/logo/icon.png`)는 `brands/` 기준이라 마지막 단계에서 찾힌다.

템플릿 규칙(CONTRACT §1-6): 3색만, radius 는 위 세 변수만, 그림자·글로우·그라디언트·블러·글래스모피즘 없음, pill 없음(브랜드 `exceptions[]` 로 승인된 버튼 pill 만 예외).
이미지 위 글자 가독성은 단색 스크림(`.scrim`, fg 55%)으로 확보한다. 그라디언트 오버레이는 쓰지 않는다.

## 3. content JSON

이미지 경로는 content 파일 기준 상대경로. 존재하는 파일만 `file://` 로 바뀐다. 이미지는 보통 `.design/assets/<mode>/<name>.png` (generate-image 출력).

### card

```json
{
  "slug": "focus-tips",
  "canvas": "instagram-feed",
  "handle": "@acme",
  "pages": [
    { "role": "cover",   "headline": "...", "body": "...", "image": "../.design/assets/card/cover-bg.png" },
    { "role": "content", "headline": "...", "body": "줄바꿈은\n그대로", "image": "선택" },
    { "role": "data",    "bigNumber": "23분", "headline": "...", "body": "선택", "source": "출처" },
    { "role": "cta",     "headline": "...", "body": "선택", "ctaText": "프로필에서 더 보기" }
  ]
}
```

`role` 을 생략하면 첫 장 cover, 마지막 장 cta, 나머지 content. 카드 수는 5~10장을 권장한다.

| role | 목적 | 구성 |
|---|---|---|
| cover | 후킹 | 전면 이미지 + 스크림 + 어센트 라인(primary) + 88px 제목 |
| content | 정보 | 번호(primary) + 64px 제목 + 36px 본문 + 선택 이미지, 우하단 고스트 번호(fg 6%) |
| data | 수치 강조 | 160px 숫자(primary) + 40px 제목 + 출처 |
| cta | 행동 유도 | 중앙 제목 + primary 버튼(`--r-control`) |

스토리 캔버스(세로/가로 > 1.7)는 세이프존 패딩이 자동 적용된다: 위 160 · 아래 480 · 좌우 120 (1080 기준).

카피 규칙: 한 장 한 메시지, 제목 2줄 이내, 본문 4줄 이내. 제목 패턴은 후킹형 `[사실/트렌드] + [주제]`, 등식형 `[A] = [B]`, 대조형 `[A] vs [B]`. 톤은 `brand.philosophy` 와 `brand.mood` 에서 가져온다.

### ad

```json
{
  "slug": "launch",
  "canvases": ["ad-square", "ad-landscape", "ad-story"],
  "headline": "할 일을 절반으로",
  "subheadline": "선택",
  "cta": "무료로 시작",
  "promo": "선택 — accent 배지",
  "background": "선택 — 전면 이미지",
  "product": "선택 — 배경 제거한 제품 PNG"
}
```

캔버스 비율로 레이아웃이 정해진다: 가로 > 1.3 이면 landscape(카피 좌 · 제품 우), 세로 > 1.3 이면 portrait(세이프존), 그 외 square.

### detail-page

```json
{
  "productName": "Acme Planner", "eyebrow": "NEW", "tagline": "...", "price": "29,000원",
  "heroImage": "../.design/assets/detail-page/hero.png",
  "sections": [
    { "type": "benefits", "title": "...", "items": [ { "title": "...", "body": "...", "image": "선택" } ] },
    { "type": "steps",    "title": "사용법", "alt": true, "items": [ { "title": "...", "body": "..." } ] },
    { "type": "specs",    "title": "제품 정보", "items": [ { "title": "크기", "body": "A5" } ] },
    { "type": "reviews",  "title": "후기", "items": [ { "title": "작성자", "body": "...", "rating": "4.9" } ] },
    { "type": "faq",      "title": "자주 묻는 질문", "items": [ { "title": "질문", "body": "답" } ] }
  ]
}
```

섹션 공통 선택 키: `eyebrow`, `body`, `image`(섹션 하단), `alt`(true 면 neutral 배경 띠). 권장 순서는 hero → benefits → 상세 이미지 → steps → specs → reviews → faq 이다.

### moodboard

```json
{ "title": "Launch", "tiles": [ { "image": "...", "span": "wide tall", "caption": "선택" }, { "image": "..." } ] }
```

4열 x 2행 그리드다. `span` 은 `wide`(2열), `tall`(2행), 둘 다 가능. 빈칸이 없게 하려면 칸 수 합이 8이 되게 맞춘다. 예: wide tall 1장(4칸) + 1칸 4장.
상단 띠에 3색 스와치와 폰트 견본이 자동으로 들어간다.

## 4. 출력

```
.design/assets/<mode>/<slug>/
  card-01.html  card-01.png  ...        # card
  ad-square.html  ad-square.png  ...    # ad (캔버스 키 = 파일명)
  detail-page.html  detail-page.png     # detail-page
  moodboard.html  moodboard.png         # moodboard
```

HTML 은 manifest 에 `kind: "code"`, PNG 는 `kind: "render"`, `model: "puppeteer"` 로 남는다. `sources` 에는 쓰인 이미지와 로고가 들어간다.
