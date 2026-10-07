# Mood x Philosophy Mapping Table

> 12개 Mood x 8개 Philosophy = 96개 조합. 26개 Critical Combination 상세 + Fallback 알고리즘.

---

## Mood 정의 (12개)

| Mood | 특성 | 온도 | 채도 경향 |
|------|------|------|---------|
| **Minimal** | 순수, 절제, 무장식 | Cool/Neutral | 초저채도 (S:0-20%) |
| **Bold** | 대담, 자신감, 강렬 | Warm | 고채도 (S:70-90%) |
| **Playful** | 즐거움, 친근, 활발 | Warm | 중채도 (S:40-70%) |
| **Luxurious** | 고급, 정교함, 희귀성 | Warm | 극저채도 (S:3-25%) |
| **Organic** | 자연, 생명, 부드러움 | Warm | 저~중채도 (S:15-40%) |
| **Futuristic** | 미래, 기술, 혁신 | Cool | 중~고채도 (S:50-80%) |
| **Nostalgic** | 과거, 추억, 향수 | Warm | 저채도 (S:10-35%) |
| **Calm** | 차분, 평온, 안정 | Cool | 초저채도 (S:5-25%) |
| **Energetic** | 생기, 동적, 활동적 | Warm | 고채도 (S:60-90%) |
| **Intellectual** | 이성, 세련, 사유 | Cool | 저채도 (S:15-40%) |
| **Romantic** | 감정, 부드러움, 친밀 | Warm | 중저채도 (S:25-50%) |
| **Rebellious** | 저항, 파격, 도발 | Warm/Cool | 고채도 (S:70-100%) |

---

## Philosophy 정의 (8개)

| Philosophy | 특성 | 시맨틱 |
|-----------|------|--------|
| **Refined** | 우아함, 절제, 정제 | Luxury position, minimal saturation |
| **Playful** | 즐거움, 친근, 접근성 | Mass/Standard position, accessible |
| **Bold** | 대담함, 자신감, 파격 | Premium/Standard, high saturation |
| **Warm** | 따뜻함, 인간적, 포용 | Warm hue, welcoming |
| **Cool** | 차가움, 전문적, 기술성 | Cool hue, systematic |
| **Dark** | 무겁고, 신비로움, 고급 | Low lightness, depth |
| **Minimal** | 가장 단순함, 기능성, 선택 | Fewest colors, lowest saturation |
| **Energetic** | 생기, 동적, 활력 | High saturation, bright lightness |

---

## Critical Combinations (26개 상세)

### 1. Minimal + Refined (가장 세련된 조합)

```
전략: 순수 무채색 1-2색. 명도 극단 활용.
지배 Hue: H:0 (neutral) 또는 H:50 (warm neutral)
OKLCH Chroma: Base C:0.01-0.03, Accent C:0.02-0.05
온도 충돌: 없음 (Refined는 온도 중립)

팔레트:
  Base:     #F5F4F2 (H:50 S:5% L:96%)  -> OKLCH(0.96, 0.01, 50)
  Dark:     #3A3530 (H:30 S:7% L:22%)  -> OKLCH(0.22, 0.02, 30)
  Accent:   #1A1714 (H:20 S:8% L:11%)  -> OKLCH(0.11, 0.01, 20)

참고: Notion, Aesop, Muji
Art Movement: Swiss Minimalism / Bauhaus Rationalism
```

### 2. Bold + Energetic (가장 강렬한 조합)

```
전략: 고채도 + 명도 강대비. 2-3색.
지배 Hue: H:0-60 (warm) 또는 H:240-300 (cool)
OKLCH Chroma: Base C:0.08-0.15, Accent C:0.25-0.40
온도 충돌: 없음

팔레트:
  Base:     #0D0D1A (H:260 S:15% L:8%)  -> OKLCH(0.08, 0.02, 260)
  Support:  #2B2D8F (H:238 S:70% L:35%) -> OKLCH(0.40, 0.20, 240)
  Accent:   #FF3B3B (H:0 S:100% L:53%)  -> OKLCH(0.60, 0.28, 0)

참고: Ramp, Revolut
Art Movement: Neo-Brutalism / Cyberpunk Aesthetics
```

### 3. Luxurious + Refined (럭셔리 스탠다드)

```
전략: 극저채도 base + 귀금속 accent. 3색 이하.
지배 Hue: H:30-50 (warm) + H:40-60 (gold)
OKLCH Chroma: Base C:0.01-0.04, Accent C:0.08-0.12
온도 충돌: 없음 (모두 warm)

팔레트:
  Dark:     #0F0E0C (H:30 S:10% L:6%)  -> OKLCH(0.06, 0.01, 30)
  Base:     #C4A96D (H:43 S:45% L:65%) -> OKLCH(0.65, 0.10, 43)
  Neutral:  #8B7355 (H:25 S:20% L:50%) -> OKLCH(0.50, 0.04, 25)

참고: Lemaire, Loro Piana, Creed
Art Movement: Art Deco / Neoclassicism
```

