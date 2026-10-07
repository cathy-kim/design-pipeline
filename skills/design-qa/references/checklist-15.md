# 15항목 시각 검증 체크리스트 (Layer C)

> 출처: antigravity Phase 5B + design-workflow D4.4 를 하나로 합쳤다. 참조 이미지(또는 참조 URL 캡처)가 있는 작업,
> 즉 Recreation · Deconstruct · SNS Template · Inspired 에서만 돌린다. 참조가 없으면 Layer C 전체가 N/A 다.

## 판정 규칙

- 항목마다 **개별 PASS/FAIL**. "비슷하다"는 PASS 가 아니다. 사람 눈에 차이가 보이면 FAIL 이다.
- **PASS 조건**: 15개 중 13개 이상 PASS **그리고** 15번 PIXEL_COLOR_MATCH 와 `pixel-diff.js` 의 `pass` 가 모두 true.
- 정량 근거가 있는 항목(2, 5, 6, 12, 15)은 숫자를 report 에 적는다. 정성 항목은 비교한 스크린샷 경로를 적는다.
- FAIL 이 나오면 그 항목에 해당하는 레이어/요소만 고친다(전체 재구축 금지). 수정은 design-recreate 의 몫이고, QA 는 판정과 위치만 넘긴다.

## 항목

| # | ID | 기준 | 측정 방법 |
|---|---|---|---|
| 1 | FONT_MATCH | 글자 형태(두께, 세리프, 터미널)가 동일 | 참조·결과 크롭을 나란히 놓고 Read 로 육안 비교 |
| 2 | FONT_SIZE | 텍스트 폭이 캔버스 대비 동일 비율 (±2%) | Playwright `boundingBox()` 폭 ÷ viewport 폭 vs 참조에서 잰 비율 |
| 3 | PHOTO_POSE | 인물 포즈·시선·프레이밍 일치 | 육안 |
| 4 | PHOTO_CROP | object-fit/position 크롭 후 보이는 영역 일치 | `pixel-diff.js --regions` 로 사진 영역 평균색 비교 + 육안 |
| 5 | PROPORTIONS | 모든 요소 비율 ±2% | 주요 요소 boundingBox 비율 표 |
| 6 | COLORS | 주요 색상 hex 채널 차 ±10 | `pixel-diff.js --regions` (기본 `--region-tolerance 10`) |
| 7 | EFFECTS | outline, shadow, radius 시각적으로 동일 | 육안 + Layer A 결과(금지 효과가 끼어들지 않았는지) |
| 8 | SPACING | 수직/수평 간격 비율 일치 | 인접 요소 boundingBox 간격 비교 |
| 9 | SHAPE_DIRECTION | 곡률 방향 정확 (top-only / bottom-only / all) | `border-radius` 4값 순서(TL TR BR BL) 확인 |
| 10 | TEXT_CLASSIFICATION | serif/sans 혼동 없음, 텍스트 색 톤 정확 | computed `font-family`, 텍스트 영역 평균색 |
| 11 | STROKE_WEIGHT | text-stroke 두께 동일 | 육안 (확대 크롭) |
| 12 | COLOR_TONE_PRECISION | 배경/텍스트/강조색 밝기 ±3, 색온도 일치 | `pixel-diff.js --samples ... --sample-tolerance 3` |
| 13 | ANNOTATION_MATCH | 오버레이 주석(원·하이라이트·밑줄) 정확 재현 | 육안 |
| 14 | TEXTURE_PRECISION | 줄선 간격·노이즈 강도 동일 | 육안 + 해당 영역 diff 이미지 |
| 15 | PIXEL_COLOR_MATCH | 동일 좌표 색 채널 차 ±5 | `pixel-diff.js` 기본 5점 샘플 (`checks.pixelColorMatch`) |

## pixel-diff 호출 예

```bash
# 15번 + 전체 픽셀 비율
node ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/pixel-diff.js \
  .design/qa/reference.png .design/qa/screenshots/home-light-1280.png \
  --threshold 0.02 --out .design/qa/diff/home-1280.png

# 6번: 히어로 영역과 CTA 영역의 평균색 (ImageMagick crop 문법 WxH+X+Y, 참조 이미지 좌표계)
node ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/pixel-diff.js ref.png actual.png \
  --regions "1280x480+0+0;200x56+540+400"

# 12번: 배경·본문 텍스트 지점을 ±3 으로
node ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/pixel-diff.js ref.png actual.png \
  --samples "40,40;640,300" --sample-tolerance 3
```

## report 표 형식

```markdown
| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 6 | COLORS | FAIL | hero 평균 #2255dd → #2a5fe0 (Δ10 경계), CTA Δ23 — `src/Hero.tsx:12` |
| 15 | PIXEL_COLOR_MATCH | PASS | 5/5 샘플 Δ≤5 |
```

## 범위 밖

design-workflow D4 의 16 DEPTH_ORDER, 17 REGION_ALIGNMENT 는 레이어 분해 계획(D2)과 대조해야 하므로
design-recreate 의 자기 수정 루프가 소유한다. QA 는 그 결과를 `recreate-report.md` 에서 읽기만 한다.
