# Grid Rules — 입력 판별 · 캡처 · 그리드 섹셔닝 · 레이아웃 그리드 · Layout Region

design-recreate Phase 1~2 의 상세 규칙. 스크립트는 전부 `${CLAUDE_PLUGIN_ROOT}/skills/design-recreate/scripts/` 아래에 있다.

---

## 1. 입력 모드 판별

| 입력 | 모드 | 정답 소스 |
|---|---|---|
| `http(s)://` URL | **Website** | DOM computed style + Playwright 캡처. 그리드는 CSS 에서 직접 읽는다 |
| `.png` `.jpg` `.jpeg` `.webp` | **Image** | ImageMagick 픽셀값 + Vision 구조 분석 |
| SNS 플랫폼 UI 스크린샷(프로필 아바타 + 유저네임 + 본문 + 인게이지먼트 바) | **SNS Template** (Image 의 하위 Fast-Path) | 플랫폼 표준 UI 값 + 콘텐츠 추출 |
| 여러 장 | Batch Image — 장마다 독립 실행 후 결과 병합 | |

판별 순서: SNS Template → Image → Website. SNS 조건이 하나라도 애매하면 일반 Image 모드로 간다.

Website 모드도 결국 **캡처 이미지가 비교 기준**이 된다. Phase 2 이후는 두 모드가 같은 파이프라인을 탄다.

---

## 2. 캡처 (Website 모드)

| 목적 | 명령 |
|---|---|
| 3개 뷰포트 표준 캡처 | `node multi-viewport-capture.js <url> <out-dir>` |
| 스크롤 리빌·인트로 오버레이가 있는 페이지 | `node cap-page.js <url> <out.png> --viewport=1440x900 --reveal=.reveal --remove=.intro-overlay` |
| 첫 화면만 | `cap-page.js ... --fold` |
| 반응형 그리드 | `node detect-layout-grid.js <url> --all-viewports --output=grid.json` |
| 요소 셀렉터·computed style | `node inspect-element.js <url> [selector]` |
| 폰트·이미지 원본 URL 확보 | `node capture-network.js <url> <out.har> --filter=font,image` |
| 성능 비교가 필요할 때만 | `node analyze-performance.js <url>` |

뷰포트 표준: Desktop 1920(또는 1440), Tablet 768, Mobile 375. 재현 비교는 **레퍼런스를 캡처한 뷰포트와 같은 크기**로 해야 한다.

---

## 3. 그리드 섹셔닝 (N×M 셀)

```bash
node grid-section-image.js <reference.png> .design/recreate/cells --rows=4 --cols=4
# → cell-{r}-{c}.png, grid-overlay.png, grid-manifest.json
```

| 이미지 폭 | 밀도 | 이유 |
|---|---|---|
| < 500px | 3×3 | 셀이 너무 작으면 Vision 정확도 저하 |
| 500–1200px | 4×4 (기본) | |
| 1200–1600px | 6×6 | |
| > 1600px | 6×6 또는 8×8 | |

- 마지막 행/열이 남는 픽셀을 흡수한다(최대 cols-1 / rows-1 px 차이).
- 셀이 50px 미만이면 밀도를 낮춘다.
- 셀별로 기록: 배경색(ImageMagick), 타이포 유무·크기 범주·굵기, UI 요소 태그(button/image/text-block/icon/card/navigation/logo/divider/form-input/decoration/empty), 셀 역할(header/nav/hero/content/sidebar/footer/image/decoration/empty).
- 셀 분석은 `design-reconstructor` 에이전트에 위임할 수 있다. 결과는 `.design/recreate/cells/analysis.json`.

**셀 섹션 vs 의미 섹션.** `grid-manifest.json` 셀은 진단용 고정 격자다. 자기 수정 루프의 섹션 일치율은 **의미 섹션**(header, hero, feature-grid, footer 등 실제 레이아웃 블록)으로 매기는 것이 기본이다. 의미 섹션을 `.design/recreate/sections.json` 에 레퍼런스 px 좌표로 적는다.

```json
[
  { "id": "header", "x": 0, "y": 0,   "width": 1440, "height": 96 },
  { "id": "hero",   "x": 0, "y": 96,  "width": 1440, "height": 640 }
]
```

