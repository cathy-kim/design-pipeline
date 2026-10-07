# State Matrix Testing Guide

컴포넌트의 상태 조합을 체계적으로 테스트하기 위한 State Matrix 접근법 가이드입니다.

---

## 개요

State Matrix Testing은 컴포넌트가 가질 수 있는 모든 상태 조합을 매트릭스로 정의하고, 각 조합을 체계적으로 테스트하는 방법입니다.

### 기본 공식

```
테스트 케이스 수 = 상태 × 변형 × 뷰포트 × 테마
```

---

## 상태 매트릭스 정의

### 차원 (Dimensions)

| 차원 | 예시 값 | 설명 |
|------|---------|------|
| 컴포넌트 상태 | default, hover, focus, active, disabled | 인터랙션 상태 |
| 데이터 상태 | empty, loading, error, success, partial | 데이터 로딩 상태 |
| 변형 | primary, secondary, outline, ghost | 스타일 변형 |
| 크기 | sm, md, lg, xl | 크기 변형 |
| 뷰포트 | mobile, tablet, desktop | 반응형 |
| 테마 | light, dark | 색상 테마 |

---

## 버튼 상태 매트릭스 예시

### Full Matrix (전체)

```
Variant  × State    × Size × Viewport × Theme
(4종류)   (6종류)    (4)    (3)        (2)
= 4 × 6 × 4 × 3 × 2 = 576 케이스
```

### Optimized Matrix (최적화)

**우선순위 기반 선택:**

```yaml
필수 (P0):
  - default × all variants × md × desktop × light
  - hover × primary × md × desktop × light
  - disabled × primary × md × desktop × light

높음 (P1):
  - all states × primary × md × desktop × light
  - default × all variants × md × mobile × light

중간 (P2):
  - default × primary × all sizes × desktop × light
  - default × primary × md × desktop × dark

낮음 (P3):
  - 나머지 조합
```

**결과: 576 → 약 30-50 케이스**

---

## 실전 예시

### 버튼 컴포넌트

```typescript
const BUTTON_MATRIX = {
  variants: ['primary', 'secondary', 'outline', 'ghost'],
  states: ['default', 'hover', 'focus', 'active', 'disabled', 'loading'],
  sizes: ['sm', 'md', 'lg'],
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1280, height: 800 }
  ],
  themes: ['light', 'dark']
};

// P0: 핵심 케이스
const P0_CASES = [
  { variant: 'primary', state: 'default', size: 'md', viewport: 'desktop', theme: 'light' },
  { variant: 'primary', state: 'hover', size: 'md', viewport: 'desktop', theme: 'light' },
  { variant: 'primary', state: 'disabled', size: 'md', viewport: 'desktop', theme: 'light' },
  { variant: 'secondary', state: 'default', size: 'md', viewport: 'desktop', theme: 'light' },
  { variant: 'outline', state: 'default', size: 'md', viewport: 'desktop', theme: 'light' },
];
```

### 테스트 실행

```typescript
// State Matrix 테스트 루프
for (const testCase of P0_CASES) {
  // 1. 환경 설정
  browser_resize({
    width: testCase.viewport.width,
    height: testCase.viewport.height
  });

  // 2. 테마 설정
  browser_run_script({
    script: `document.documentElement.setAttribute('data-theme', '${testCase.theme}')`
  });

  // 3. 컴포넌트 렌더링 (Storybook 사용 시)
  browser_navigate({
    url: `http://localhost:6006/?path=/story/button--${testCase.variant}&args=size:${testCase.size}`
  });

  // 4. 상태 트리거
  if (testCase.state === 'hover') {
    browser_hover({ selector: '[data-testid="button"]' });
  } else if (testCase.state === 'focus') {
    browser_click({ selector: '[data-testid="button"]' });
  }

  // 5. 스크린샷
  browser_take_screenshot({
    selector: '[data-testid="button"]'
  });
  // 저장: button-{variant}-{state}-{size}-{viewport}-{theme}.png
}
```

---

## 폼 상태 매트릭스

### Input Field Matrix

```yaml
dimensions:
  field_state:
    - empty
    - filled
    - focused
    - error
    - success
    - disabled

  validation_state:
    - valid
    - invalid
    - pending

  content_type:
    - text
    - email
    - password
    - number
```

### 우선순위

```yaml
P0:
  - empty + default + text
  - filled + default + text
  - error + invalid + email
  - disabled + default + text

