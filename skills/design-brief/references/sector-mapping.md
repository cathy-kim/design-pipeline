# Sector x Positioning Mapping Table

> 10개 Sector x 26개 Sub-position = 260개 조합. 포지셔닝별 채도/명도 규칙 포함.

---

## CRITICAL FIX: HSL 범위 확장

기존 규칙이 실제 성공한 럭셔리 브랜드를 위반하여 수정:

| 포지셔닝 | Base S 상한 | Support S 범위 | Accent S 상한 | 설명 |
|---------|-----------|--------------|------------|------|
| **Luxury** | **35%** | 15-50% | **50%** | 시그니처 색(Stripe) 허용, 기본은 저채도 |
| **Premium** | **45%** | 20-60% | **65%** | 다양한 채도 표현 허용 |
| **Standard** | **60%** | 30-75% | **80%** | 높은 채도 허용 |
| **Mass** | **80%** | 50-100% | **100%** | 최대 자유도 |

### 시그니처 브랜드 컬러 예외 Tier

3가지 모두 만족할 때만 예외 적용:
1. **면적 제약**: 전체 디자인의 5-15% 이하
2. **배경 중립성**: 주변 배경이 무채색 또는 반대 온도
3. **기능적 명확성**: CTA, 브랜드 로고, 강조 요소로만 사용

---

## 포지셔닝별 기본 규칙

### Luxury

```
명도 분산: >=60 포인트 | 채도 상한: Base S<35%, Accent S<50%
중성 비율: >=70% | 온도: 일관성 필수 | 색상 수: 3-4색
톤존: Deep + Pale (극단) 또는 Dark + Light
OKLCH: L: 0.10-0.95, C: 0.01-0.12
```
대표: Lemaire, Loro Piana, Aesop, Notion, Stripe (CTA만)

### Premium

```
명도 분산: >=50 포인트 | 채도 상한: Base S<45%, Accent S<65%
중성 비율: >=60% | 온도: 일관성 필수 | 색상 수: 2-5색
톤존: Dark + Light 또는 Pale + Vivid (1단계 이탈)
OKLCH: L: 0.15-0.92, C: 0.02-0.18
```
대표: Wise, Ramp, Glossier, Figma

### Standard

```
명도 분산: >=40 포인트 | 채도 상한: Base S<60%, Accent S<80%
중성 비율: >=40% | 온도: 일관성 권장 | 색상 수: 3-6색
톤존: 혼용 가능 (1-2단계 이탈)
OKLCH: L: 0.20-0.90, C: 0.05-0.25
```

### Mass

```
명도 분산: >=30 포인트 | 채도 상한: Base S<80%, Accent S<=100%
중성 비율: >=20% | 온도: 자유 | 색상 수: 3-8색
톤존: 완전 자유
OKLCH: L: 0.20-0.95, C: 0.08-0.40
```

---

## 1. Tech / SaaS

