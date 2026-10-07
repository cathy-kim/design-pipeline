# 정적 규칙 (Layer A) — 패턴 정본

> `scripts/token-audit.js` 가 이 문서의 패턴을 그대로 구현한다. 패턴을 바꾸면 두 곳을 같이 바꾼다.
> 근거: CONTRACT §1-6 (한 화면 3색, 닫힌 radius 스케일, pill 버튼·네온 글로우·글래스모피즘·그라디언트 보더 금지).
> 출처: design-qa-reviewer 의 정적 감사(대비·타이포·간격·모션)를 brand_config 기반으로 일반화했다. 브랜드 값은 하드코딩하지 않는다.

## 입력

| 값 | brand_config 경로 | 없을 때 |
|---|---|---|
| Primary 색 | `tokens.colors.primary` (문자열 또는 스케일 객체, 안의 모든 색) | 색 대조 없이 색상군만 센다 |
| Accent 색 | `tokens.colors.accent` | 〃 |
| Neutral 스케일 | `tokens.colors.neutral` | 채도 기준만 쓴다 |
| Semantic | `tokens.colors.semantic` | 없음 |
| Radius 스케일 | `tokens.radius.scale` `{name: px}` (숫자, `"4px"`, `"0.25rem"` 허용) | R2·R3 SKIP |

## 스캔 범위

- 확장자: `css scss sass less html htm jsx tsx js ts mjs vue svelte mdx`
- 제외 디렉터리: `node_modules .git .next dist build out coverage .turbo`, 그리고 `.design/qa`
- 제외 파일: `*.test.*`, `*.spec.*`, `*.d.ts`, `*.min.*`, `package*.json`
- **토큰 정의 파일**(`tailwind.config.*`, `nativewind.config.*`, `*token*.*`, `*theme.*`, `guards/` 아래): 팔레트 전체를 담는 게 정상이므로 R1·W1·R3(리터럴 검사)에서 면제하고, 대신 R3 의 이름-값 대조를 받는다.

## R1 colors-per-screen — 한 화면 3색 (FAIL)

화면 = 파일 하나. 파일에서 색을 모아 **역할**로 분류하고, semantic 을 뺀 역할 수가 `--max-colors`(기본 3)를 넘으면 FAIL.

색 수집 패턴:

```
리터럴:   (?<![&\w])#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b   |   (rgba?|hsla?)\([^)]*\)
          단, 앞 6글자가 href=" 또는 url( 이면 무시 (앵커·URL 오인 방지)
Tailwind: (bg|text|border(-[trblxy])?|ring|ring-offset|fill|stroke|from|via|to|outline|decoration|
           shadow|caret|divide|placeholder|accent)-<name>(-<50..950>)?(/<opacity>)?
```

분류 순서 (먼저 맞는 것):

1. alpha 0 → 무시
2. **neutral**: HSL 채도 < 0.12, 또는 명도 < 0.06 / > 0.97. Tailwind `slate gray zinc neutral stone black white`. 토큰 이름에 `foreground background border input card popover muted neutral surface`
3. **semantic**: brand semantic 색과 채널 차 ≤ 12. 토큰 `destructive error danger success warning info`
4. **neutral**: brand neutral 스케일과 채널 차 ≤ 12
5. **primary**: brand primary 색과 채널 차 ≤ 12 또는 hue 차 ≤ 15°. 토큰 `primary*`
6. **accent**: 같은 기준으로 brand accent. 토큰 `accent* secondary*`
7. 그 밖: **팔레트 밖 색상군**. hue 20° 안의 색은 한 군으로 묶는다. 군 하나가 역할 하나로 센다. 동시에 W1 경고.

Tailwind 기본 팔레트 이름은 대표 hue 로 환산한다: red 0, orange 25, amber 38, yellow 48, lime 85, green 142, emerald 160, teal 173, cyan 189, sky 199, blue 217, indigo 239, violet 258, purple 271, fuchsia 292, pink 330, rose 350.

