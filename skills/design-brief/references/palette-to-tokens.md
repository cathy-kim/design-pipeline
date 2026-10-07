# Palette & Typography → brand_config 토큰 매핑

design-brief 가 "브랜드 없음" 분기에서 내린 결정을 `brands/_template.json` 과 **같은 모양**으로 적는 규칙.
brief.md §8 의 `json brand-decision` 블록은 키가 brand_config 점 경로이고, design-system 의
`--promote-brief` 가 경로마다 그대로 대입해 `brand_config.json` 을 만든다.

## 1. 팔레트 역할 → 토큰 키 (3색 접기)

color-palette-advisor 식 팔레트는 Base · Support · Accent · Highlight 4~5색이 나온다.
CONTRACT §1-6 "한 화면 3색" 에 맞춰 다음처럼 접는다.

| 팔레트 역할 | OKLCH 채도 | 토큰 키 | 용도 |
|---|---|---|---|
| Base (어두운/밝은 중성) | C ≤ 0.05 | `tokens.colors.neutral` 스케일의 hue·chroma | 배경, 본문, 보더 |
| Highlight (off-white) | C ≤ 0.03 | `neutral.0`·`neutral.50` 쪽 끝 (같은 스케일) | 페이지 배경 |
| Support (브랜드 색) | C 0.06–0.12 | `tokens.colors.primary` (`DEFAULT`·`foreground`·`50`·`100`·`500`·`600`·`700`) | 헤더, 링크, 선택 상태, 구조적 강조 |
| Accent (강조) | C ≥ 0.13 | `tokens.colors.accent` (`DEFAULT`·`foreground`·`100`·`600`) | CTA, 핵심 강조. 면적 15% 이하 |
| Accent2 이상 | — | **버린다** | 3색 초과. 필요하면 accent 의 명도 변형으로 대체 |
| (자동) | — | `tokens.colors.semantic` | success / warning / danger / info. 상태 표시에만, 장식 금지 |

- neutral 스케일은 `0`(흰색), `50, 100, 200, …, 900, 950` 12단계. L 은 스크립트가 고정값으로 만들고, brief 는 **neutral 의 hue 와 chroma 하나씩만** 정한다.
- neutral hue: SR-03 에 따라 warm 20–50 또는 cool 200–240, 또는 primary hue ±5. chroma 0.005–0.02 권장. 순수 회색(C=0)은 DevTool·Streetwear·Fashion Luxury 만.
- `semantic.info` 는 primary 와 같게 둔다(새 색을 늘리지 않기 위해).
- primary·accent 의 `foreground` 는 흰색과 `neutral.950` 중 대비가 큰 쪽, `600` 은 hover 단계(L −0.06)다. 전부 스크립트가 계산한다.
- `roles`(background·text·border …), radius, spacing, components 는 brief 가 정하지 않는다. design-system 이 기본값으로 채운다.

## 2. OKLCH 입력 고르는 법

1. [sector-mapping.md](sector-mapping.md) 에서 Sector × Sub-position 행을 찾는다 → Primary/Secondary/Accent 의 hue·채도 범위.
2. [mood-philosophy-mapping.md](mood-philosophy-mapping.md) 에서 Mood × Philosophy 조합(없으면 Fallback 알고리즘) → 온도·채도 경향·예시 팔레트.
3. 충돌은 Mood 온도 > Philosophy 온도 > Sector 기본 온도 순으로 해소.
4. Support 역할 = primary, Accent 역할 = accent 로 OKLCH 값을 정한다. 기준:
   - primary: L 0.30–0.55, C 0.06–0.12
   - accent: L 0.50–0.70, C ≥ 0.13, primary 와 hue 차 30° 이내 권장(섹터 표가 짝지은 경우만 예외), 150° 이상 금지
5. 스크립트로 확정·검증한다. 실패 시 [sophistication-rules.md](sophistication-rules.md) "오류 자동 교정 가이드" 대로 고쳐 재실행.

## 3. 타이포그래피 방향 → `tokens.typography`

키는 `families`, `scale`, `weights`, `lineHeights` 네 개로 고정한다.

### families

