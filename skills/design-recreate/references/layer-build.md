# Layer-by-Layer Build

`plan/deconstruct-plan.json` 을 받아 재현 코드를 아래에서 위로 쌓는 규칙. 깊이 배정은 [three-signal-layers.md](three-signal-layers.md), Region 은 [grid-rules.md](grid-rules.md) §5.

---

## 1. 두 축의 빌드 순서

| 축 | 정하는 것 | 출처 |
|---|---|---|
| **Depth (z)** | 무엇이 무엇 위에 보이나 | `depthLayers[]` (3-Signal) |
| **Method (L0–L5)** | 요소를 어떤 기술로 만드나 | `layers[]` / 요소의 `method` |

빌드는 **depth-major** 다. z0 을 끝내고 z1, z2 … 로 올라간다. 각 z 안에서는 method 순서로 만든다.

```
z0 → z1 → z2 …
  각 z 안:  L0 배경 → L1-A 이미지 → L1-B 절차 패턴 → L2 구조/Region → L3 컴포넌트 → L4 질감 → L5 텍스트
```

한 Layer 를 끝낼 때마다 렌더해서 눈으로 확인한 뒤 다음 Layer 로 간다. 마지막에 한 번에 확인하지 않는다.

---

## 2. 골격

**단일 캔버스(광고, SNS 포스트, 상세페이지 컷):**

```html
<div class="canvas" style="position:relative; width:Wpx; height:Hpx; overflow:hidden;">
  <div class="layer-0" style="position:absolute; inset:0; z-index:0;"> <!-- 배경 --> </div>
  <div class="layer-1" style="position:absolute; inset:0; z-index:1;">
    <!-- Region: 컨테이너만 absolute, 자식은 flow -->
    <div class="region" style="position:absolute; left:50%; top:7%; width:46%;
         display:flex; flex-direction:column; align-items:flex-start; gap:12px;">
      <span>…</span><h2>…</h2>
    </div>
    <!-- 독립 요소 -->
    <img src="assets/hero.png" style="position:absolute; left:3%; top:8%; width:44%; height:82%; object-fit:contain;">
  </div>
  <div class="layer-2" style="position:absolute; inset:0; z-index:2;"> <!-- 강조·겹침 --> </div>
</div>
```

**웹 페이지(반응형):** 섹션은 문서 흐름(`<section>` 세로 스택)으로 쌓고, 섹션 내부만 위 규칙을 쓴다. 섹션 레이아웃은 감지한 그리드 타입의 CSS 로 구현한다. 페이지 전체를 absolute 캔버스로 만들지 않는다. z 가 2 이상인 장식만 `position:absolute` + `z-index` 로 올린다.

**Region 규칙:**

1. Region 의 left/top/width 는 plan 의 anchor/size 를 쓴다. height 는 auto.
2. Region 자식에 `position:absolute` 금지. flow 순서로만 놓는다.
3. gap 은 측정한 간격을 쓴다. `.design/system/` 이 있으면 가장 가까운 spacing 토큰으로 맞춘다.
4. 중첩 나열은 요소의 `innerLayout` 으로 표현한다.

정렬 축을 공유하는 요소들을 각각 absolute 로 놓는 것은 금지다. 좌표 오차가 요소 수만큼 쌓인다.

---

## 3. Method 별 구현

| Method | 요소 | 구현 |
|---|---|---|
| L0 | fill / gradient 배경 | CSS background. 색은 ImageMagick 측정값 |
| L1-A | RAW_IMAGE (사진·일러스트) | 아래 §3.1 |
| L1-B | PROCEDURAL (halftone, starburst, glitch, 기하 패턴) | CSS/SVG/Canvas 코드. 파라미터는 [procedural-analysis.md](procedural-analysis.md) |
| L2 | TEMPLATE (구조) | CSS Grid / Flex. 그리드 타입별 구현은 [grid-rules.md](grid-rules.md) §4 |
| L3 | COMPONENT (뱃지, 버튼, 구분선, 아이콘, 도장) | HTML/CSS/SVG. `.design/system/primitives/` 가 있으면 그 컴포넌트를 쓴다 |
| L4 | TEXTURE (노이즈, 그림자, 그라디언트 오버레이, 블렌드) | [texture-catalog.md](texture-catalog.md) |
| L5 | TEXT | HTML + 웹폰트. **텍스트를 이미지로 생성하지 않는다** |

### 3.1 RAW_IMAGE 소스 결정

1. 레퍼런스 크롭이 양 변 100px 이상이면 **크롭을 그대로 쓴다**(`analysis/crops/<id>.png`). 재현의 목적은 원본과 같아 보이는 것이다.
2. 100px 미만(아바타, 작은 아이콘)이거나 크롭에 텍스트·다른 요소가 섞여 분리할 수 없으면 **`design-assets` 스킬에 생성을 맡긴다.** plan 의 `asset_request`(prompt, aspect_ratio, reference_crop)를 넘긴다. 이미지 생성은 design-assets 만 한다.
3. 받은 에셋은 `object-fit`/`object-position` 으로 원본 크롭 영역에 맞춘다.
4. 사진 저작권이 문제되는 산출물(외부 배포용)은 크롭 대신 2 로 간다. 리포트에 적는다.

### 3.2 텍스트

