# Texture & Effects Catalog

> Layer-by-Layer 빌드에서 TEXTURE 요소(L4)와 텍스트 장식(L5.1)을 CSS 로 옮길 때 쓴다.
> 순서·구조 규칙은 [layer-build.md](layer-build.md). 네온 글로우·글래스모피즘·그라디언트 보더는 이 카탈로그에서 뺐다(CONTRACT §1-6).

##### L4.1 Noise/Grain 텍스처 카탈로그

D1.2에서 분석한 `noise/grain` 타입에 따라 아래 CSS 패턴을 적용한다.

```css
/* ═══════════════════════════════════════════════
   TYPE 1: Paper Noise (종이 질감)
   - 미세한 랜덤 입자감, 빈티지/고급 인쇄물 느낌
   - frequency: fine → baseFrequency 0.7~0.9
   - frequency: medium → baseFrequency 0.45~0.65
   - frequency: coarse → baseFrequency 0.2~0.35
   ═══════════════════════════════════════════════ */

/* Paper Fine (미세 종이 질감 - 가장 일반적) */
.texture-paper-fine::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 10;
  mix-blend-mode: overlay;
}

/* Paper Medium (중간 종이 질감 - 크래프트지 느낌) */
.texture-paper-medium::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 10;
  mix-blend-mode: overlay;
}

/* Paper Coarse (거친 종이 질감 - 수채화지/한지 느낌) */
.texture-paper-coarse::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.3' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.1'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 10;
  mix-blend-mode: soft-light;
}

/* ═══════════════════════════════════════════════
   TYPE 2: Film Grain (필름 그레인)
   - 아날로그 필름 느낌, 밝은/어두운 입자 혼합
   - monochrome: 흑백 입자
   - colored: 컬러 입자 (레트로 필름)
   ═══════════════════════════════════════════════ */

/* Film Grain - Monochrome (흑백 필름 입자) */
.texture-film-grain::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.9' numOctaves='6' stitchTiles='stitch' seed='5'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='0.06'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 10;
  mix-blend-mode: overlay;
}

/* Film Grain - Colored (컬러 필름 입자 - Kodak/Fuji 느낌) */
.texture-film-grain-color::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.75' numOctaves='5' stitchTiles='stitch' seed='12'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='0.05'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 10;
  mix-blend-mode: color-dodge;
}

/* ═══════════════════════════════════════════════
   TYPE 3: Digital Noise (디지털 노이즈)
   - 고ISO 카메라 느낌, 균일한 픽셀 노이즈
   ═══════════════════════════════════════════════ */

.texture-digital-noise::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='d'%3E%3CfeTurbulence type='turbulence' baseFrequency='1.2' numOctaves='1' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23d)' opacity='0.03'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 10;
}

/* ═══════════════════════════════════════════════
   TYPE 4: Organic Texture (유기적 질감)
   - 직물/패브릭/자연 질감
   ═══════════════════════════════════════════════ */

.texture-organic::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='o'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.015 0.08' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23o)' opacity='0.08'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 10;
  mix-blend-mode: soft-light;
}
```

**Noise 강도 조절 가이드:**

| D1.2 intensity | CSS opacity | 체감 |
|---------------|-------------|------|
| 0-15 (미미) | 0.02-0.03 | 거의 안 보이지만 질감감 있음 |
| 16-35 (약함) | 0.04-0.06 | 고급 인쇄물 느낌 |
| 36-55 (중간) | 0.07-0.10 | 크래프트지/빈티지 |
| 56-75 (강함) | 0.11-0.15 | 거친 종이/오래된 사진 |
| 76-100 (매우 강함) | 0.16-0.25 | 의도적 텍스처 아트 |

##### L4.2 (삭제) Glassmorphism

CONTRACT §1-6 금지 효과다. 레퍼런스에 반투명 블러 패널이 있으면 [layer-build.md](layer-build.md) 의 "금지 효과 대체" 표를 따른다.

##### L4.3 Shadow 시스템