### 1.1 Enterprise (신뢰, 안정성)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:220-250, S:30-55%, L:15-35% (#0A1628-#1E3A5F) |
| **Secondary** | H:220-230, S:5-15%, L:88-96% (#E8ECFF-#F0F4FF) |
| **Accent** | H:240-265, S:55-75%, L:45-60% (#4B5FD6-#6366F1) |
| **Forbidden** | None for Tech sector |
| **Reference** | Stripe (#635BFF), IBM, Microsoft, Slack (#36C5F0) |
| **Temperature** | Cool (Blue dominant) |
| **Tone Zone** | Deep + Light (binary) |
| **OKLCH Chroma** | Base C:0.04, Support C:0.10, Accent C:0.16 |
| **Art Movement** | Swiss International / Corporate Modernism |

### 1.2 Startup (혁신, 에너지)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:255-280, S:50-70%, L:45-60% (#7C3AED-#8B5CF6) |
| **Secondary** | H:250-265, S:10-20%, L:8-15% (#1E1B4B-#312E81) |
| **Accent** | H:260-275, S:65-85%, L:55-70% (#A78BFA-#C4B5FD) |
| **Reference** | Figma, Linear, Superhuman, Loom |
| **Temperature** | Cool (Purple accent) |
| **Tone Zone** | Dark + Vivid |
| **Art Movement** | Digital Minimalism / Dark Bauhaus |

### 1.3 DevTool (개발자 친화, 기술성)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:0, S:0%, L:10-20% (#0D1117-#21262D) -- Pure black monochrome |
| **Secondary** | H:210-220, S:5-12%, L:30-50% (#4A6FA5-#6E88B0) |
| **Accent** | H:140-200, S:50-70%, L:50-65% (#3FB950-#58A6FF) |
| **Reference** | GitHub (#0D1117), Vercel (#000), Railway (#030B0F) |
| **Temperature** | Neutral (Black + Color accent) |
| **Tone Zone** | Dark Monochrome (base) + Vivid (accent) |
| **Art Movement** | Terminal Aesthetics / Brutalist Grid |

---

## 2. Beauty / Cosmetics

### 2.1 Clean (미니멀, 자연)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:30-50, S:15-35%, L:88-96% (#F8F5EF-#FDF9F4) |
| **Secondary** | H:0-20 or H:90-130, S:12-28%, L:70-85% (#E8D9D3-#ECDFC3) |
| **Accent** | H:0-40, S:20-35%, L:75-88% (#F5DADF-#EDD5C8) |
| **Forbidden** | 과도한 채도 금지 (S >40%) |
| **Reference** | Aesop, Glossier (#F5DADF), Byredo |
| **Temperature** | Warm |
| **Tone Zone** | Pale / Light (고명도 유지) |
| **Art Movement** | Japandi / Wabi-sabi Lightness |

### 2.2 Luxury (고급, 정교함)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:30-40, S:3-8%, L:5-15% (#0A0906-#1C1A17) |
| **Secondary** | H:35-45, S:8-18%, L:92-98% (#F7F3ED-#FCFAF6) |
| **Accent** | H:35-55, S:25-45%, L:55-75% (#B89A6A-#D4AF7A) |
| **Forbidden** | S > 40% in primary/secondary (럭셔리 채도 상한) |
| **Saturation Ceiling** | Base S:3-8%, Accent S:25-45% (매우 엄격) |
| **Reference** | Lemaire (#100A0D - S:11%), Loro Piana, Creed |
| **Temperature** | Warm (brown/gold undertone) |
| **OKLCH Chroma** | Base C:<=0.03, Accent C:0.08-0.12 |
| **Art Movement** | Minimalism / Art Deco Restraint |

### 2.3 Mass K-Beauty (활발, 친근)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:340-15, S:55-80%, L:55-75% (#FF6B8A-#FF8FA3) |
| **Secondary** | H:340-10, S:5-20%, L:90-98% (#FFE4EC-#FFF5F9) |
| **Accent** | H:330-345, S:70-90%, L:50-65% (#FF4D79-#FF6B8A) |
| **Reference** | Etude House, Peripera, Tarte |
| **Temperature** | Warm (hot pink) |
| **Art Movement** | Pop Art / Kawaii Aesthetics |

---

## 3. Finance / Fintech

### 3.1 Traditional (신뢰, 권위)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:210-230, S:45-65%, L:15-30% (#0A1929-#1B3A5C) |
| **Secondary** | H:210-220, S:5-12%, L:85-95% (#E8F0F8-#F2F6FB) |
| **Accent** | H:40-55, S:30-50%, L:45-60% (#B8962E-#D4AF37) |
| **Forbidden** | Pastel 전체 팔레트 금지 (신뢰감 파괴); High saturation >70% 금지 |
| **Reference** | JPMorgan, Goldman Sachs, UBS |
| **Temperature** | Cool + Warm mix (Blue base + Gold accent) |
| **Art Movement** | Corporate Classicism / Swiss Typography |

### 3.2 Fintech (혁신, 접근성)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:140-180, S:60-80%, L:45-65% (#9FE870-#3ECF8E) |
| **Secondary** | H:140-160, S:8-18%, L:8-16% (#0D5C35-#1A4D42) |
| **Accent** | H:75-90, S:75-90%, L:65-78% (#9FE870-#C8F56A) |
| **Reference** | Wise (#9FE870), Revolut, Chime, Plaid |
| **Temperature** | Cool (Green/Teal) |
| **Art Movement** | Neo-Brutalism / Bauhaus Bold |

### 3.3 Investment (성장, 안정)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:150-165, S:30-50%, L:20-35% (#1B3D2F-#2D5A42) |
| **Secondary** | H:40-50, S:8-18%, L:90-97% (#F5F1E8-#FAF9F5) |
| **Accent** | H:45-55, S:25-40%, L:55-70% (#BFA06A-#D4B896) |
| **Reference** | Robinhood, Public, Betterment |
| **Temperature** | Warm-Cool mix (Green + Beige) |
| **Art Movement** | Anglo-American Heritage / Preppy |

---

## 4. Food & Beverage

### 4.1 Premium (신선함, 품질)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:25-55, S:20-40%, L:30-55% (#5C3A1E-#8B5E3C) |
| **Secondary** | H:35-45, S:10-25%, L:88-97% (#F0E8DC-#FAF7F2) |
| **Accent** | H:40-60, S:35-55%, L:45-65% (#C8973A-#E8B84B) |
| **Forbidden** | Blue dominant primary/background (H:180-240, L:30-60%, area >20%) -- 식욕 억제 |
| **Exception** | Blue Bottle Coffee: Small brand mark (H:195, 5-10% area) on neutral background |
| **Reference** | Blue Bottle Coffee, Nespresso, Stumptown |
| **Temperature** | Warm (earthy brown) |
| **Art Movement** | Arts & Crafts / Farmhouse |

### 4.2 FMCG (상품성, 인식)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | Category-dependent: Red H:0-15 OR Yellow H:45-60 OR Green H:120-145 |
| **Secondary** | H:0, S:0%, L:98-100% (Pure white) |
| **Accent** | 보색 또는 White (대조) |
| **Forbidden** | Blue 주색 금지 (CRITICAL: Food sector rule) |
| **Reference** | Coca-Cola (Red), Lay's (Yellow), Tropicana (Orange) |
| **Art Movement** | Pop Art / Commercial Signage |

### 4.3 Wellness (자연, 건강)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:80-130, S:15-35%, L:40-65% (#6B8F5E-#8FAF7A) |
| **Secondary** | H:35-50, S:15-30%, L:82-93% (#E8DCC8-#F5F0E3) |
| **Accent** | H:25-45, S:30-50%, L:45-60% (#C4913A-#D4A855) |
| **Forbidden** | Medical Blue (H:200-220, S:60%+) as primary -- 따뜻함 정체성 파괴 |
| **Reference** | Erewhon (#6B8F5E green), Whole Foods, Fairway |
| **Temperature** | Warm (Green with earthy undertone) |
| **Art Movement** | Organic Modernism / Scandinavian Natural |

---

## 5. Fashion / Apparel

### 5.1 Luxury (정교함, 절제)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:30-40, S:0-8%, L:5-15% (Black) + L:90-99% (White) |
| **Secondary** | H:30-45, S:20-35%, L:65-82% (Warm gray/beige) |
| **Accent** | Brand-specific single hue; S:10-35%, L:40-80% |
| **Forbidden** | 3 hue 이상 혼합 금지 -- 럭셔리 절제 원칙 위반 |
| **Saturation Ceiling** | Base S:<8%, Accent S:<35% (Luxury에서 가장 엄격) |
| **Reference** | Lemaire, Celine, Loro Piana, Rick Owens |
| **OKLCH Chroma** | Base C:<=0.02, Accent C:<=0.10 |
| **Art Movement** | Minimalism / Quiet Luxury |

### 5.2 Contemporary (접근성, 개성)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:20-50, S:10-25%, L:30-70% (#4A3728-#8C7060) |
| **Secondary** | H:35-45, S:8-18%, L:88-96% (#F0E8DC-#FAF7F2) |
| **Accent** | H:25-55, S:30-45%, L:40-60% |
| **Reference** | Everlane, Reformation, COS |
| **Temperature** | Warm |
| **Art Movement** | Japandi / New Normcore |

### 5.3 Streetwear (대담함, 표현)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:0, S:0%, L:3-10% (Pure black) |
| **Secondary** | H:0, S:0%, L:97-100% (Pure white) |
| **Accent** | Season-dependent; S:60-90%, free hue |
| **Reference** | Supreme, Stussy, Fear of God |
| **Temperature** | Neutral (Black/White base) |
| **Art Movement** | Graffiti Art / Pop Art Bold |

---

## 6. Wellness / Healthcare

### 6.1 Natural (자연, 신뢰)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:80-130, S:12-28%, L:40-65% (#7A9B6E-#9BBF8A) |
| **Secondary** | H:35-50, S:15-30%, L:80-93% (#E8DCC8-#F5F0E3) |
| **Accent** | H:15-30, S:30-45%, L:50-65% (#C4785A-#D4906E) |
| **Forbidden** | Medical Blue (H:200-220, S:60%+) as primary |
| **Reference** | Innisfree, Burt's Bees, Herbivore |
| **Temperature** | Warm |
| **Art Movement** | Wabi-sabi / Organic Modernism |

### 6.2 Clinical (신뢰, 명확성)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:200-220, S:15-35%, L:40-65% (#4A90B8-#5BA3CC) |
| **Secondary** | H:210-220, S:0-8%, L:92-100% (Pure white/off-white) |
| **Accent** | H:205-220, S:50-65%, L:40-55% (#1A7FA6-#2E8BB5) |
| **Forbidden** | Warm colors in primary (clinical perception 파괴) |
| **Reference** | Teladoc, Gavi, CVS Health |
| **Temperature** | Cool (Medical Blue but muted) |
| **Art Movement** | International Style / Swiss Design |

---

## 7. Sustainability / Eco

### 7.1 Activist (신념, 행동)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:25-55, S:20-40%, L:30-55% (#7A5C3A-#A07848) |
| **Secondary** | H:40-50, S:12-25%, L:85-94% (#EDE4D3-#F5F0E8) |
| **Accent** | H:90-130, S:20-40%, L:35-55% (#5A8A3C-#78A855) |
| **Forbidden** | 전체 팔레트 녹색 도배 (H:80-160 >60%) -- Greenwashing 혐의 |
| **Reference** | Patagonia, The Nature Conservancy |
| **Temperature** | Warm (earth tone base) + Cool (green accent) |
| **Art Movement** | Arts & Crafts / Land Art |

### 7.2 Premium B-Corp (신뢰, 지속가능성)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:140-165, S:20-40%, L:20-40% (#1E3D2F-#2D5A42) |
| **Secondary** | H:40-50, S:10-20%, L:90-97% (#F5F1E8-#FAF9F5) |
| **Accent** | H:45-55, S:20-35%, L:55-70% (#B09A6A-#C8B080) |
| **Forbidden** | High-saturation green (greenwashing risk) |
| **Reference** | Allbirds, Reformation, Everlane |
| **Temperature** | Warm (Green + Cream) |
| **Art Movement** | Scandinavian Craft / Quiet Sustainability |

---

## 8. Real Estate / Property

### 8.1 Luxury (고급, 진정성)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:30-40, S:5-12%, L:8-18% (#131110-#201D1A) |
| **Secondary** | H:40-55, S:20-38%, L:65-80% (#C9A875-#DFC9A8) |
| **Accent** | H:40-50, S:30-45%, L:75-90% (#F0D9A8-#F8E8C0) |
| **Forbidden** | Electric blue (H:195-225, S:55%+) as primary -- 임대/공공주택 연상 |
| **Reference** | Sotheby's, Christie's, Four Seasons |
| **Temperature** | Warm (gold undertone) |
| **Art Movement** | Art Deco / Beaux-Arts |

### 8.2 PropTech (혁신, 기술)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:195-225, S:55-75%, L:40-60% (#1B7FE8-#0066CC) |
| **Secondary** | H:210-220, S:5-12%, L:90-98% (#E8F0F8-#F0F6FB) |
| **Accent** | H:25-35, S:70-85%, L:50-60% (#FF6B35-#FF8C5A) |
| **Reference** | Zillow, Redfin, Compass |
| **Temperature** | Cool + Warm mix (cool dominant) |
| **Art Movement** | Digital Product Design |

---

## 9. Education / EdTech

### 9.1 Adult (전문성, 신뢰)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:230-255, S:35-55%, L:20-40% (#1A2456-#2D3A8C) |
| **Secondary** | H:40-50, S:8-18%, L:90-97% (#F5F1E8-#FAF9F5) |
| **Accent** | H:235-250, S:55-70%, L:50-65% (#5B72CC-#7A8FE0) |
| **Forbidden** | 고채도 Yellow + Red 동시 사용 (S:80%+) -- 유치원/초등 연상 |
| **Reference** | Coursera, Skillshare, Masterclass |
| **Temperature** | Cool (Indigo) |
| **Art Movement** | Academic Traditionalism |

### 9.2 K12 (참여, 즐거움) -- UNIQUE EXCEPTION

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | Multi-hue: Red H:0-10 / Blue H:210-230 / Yellow H:50-60 |
| **Secondary** | H:0, S:0%, L:97-100% (Pure white) |
| **Accent** | All primary colors; S:70-85%, L:55-70% |
| **특수 규칙** | 유일하게 3-4 hue 허용 섹터 (아동 교육 심리) |
| **Reference** | PBS Kids, Duolingo, Khan Academy Kids |
| **Art Movement** | Primary Modernism / Montessori |

### 9.3 B2B (신뢰, 기술)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:200-235, S:40-60%, L:30-50% (#1B5E8A-#2A7BAD) |
| **Secondary** | H:210-215, S:5-10%, L:90-97% (#E8EEF5-#F0F4F9) |
| **Accent** | H:140-160, S:45-60%, L:40-55% (#2D8A5E-#3DA872) |
| **Reference** | Blackboard, Canvas, Workday |
| **Temperature** | Cool |
| **Art Movement** | Corporate Modernism / Information Design |

---

## 10. Hospitality / Travel

### 10.1 Luxury (우아함, 안정)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:30-50, S:8-20%, L:15-30% (#261E16-#3D2E20) |
| **Secondary** | H:40-55, S:15-30%, L:85-95% (#F5EEDD-#FCF8F0) |
| **Accent** | H:40-55, S:25-40%, L:55-70% (#C4A05A-#D8B87A) |
| **Reference** | Four Seasons, Ritz-Carlton, Mandarin Oriental |
| **Temperature** | Warm (gold undertone) |
| **Art Movement** | Art Deco Warmth |

### 10.2 OTA (접근성, 신뢰)

| 항목 | 상세 내용 |
|------|---------|
| **Primary** | H:195-225, S:70-90%, L:40-55% (#003580-#0057B8) |
| **Secondary** | H:0, S:0%, L:95-100% (Pure white) |
| **Accent** | H:20-35, S:75-90%, L:50-60% (#FF6600-#FF8C42) |
| **Reference** | Booking.com (#003580), Expedia, Airbnb |
| **Temperature** | Cool (Blue) + Warm (Orange) mix |
| **Art Movement** | E-commerce Functionalism |

---

## 온도 충돌 해소 가이드

우선순위: Mood Temperature > Philosophy Temperature > Sector Default

| 조합 | 충돌 | 해결 |
|------|------|------|
| Food + Playful (Warm) + Cool (Philosophy) | Yes | Mood 우선 -> Warm 선택 |
| Tech + Bold (Warm) + Cool (Sector) | Yes | Mood 우선 -> Warm, accent만 warm |
| Wellness + Calm (Cool) + Warm (Sector) | Yes | Mood 우선 -> Cool, Medical Blue 위험 -> accent warm 상쇄 |