- 텍스트 내용은 레퍼런스 그대로 옮긴다(SNS Template 모드는 슬롯으로 뺀다, §6).
- 폰트: `.design/system/` 또는 `brand_config` 의 `tokens.typography.families` 를 쓴다. 없으면 Website 모드는 `capture-network.js --filter=font` 로 원본 폰트를 찾고, Image 모드는 형태(세리프 유무, 굵기, x-height)가 가장 가까운 공개 웹폰트를 고른다. 고른 근거를 리포트에 적는다.
- 큰 텍스트가 사진과 겹치면 음수 margin 이 아니라 상위 z Layer 로 올린다.

---

## 4. 토큰 바인딩

| 상황 | 값의 출처 |
|---|---|
| `.design/system/` 있음 | 그 토큰(CSS 변수 / tailwind 설정). 측정값은 가장 가까운 토큰으로 스냅하고, 스냅 오차가 큰 값은 리포트 "토큰 이탈" 에 적는다 |
| system 없음, `brand_config.json` 또는 `brand_config.draft.json` 있음 | 그 `tokens` 를 CSS 변수로 선언해서 쓴다 |
| 둘 다 없음 | 측정값을 CSS 변수로 한곳에 선언(`:root { --c-bg: … }`). 하드코딩 hex 를 요소마다 흩뿌리지 않는다 |

radius 는 브랜드의 닫힌 스케일에서만 고른다. 원본 radius 가 스케일 사이에 있으면 가까운 값으로 스냅하고 리포트에 적는다.

---

## 5. 금지 효과 대체 (CONTRACT §1-6)

레퍼런스가 금지 효과를 쓰고 있어도 기본은 **대체**다. design-qa 가 이 네 가지를 기계적으로 잡는다.

| 레퍼런스에 있는 것 | 재현에서 쓰는 것 |
|---|---|
| pill 버튼 (완전히 둥근 버튼) | 브랜드 radius 스케일의 가장 큰 비-full 값. 둥근 **태그/뱃지/아바타**는 버튼이 아니므로 허용 |
| 네온 글로우 (발광 box-shadow / text-shadow) | 측정한 색의 단색 강조 또는 일반 그림자 |
| 글래스모피즘 (backdrop-filter 블러 패널) | 블러 없이 측정한 합성색의 불투명 면 (alpha 역산은 procedural-analysis.md D1.16) |
| 그라디언트 보더 | 단색 1px 보더 (그라디언트 양끝 중 대비가 큰 색) |

대체한 항목은 리포트 "규칙 대체" 표에 원본 위치·원본 효과·대체 효과를 적는다. 대체 영역은 픽셀 일치율이 낮게 나오는 것이 정상이며, 그 섹션의 기준 미달을 정당화하는 근거가 된다.

사용자가 "원본 효과 그대로" 를 명시했을 때만 금지 효과를 남긴다. 이 경우 리포트에 "의도된 규칙 예외" 로 적고 design-qa 에 넘긴다.

색 수도 같다. 원본이 4색 이상을 쓰면 그대로 재현하되, `.design/system/` 이 있는 브랜드 재현이면 Primary/Accent/Neutral 로 묶고 리포트에 매핑을 적는다.

---

## 6. SNS Template 모드

알려진 SNS UI 포스트는 깊이 분석 전체가 필요 없다.

```
S1 플랫폼 식별 + 콘텐츠 추출 (Vision 1회: 이름, 핸들, 본문, 수치, 시간, 미디어 배치)
S2 플랫폼 표준 UI 템플릿 적용 (아래 값)
S3 콘텐츠 주입: 텍스트는 슬롯으로, 사진은 크롭(≥100px) 또는 design-assets, 형광펜 같은 강조는 크롭 색 측정 → CSS background
S4 recreate-step.sh 로 비교·수정
```

**표준 UI 값(플랫폼 UI 크롬이므로 브랜드 토큰 대상이 아니다):**

| 플랫폼 | 값 |
|---|---|
| X / Twitter | bg #FFFFFF · text #0F1419 · secondary #536471 · link #1D9BF0 · border #EFF3F4 · 본문 15px/20px · avatar 40px · media radius 16px |
| Instagram | bg #FFFFFF · text #262626 · secondary #8E8E8E · link #0095F6 · border #DBDBDB · avatar 32px |
| 공통 폰트 스택 | -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial |

LinkedIn, Facebook, Threads 는 Website 모드로 실제 UI 를 한 번 캡처해 값을 잰다. 기억에서 값을 지어내지 않는다.

**출력은 매개변수화된 HTML 템플릿이다.** 콘텐츠를 슬롯으로 빼서, 같은 틀에 다른 글을 넣을 수 있게 한다.

```html
<!-- template.html — 슬롯은 data-slot, 기본값은 레퍼런스 콘텐츠 -->
<article class="post" style="width:{{width}}px">
  <img data-slot="avatar" src="{{avatar}}" alt="">
  <strong data-slot="displayName">{{displayName}}</strong>
  <span data-slot="handle">{{handle}}</span>
  <p data-slot="body">{{body}}</p>
  <img data-slot="media" src="{{media}}" alt="">
  <span data-slot="likes">{{likes}}</span>
</article>
```

함께 `template.schema.json`(슬롯 이름 · 타입 · 최대 길이 · 기본값)과 `template.sample.json`(레퍼런스 값)을 둔다. 비교 렌더는 sample 값을 채운 결과로 한다.
