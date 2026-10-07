# Image Generation (Gemini) — design-assets 단일 구현

이 플러그인에서 Gemini 이미지를 만드는 코드는 `scripts/generate-image.ts` 하나뿐이다(CONTRACT §1-3).
다른 스킬(design-recreate 의 `generated-image` 레이어 등)은 이 스크립트를 `${CLAUDE_PLUGIN_ROOT}/skills/design-assets/scripts/generate-image.ts` 로 부른다.
구현을 고른 이유는 [decision-log.md](decision-log.md) 에 있다.

## 1. 입력

| 출처 | 키 | 프롬프트에서의 역할 |
|---|---|---|
| `brand_config.json` | `brand.name`, `brand.mood[]` | 브랜드명, Mood 줄 |
| | `artStyle.artStyleName` | "Generate a {artStyleName} image ..." |
| | `artStyle.negative[]` | FORBIDDEN 목록에 추가 |
| | `tokens.colors.primary / accent / neutral` | Colors 줄. 이 3색 외 지배 색 금지 |
| | `assets.canvasSizes.<key>` | 목표 크기 → 가장 가까운 Gemini 비율 |
| | `assets.imagePromptConfiguration` | 아래 표 |
| CLI | `--subject` 또는 `--prompt` 또는 `--prompt-file` | 피사체 / 완성 프롬프트 / logo-prompt-builder 출력 |
| 환경변수 | `GEMINI_API_KEY` | 유일한 키 출처. `.env` 파일을 읽지 않는다 |

`assets.imagePromptConfiguration` 에서 읽는 키 (모두 선택):

| 키 | 기본값 | 설명 |
|---|---|---|
| `model` | `gemini-3-pro-image-preview` | Tier 1 모델 |
| `fallbackModel` | `gemini-3.1-flash-image-preview` | Tier 2 모델 |
| `styleKeywords[]` | — | Keywords 줄 |
| `lighting` | `soft, diffused` | Lighting 줄 |
| `composition` | `single clear focal point, generous margins` | COMPOSITION 첫 줄 |
| `negativeSpace` | card·ad 40, 그 외 20 | 타이포 오버레이용 여백 % |
| `negative[]` | — | FORBIDDEN 에 추가 |
| `prefix` / `suffix` | — | 프롬프트 앞뒤에 그대로 붙임 |
| `style` (별칭) | — | `brands/_template.json` 의 키. styleKeywords 맨 앞에 붙는다 |
| `avoid[]` (별칭) | — | `brands/_template.json` 의 키. negative 에 합쳐진다 |

FORBIDDEN 목록은 소문자로 맞춘 뒤 중복을 제거한다.

## 2. 프롬프트 구조 (`--subject` 사용 시 자동 조립)

```
Generate a {artStyleName} image for {mode purpose} for the brand "{name}".
The image must contain absolutely no text, letters, captions, or typography of any kind; type is added later in HTML.

SUBJECT: {subject}

COMPOSITION:
- {composition}
- {negativeSpace}% negative space reserved for typography overlay
- Aspect ratio {4:5 | 1:1 | 9:16 | 16:9 ...}

STYLE:
- Colors: primary #..., accent #..., neutrals #... and #.... No other dominant hues.
- Mood: {brand.mood}
- Keywords: {styleKeywords}
- Lighting: {lighting}
- Quality: professional, high resolution

FORBIDDEN:
- NO text / numbers / logos / watermarks   (logo 모드에서는 빠진다)
- NO neon glow / glassmorphism / gradient borders   (CONTRACT §1-6)
- NO busy patterns / generic stock photo look
- NO {artStyle.negative ...} {imagePromptConfiguration.negative ...}
```

이미지 안에 글자를 넣지 않는다. 문구는 compose 단계에서 HTML 로 얹는다. 모델이 그래도 글자를 그리면 같은 seed 를 바꿔 재생성한다.
Gemini 3 Pro 는 "NO text" 한 줄만으로는 글자를 자주 그린다. 그래서 첫 문단에 금지 문장을 따로 둔다.

## 3. 3-Tier fallback (이 문서가 유일한 정의)

| Tier | 무엇 | 언제 다음으로 | manifest |
|---|---|---|---|
| 1 | REST `models/{model}:generateContent`, `model` = imagePromptConfiguration.model | HTTP 오류, 이미지 part 없음, 120초 타임아웃 | `tier: 1`, `model` |
| 2 | 같은 호출, `fallbackModel` | 위와 같음 | `tier: 2`, `model` |
| 3 | 브랜드 neutral 색 SVG placeholder (`<name>.placeholder.svg`) | — | `tier: 3`, `model: null`, `note` 에 실패 사유 |

- 키가 없으면 Tier 1·2 를 건너뛰고 바로 Tier 3 으로 간다. 키는 사람에게 채팅으로 요구하지 않는다.
- `--strict` 를 주면 Tier 3 대신 종료 코드 1로 끝난다. 최종 납품 직전에는 `--strict` 로 다시 돌린다.
- Tier 3 결과는 완성물이 아니다. 완료 조건에서 걸러진다(SKILL.md "완료 조건").
- 요청 본문: `generationConfig.responseModalities = ["TEXT","IMAGE"]`, `seed`, `imageConfig.aspectRatio`.
- 키는 `x-goog-api-key` 헤더로 보낸다. URL 쿼리에 넣지 않아 로그에 남지 않는다.

## 4. 참조 이미지 (image-to-image)

`--ref <path>` 를 주면 이미지 part 를 프롬프트 앞에 붙인다. 레이아웃은 유지하고 브랜드만 바꾸는 리브랜드 목업에 쓴다.

```
KEEP EXACTLY THE SAME: layout, item positions, camera angle, lighting.
CHANGE: all accent colors → {primary}; logo → {visualSystem.logoDirection}.
```

이 문장은 `--prompt` 로 직접 넘긴다. 참조 이미지 경로는 manifest `sources` 에 남는다.

## 5. seed · 크기 · 재현성

- `--seed` 를 주지 않으면 무작위 31비트 정수를 쓰고 manifest 에 남긴다. 같은 seed·프롬프트·모델이면 같은 결과에 가깝다(보장은 아님).
- 모델은 캔버스와 다른 픽셀을 줄 수 있다. 예를 들어 1080x1350 요청에 928x1152 를 준다. manifest 에 목표 `size` 와 실제 `pixels` 를 둘 다 남긴다. 업스케일은 하지 않는다. 템플릿이 `object-fit: cover` 로 맞춘다.
- 여러 장을 만들 때는 순차로 돌린다. 분당 한도에 걸리면(HTTP 429) 몇 초 기다렸다가 같은 seed 로 다시 돌린다.

## 6. 배경 제거 (투명 PNG 가 필요할 때)

```bash
magick in.png -fuzz 15% -transparent white out.png   # 흰 배경 단순 제거
rembg i in.png out.png                                # 복잡한 배경 (python rembg)
```

결과 파일도 manifest 에 남긴다. `generate-image.ts` 를 다시 돌리지 않으므로 직접 항목을 추가하고 `note: "bg-removed from <원본>"` 을 적는다.

## 7. 생성 후 확인

- [ ] 파일이 열리고 manifest 의 `pixels` 비율이 캔버스 비율과 맞다
- [ ] 이미지 안에 글자·로고·워터마크가 없다(logo 모드 제외)
- [ ] 지배 색이 brand 3색 범위 안이다
- [ ] 네온 글로우·글래스모피즘·그라디언트 보더가 없다
- [ ] manifest 에 `tier: 3` 항목이 남아 있지 않다