### 4. Calm + Minimal (가장 평온한 조합)

```
전략: 고명도 저채도 중성. 2-3색.
지배 Hue: H:200-240 (cool) 또는 H:0 (neutral)
OKLCH Chroma: Base C:0.01-0.04, Accent C:0.02-0.06

팔레트:
  Base:     #F8F7F5 (H:40 S:3% L:97%)  -> OKLCH(0.97, 0.01, 40)
  Support:  #B0AEA8 (H:40 S:7% L:69%)  -> OKLCH(0.69, 0.02, 40)
  Accent:   #5A7A93 (H:210 S:25% L:50%) -> OKLCH(0.50, 0.06, 210)

참고: Apple (minimalist iOS), Noto, Airbnb
Art Movement: Scandinavian Modernism / Zen Minimalism
```

### 5. Playful + Bold (친근한 강렬함)

```
전략: 중~고채도 + 친근한 Hue. 3-4색.
지배 Hue: H:0-45 (warm) 또는 H:300-360 (pink)
OKLCH Chroma: Base C:0.08-0.12, Accent C:0.18-0.28

팔레트:
  Base:     #FFF5E6 (H:40 S:20% L:95%)  -> OKLCH(0.95, 0.03, 40)
  Support:  #FFCC99 (H:35 S:60% L:75%)  -> OKLCH(0.75, 0.12, 35)
  Accent:   #FF8C42 (H:25 S:65% L:58%)  -> OKLCH(0.63, 0.22, 25)

참고: Etude House, Glossier, Duolingo
Art Movement: Pop Art / Kawaii Aesthetics
```

### 6. Organic + Warm (따뜻한 자연)

```
전략: Earthy hue (갈색/초록) + 저채도. 3-4색.
지배 Hue: H:25-55 (brown) + H:80-130 (green)
OKLCH Chroma: Base C:0.05-0.10, Accent C:0.10-0.15

팔레트:
  Base:     #F5F1E8 (H:40 S:12% L:93%) -> OKLCH(0.93, 0.02, 40)
  Support:  #8B7355 (H:25 S:20% L:50%) -> OKLCH(0.50, 0.04, 25)
  Accent:   #6B8F5E (H:105 S:20% L:55%) -> OKLCH(0.55, 0.07, 105)
  Dark:     #3D3227 (H:25 S:15% L:25%) -> OKLCH(0.25, 0.03, 25)

참고: Patagonia, Allbirds, Erewhon
Art Movement: Arts & Crafts / Organic Modernism
```

### 7. Futuristic + Cool (미래지향적 기술)

```
전략: 차가운 고채도 + 고명도 대비. 2-3색.
지배 Hue: H:180-260 (cool) 또는 H:50-90 (neon)
OKLCH Chroma: Base C:0.08-0.15, Accent C:0.20-0.35

팔레트:
  Base:     #0A1628 (H:220 S:40% L:15%) -> OKLCH(0.15, 0.06, 220)
  Support:  #1E4A6F (H:210 S:50% L:35%) -> OKLCH(0.35, 0.10, 210)
  Accent:   #00D9FF (H:186 S:100% L:50%) -> OKLCH(0.60, 0.28, 186)

참고: Linear, Figma, Stripe
Art Movement: Cyberpunk / Digital Brutalism
```

### 8. Nostalgic + Warm (향수적 따뜻함)

```
전략: Muted warm hue (brown/rust) + 저~중채도. 3-4색.
지배 Hue: H:15-45 (rust) 또는 H:330-360 (mauve)
OKLCH Chroma: Base C:0.05-0.10, Accent C:0.10-0.16

팔레트:
  Base:     #FAF8F3 (H:40 S:8% L:97%)  -> OKLCH(0.97, 0.01, 40)
  Support:  #C9A875 (H:35 S:40% L:66%) -> OKLCH(0.66, 0.09, 35)
  Accent:   #A0644E (H:20 S:35% L:51%) -> OKLCH(0.51, 0.08, 20)
  Dark:     #4A3728 (H:20 S:25% L:31%) -> OKLCH(0.31, 0.05, 20)

참고: Anthropologie, Pottery Barn, Ace & Tate
Art Movement: Retro / Vintage Americana
```

### 9. Energetic + Bold (활발한 대담함)

