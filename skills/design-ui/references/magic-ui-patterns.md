# Magic UI Patterns — 계약 필터를 거친 조합

> landing-page-creator `magic-ui-patterns.md` 를 계약 §1-6(3색 · 닫힌 radius · pill 버튼/네온 글로우/글래스모피즘/그라디언트 보더 금지)으로 걸렀다.
> Magic UI 컴포넌트는 Magic UI MCP 가 돌려주는 **소스 코드를 프로젝트에 복사**해서 쓴다. 복사한 코드는 우리 코드다 — 토큰으로 고친다.

## 1. MCP 조회

Magic UI MCP 가 연결돼 있으면 카테고리별로 조회한다(도구 이름은 MCP 서버 등록명에 따라 접두어가 다르다):

| 조회 | 돌려주는 것(예) |
|---|---|
| `getUIComponents` | 전체 목록 |
| `getTextAnimations` | text-animate, number-ticker, word-rotate, typing-animation, text-reveal, hyper-text, flip-text, box-reveal, morphing-text, line-shadow-text, aurora-text, animated-gradient-text, sparkles-text … |
| `getBackgrounds` | dot-pattern, grid-pattern, animated-grid-pattern, flickering-grid, interactive-grid-pattern, ripple, retro-grid, warp-background |
| `getButtons` | interactive-hover-button, ripple-button, shimmer-button, shiny-button, animated-subscribe-button, pulsating-button, rainbow-button |
| `getSpecialEffects` | animated-beam, meteors, particles, confetti, cool-mode, scratch-to-reveal, magic-card, border-beam, shine-border, neon-gradient-card |
| `getDeviceMocks` | safari, iphone-15-pro, android |
| `getComponents` | marquee, bento-grid, terminal, hero-video-dialog, animated-list, dock, globe, tweet-card, orbiting-circles, avatar-circles, icon-cloud, file-tree, code-comparison, scroll-progress, lens |
| `getAnimations` | blur-fade |

MCP 가 없으면 https://magicui.design 의 컴포넌트 소스를 WebFetch 로 가져와 같은 방식으로 복사한다.

## 2. 사용 등급

| 등급 | 컴포넌트 | 조건 |
|---|---|---|
| **허용** | text-animate, number-ticker, word-rotate, typing-animation, text-reveal, box-reveal, blur-fade, flip-text, morphing-text, hyper-text, dot-pattern, grid-pattern, animated-grid-pattern, flickering-grid, marquee, bento-grid, animated-list, terminal, file-tree, code-comparison, safari, iphone-15-pro, android, hero-video-dialog, orbiting-circles, icon-cloud, animated-beam, scroll-progress, avatar-circles, tweet-card | 색 prop·클래스는 토큰 이름으로. 원형 아바타는 허용. |
| **조건부** | shimmer-button, shiny-button, interactive-hover-button, ripple-button, animated-subscribe-button, particles, meteors, confetti, globe, retro-grid, ripple, warp-background, dock, magic-card, lens | 복사 후 반드시 고친다: `borderRadius`/`rounded-full` → 시스템 radius 이름, 하드코딩 색(`#fff`, `slate-*` 등) → 토큰, `backdrop-blur`·반투명 유리 패널 제거(dock), hover spotlight 를 radial-gradient 글로우로 그리는 부분 제거 또는 단색 opacity 로 대체(magic-card), 멀티컬러 파티클 → Primary/Accent 두 색만(confetti). 고칠 수 없으면 쓰지 않는다. |
| **금지** | rainbow-button, pulsating-button, neon-gradient-card, shine-border, border-beam, aurora-text, animated-gradient-text, sparkles-text, line-shadow-text(그림자 색이 브랜드 밖이면), cool-mode | 그라디언트 보더 · 네온 글로우 · 다색 그라디언트 텍스트는 계약 위반이다. 같은 강조 효과가 필요하면 아래 "대체" 를 쓴다. |

**대체표**

| 하고 싶은 것 | 금지된 선택 | 대신 |
|---|---|---|
| 눈에 띄는 Primary CTA | rainbow-button, pulsating-button | 시스템 Button primary + `interactive-hover-button`(radius 교체) 또는 hover 시 translate/scale |
| 강조 카드(추천 요금제) | neon-gradient-card, shine-border, border-beam | 시스템 Card + 2px Primary 단색 보더 + 크기·간격 계위(카드를 키우고 위로 올림) |
| 히어로 헤드라인 임팩트 | aurora-text, animated-gradient-text, sparkles-text | display 스케일 최상단 + `text-reveal`/`blur-fade`/`word-rotate`, 핵심 단어 하나만 Accent 단색 |

