# Landing Sections — 섹션 해부와 순서

> landing-page-creator `landing-sections.md` 에서 섹션 구조·순서·반응형 규칙을 가져왔다.
> 원본 코드의 rainbow-button · neon-gradient-card · shine-border · pill 배지 · `text-green-500` 같은 브랜드 밖 색은 제거했다.
> `Button`/`Card` 는 시스템 프리미티브(`@/design-system/primitives/web`, named export). `Badge`/`Accordion` 은 시스템에 없으므로 토큰 클래스로 조립하거나 shadcn 을 시스템 토큰으로 재스킨해 쓴다. 클래스 이름은 시스템 preset 의 이름이다(실제 이름은 `system/` 에서 확인).

## 1. Hero

**목적**: 첫인상, 핵심 가치 한 줄, 주요 CTA.

**필수 요소**: 헤드라인 1줄 · 서브 1–2줄 · Primary CTA · (선택) Secondary CTA · 시각 요소(제품 스크린샷/영상/모션).

```tsx
<section className="relative min-h-[90vh] flex items-center">
  <div className="absolute inset-0 -z-10">{/* grid-pattern / dot-pattern */}</div>
  <div className="mx-auto max-w-6xl px-6">
    <Badge variant="subtle">새 기능</Badge>            {/* 시스템 Badge — pill 아님 */}
    <h1 className="mt-6 text-display font-bold">핵심 메시지</h1>
    <p className="mt-6 max-w-2xl text-body-lg text-neutral-600">가치 제안을 설명하는 문장</p>
    <div className="mt-10 flex flex-col gap-4 sm:flex-row">
      <Button variant="primary" size="lg">무료로 시작</Button>
      <Button variant="outline" size="lg">데모 보기</Button>
    </div>
    <div className="mt-16">{/* Safari 목업 + 스크린샷 */}</div>
  </div>
</section>
```

**변형**: Split Hero(텍스트 좌 · 이미지 우) · Video Hero · Animated Hero(타이핑, 단어 순환). 가운데 정렬은 기본값이 아니다 — brief 의 톤이 요구할 때만.

## 2. Features

| 레이아웃 | 언제 |
|---|---|
| **Bento Grid** | 기능 4–7개, 그중 하나가 확실한 주인공. 큰 카드 `col-span-2 row-span-2` 하나 + 작은 카드들. |
| **Icon List** | 기능이 대등하고 짧을 때. 아이콘 컨테이너 radius 는 시스템 스케일. |
| **Alternating Rows** | 기능마다 스크린샷이 있고 설명이 길 때. 짝수 행 `md:flex-row-reverse`. 체크 아이콘 색은 Primary 또는 Accent — 초록 등 새 색 금지. |

## 3. Social Proof

로고 마키(grayscale → hover 원색) · 통계(NumberTicker, display 스케일) · 후기 카드(시스템 Card, 원형 아바타 허용) · 케이스 스터디 링크.

## 4. Pricing

- 플랜 3개가 기본. 추천 플랜 강조는 **계위**로: 카드 크기·위치(`md:scale-105 md:-translate-y-4`) → 2px Primary 단색 보더 → 라벨(Badge). 글로우·그라디언트 보더 금지.
- 각 카드: 이름 · 한 줄 설명 · 가격(display) + 기간(caption) · 기능 목록 · CTA(추천만 primary, 나머지 outline).

## 5. FAQ

시스템 Accordion(`type="single" collapsible`). 질문 6–10개. 접근성은 `interaction-patterns.md` §4 Expandable.

## 6. CTA

마지막 행동 유도. 배경을 Primary 로 뒤집고(텍스트는 primary-foreground) 패턴은 opacity 낮게. 버튼 두 개 이하. 아래 한 줄 안심 문구(“카드 등록 없이 14일 무료”).

## 7. Footer

로고 + 한 줄 설명 · 링크 그룹 3–4개(제품/회사/리소스/법적) · 하단 저작권 + 소셜 아이콘(원형 아이콘 버튼 허용). Dock 을 쓰면 `backdrop-blur` 를 지운다.

## 섹션 순서 추천

| SaaS | 포트폴리오 | 제품 출시 | B2B 엔터프라이즈 |
|---|---|---|---|
| 1 Hero(제품 데모) | 1 Hero(이름/역할 모션) | 1 Hero(발표/카운트다운) | 1 Hero |
| 2 로고 마키 | 2 대표 프로젝트 | 2 제품 기능 | 2 문제 정의 |
| 3 Features(Bento) | 3 역량/서비스 | 3 데모 영상 | 3 솔루션 기능 |
| 4 How it works | 4 후기 | 4 사전 신청 폼 | 4 케이스 스터디 |
| 5 후기 | 5 연락 | 5 FAQ | 5 연동 |
| 6 Pricing | 6 Footer | 6 Footer | 6 Pricing |
| 7 FAQ | | | 7 CTA(영업 문의) |
| 8 CTA | | | 8 Footer |
| 9 Footer | | | |

brief 의 화면 목록이 섹션을 지정했으면 그것이 이긴다.

## 반응형

브레이크포인트는 시스템 preset 의 `screens` 를 따른다(없으면 Tailwind 기본 sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536).

```css
.section  { @apply py-16 md:py-24 lg:py-32 px-4 md:px-8; }   /* 간격은 spacing 토큰 스케일 안에서 */
.headline { @apply text-display-sm md:text-display; }        /* 타입 스케일 이름으로 */
.grid-3   { @apply grid-cols-1 md:grid-cols-2 lg:grid-cols-3; }
```

375 · 768 · 1440 세 폭에서 가로 스크롤이 없어야 한다.