의미 섹션을 잡기 어려운 단일 캔버스(광고, SNS 포스트)는 `grid-manifest.json` 을 그대로 `--sections` 로 넘긴다.

그리드 시각화:

```bash
node grid-overlay.js <reference.png> <out.png> --cols=12 --gutter=24 --margin=64
```

---

## 4. 레이아웃 그리드 감지 (7 타입)

| 타입 | 판별 신호 | 구현 |
|---|---|---|
| Regular | 동일 폭 N 컬럼 반복 | `grid-template-columns: repeat(N, 1fr)` |
| Modular | 행과 열 모두 등간격 모듈 | `grid-template-columns` + `grid-template-rows` 등간격 |
| Baseline | 텍스트 기준선만 수평 정렬 | 4/8px 수직 리듬 |
| Golden Ratio | 인접 영역 비 ≈ 1.618 | `1fr 1.618fr` |
| Bento | 크기가 다른 직사각형 셀 타일 | `grid-template-areas` + span |
| Asymmetric | 의도적 비대칭(2:1, 3:1) | `2fr 1fr` |
| Freeform | 위 어느 것도 아님 | Region + absolute |

**Website 모드:** `detect-layout-grid.js` 가 모든 grid/flex 컨테이너의 computed style 을 읽는다. CSS 값이 정답이다.

**Image 모드:** Vision 으로 추론하고(`design-reconstructor` 에 위임 가능) 아래 점수로 신뢰도를 매긴다.

```
+0.30  3개 이상의 컬럼 경계가 등간격(±5%)
+0.20  gutter 일정(±3px)
+0.20  좌우 margin 대칭(±5px)
+0.30  콘텐츠 블록의 80% 이상이 그리드 라인에 정렬
```

- ≥ 0.8 확정 · 0.5–0.8 후보로 표기 · < 0.5 Freeform 처리
- 결정 트리: 동일 폭 반복? → 행도 등간격이면 Modular, 아니면 Regular → 1.618 비? Golden → 다양한 크기 타일? Bento → 명시적 비대칭? Asymmetric → 기준선만? Baseline → 나머지 Freeform.

**반응형:** 1920/768/375 각각에서 컬럼 수를 읽어 breakpoint 로 매핑한다(예: 12 → 8 → 4). 재현 코드에 같은 breakpoint 를 쓴다. `.design/system/` 이 있으면 그 breakpoint 토큰을 우선한다.

---

## 5. Layout Region (같은 Depth Layer 안의 정렬 그룹)

3-Signal 깊이 배정([three-signal-layers.md](three-signal-layers.md)) **뒤에** 실행한다. 정렬 축을 공유하는 요소를 flex/grid 컨테이너로 묶어, 좌표 추정 오차를 요소 단위가 아니라 Region 단위로 줄인다.

**정렬 축(캔버스 대비 %):**

- 수직 축 공유: 2개 이상 요소의 left / center / right x 가 ±3% 이내
- 수평 축 공유: 2개 이상 요소의 top y 가 ±3% 이내
- 균등 간격: 연속 요소 간 거리 편차 ±2% 미만

**Region 타입:**

| 타입 | 조건 | CSS |
|---|---|---|
| flex-column | 같은 x 축, 순차 y, 균등 간격 | `display:flex; flex-direction:column; gap:Npx` |
| flex-row | 같은 y 축, 순차 x | `display:flex; flex-direction:row; gap:Npx` |
| grid | 2D 행렬 배치 | `display:grid; grid-template-columns:…` |
| absolute | 묶을 수 없음 | `position:absolute` |

**묶는 조건(2개 이상 충족):** 공유 정렬 축 · 일정한 간격 · 인접한 semantic role · 비슷한 크기/굵기/색 범위.

**절대 묶지 않는다:**

- 서로 다른 Depth Layer 의 요소
- overlaps 관계가 있는 요소 쌍
- 캔버스 면적 40% 이상의 hero 이미지
- 다른 요소 위에 얹힌 도장/스티커
- 요소 1개짜리 Region
- confidence < 0.6 인 Region (absolute 로 되돌린다)

Region 의 anchor(left/top)와 width 는 bounding box 에서, gap 은 측정한 간격에서 가져온다. 요소 안쪽의 소규모 나열(태그 묶음 등)은 별도 Region 이 아니라 그 요소의 `innerLayout` 으로 적는다.