## 3. 복사 직후 자동 점검

컴포넌트를 `components/ui/` 에 복사할 때마다 돌린다. 하나라도 걸리면 고치고 다시 돌린다.

```bash
grep -nE '#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\([0-9]|rounded-full|rounded-\[|backdrop-blur|bg-gradient|from-[a-z]+-[0-9]|shadow-\[0_0_|drop-shadow-\[' components/ui/*.tsx
```

`rounded-full` 은 아바타·점·원형 아이콘 버튼이면 둔다(계약 허용). 버튼 텍스트를 감싼 `rounded-full` 은 pill 이므로 고친다.
최종 판정은 design-qa 의 정적 토큰 감사다.

## 4. 조합 패턴

아래 코드에서 `Button`, `Card` 는 시스템 프리미티브(`@/design-system/primitives/web`, named export)다. 색·radius 클래스는 시스템 preset 이 정의한 이름만 쓴다(`bg-primary`, `text-accent`, `rounded-<scale>` 등 — 실제 이름은 `system/` 을 열어 확인).

### Hero — 타이포 주도

```tsx
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { BlurFade } from "@/components/ui/blur-fade";
import { WordRotate } from "@/components/ui/word-rotate";
import { Safari } from "@/components/ui/safari";
import { Button } from "@/design-system/primitives/web";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <AnimatedGridPattern className="absolute inset-0 text-neutral-200" />
      <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-6 py-32 md:grid-cols-[3fr_2fr]">
        <BlurFade>
          <h1 className="text-display font-bold leading-tight">
            팀이 <WordRotate words={["기획", "디자인", "출시"]} className="text-accent" /> 를 한 곳에서
          </h1>
          <p className="mt-6 max-w-xl text-body-lg text-neutral-600">한 줄 가치 제안.</p>
          <div className="mt-10 flex gap-4">
            <Button variant="primary" size="lg">시작하기</Button>
            <Button variant="ghost" size="lg">데모 보기</Button>
          </div>
        </BlurFade>
        <Safari url="app.example.com" className="self-end" />
      </div>
    </section>
  );
}
```

### Features — Bento + Beam

```tsx
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { AnimatedBeam } from "@/components/ui/animated-beam";

// 큰 카드 하나(col-span-2 row-span-2)가 차별점. 나머지는 작게. 균등 3열 반복 금지.
<BentoGrid className="mx-auto max-w-6xl">
  {features.map((f) => <BentoCard key={f.title} {...f} />)}
</BentoGrid>
```

### Social Proof — Marquee + Ticker

```tsx
<Marquee pauseOnHover className="[--duration:40s]">
  {logos.map((l) => <img key={l.name} src={l.src} alt={l.name} className="h-8 mx-12 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition" />)}
</Marquee>
<NumberTicker value={10000} className="text-display-sm font-bold" />
```

### Pricing — 강조는 계위로

```tsx
import { Card } from "@/design-system/primitives/web";

{plans.map((p) => (
  <Card key={p.name} className={p.highlighted ? "border-2 border-primary md:-translate-y-4 md:scale-105" : ""}>
    {/* name · price(display) · features · Button */}
  </Card>
))}
```

### CTA — 절제된 배경

```tsx
<section className="relative overflow-hidden bg-primary text-primary-foreground">
  <DotPattern className="absolute inset-0 opacity-20" />
  {/* headline · Button variant="inverse" */}
</section>
```

## 5. 랜딩 유형별 출발점

| 유형 | 배경 | 텍스트 | 버튼 | 효과 |
|---|---|---|---|---|
| SaaS / B2B | grid-pattern, dot-pattern | text-reveal, number-ticker | 시스템 Button + interactive-hover-button | animated-beam, bento-grid |
| 포트폴리오 / 크리에이티브 | warp-background, particles(2색) | morphing-text, box-reveal | interactive-hover-button | lens, orbiting-circles |
| 제품 출시 | flickering-grid, meteors(토큰색) | typing-animation, flip-text | animated-subscribe-button(radius 교체) | confetti(2색), scroll-progress |
| 엔터프라이즈 | grid-pattern | text-animate, number-ticker | 시스템 Button | scroll-progress, marquee |

## 6. 성능

1. 뷰포트 밖 애니메이션은 lazy load (`next/dynamic`, `{ ssr: false }` 는 꼭 필요할 때만).
2. `prefers-reduced-motion` 존중 — 모션 컴포넌트는 감소 모드에서 정적 렌더.
3. transform 과 opacity 만 애니메이션.
4. 뷰포트 진입 시 시작 — framer-motion `useInView(ref, { once: true })`.
