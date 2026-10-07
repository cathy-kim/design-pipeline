# Sophistication Rules & Decision Flow

> design-brief 팔레트 결정 규칙. 11개 정량 규칙 상세 + Decision Flow 예시 + Anti-patterns + Prompt Guide.
>
> **계약 우선:** CONTRACT §1-6 의 "한 화면 3색" 이 SR-08 보다 우선한다. 4~5색 팔레트가 나와도 brief 는
> primary · accent · neutral 3역할로 접는다(접는 법: [palette-to-tokens.md](palette-to-tokens.md)).
> SR-01·02·03·04·05·07·09·10 은 `scripts/palette-decide.mjs` 가 기계 검증한다.

---

## SR-01: Chroma Binding (지각 채도 계층화)

OKLCH 색공간에서 명시적 채도 할당:

| 역할 | OKLCH C 범위 | HSL S 등가 범위 | 용도 |
|------|-------------|---------------|------|
| **Base** | C <= 0.05 | S <= 15% | 배경, 본문, 중성 톤 |
| **Support** | C: 0.06-0.12 | S: 16-30% | 보조 요소, UI 컴포넌트 |
| **Accent** | C >= 0.13 | S >= 31% | 강조, CTA, 브랜드 아이콘 |

검증: `max(C_accent) - min(C_base) >= 0.08`

예시 (Tech Premium):
- Base: `OKLCH(0.20, 0.04, 240)` = `#1a2456`
- Support: `OKLCH(0.50, 0.10, 235)` = `#3a5a8f`
- Accent: `OKLCH(0.62, 0.18, 260)` = `#5b72cc`

---

## SR-02: 명도 분산 (Lightness Spread)

포지셔닝별 최소 명도 범위 강제:

| 포지셔닝 | 최소 L 분산 | 검증 공식 |
|---------|-----------|---------|
| **Luxury** | >= 60 포인트 | `max(L) - min(L) >= 0.60` (OKLCH) |
| **Premium** | >= 50 포인트 | `max(L) - min(L) >= 0.50` |
| **Standard** | >= 40 포인트 | `max(L) - min(L) >= 0.40` |
| **Mass** | >= 30 포인트 | `max(L) - min(L) >= 0.30` |

럭셔리 브랜드는 극단 명도(어두운 검정 + 밝은 흰색)로 고급감 표현.

예시 (Luxury Fashion):
- Dark: `OKLCH(0.10, 0.02, 30)` (L:0.10)
- Pale: `OKLCH(0.95, 0.02, 30)` (L:0.95)
- 분산: 0.95 - 0.10 = 0.85 (60 포인트 이상)

---

## SR-03: Warm Undertone Neutral (중성색의 온정감)

순수 회색(H:0, S:0%) 금지 -> 따뜻한 톤 중성 필수:

| 조건 | HSL 범위 | 용도 |
|------|---------|------|
| **Warm Neutral** | H: 20-50, S: 5-25%, L: 30-95% | 대부분 업종 기본 |
| **Cool Neutral** | H: 200-240, S: 5-15%, L: 70-95% | Tech/Clinical 섹터만 |
| **금지** | H: 0, S: 0%, L: any | 모든 경우 |

OKLCH 등가:
- Warm Neutral: `OKLCH(L:0.50, C:0.02, H:45)` = `#706a62`
- Cool Neutral: `OKLCH(L:0.80, C:0.02, H:220)` = `#c9d0dd`