P1:
  - focused + default + all types
  - all states + password (visibility toggle)
```

---

## 모달 상태 매트릭스

### Modal Matrix

```yaml
dimensions:
  visibility:
    - closed
    - opening
    - open
    - closing

  size:
    - sm
    - md
    - lg
    - fullscreen

  content:
    - simple (alert)
    - form
    - scrollable
    - nested
```

### 우선순위

```yaml
P0:
  - open + md + simple
  - open + md + form
  - open + fullscreen + mobile

P1:
  - opening animation
  - closing animation
  - scrollable content
```

---

## 테이블 상태 매트릭스

### Table Matrix

```yaml
dimensions:
  data_state:
    - empty
    - loading
    - partial (1-3 rows)
    - normal (10+ rows)
    - overflow (100+ rows)

  features:
    - sorting
    - selection
    - pagination
    - filtering

  interaction:
    - row_hover
    - row_selected
    - header_sorted
```

---

## 커버리지 계산

### 목표

| 레벨 | 커버리지 | 설명 |
|------|----------|------|
| P0 | 100% | 비즈니스 크리티컬 |
| P1 | 80%+ | 주요 기능 |
| P2 | 50%+ | 일반 기능 |
| P3 | 선택적 | 엣지 케이스 |

### 커버리지 계산 공식

```
커버리지(%) = (테스트된 조합 / 전체 가능 조합) × 100

최적화 커버리지(%) = Σ(우선순위 가중치 × 테스트된 조합) / Σ(우선순위 가중치 × 전체 조합)
```

---

## 자동화 도구

### Matrix Generator

```typescript
function generateTestMatrix(config: MatrixConfig): TestCase[] {
  const cases: TestCase[] = [];

  for (const variant of config.variants) {
    for (const state of config.states) {
      for (const size of config.sizes) {
        for (const viewport of config.viewports) {
          for (const theme of config.themes) {
            const priority = calculatePriority(variant, state, size, viewport, theme);
            cases.push({
              variant, state, size, viewport, theme, priority
            });
          }
        }
      }
    }
  }

  return cases.sort((a, b) => a.priority - b.priority);
}

function calculatePriority(
  variant: string,
  state: string,
  size: string,
  viewport: string,
  theme: string
): number {
  let priority = 3; // 기본 P3

  // P0 조건
  if (variant === 'primary' && state === 'default' && size === 'md') {
    priority = 0;
  }
  // P1 조건
  else if (state === 'default' && size === 'md' && theme === 'light') {
    priority = 1;
  }
  // P2 조건
  else if (viewport === 'desktop' && theme === 'light') {
    priority = 2;
  }

  return priority;
}
```

### 실행 예시

```typescript
const buttonConfig: MatrixConfig = {
  variants: ['primary', 'secondary', 'outline', 'ghost'],
  states: ['default', 'hover', 'focus', 'active', 'disabled', 'loading'],
  sizes: ['sm', 'md', 'lg'],
  viewports: ['mobile', 'tablet', 'desktop'],
  themes: ['light', 'dark']
};

const testCases = generateTestMatrix(buttonConfig);
const p0Cases = testCases.filter(c => c.priority === 0);
const p1Cases = testCases.filter(c => c.priority === 1);

console.log(`전체: ${testCases.length}, P0: ${p0Cases.length}, P1: ${p1Cases.length}`);
// 전체: 432, P0: 6, P1: 24
```

---

## 리포팅

### 테스트 결과 형식

```yaml
test_run:
  timestamp: 2024-01-15T10:30:00Z
  component: Button
  total_cases: 30
  passed: 28
  failed: 2

  coverage:
    p0: 100%
    p1: 95%
    p2: 60%

  failures:
    - case: "primary-hover-md-mobile-dark"
      expected: "shadow-lg"
      actual: "no shadow"
      diff_url: "/diffs/button-hover-mobile-dark.png"
```

### 대시보드 메트릭

```
┌─────────────────────────────────────┐
│ Button Component Coverage           │
├─────────────────────────────────────┤
│ P0: ████████████████████ 100%       │
│ P1: ████████████████░░░░  80%       │
│ P2: ████████░░░░░░░░░░░░  40%       │
│                                     │
│ Failed: 2 | Passed: 28 | Total: 30  │
└─────────────────────────────────────┘
```

---

*참조*:
- [Visual Regression Guide](./visual-regression-guide.md)