## R2 radius-scale — brand 스케일 자체 정합 (FAIL)

**정본은 `.design/brand_config.json` 의 `tokens.radius.scale` 하나다.** token-audit.js 에는 radius 값 표가 없다. R2·R3 는 매 실행마다 이 파일에서만 스케일을 읽고, 파일이 없거나 스케일이 비면 R2·R3 를 SKIP 으로 보고한다. `--config <path>` 는 그 파일의 위치만 바꾼다(픽스처 테스트용). 다른 출처를 섞지 않는다.
**값 자체는 판정하지 않는다.** 예를 들어 lg=12 는 순서가 맞으면 PASS 다.

검사는 CONTRACT §5 "radius 규칙(확정)" 그대로이며, design-system `scripts/build-system.ts` 의 `radiusErrors()`(= `guards/radius-scale.test.ts`)와 **같은 함수**다. token-audit.js 의 `radiusErrors()` 는 그것을 그대로 옮긴 것이고 메시지 문자열도 같다. 한쪽을 바꾸면 셋을 같이 바꾼다.

1. **허용 이름**: `none sm md lg xl 2xl 3xl full` 8개와 숫자 이름(`"6"`, `"10"`)뿐. `xs`, `4xl`, `DEFAULT`, `pill` 등은 `unknown step name` 으로 FAIL
2. **이름 있는 단계의 최소 구성**: `none` 외의 이름 있는 단계가 하나라도 있으면 `none: 0` 이 있어야 하고, `none` 말고도 이름 있는 단계가 **두 개 이상** 있어야 한다. `{"lg": 2}` 단독 → FAIL. 숫자 이름만 있는 `{"none": 0, "6": 6, "10": 10}` → PASS
3. **순서**: 이름 있는 단계끼리 `none < sm < md < lg < xl < 2xl < 3xl < full` 로 값이 **엄격 증가**. `sm=6, md=6` → FAIL, `md=6, lg=4` → FAIL
4. **숫자 이름 = 값**: `"8": 10` → FAIL
5. **값 형식**: 음이 아닌 정수 px 숫자. `"12px"` 같은 문자열 → FAIL

픽스처(`node --test test/`)로 확인한 결과다.

| 스케일 | R2 |
|---|---|
| `none0 sm4 md8 lg12 full9999` (lg=12, 순서 맞음) | PASS |
| 픽스처 `test/fixtures/pill-brand.json` (`none`, `sm`, `md`, `10`, `lg: 12`, `full`) | PASS |
| `none0 6 10` (숫자만) | PASS |
| `xs` 또는 `4xl` 포함 | FAIL (unknown step name) |
| `lg: 2` 단독 | FAIL (none:0 필요, 두 단계 이상 필요) |

## R3 radius-off-scale — 닫힌 스케일 (FAIL)

| 위치 | 패턴 | 판정 |
|---|---|---|
| CSS | `border(-<corner>)?-radius:\s*<values>` | 각 길이값(px/rem/em→px)이 스케일 값에 없으면 FAIL. `var() calc() %` 는 건너뜀 |
| JS style | `borderRadius:\s*['"]?<n>(px\|rem)?` | 같은 기준 |
| Tailwind | `rounded(-<side>)?(-<name>\|-\[<v>\])?` | 이름 없는 `rounded` → FAIL(스케일 이름을 쓴다). `[임의값]` (`rounded-[7px]`) → 스케일 값이어야 함. 이름 → 스케일 키여야 함(`full` 은 허용, pill 여부는 R4 가 판단) |
| 토큰 정의 | `borderRadius:\s*\{ name: value, ... \}` | 이름이 스케일에 없거나 값이 다르면 FAIL (**이름-값 불일치**) |
| 토큰 정의 | `--radius-<name>:\s*<value>` | 스케일에 있는 이름인데 값이 다르면 FAIL |

