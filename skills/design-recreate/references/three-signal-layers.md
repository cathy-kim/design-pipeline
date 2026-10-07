# 3-Signal Depth Layer Rules

레퍼런스는 평면이 아니라 **깊이가 있는 레이어 스택**이다. Layer 수는 미리 정하지 않는다(보통 2~4). 요소 사이의 관계로 결정한다. 하나의 Layer 안에 이미지·텍스트·뱃지가 섞일 수 있다.

구현은 `auto-plan.ts` 의 `assignDepthLayers()` 하나뿐이다. 수동으로 배정할 때도 아래 규칙을 그대로 따른다.

---

## 1. 측정은 누가 하나 (교차 검증 우선순위)

| 항목 | 정답 소스 | Vision 의 역할 |
|---|---|---|
| 색(hex) | ImageMagick 픽셀/영역 평균 샘플링 | 어디를 잴지 안내 |
| 좌표·크기 | Vision bounding box → `magick -crop` 으로 실측 확인 | 요소 식별 |
| 앞뒤 관계(겹침에서 누가 위) | Vision | 주 담당 |
| 폰트 형태·semantic role | Vision(크롭 확대) | 주 담당 |
| 패턴 주기·도형 개수·투명도 | [procedural-analysis.md](procedural-analysis.md) 의 FFT/NCC·connected-components·alpha 역산 | 유무 감지 |

Vision 이 추정한 색을 CSS 에 그대로 쓰지 않는다. 충돌하면 ImageMagick 값을 채택한다.

```bash
magick ref.png -format "%[hex:p{X,Y}]" info:                               # 한 점
magick ref.png -crop 10x10+X+Y +repage -scale 1x1! -format "%[hex:p{0,0}]" info:   # 10x10 평균
magick ref.png -colors 10 -define histogram:unique-colors=true -format "%c" histogram:info: | sort -rn | head
```

---

## 2. 세 시그널

### Signal 1 — 물리적 겹침 (최우선)

두 bounding box 가 교차하면 어느 쪽이 위인지 Vision 에 묻는다. 위에 있는 요소의 `overlaps_above` 에 아래 요소 id 를 적는다.

```
교차: A.x < B.x+B.w  AND  A.x+A.w > B.x  AND  A.y < B.y+B.h  AND  A.y+A.h > B.y
```

bbox 가 실제로 교차하지 않는 `overlaps_above` 항목은 무시한다(Vision 오답 방지).

### Signal 2 — 시각적 무게

```
score = clamp(fontSize/150)          * 0.30   (텍스트만, px)
      + clamp((fontWeight-100)/800)  * 0.15   (텍스트만)
      + colorContrast                * 0.25   (배경 대비 명도차 0~1)
      + clamp(area/0.5)              * 0.15   (캔버스 대비 면적)
      + semanticBoost                * 0.15
```

| semantic role | boost |
|---|---|
| cta · price · discount | 1.0 |
| headline · hero | 0.7 |
| body · sub-copy | 0.4 |
| spec · pill | 0.3 |
| logo · badge | 0.2 |
| decoration | 0.1 |
| background | 0.0 |
| (없음) | 0.3 |

| score | 의미 |
|---|---|
| ≥ 0.85 | 최전면 강조 (큰 할인율 숫자 등) |
| 0.60–0.84 | 주요 콘텐츠 |
| 0.35–0.59 | 일반 콘텐츠 |
| 0.15–0.34 | 보조 요소 |
| < 0.15 | 배경 |

### Signal 3 — 의미적 역할

role 은 boost 로만 작동한다. **겹침 판정을 뒤집지 못한다.** 배경(`background`) 만 예외로 항상 z0 이다.

---

## 3. 배정 알고리즘

```
1. role == background, 또는 role 없음 + 텍스트 아님 + 면적 ≥ 90%  → z0
2. 나머지 요소의 기본 z:
     score ≥ 0.75 → 2   (강조 오버레이로 승격)
     그 외        → 1
3. 겹침 반영: z(e) = max(기본 z, 1 + max z(e 가 덮는 요소들))   — 재귀, 순환은 1 로 끊는다
4. 사용된 z 값을 0,1,2… 로 압축
5. 역할 이름: z0 background · 맨 위(3개 이상일 때) overlay · 나머지 content
```

충돌 시 우선순위: **물리적 겹침 > 시각적 무게 > 의미적 역할.**

각 요소에 배정 사유(`reason`)를 남긴다. 리포트와 수정 단계에서 "왜 이 Layer 인가" 를 추적하는 근거다.

---

## 4. 전형적인 스택 (예시)

| 레퍼런스 유형 | Layers |
|---|---|
| 순수 타이포 배너 | z0 배경 · z1 텍스트+로고 |
| 상품 중심 광고 | z0 배경 · z1 상품+카피+로고 · z2 할인율(무게 승격) + 상품 위 도장(겹침) |
| 모델+상품 | z0 배경 · z1 모델+카피 · z2 모델 손 위 상품 · z3 상품 위 가격 스티커 |
| 콜라주 | z0 패턴 · z1 이미지들 · z2 오버레이 그라디언트 · z3 텍스트+CTA · z4 스티커 |
| 웹 랜딩 섹션 | 대부분 z0 섹션 배경 · z1 콘텐츠. 겹치는 hero 장식이 있을 때만 z2 |

---

## 5. 산출물 형식

`analysis/d1-elements.json` 의 요소마다 3-Signal 입력 필드를 둔다.

```json
{
  "id": "discount-number",
  "classification": "TEXT",
  "bounds": { "x": 200, "y": 700, "width": 650, "height": 250 },
  "semantic_role": "cta",
  "overlaps_above": [],
  "font_size_px": 120,
  "font_weight": 900,
  "color_contrast": 0.95
}
```

`plan/deconstruct-plan.json` 의 `depthLayers[]`:

```json
{ "z": 2, "role": "overlay", "elements": [
  { "id": "discount-number", "classification": "TEXT", "method": "L5",
    "semanticRole": "cta", "visualWeight": 0.83, "reason": "visualWeight 0.83 >= 0.75 → promoted" },
  { "id": "cert-stamp", "classification": "COMPONENT", "method": "L3",
    "semanticRole": "badge", "visualWeight": 0.16, "reason": "overlaps hero-product → above it" }
]}
```

`method` 는 요소 유형별 구현 방법이다. 빌드 순서는 [layer-build.md](layer-build.md).

---

## 6. 금지

| 금지 | 대신 |
|---|---|
| 모든 요소를 같은 Layer 에 평평하게 | 3-Signal 로 깊이 배정 |
| Layer 수를 미리 고정(항상 L0–L5 여섯 장 등) | 관계로 결정. L0–L5 는 구현 방법 분류일 뿐 z 가 아니다 |
| 큰 글자와 작은 글자를 같은 깊이로 | 무게 점수로 승격 |
| Vision 색 추정을 CSS 에 직접 | ImageMagick 측정값 |
