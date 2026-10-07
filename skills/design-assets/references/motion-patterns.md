# Motion Patterns — Framer Motion (React)

mode `motion` 의 React 출력 규칙. 독립 HTML/CSS 버전은 [css-keyframes.md](css-keyframes.md) 를 본다.
값은 전부 `brand_config.motion` 과 `tokens` 에서 읽는다. 아래 코드의 `BRAND` 상수는 생성 시점에 brand_config 값으로 치환한다.

## 0. 원칙

- 금지(CONTRACT §1-6): 네온 글로우, radial-gradient 빛 번짐(glow/shine), 그라디언트 테두리 회전(border-beam/shine-border), 글래스모피즘, backdrop blur.
  원본 web-motion-generator 의 glow · shine · border-beam 효과는 **이관하지 않았다.** 대체 효과는 §4 에 있다.
- 색은 primary · accent · neutral 3색만 쓴다.
- `prefers-reduced-motion` 을 반드시 존중한다. `useReducedMotion()` 이 true 면 위치·크기 변화 없이 opacity 만 쓴다.
- 총 길이는 `motion.durations.intro` (없으면 2.4s) 를 넘기지 않는다. 로고 인트로는 한 번만 재생하고 루프하지 않는다.

## 1. brand_config.motion → 상수

```ts
// 생성 시 brand_config.motion 값으로 채운다
const BRAND = {
  name: 'Acme',                                   // brand.name
  primary: '#1F4FFF', accent: '#FFB800',          // tokens.colors
  bg: '#FFFFFF', fg: '#111111',                   // neutral 양끝
  ease: [0.4, 0, 0.2, 1] as const,                // motion.easingCurves.standard
  easeEmphasis: [0.34, 1.56, 0.64, 1] as const,   // motion.easingCurves.emphasis
  dur: { fast: 0.12, base: 0.2, slow: 0.32 },     // motion.durations 는 ms → 1000 으로 나눠 초로
};
```

brand_config 의 `motion.durations` 는 밀리초(ms)다. Framer Motion 의 `duration` 은 초라서 1000 으로 나눈다. 이징 곡선이 `ease-out` 같은 키워드면 그대로, `cubic-bezier(a,b,c,d)` 면 `[a,b,c,d]` 배열로 바꾼다.

`motion.feel` 이 calm·trustworthy 계열이면 spring bounce 를 0~0.15 로, playful·energetic 계열이면 0.3~0.4 로 둔다.

## 2. 설치 · import

```bash
npm install motion
```

```tsx
import { motion, AnimatePresence, useReducedMotion, useInView } from 'motion/react';
```

## 3. 기본 패턴

### 등장 (fade + slide)

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: BRAND.dur.base, ease: BRAND.ease }}
/>
```

### 심볼 등장 (scale + rotate)

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0, rotate: -90 }}
  animate={{ opacity: 1, scale: 1, rotate: 0 }}
  transition={{ type: 'spring', bounce: 0.15, duration: BRAND.dur.slow, delay: 0.2 }}
/>
```

### 순차 등장 (stagger)

```tsx
const container = { hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } } };
const item = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

<motion.ul variants={container} initial="hidden" animate="visible">
  {items.map((it) => <motion.li key={it.id} variants={item}>{it.label}</motion.li>)}
</motion.ul>
```

### 글자별 등장

```tsx
{BRAND.name.split('').map((ch, i) => (
  <motion.span
    key={i}
    style={{ display: 'inline-block' }}
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: BRAND.dur.slow, delay: 0.8 + i * 0.06, ease: BRAND.ease }}
  >
    {ch === ' ' ? ' ' : ch}
  </motion.span>
))}
```

### 스크롤 진입

```tsx
function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: BRAND.dur.base, ease: BRAND.ease }}>
      {children}
    </motion.div>
  );
}
```

### 퇴장 (AnimatePresence)

```tsx
<AnimatePresence mode="wait">
  {open && (
    <motion.div key="panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
      transition={{ duration: BRAND.dur.fast }} />
  )}
</AnimatePresence>
```

## 4. 허용되는 강조 효과 (glow · shine · border-beam 대체)

| 대신 쓸 것 | 방법 |
|---|---|
| 선 그리기 | SVG `pathLength` 0→1 (`<motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />`) |
| 마스크 와이프 | `clipPath: 'inset(0 100% 0 0)'` → `'inset(0 0% 0 0)'` |
| 단색 블록 슬라이드 | primary 블록이 지나가며 로고를 드러냄 (`x: '-100%'` → `'100%'`) |
| 언더라인 성장 | accent 2~4px 바 `scaleX: 0 → 1`, `transformOrigin: 'left'` |

## 5. 로고 인트로 타임라인 (기본)

```
0.0s  배경(neutral bg) 표시
0.2s  심볼 요소 순차 등장 (요소당 0.1s 간격, spring)
0.8s  브랜드명 글자별 등장 (글자당 0.06s)
~1.4s 마지막 글자 완료
1.6s  언더라인(accent) 성장
1.8s  태그라인 fade in
2.4s  onComplete()
```

딜레이 공식:

```ts
const charDelay = (i: number, base = 0.8, step = 0.06) => base + i * step;
const gridDelay = (row: number, col: number, cols = 2, base = 0.2, step = 0.1) => base + (row * cols + col) * step;
const radialDelay = (distance: number, base = 0.3, factor = 0.15) => base + distance * factor;
```

## 6. 컴포넌트 템플릿

```tsx
'use client';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';

interface LogoIntroProps { onComplete?: () => void; className?: string }

export function LogoIntro({ onComplete, className }: LogoIntroProps) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), reduce ? 300 : 2400);
    return () => clearTimeout(t);
  }, [onComplete, reduce]);

  const enter = (delay: number) => reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3 } }
    : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: BRAND.dur.slow, delay, ease: BRAND.ease } };

  return (
    <div className={className} style={{ background: BRAND.bg, color: BRAND.fg, display: 'grid', placeItems: 'center' }}>
      {/* 심볼: brands/<id>/ 의 SVG 를 인라인하고 path 마다 pathLength 애니메이션 */}
      <div style={{ display: 'flex', fontWeight: 700, fontSize: 48 }}>
        {BRAND.name.split('').map((ch, i) => (
          <motion.span key={i} style={{ display: 'inline-block' }} {...enter(0.8 + i * 0.06)}>{ch}</motion.span>
        ))}
      </div>
      <motion.div
        style={{ height: 3, width: 120, background: BRAND.accent, transformOrigin: 'left' }}
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: BRAND.dur.base, delay: reduce ? 0 : 1.6 }}
      />
    </div>
  );
}
```

출력 파일: `.design/assets/motion/<Name>Intro.tsx` 와 같은 이름의 `.html` (css-keyframes.md), 그리고 사용법을 적은 `README.md`.

## 7. 이징 치트시트

| 용도 | cubic-bezier | Framer Motion |
|---|---|---|
| 등장 | `(0.4, 0, 0.2, 1)` | `ease: [0.4, 0, 0.2, 1]` |
| 강조 등장 | `(0.34, 1.56, 0.64, 1)` | `type: 'spring', bounce: 0.3` |
| 퇴장 | `(0.4, 0, 1, 1)` | `ease: 'easeIn'` |
| 반복 | `linear` | `ease: 'linear'` |

brand_config 에 `motion.easingCurves` 가 있으면 이 표보다 그것이 우선한다.
