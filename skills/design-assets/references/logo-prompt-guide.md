# Logo Prompt Guide

`scripts/logo-prompt-builder.ts` 는 `brand_config.json` 으로 로고 **프롬프트**를 만든다. 이미지는 `generate-image.ts --mode logo` 로 만든다.
AI 로고는 초안이다. 확정 로고는 벡터로 다시 그려 `brands/<id>/` 에 넣고 `assets.logo` 로 가리킨다.

## 입력 매핑

| brand_config | 빌더 입력 | 쓰임 |
|---|---|---|
| `brand.name` | name | 철자 고정 문장 |
| `brand.mood[]` | personality(알려진 성격어) + extraMood(나머지) | 시각 속성, 브랜드 맥락 |
| `brand.industry` 또는 `--industry` | industry | 업종 키워드, 로고 타입 추론 |
| `brand.description` | description | industry 가 없을 때 맥락 |
| `tokens.colors` | primary · accent · neutral(bg) | Color palette 줄 |
| `visualSystem.logoDirection` 또는 `--symbol` | symbolDescription | 심볼 설명 |
| `artStyle.negative[]` | negative | negative prompt 에 추가 |

알려진 성격어: professional, playful, luxurious, friendly, bold, elegant, innovative, trustworthy, energetic, sophisticated.

## 5원칙

| 원칙 | 기준 |
|---|---|
| Simplicity | 2~3색, 16px 파비콘에서도 식별 |
| Memorability | 고유한 실루엣, 클립아트 금지 |
| Timelessness | 글로시·3D 그림자·글로우 같은 유행 효과 금지 |
| Versatility | 밝은/어두운 배경, 가로/세로 조합 |
| Relevance | 업종과 성격에 맞는 시각 언어 |

## 로고 타입 · 스타일

| 타입 | 설명 | 추론 규칙 (명시 안 했을 때) |
|---|---|---|
| wordmark | 글자만 | beauty/fashion + luxurious |
| lettermark | 이니셜 | 이름 3자 이하 |
| pictorial | 아이콘 | — |
| abstract | 추상 형태 | tech |
| emblem | 배지/씰 | food (playful 아님) |
| combination | 심볼+글자 | 기본값 |
| mascot | 캐릭터 | food + playful |

스타일: minimalist(기본) · modern · vintage · geometric · hand-drawn · gradient · line-art · flat · isometric · calligraphy.
`--style calligraphy` 에는 `--calligraphy` 로 세부 서체를 지정한다: `Modern Brush` · `Gothic` · `Copperplate` · `Graffiti` · `Asian Ink`.

## 공식

```
[Style cue] [structure keyword] for [brand context], [color palette], [format modifiers]
```

예 (placeholder 브랜드 acme):

```
geometric combination logo, combination mark with symbol and wordmark, for "Acme",
a everyday productivity tools brand that is bold, trustworthy, calm.
Color palette: primary color #1F4FFF, accent #FFB800, on #FFFFFF background.
The symbol should represent: an upward arrow formed by two overlapping squares.
```

## 플랫폼별

| 플랫폼 | 강점 | 형식 |
|---|---|---|
| gemini (기본) | 구조화된 지시, 글자 렌더링 | Role / Task / Design Brief / Principles / Technical / Negative |
| midjourney | 스타일 자유도 | 짧은 키워드 + `--no` + `--ar 1:1 --stylize 100`. 글자 약함 |
| dalle | 개념 이해 | 자연어 문단 |
| ideogram | 타이포 정확도 | 워드마크·레터마크에 적합 |

## CLI

| 옵션 | 예 |
|---|---|
| `--industry` | `--industry tech` |
| `--personality` | `--personality bold,trustworthy` (기본: brand.mood) |
| `--style` / `--type` | `--style geometric --type abstract` |
| `--calligraphy` | `--calligraphy "Modern Brush"` |
| `--symbol` | `--symbol "leaf with droplet"` (기본: visualSystem.logoDirection) |
| `--tagline` | `--tagline "Work, simplified"` |
| `--platform` / `--all-platforms` | `--platform ideogram` |
| `--design-dir` | 기본 `./.design` |

출력: `.design/assets/logo-prompt/prompts.json` 과 `<platform>.txt`. manifest 에 `kind: "prompt"` 로 남는다.

## 다음 단계

```bash
npx tsx "${CLAUDE_PLUGIN_ROOT}/skills/design-assets/scripts/generate-image.ts" \
  --mode logo --name logo-a --prompt-file .design/assets/logo-prompt/prompts.json --canvas logo-square --seed 1
```

같은 프롬프트로 seed 를 3~4개 바꿔 후보를 만들고, 흑백 변환과 16px 축소로 식별성을 확인한다.

## 출처

- superside.com/blog/ai-prompts-logo-design
- quillbot.com/blog/ai-prompt-writing/ai-logo-promts
- inkbotdesign.com/logo-design-principles