## R4 pill-button — pill 버튼 금지 (FAIL)

버튼 판정: 태그가 `button` / `*Button`, `role="button"`, class 에 `btn`·`button`, `input[type=submit|button]`.
CSS 셀렉터는 `\bbutton\b | \.btn\b | \[role=button | \.cta\b | -button\b | button-`.

pill 판정:

```
Tailwind: rounded-(full|\[(9999px|999px|50%|100%)\]|<brand 스케일에서 값이 999 이상인 이름>)
JS style: borderRadius:\s*['"]?(9999|999|50%|100%)
CSS:      border-radius 첫 값이 >= 50% 또는 >= 100px
```

`button` 이 이름에 들어간 파일(버튼 프리미티브)은 모든 문자열 리터럴(cva variant 등)에서 pill 클래스를 찾는다.

**예외 (정사각 아이콘 버튼)**: 같은 class 에 `size-*` 또는 `aspect-square`, 또는 `h-X` 와 `w-X` 의 X 가 같음. CSS 는 같은 블록에 width = height 또는 `aspect-ratio: 1`.

## R5 neon-glow — 네온 글로우 금지 (FAIL)

그림자 값을 레이어로 쪼개(괄호 밖 쉼표) 각 레이어의 `offset-x offset-y blur` 와 색을 읽는다.

```
대상:  box-shadow: … | text-shadow: … | boxShadow: '…' | textShadow: '…' | drop-shadow(…)
       Tailwind shadow-[…] / drop-shadow-[…] (밑줄 = 공백)
FAIL:  blur >= 10px (text-shadow 는 >= 8px)  AND  색이 "채도 높음"
채도 높음: alpha >= 0.25 AND HSL s >= 0.5 AND 0.25 <= l <= 0.85
Tailwind 조합: 같은 class 문자열에 shadow-<chromatic|primary|accent>-<shade> AND shadow-(lg|xl|2xl)
```

`rgba(0,0,0,.12)` 같은 무채색 그림자는 blur 와 무관하게 PASS. `var()` 색은 판정 불가로 건너뛴다(Layer B 가 런타임 값으로 다시 잡는다).

## R6 glassmorphism — 글래스모피즘 금지 (FAIL)