```
전략: 고채도 다양한 hue 또는 단일 명도 대비. 3-5색.
지배 Hue: H:0-60 (warm) 또는 혼합
OKLCH Chroma: Base C:0.10-0.18, Accent C:0.22-0.35

팔레트:
  Base:     #FFFEF5 (H:50 S:5% L:99%)   -> OKLCH(0.99, 0.01, 50)
  Accent1:  #FF6B35 (H:25 S:100% L:55%) -> OKLCH(0.60, 0.24, 25)
  Accent2:  #FF1493 (H:330 S:100% L:52%) -> OKLCH(0.55, 0.28, 330)
  Dark:     #1A1A1A (H:0 S:0% L:10%)    -> OKLCH(0.10, 0.00, 0)

참고: Slack, Airbnb (energetic), Peripera
Art Movement: Graffiti / Street Art
```

### 10. Intellectual + Cool (지성적 차가움)

```
전략: 저~중채도 cool hue. 2-3색.
지배 Hue: H:200-260 (blue/purple)
OKLCH Chroma: Base C:0.05-0.12, Accent C:0.12-0.18

팔레트:
  Base:     #F0F4F8 (H:210 S:15% L:96%) -> OKLCH(0.96, 0.02, 210)
  Support:  #5B6F82 (H:210 S:25% L:50%) -> OKLCH(0.50, 0.07, 210)
  Accent:   #2E5090 (H:220 S:55% L:40%) -> OKLCH(0.40, 0.13, 220)

참고: GitHub, IBM, Masterclass
Art Movement: International Style / Swiss Grid
```

### 11. Romantic + Warm (감정적 따뜻함)

```
전략: Soft warm hue (pink/peach) + 중채도. 3-4색.
지배 Hue: H:330-360 (pink) 또는 H:15-35 (peach)
OKLCH Chroma: Base C:0.06-0.12, Accent C:0.14-0.20

팔레트:
  Base:     #FEF5F3 (H:15 S:10% L:97%)  -> OKLCH(0.97, 0.02, 15)
  Support:  #F5C4D4 (H:345 S:50% L:82%) -> OKLCH(0.82, 0.10, 345)
  Accent:   #E87AA7 (H:340 S:70% L:63%) -> OKLCH(0.63, 0.18, 340)
  Dark:     #8B5A6D (H:330 S:25% L:48%) -> OKLCH(0.48, 0.07, 330)

참고: Noto, Curology
Art Movement: Romanticism / Soft Aesthetics
```

### 12. Rebellious + Cool (냉정한 저항)

```
전략: 고채도 cool hue + 극단 명도. 2-3색.
지배 Hue: H:180-240 (cool) 또는 H:280-360 (purple/magenta)
OKLCH Chroma: Base C:0.08-0.18, Accent C:0.25-0.40

팔레트:
  Base:     #0F0E1F (H:260 S:15% L:12%)  -> OKLCH(0.12, 0.02, 260)
  Accent:   #6B00FF (H:270 S:100% L:40%) -> OKLCH(0.45, 0.28, 270)
  Highlight:#FF00FF (H:300 S:100% L:50%) -> OKLCH(0.55, 0.32, 300)

참고: Supreme, Fear of God, Grailed
Art Movement: Cyberpunk / Goth
```

---

## Major Combinations (13-24)

| # | Mood | Philosophy | 전략 | 예시 HEX |
|---|------|-----------|------|---------|
| 13 | Minimal | Playful | Low saturation + accessible lightness | #F5F5F0, #2C2C2C, #E8D4FF |
| 14 | Minimal | Bold | Extreme contrast + neutral base | #FFFFFF, #000000, #FF6B6B |
| 15 | Bold | Refined | High saturation limited to accent | #0A0906, #FFD700, #8B4513 |
| 16 | Playful | Minimal | Cheerful but restrained palette | #FFF9E6, #FFB366, #333333 |
| 17 | Playful | Cool | Cool playful = pastel cool hues | #E6F2FF, #99CCFF, #004D99 |
| 18 | Luxurious | Playful | Rare + accessible (contradiction via accent) | #1A1A1A, #D4AF7A, #FFB366 |
| 19 | Organic | Cool | Contradiction: muted cool (teal/seafoam) | #E8F5F0, #4A8A7E, #2C5C54 |
| 20 | Futuristic | Warm | Contradiction resolved: Neon warm (rare) | #FF00FF, #FF6B35, #1A1A1A |
| 21 | Nostalgic | Cool | Vintage cool (blue/teal instead of brown) | #E8EEF5, #7A9CAA, #3A5A73 |
| 22 | Calm | Energetic | Contradiction: soft pastels | #FFE6E6, #FF9999, #99CCFF |
| 23 | Energetic | Minimal | Contradiction: muted brights | #FFE8CC, #FF8C42, #004D99 |
| 24 | Intellectual | Warm | Logical + warm = warm neutrals + cool accent | #FAF5F0, #A0826D, #4A7BA7 |

---

## Fallback Algorithm (미커버 조합 처리)

커버리지: 26/96 조합 정의. 나머지 70개는 다음 순서로 fallback:

### Step 1: Mood만 일치 + Philosophy 무시

```
예: Playful + Dark (미정의) -> Playful의 기본 팔레트 사용
```

### Step 2: Philosophy만 일치 + Mood 무시

```
예: [undefined Mood] + Refined -> Refined의 기본 구조 사용
```

### Step 3: 온도 일치 + Hue 자유

```
예: [undefined] + Warm -> Warm hue range 선택, Luxury/Premium saturation 적용
```

### Step 4: 대안 추천 (3개)

```
미커버 조합 감지 시:
  "이 조합은 아직 정의되지 않았습니다."
  "대안 3가지를 권장합니다:"
  1. [가장 유사한 정의된 조합]
  2. [온도 유사 조합]
  3. [대조 제안]
```

우선순위: `정의된 조합 (26개) > Mood 일치 > Philosophy 일치 > 온도 일치 > 대안`

---

## Sector x Mood 온도 충돌 해소 규칙

| Sector | 기본 온도 | Mood 온도 | 해소 방법 |
|--------|---------|---------|---------|
| **Food** | Warm | Cool (Calm, Intellectual, Futuristic) | Mood 우선, Accent만 cool + warm base 유지 |
| **Tech** | Cool | Warm (Bold, Organic, Playful, Energetic) | Mood 우선, Base는 cool + accent warm |
| **Wellness Natural** | Warm | Cool (Calm, Intellectual, Futuristic) | Sector 우선 (medical blue 위험), Philosophy로 완화 |
| **Fashion Luxury** | Neutral | Any | Philosophy 우선 (절제 원칙) |
| **Eco** | Mixed | Bold, Energetic (고채도) | Greenwashing 위험 주의, 중채도 유지 |

---

## 온도 충돌 해소 최종 규칙

우선순위:
1. Mood Temperature (가장 높음)
2. Philosophy Temperature
3. Sector Default Temperature (가장 낮음)

실행 방법:

| 단계 | 액션 |
|------|------|
| Step 1 | Mood의 온도 결정 (12개 mood 정의에서 추출) |
| Step 2 | Philosophy의 온도 확인 (8개 philosophy 정의에서) |
| Step 3 | 충돌 여부 판단 (Mood != Philosophy 온도) |
| Step 4 | Mood 온도로 강제, Philosophy는 보조 규칙으로 활용 |
| Step 5 | Accent로 Philosophy 표현 (예: Mood=Warm이지만 Philosophy=Cool -> Base warm, Accent cool) |

### 예시

```
입력: Wellness Natural + Calm + Cool (Philosophy)

Step 1: Wellness Natural 온도 = Warm (자연/흙색)
Step 2: Calm 온도 = Cool (파란색 차분)
Step 3: Cool 우선 (Mood temperature)
Step 4: Base H:200-220, Accent H:35-50 (Warm Philosophy 완화)
Step 5: Result = Muted cool base + warm accent

REJECT: Medical Blue (H:200-220, S:60%+) 위험
ACCEPT: Pale cool (H:210-220, S:15-35%, L:70+) + Warm accent

최종 팔레트:
  Base:     #E8F0F8 (H:215 S:15% L:96%)
  Support:  #7A9CAA (H:200 S:20% L:62%)
  Accent:   #D4A855 (H:42 S:40% L:60%) <- Warm accent (Philosophy)
```

---

## Playful 팔레트 채도 규칙

Playful S:40-70% 기본 범위 (포지셔닝별 상한 적용):

| 포지셔닝 | Playful S 범위 |
|---------|--------------|
| Luxury Playful (드물음) | S: 30-50% |
| Premium Playful | S: 40-70% |
| Standard Playful | S: 60-85% |
| Mass Playful | S: 70-100% |

---

## Warm Undertone 순수회색 금지 조건부 규칙

| Sector | 순수 회색 허용 | 대체 규칙 |
|--------|------------|---------|
| **DevTool** | 허용 (GitHub #0D1117, Vercel #000) | H:0, S:0% OK |
| **Streetwear** | 허용 (Supreme, Fear of God) | H:0, S:0% OK |
| **Fashion Luxury** | 허용 (Celine, Rick Owens) | H:0, S:0% OK (절제 원칙) |
| **모든 다른 섹터** | 금지 | H:20-50 or H:200-240, S:5-25% |

---

## Mood와 Philosophy의 관계

- **Mood** = 감정적 톤. 시즌/상황에 따라 변함. 즉각적 지각 반응.
- **Philosophy** = 브랜드 가치관. 장기적이고 일관된 정체성. 의도적 메시징.

```
예: Mood: Playful (이번 시즌 봄의 활발한 느낌)
    Philosophy: Refined (브랜드는 항상 정교해야 함)
    -> 결과: 낮은 채도의 Playful (친근하지만 고급스러운)
```