```css
/* Subtle Shadow (카드 기본) */
.shadow-subtle {
  box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06);
}

/* Elevated Shadow (떠오른 느낌) */
.shadow-elevated {
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.1),
    0 12px 24px rgba(0, 0, 0, 0.15),
    0 32px 64px -12px rgba(0, 0, 0, 0.1);
}

/* Inner Shadow (오목한 느낌) */
.shadow-inset {
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 2px rgba(0, 0, 0, 0.1);
}
```

##### L4.4 Gradient 정밀 구현

D1.2에서 분석한 gradient stops를 **정확히** CSS로 변환한다.

```css
/* Dark Photo Overlay (사진 위 텍스트 가독성용) */
.gradient-dark-overlay {
  background: linear-gradient(180deg,
    transparent 0%,               /* 상단: 투명 (사진 보임) */
    rgba(0, 0, 0, 0.2) 35%,      /* 중간: 약한 어둡게 */
    rgba(0, 0, 0, 0.6) 60%,      /* 하단 시작: 강한 어둡게 */
    rgba(0, 0, 0, 0.9) 100%      /* 하단: 거의 불투명 */
  );
}


/* Ambient Glow (은은한 발광) */
.gradient-ambient {
  background:
    radial-gradient(ellipse at 30% 50%, rgba(100, 130, 255, 0.08) 0%, transparent 70%),
    radial-gradient(ellipse at 70% 50%, rgba(100, 130, 255, 0.05) 0%, transparent 70%);
}

/* Vignette (비네팅 - 가장자리 어둡게) */
.gradient-vignette {
  background: radial-gradient(ellipse at center,
    transparent 40%,
    rgba(0, 0, 0, 0.15) 70%,
    rgba(0, 0, 0, 0.4) 100%
  );
}

/* Abstract Gradient (추상 배경 - 여러 색상 블렌딩) */
.gradient-abstract-dark {
  background:
    radial-gradient(ellipse at 20% 80%, rgba(120, 40, 200, 0.5) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(20, 180, 180, 0.4) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(200, 60, 120, 0.3) 0%, transparent 60%),
    linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 100%);
}
```

**Gradient 정밀도 체크리스트:**

- [ ] stop position이 D1.2 분석값과 +-5% 이내인가?
- [ ] opacity가 원본 느낌과 일치하는가?
- [ ] 색상이 hex로 정확히 매칭되는가?
- [ ] blend-mode가 올바른가? (screen=밝게, multiply=어둡게, overlay=대비강화)

##### L4.5 Blend Mode 가이드

| D1.2 blend_mode | CSS | 효과 | 사용처 |
|-----------------|-----|------|--------|
| screen | `mix-blend-mode: screen` | 밝은 부분 강화, 어두운 부분 무시 | 빛 번짐, 하이라이트 |
| multiply | `mix-blend-mode: multiply` | 어두운 부분 강화, 밝은 부분 무시 | 그림자, 깊이감 |
| overlay | `mix-blend-mode: overlay` | 대비 강화 (밝은건 더 밝게, 어두운건 더 어둡게) | 텍스처, 질감 |
| soft-light | `mix-blend-mode: soft-light` | 부드러운 대비 | 미묘한 텍스처, 종이 질감 |
| color-dodge | `mix-blend-mode: color-dodge` | 색상 번 (과도하게 밝음) | 하이라이트, 렌즈 플레어 |

---

##### L5.1 Text Decorative Effects 카탈로그

```css
/* ═══════════════════════════════════════════
   Text Outline (사진 위 겹치는 큰 텍스트)
   ═══════════════════════════════════════════ */
.text-outline {
  -webkit-text-stroke: var(--stroke-width) var(--stroke-color);
  paint-order: stroke fill;
  /* stroke가 fill 아래로 가서 글자 안쪽은 깔끔 */
}

/* Text-Photo Overlap (음수 마진 + z-index) */
.text-overlap-photo {
  margin-top: calc(var(--photo-height) * var(--overlap-ratio) * -1);
  position: relative;
  z-index: 2; /* 사진(z-index:1) 위로 */
}

/* Gradient Text Fill */
.text-gradient-fill {
  background: linear-gradient(var(--gradient-direction), var(--color-start), var(--color-end));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

```
