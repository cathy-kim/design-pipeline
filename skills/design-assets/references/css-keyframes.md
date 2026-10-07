# CSS Keyframes — 독립 HTML 모션

mode `motion` 의 의존성 없는 HTML 버전이다. React 버전은 [motion-patterns.md](motion-patterns.md) 를 본다.
같은 타임라인을 순수 CSS `@keyframes` + `animation-delay` 로 옮긴다. 금지 효과(글로우·shine·border-beam·글래스모피즘)는 여기서도 쓰지 않는다.

## 1. 토큰 → CSS 변수

```css
:root {
  --c-primary: #1F4FFF;   /* tokens.colors.primary */
  --c-accent:  #FFB800;   /* tokens.colors.accent */
  --c-bg:      #FFFFFF;   /* neutral 가장 밝은 값 */
  --c-fg:      #111111;   /* neutral 가장 어두운 값 */
  --ease:      cubic-bezier(0.4, 0, 0.2, 1);     /* motion.easingCurves.standard */
  --ease-emph: cubic-bezier(0.34, 1.56, 0.64, 1);/* motion.easingCurves.emphasis */
  --d-fast: 120ms; --d-base: 200ms; --d-slow: 320ms; /* motion.durations (ms 그대로) */
  --font: Pretendard, sans-serif;                 /* tokens.typography.families.heading */
}
```

## 2. 키프레임 세트

```css
@keyframes fade-up   { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes pop-in    { from { opacity: 0; transform: scale(0) rotate(-90deg); } to { opacity: 1; transform: none; } }
@keyframes wipe-in   { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes grow-x    { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes draw      { from { stroke-dashoffset: var(--len, 1000); } to { stroke-dashoffset: 0; } }
@keyframes block-pass{ 0% { transform: translateX(-101%); } 50% { transform: translateX(0); } 100% { transform: translateX(101%); } }
```

| 키프레임 | 용도 | 권장 길이 · 이징 |
|---|---|---|
| `fade-up` | 텍스트·요소 등장 | `--d-slow` · `--ease` |
| `pop-in` | 심볼 조각 등장 | `--d-slow` · `--ease-emph` |
| `wipe-in` | 워드마크 드러내기 | `--d-slow` · `--ease` |
| `grow-x` | 언더라인(accent) | `--d-base` · `--ease`, `transform-origin: left` |
| `draw` | SVG 윤곽선 그리기 | 0.8~1.2s · `--ease`. `stroke-dasharray` 와 `--len` 을 path 길이로 |
| `block-pass` | primary 단색 블록이 지나가며 로고 노출 | 0.8s · `--ease` |

모든 등장 애니메이션은 `animation-fill-mode: both` 로 시작 전 상태를 유지한다.

## 3. 독립 HTML 골격

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{BRAND_NAME}} — logo intro</title>
<style>
  /* §1 변수 + §2 키프레임 */
  * { margin: 0; box-sizing: border-box; }
  body { min-height: 100vh; display: grid; place-items: center; background: var(--c-bg); color: var(--c-fg); font-family: var(--font); }
  .stage { display: grid; justify-items: center; gap: 16px; }
  .symbol { display: grid; grid-template-columns: repeat(2, 40px); gap: 4px; }
  .symbol i { width: 40px; height: 40px; background: var(--c-primary); animation: pop-in var(--d-slow) var(--ease-emph) both; }
  .symbol i:nth-child(1) { animation-delay: .2s; } .symbol i:nth-child(2) { animation-delay: .3s; background: var(--c-accent); }
  .symbol i:nth-child(3) { animation-delay: .4s; background: var(--c-accent); } .symbol i:nth-child(4) { animation-delay: .5s; }
  .name { display: flex; font-size: 48px; font-weight: 700; }
  .name span { display: inline-block; animation: fade-up var(--d-slow) var(--ease) both; animation-delay: calc(.8s + var(--i) * .06s); }
  .rule { width: 120px; height: 3px; background: var(--c-accent); transform-origin: left; animation: grow-x var(--d-base) var(--ease) 1.6s both; }
  .tagline { opacity: .7; animation: fade-up var(--d-base) var(--ease) 1.8s both; }
  .replay { position: fixed; bottom: 24px; right: 24px; padding: 8px 16px; border: 1px solid var(--c-fg); background: var(--c-bg); color: var(--c-fg); font: inherit; cursor: pointer; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 1ms !important; animation-delay: 0s !important; }
  }
</style>
</head>
<body>
  <div class="stage" id="stage">
    <div class="symbol"><i></i><i></i><i></i><i></i></div>
    <div class="name">{{BRAND_TEXT_SPANS}}</div>
    <div class="rule"></div>
    <p class="tagline">{{TAGLINE}}</p>
  </div>
  <button class="replay" type="button" onclick="replay()">Replay</button>
  <script>
    function replay() {
      const s = document.getElementById('stage');
      const c = s.cloneNode(true);
      s.replaceWith(c);
    }
  </script>
</body>
</html>
```

- `.symbol` 의 2x2 그리드는 예시다. 실제로는 `assets.logo` SVG 를 인라인하고 path 마다 `draw` 나 `pop-in` 을 건다.
- radius 가 필요하면 `tokens.radius.scale` 값만 쓴다. 임의값이나 pill 은 쓰지 않는다.
- 버튼 radius 는 0 이다(§1-6). 브랜드가 `components.button.radius` 를 정했으면 그 값을 쓴다.

## 4. 변수 치환

| 자리 | 값 |
|---|---|
| `{{BRAND_NAME}}` | `brand.name` |
| `{{TAGLINE}}` | 요청 문구 또는 `brand.description` |
| `{{BRAND_TEXT_SPANS}}` | 글자마다 `<span style="--i:N">글자</span>`, 공백은 `&nbsp;` |

```js
const spans = (text) => [...text].map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
```

## 5. 확인

- [ ] 브라우저 콘솔 에러 0
- [ ] Replay 가 처음부터 다시 재생된다
- [ ] OS 의 "동작 줄이기" 를 켜면 즉시 최종 상태로 보인다
- [ ] 사용한 색이 `--c-primary` · `--c-accent` · `--c-bg` · `--c-fg` 뿐이다
- [ ] `box-shadow`, `filter: blur`, `backdrop-filter`, `radial-gradient`, `linear-gradient` 가 없다
