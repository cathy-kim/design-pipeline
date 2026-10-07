# brief.md 템플릿

`.design/brief.md` 는 아래 구조를 **절 제목과 순서 그대로** 쓴다. 다음 단계는 절 제목으로 내용을 찾는다.
`{}` 는 채울 자리. 해당 없음은 지우지 말고 `없음` 이라고 쓴다.

- §1~§7 은 항상 쓴다.
- §8 "팔레트·타이포 결정" 은 `.design/brand_config.json` 이 **없을 때만** 쓴다. 있으면 §8 자리에 `브랜드 있음: .design/brand_config.json (brand.id = {id})` 한 줄만 쓴다.
- §8 의 JSON 은 언어 태그가 `json brand-decision` 인 fenced 블록 **하나**에 둔다. 키는 brand_config 의 점 경로(`"brand.id"`, `"tokens.colors"` …)다. design-system 의 `--promote-brief` 가 이 블록을 찾아 경로마다 그대로 대입해 `brand_config.json` 을 만든다. 태그를 바꾸거나 brief 안에 같은 태그 블록을 둘 두지 않는다.
- 블록 내용은 `palette-decide.mjs` 출력의 `brand_decision` 을 **수정 없이** 붙인 것이다. 손으로 HEX 를 고치지 않는다.

---

~~~markdown
# Design Brief — {프로젝트/화면 이름}

> 작성: design-brief · {YYYY-MM-DD} · 질문 라운드 {n}/3
> 요청 원문: "{사용자 요청 원문 한 줄}"

## 1. 목표

- **한 줄 목표:** {이 작업이 끝나면 사용자가 무엇을 할 수 있나}
- **성공 지표:** {전환율, 작업 완료 시간 등 측정 가능한 것. 모르면 "정의 안 됨"}
- **디자인 유형:** {landing_page | dashboard | form | list | detail | profile | product_page | sns_card}
- **플랫폼:** {web | mobile-rn | print} · 기준 뷰포트 {1440 | 375 | 1080×1350}

## 2. 대상 사용자

| 항목 | 내용 |
|---|---|
| 주 사용자 | {누구} |
| 사용 맥락 | {언제·어디서·어떤 기기로} |
| 숙련도 | {처음 | 가끔 | 매일} |
| 접근성 요구 | {기본 WCAG AA | 추가 요구} |

## 3. 화면 목록과 우선순위

| ID | 화면 | 목적 | 핵심 요소 | 우선순위 | 상태(States) |
|---|---|---|---|---|---|
| S1 | {화면명} | {이 화면에서 끝내야 할 일} | {꼭 있어야 할 요소 3~6개} | P0 | {default, loading, empty, error} |
| S2 | ... | ... | ... | P1 | ... |

- **P0** = 이것 없이는 목표 불가. design-ui 가 먼저, 반드시 만든다.
- **P1** = 목표 흐름에 필요하지만 P0 뒤.
- **P2** = 있으면 좋음. 이번 범위에서 빠질 수 있다.
- P0 는 1~3개. 넘으면 범위를 다시 묻는다.

### 사용자 흐름

{S1 → S2 → S3 형태로 P0 화면 간 이동 1~2줄}

## 4. 톤

- **Mood:** {mood 1~3개, mood-philosophy-mapping 의 12개 어휘}
- **Philosophy:** {8개 어휘 중 1개}
- **문체:** {존댓말 해요체 | 합니다체 | 반말} · {짧고 단정 | 친근 | 전문}
- **피할 것:** {예: 과장된 마케팅 문구, 귀여운 이모지}

## 5. 콘텐츠

| 화면 ID | 필수 문구/데이터 | 출처 |
|---|---|---|
| S1 | {헤드라인, CTA 라벨, 표시 데이터} | {사용자 제공 | 가정 | API} |

## 6. 제약

| 항목 | 값 |
|---|---|
| 브랜드 | {있음: brand_config.json | 없음: §8 에서 결정} |
| 참조 | {URL/이미지 경로 | 없음} |
| 기술 스택 | {Next.js + Tailwind | React Native + NativeWind | 단일 HTML | 미정} |
| 다국어 | {ko | ko+en | ...} |
| 기한·범위 | {있으면} |
| 디자인 규칙 | 한 화면 3색, 닫힌 radius 스케일, pill 버튼·네온 글로우·글래스모피즘·그라디언트 보더 금지 (CONTRACT §1-6) |