**예외 섹터** (순수 회색 허용):
- DevTool (GitHub #0D1117, Vercel #000)
- Streetwear (Supreme, Fear of God)
- Fashion Luxury (Celine, Rick Owens)

---

## SR-04: Hue 제약 (단일 색상군 원칙)

| 조건 | 확인 공식 |
|------|---------|
| Base/Support 일관성 | `|H_base - H_support| <= 5` |
| Accent 범위 | `|H_accent - H_base| <= 30` |
| 보색 금지 | `|H_accent - H_base| != 180` |

예시:
- OK: Base H:235, Support H:238, Accent H:260 (모두 Cool Blue 계열)
- NG: Base H:235, Accent H:55 (차이 180 = 보색 금지)

---

## SR-05: 포지셔닝별 채도 상한 (Saturation Ceiling)

CRITICAL FIX: 실제 브랜드 검증으로 확장된 범위.

| 포지셔닝 | Base S 상한 | Accent S 상한 | 시그니처 색 예외 |
|---------|-----------|------------|--------------|
| **Luxury** | **S < 35%** | **S < 50%** | Stripe #635BFF (S:100%) |
| **Premium** | **S < 45%** | **S < 65%** | Wise #9FE870 (S:88%) |
| **Standard** | **S < 60%** | **S < 80%** | - |
| **Mass** | **S < 80%** | **S < 100%** | - |

**시그니처 브랜드 컬러 예외 조건** (3가지 모두 충족):
1. 면적 제약: 전체 디자인의 5-15% 이하
2. 배경 중립성: 주변 배경이 무채색 또는 반대 온도
3. 기능적 명확성: CTA, 브랜드 로고, 강조 요소로만 사용

---

## SR-06: Tone Zone 일관성

PCCS Tone Zone 분류:

| Tone Zone | OKLCH L 범위 | OKLCH C 범위 | 포함 색 역할 |
|-----------|------------|-----------|-----------|
| **Deep** | 0.10-0.30 | 0.02-0.08 | Base (어두운 중성) |
| **Dark** | 0.25-0.50 | 0.05-0.15 | Support (어두운 컬러) |
| **Pale** | 0.80-0.98 | 0.02-0.08 | Support (밝은 중성) |
| **Light** | 0.70-0.90 | 0.03-0.12 | Support (밝은 컬러) |
| **Vivid** | 0.50-0.75 | 0.15-0.30 | Accent (채도 높음) |

검증: Base/Support는 동일 zone. Accent는 1단계 이탈 허용.

---

## SR-07: 대비 비율 (Accessibility Contrast)

WCAG 2.1 상대 명도 기준:

| 용도 | WCAG 레벨 | 최소 대비비 |
|------|---------|-----------|
| 텍스트 (본문) | AA | 4.5:1 |
| 텍스트 (대형, 18pt+) | AA | 3:1 |
| UI 컴포넌트 | AA | 3:1 |
| 그래픽 | AAA | 7:1 |

---

## SR-08: 팔레트 크기

| 포지셔닝 | 권장 범위 | 최대 색 수 |
|---------|---------|----------|
| **Luxury** | 3-4색 | 4 |
| **Premium** | 2-5색 | 5 |
| **Standard** | 3-6색 | 6 |
| **Mass** | 3-8색 | 8 |

---

## SR-09: 온도 일관성 (Temperature Coherence)

| 온도 | Hue 범위 |
|------|---------|
| **Warm** | H: 0-80, H: 320-360 |
| **Cool** | H: 140-260 |
| **Neutral** | H: 0 (회색) 또는 H: 50 (베이지) |

우선순위: Mood Temperature > Philosophy Temperature > Sector Default

---

## SR-10: AI 편향 역교정 (Hue Bias Correction)

규칙: Orange + Cyan 누적 비율 < 20%

```
orange_count = sum(1 for h in palette_hues if 0 <= h <= 45 or 320 <= h <= 360)
cyan_count = sum(1 for h in palette_hues if 160 <= h <= 200)
bias_ratio = (orange_count + cyan_count) / total_colors
assert bias_ratio < 0.20
```

---

## SR-11: 금지 조합 (Sector x Accent 교차 검증)

| Sector | 금지 패턴 | 이유 | 예외 |
|--------|---------|------|------|
| **Food** | Blue dominant primary/background (H:180-240, L:30-60%, area >20%) | 식욕 억제 | Blue Bottle Coffee: Small brand mark (5-10% area) |
| **Wellness Natural** | Medical Blue (H:200-220, S:60%+) as primary | 따뜻함 정체성 파괴 | - |
| **Luxury Fashion** | 3+ distinct hues in base/support | 절제 원칙 위반 | - |
| **Finance Traditional** | Pastel 전체 팔레트 (모든 색 L:70%+) | 신뢰감 약화 | - |
| **Sustainability/Eco** | 전체 팔레트 녹색 도배 (H:80-160 비율 > 60%) | Greenwashing 혐의 | - |
| **Beauty Luxury** | Primary color S > 40% | 럭셔리 채도 상한 위반 | - |
| **EdTech Adult** | 고채도 Yellow + Red 동시 사용 (S:80%+) | 유치원/초등 연상 | - |
| **Real Estate Luxury** | Electric Blue (H:195-225, S:55%+) as primary | 임대주택/공공성 연상 | - |

---

## Decision Flow 실행 예시

### Tech/SaaS, Premium, Minimal, Refined

```
INPUT:
  Sector: Tech SaaS (Enterprise)
  Positioning: Premium
  Mood: Minimal
  Philosophy: Refined

EXECUTION:
  [GATE 1] Forbidden Combos: None for Tech
  [GATE 2] Saturation Ceiling: S_base < 45%, S_accent < 65% (Premium)
  [GATE 3] Minimal+Refined: Base OKLCH(0.15, 0.04, 235), Accent OKLCH(0.60, 0.16, 260)
  [GATE 4] Temperature: Minimal=Cool, Refined=Cool -> OK
  [GATE 5] Tech+Minimal+Refined: No conflict
  [GATE 6] Structure: Dark Navy (base) + Light Blue (support) + Indigo (accent) + Off-white
  [GATE 7] Chroma: Base C:0.04, Support C:0.10, Accent C:0.16
  [GATE 8] Lightness Spread: 0.15 to 0.95 = 0.80 spread (>=0.50 required)
  [GATE 9] Albers: All pairs > 4.5:1 contrast
  [GATE 10] Forbidden: None triggered
  [GATE 11] Hue Bias: 0% Orange, 0% Cyan
  [GATE 12] OUTPUT: Ready

RESULT:
  Base:      #0A1628 (H:225 S:32% L:15%)
  Support:   #3A4A6F (H:230 S:20% L:35%)
  Accent:    #6366F1 (H:258 S:72% L:55%)
  Highlight: #F5F7FA (H:220 S:10% L:97%)
```

---

## Anti-patterns 상세

| # | 패턴명 | 증상 | 방지 규칙 | 검증 방법 |
|---|--------|------|---------|---------|
| 1 | 균일 채도 분포 | 모든 색 S:45-55% | SR-01 Chroma Binding 강제 | `base_c < support_c < accent_c` |
| 2 | 순수 회색 | H:0 S:0% 사용 | SR-03 Warm undertone 필수 | `H in [20-50] or [200-240]` |
| 3 | 보색 대비 | Base와 Accent H 차이 180 | SR-04 Hue 제약 | `|H_accent - H_base| < 30` |
| 4 | 과다색 | 5개 이상 서로 다른 hue | SR-08 팔레트 크기 | `unique_hues <= positioning_max` |
| 5 | Neon 남용 | 모든 색 S:80%+ | SR-01/SR-05 채도 상한 | `base: S < 40%, accent: S < 65-80%` |
| 6 | 명도 부족 | 모든 색 L:40-60% | SR-02 명도 분산 | `max(L) - min(L) >= threshold` |
| 7 | 온도 혼합 | Base Warm, Accent Cool | SR-09 온도 일관성 | `all_hues in same_temperature_range` |
| 8 | Tone Zone 불일치 | Base Deep, Support Pale | SR-06 Tone Zone 일관성 | `base/support in same_zone` |
| 9 | 섹터 무시 | Food에 Blue 주색 | SR-11 금지 조합 | `forbidden_check(sector, accent)` |
| 10 | AI Hue Bias | Accent가 Orange/Cyan | SR-10 편향 역교정 | `(orange+cyan)/total < 20%` |

---

## 오류 자동 교정 가이드

| 오류 | 자동 교정 |
|------|---------|
| Chroma gradient 불충분 | Support C를 +0.02 증가 후 재생성 |
| Lightness spread 부족 | Base L을 -0.05 낮추거나 Accent L을 +0.05 높임 |
| Forbidden combo 위반 | Accent hue를 +-15 이동 후 재검증 |
| Temperature 혼합 | Philosophy temperature를 Mood로 override |
| Hue 180 위반 | Accent hue를 +-40 회전 |

---

## User Prompt Template

```
Generate a sophisticated brand color palette with the following requirements:

INPUTS:
- Sector: [Tech/Beauty/Finance/Food/Fashion/Wellness/Eco/RealEstate/EdTech/Hospitality]
- Positioning: [Luxury/Premium/Standard/Mass]
- Mood: [Minimal/Bold/Playful/Luxurious/Organic/Futuristic/Nostalgic/Calm/Energetic/Intellectual/Romantic/Rebellious]
- Philosophy: [Refined/Playful/Bold/Warm/Cool/Dark/Minimal/Energetic]

CONSTRAINTS:
- Sector forbidden combos: [load from mapping]
- Positioning saturation ceiling: [load from matrix]
- Mood+Philosophy temperature: [load from mood table]

REQUIRED OUTPUT:
1. Base color (primary neutral)
2. Support color (secondary neutral)
3. Accent color (primary highlight)
4. Highlight color (secondary highlight, optional)

Format each as: HEX, HSL (H, S%, L%), OKLCH (L, C, H)
```

---

## OKLCH-HSL Hue-Dependent Conversion Table

OKLCH C(chroma)는 지각 균일이므로, 같은 C값이라도 색마다 다르게 보임:
- Blue C:0.10 -> 매우 채도 높게 느껴짐 (HSL S:50% 이상)
- Yellow C:0.10 -> 약간 채도 높게 느껴짐 (HSL S:30% 정도)

| Hue | OKLCH C:0.05 -> HSL S% | OKLCH C:0.10 -> HSL S% | OKLCH C:0.15 -> HSL S% |
|-----|------------------------|------------------------|------------------------|
| 0 (Red) | ~12% | ~25% | ~38% |
| 30 (Orange) | ~10% | ~22% | ~35% |
| 60 (Yellow) | ~8% | ~18% | ~30% |
| 120 (Green) | ~11% | ~24% | ~37% |
| 210 (Blue) | ~18% | ~36% | ~54% |
| 300 (Purple) | ~15% | ~32% | ~48% |

규칙은 HSL이 아닌 OKLCH로 정의해야 함. HSL 검증 시 이 표 참조.