```
(-webkit-)?backdrop-filter\s*:\s*[^;]*blur\(
backdropFilter\s*:\s*['"`][^'"`]*blur\(
(?<![\w-])backdrop-blur(?!-none)(-\w+|-\[[^\]]+\])?(?![\w-])
```

## R7 gradient-border — 그라디언트 보더 금지 (FAIL)

```
border-image(-source)?\s*:\s*[^;]*gradient\(            borderImage(Source)?: '…gradient(…'
한 규칙 블록에 gradient( + mask-composite: (exclude|xor|destination-out)      ← mask 트릭
한 규칙 블록에 gradient( + padding-box + border-box                              ← background-clip 트릭
한 class 문자열에 (bg-gradient-to-*|bg-linear-to-*|bg-[linear-gradient…) + (p-px|p-[1px]|p-[2px]|p-0.5)   ← 래퍼 트릭
```

## 예외 — `brand_config.exceptions` → WAIVED

```json
"exceptions": [
  { "rule": "no-pill-button", "scope": "components.button",
    "reason": "제품 Button 은 승인된 pill 이고 제품 radius 가드가 강제한다", "evidence": "Button.tsx, radius-canon.test.ts" }
]
```

덮인 위반은 FAIL/WARN 대신 **WAIVED**(PASS·FAIL 외 세 번째 상태)가 된다. 실패로 세지 않아 실행을 막지 않지만, `token-audit.md` 와 `qa/report.md` 의 WAIVED 표에 원래 심각도, `file:line`, 예외 rule/scope, reason, evidence 를 **항상** 그대로 인용한다. 규칙 요약 상태는 살아 있는 위반이 있으면 FAIL/WARN, 전부 면제됐으면 WAIVED, 없으면 PASS.

**rule 이름 매핑** (대소문자 무시, `"*"` = 전 규칙):

| 규칙 | exceptions 의 rule 로 쓸 수 있는 이름 |
|---|---|
| R1 colors-per-screen | `R1` `colors-per-screen` `max-3-colors` `three-colors` `3-colors` |
| R2 radius-scale | `R2` `radius-scale` |
| R3 radius-off-scale | `R3` `radius-off-scale` `closed-radius` `radius-closed-scale` |
| R4 pill-button | `R4` `pill-button` `no-pill-button` `no-pill` `pill` |
| R5 neon-glow | `R5` `neon-glow` `no-neon-glow` `no-glow` `glow` |
| R6 glassmorphism | `R6` `glassmorphism` `no-glassmorphism` `no-glass` |
| R7 gradient-border | `R7` `gradient-border` `no-gradient-border` |
| W1 off-palette-color | `W1` `off-palette-color` |

**scope 매칭** — 생략 또는 `"*"` 는 전부. 쉼표로 여러 항목을 줄 수 있고 하나라도 맞으면 해당한다. 각 항목은:

- `/` 를 포함하면 경로 접두: 위반 파일 경로가 그것으로 시작 (`src/legacy/`)
- 점 경로면 마지막 조각을 쓴다: `components.button` → `button`
- 그 밖 자유 문장은 단어로 쪼갠다: `circular badge (rounded-full)` → `circular`, `badge`, `rounded-full`
- 그 단어가 **모두** 위반의 파일 경로 + 매치 문자열에 들어 있어야 한다 (`button` 은 `btn` 도 맞는다 — R4 의 버튼 판정과 같다)

예: 픽스처 브랜드의 `no-pill-button` / `components.button` 은 `<button className="rounded-full …">` 와 `.btn-primary { border-radius: 9999px }` 를 면제한다. 칩 전용 `no-pill` / `chip, circular badge (rounded-full)` 는 버튼을 면제하지 않는다 — 버튼 매치에는 `chip` 도 `circular badge` 도 없다(사유 문장의 "Buttons stay 4px" 와 일치).

검증: `cd ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts && node --test test/` — 픽스처 pill 버튼 → WAIVED, 같은 코드에 예외 없음 → FAIL, 칩 전용 예외는 버튼 미면제, 픽스처 스케일 R2 PASS, 순서·숫자·이름 위반 R2 FAIL.

## W1 off-palette-color (WARN)

brand_config 가 있을 때, R1 분류 7단계로 떨어진 색마다 1건. FAIL 은 아니지만 report 에 남겨 design-system 토큰으로 옮기게 한다.

## 정적 감사가 못 잡는 것 (Layer B 로 넘김)

- CSS 변수·런타임 테마로 결정되는 색과 그림자 → `qa-runner.js` 의 computed-style 검사
- 실제 버튼 높이 대비 radius (`rounded-xl` 이 작은 버튼에서 pill 이 되는 경우) → Layer B `effects.pill-button` (radius ≥ 높이/2 이고 폭 > 높이×1.2)
- 대비율 → Layer B axe `color-contrast`

## 디자인 리뷰 보조 기준 (사람 판단, report 의 "권고" 칸)

design-qa-reviewer 에서 가져온 기준. 기계 판정이 아니므로 FAIL 로 세지 않는다.

- 대비: 본문 4.5:1 (AA), 큰 글자 3:1. 다크 모드 본문은 7:1 권장
- 계위: 크기/무게 → 간격 → 명도 순. 색으로 계위를 만들었으면 권고
- 간격: brand `tokens.spacing.scale` 밖의 값
- 모션: brand `motion.durations` 밖의 duration, bounce/elastic easing
- 그리드: 요소가 컬럼 경계에 정렬, gutter 일관, breakpoint 에서 컬럼 수 변화