## 7. 가정과 미결

| 필드 | 가정값 | 근거 | 확정 여부 |
|---|---|---|---|
| {platform} | {web} | {요청문 "웹사이트"} | 가정 |

## 8. 팔레트·타이포 결정

**입력 3축:** Sector {sector} / {subPosition} · Positioning {positioning} · Mood {mood} × Philosophy {philosophy}
**온도:** {warm | cool} (해소: {Mood > Philosophy > Sector 중 무엇이 이겼나})
**역할 접기:** Base→neutral · Support→primary · Accent→accent · {버린 색과 이유}

**검증 (palette-decide.mjs):**

| 규칙 | 결과 | 근거 |
|---|---|---|
| SR-01 chroma binding | PASS | {detail} |
| ... | ... | ... |

```json brand-decision
{
  "brand.id": "{kebab-case id}",
  "brand.name": "{표시 이름}",
  "brand.mood": ["{mood}"],
  "brand.philosophy": "{philosophy}",
  "tokens.colors": {
    "primary": { "DEFAULT": "#RRGGBB", "foreground": "#RRGGBB", "50": "#RRGGBB", "100": "#RRGGBB", "500": "#RRGGBB", "600": "#RRGGBB", "700": "#RRGGBB" },
    "accent":  { "DEFAULT": "#RRGGBB", "foreground": "#RRGGBB", "100": "#RRGGBB", "600": "#RRGGBB" },
    "neutral": { "0": "#FFFFFF", "50": "#RRGGBB", "100": "#RRGGBB", "200": "#RRGGBB", "300": "#RRGGBB", "400": "#RRGGBB",
                 "500": "#RRGGBB", "600": "#RRGGBB", "700": "#RRGGBB", "800": "#RRGGBB", "900": "#RRGGBB", "950": "#RRGGBB" },
    "semantic": { "success": "#RRGGBB", "warning": "#RRGGBB", "danger": "#RRGGBB", "info": "#RRGGBB" }
  },
  "tokens.typography": {
    "families": { "sans": "Pretendard, Inter, system-ui, sans-serif" },
    "scale": {
      "display":   { "size": "48px", "lineHeight": "1.15", "weight": 700, "letterSpacing": "-0.02em" },
      "title-lg":  { "size": "33px", "lineHeight": "1.3",  "weight": 700, "letterSpacing": "-0.01em" },
      "title-md":  { "size": "23px", "lineHeight": "1.4",  "weight": 600 },
      "body-lg":   { "size": "19px", "lineHeight": "1.7",  "weight": 400 },
      "body-md":   { "size": "16px", "lineHeight": "1.7",  "weight": 400 },
      "caption":   { "size": "13px", "lineHeight": "1.4",  "weight": 400 },
      "button-md": { "size": "16px", "lineHeight": "1.2",  "weight": 600 }
    },
    "weights": { "regular": 400, "medium": 500, "semibold": 600, "bold": 700 },
    "lineHeights": { "tight": 1.25, "normal": 1.5, "relaxed": 1.7 }
  }
}
```

**design-system 에 넘기는 메모:** radius·spacing·roles·components 는 brief 가 정하지 않는다. 승격 시 design-system 기본값이 들어간다.
~~~

---

## 채운 예시 (placeholder 브랜드 acme)

~~~markdown
# Design Brief — acme 회원 대시보드

> 작성: design-brief · 2026-10-07 · 질문 라운드 2/3
> 요청 원문: "acme 고객이 쓰는 사용량 대시보드 만들어줘"

## 1. 목표
- **한 줄 목표:** 고객이 이번 달 사용량과 청구 예상액을 10초 안에 파악한다
- **성공 지표:** 정의 안 됨
- **디자인 유형:** dashboard
- **플랫폼:** web · 기준 뷰포트 1440

## 3. 화면 목록과 우선순위
| ID | 화면 | 목적 | 핵심 요소 | 우선순위 | 상태(States) |
|---|---|---|---|---|---|
| S1 | 사용량 개요 | 이번 달 사용량 파악 | KPI 카드 4, 일별 차트, 기간 필터 | P0 | default, loading, empty, error |
| S2 | 청구 내역 | 지난 청구 확인 | 테이블, 다운로드 | P1 | default, empty |
| S3 | 알림 설정 | 한도 알림 지정 | 토글, 임계값 입력 | P2 | default, saving, error |
~~~