| Mood/Philosophy 경향 | `families.sans` (본문·UI) | `families.display` (제목, 선택) | 비고 |
|---|---|---|---|
| Minimal · Calm · Intellectual · Cool | Pretendard / Inter | 없음 (sans 굵기로 계위) | 기본값 |
| Luxurious · Refined · Nostalgic | Pretendard | serif 계열 (예: Noto Serif KR / Playfair Display) | display 는 제목에만 |
| Bold · Energetic · Rebellious | Pretendard | 굵은 grotesk (예: Space Grotesk) | 900 금지, 800 까지 |
| Playful · Romantic · Organic | Pretendard | rounded sans (예: Nunito) | 본문은 sans 유지 |
| Futuristic · DevTool | Pretendard / Inter | 없음 | `families.mono` 필수 (JetBrains Mono 등) |

- 한국어 본문이 있으면 `sans` 의 첫 폰트는 한글 글리프를 가진 폰트여야 한다.
- 폰트는 최대 2패밀리(+mono). 값은 CSS `font-family` 문자열 그대로 적는다 (`"Pretendard, Inter, system-ui, sans-serif"`).
- 폰트 파일 경로는 brief 가 정하지 않는다(`assets.fonts` 는 design-system/브랜드 몫).

### scale (px, 모듈러 비율)

| 성격 | ratio | base |
|---|---|---|
| 정보 밀도 높음 (dashboard, table, admin) | 1.125 | 14 |
| 일반 앱·웹 | 1.2 | 16 |
| 마케팅·랜딩 | 1.25 | 16 |
| Luxury · 에디토리얼 | 1.333 | 16 |

brief 는 `ratio` 와 `base`(= `body-md` 크기) 두 숫자만 정한다. 스크립트가 design-system 이 쓰는 역할 이름 스케일로 펼친다.

| 역할 | 크기 | lineHeight | weight |
|---|---|---|---|
| `display` | base × ratio⁶ | 1.15 | bold (없으면 semibold) |
| `title-lg` | base × ratio⁴ | 1.3 | bold (없으면 semibold) |
| `title-md` | base × ratio² | 1.4 | semibold |
| `body-lg` | base × ratio | `lineHeights.relaxed` | regular |
| `body-md` | base | `lineHeights.relaxed` | regular |
| `caption` | base ÷ ratio (최소 12px) | 1.4 | regular |
| `button-md` | base | 1.2 | semibold |

`body-md`·`button-md`·`caption` 은 design-system 기본 컴포넌트가 참조하므로 빠지면 안 된다.

### weights

`{ "regular": 400, "medium": 500, "semibold": 600, "bold": 700 }` 이 기본. Luxurious/Refined 는 `bold` 를 빼고 `semibold` 까지, Bold/Energetic 는 `extrabold: 800` 추가 가능.

### lineHeights

`{ "tight": 1.25, "normal": 1.5, "relaxed": 1.7 }` 기본. 한국어 본문 비중이 높으면 `normal: 1.6`.

## 4. 스크립트 입력 형식

`${CLAUDE_PLUGIN_ROOT}/skills/design-brief/scripts/palette-decide.mjs` 의 입력 JSON:

```json
{
  "brandId": "acme", "brandName": "Acme",
  "sector": "tech", "subPosition": "enterprise", "positioning": "premium",
  "mood": ["minimal", "calm"], "philosophy": "refined",
  "primary": { "l": 0.42, "c": 0.10, "h": 255 },
  "accent":  { "l": 0.55, "c": 0.17, "h": 268 },
  "neutral": { "c": 0.012, "h": 250 },
  "signatureAccent": false,
  "pureGrayAllowed": false,
  "typography": {
    "families": { "sans": "Pretendard, Inter, system-ui, sans-serif" },
    "ratio": 1.2, "base": 16,
    "weights": { "regular": 400, "medium": 500, "semibold": 600, "bold": 700 },
    "lineHeights": { "tight": 1.25, "normal": 1.5, "relaxed": 1.7 }
  }
}
```

출력의 `brand_decision` 을 brief.md §8 의 `json brand-decision` 블록에 **그대로** 붙인다. `checks` 는 결정 근거 표로 옮긴다.
`brandId` 는 kebab-case(프로젝트·서비스 이름에서 만든다. 모르면 질문하고, 끝까지 모르면 `project` 로 두고 §7 에 가정으로 적는다). `signatureAccent: true` 는 SR-05 시그니처 예외 3조건(면적 ≤15%, 중립 배경, CTA/로고 전용)을 brief 에 적었을 때만 쓴다.
