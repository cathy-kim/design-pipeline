# Visual Regression Testing Guide

Playwright MCP를 활용한 시각적 회귀 테스트 가이드입니다.

---

## 개요

Visual Regression Testing은 UI의 시각적 변화를 자동으로 감지하여 의도치 않은 변경을 방지합니다.

### 워크플로우

```
1. Baseline 생성 → 2. 변경 후 스냅샷 → 3. Diff 비교 → 4. 검토/승인
```

---

## Playwright MCP 도구

### 스크린샷 캡처

```typescript
// 전체 페이지
browser_take_screenshot({
  raw: false  // base64 대신 저장
});

// 특정 요소만
browser_take_screenshot({
  selector: '[data-testid="header"]',
  raw: false
});
```

### Vision 기능 (요소 분석)

```typescript
// 화면의 모든 요소 분석
browser_snapshot();  // 접근성 스냅샷
```

---

## 임계값 설정

### 권장 임계값

| 테스트 유형 | 임계값 | 설명 |
|------------|--------|------|
| 픽셀 퍼펙트 | 0% | 아이콘, 로고 |
| 레이아웃 | 0.1% | 구조적 요소 |
| 콘텐츠 | 0.5% | 텍스트 영역 |
| 동적 콘텐츠 | 1-2% | 차트, 그래프 |

### 임계값 판단 기준

```yaml
critical: 0%      # 브랜드 요소, 결제 페이지
high: 0.1%        # 네비게이션, 폼
medium: 0.5%      # 일반 콘텐츠
low: 1-2%         # 동적 영역, 애니메이션
```

---

## 테스트 환경 표준화

### 뷰포트 크기

```typescript
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },     // iPhone SE
  tablet: { width: 768, height: 1024 },    // iPad
  desktop: { width: 1280, height: 800 },   // 일반 데스크탑
  wide: { width: 1920, height: 1080 },     // Full HD
};
```

### 폰트 렌더링 안정화

```css
/* 테스트 환경 전용 */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### 애니메이션 비활성화

```typescript
// 테스트 전 주입
browser_run_script({
  script: `
    document.head.insertAdjacentHTML('beforeend', \`
      <style>
        *, *::before, *::after {
          animation-duration: 0s !important;
          transition-duration: 0s !important;
        }
      </style>
    \`);
  `
});
```

---

## Baseline 관리

### 디렉토리 구조

```
__snapshots__/
├── components/
│   ├── button/
│   │   ├── default-desktop.png
│   │   ├── default-mobile.png
│   │   ├── hover-desktop.png
│   │   └── disabled-desktop.png
│   └── modal/
│       ├── open-desktop.png
│       └── open-mobile.png
├── pages/
│   ├── home/
│   │   ├── desktop.png
│   │   └── mobile.png
│   └── dashboard/
│       └── desktop.png
└── flows/
    └── checkout/
        ├── step1-desktop.png
        ├── step2-desktop.png
        └── complete-desktop.png
```

### 명명 규칙

```
{component/page}-{state}-{viewport}-{theme}.png

예시:
- button-hover-desktop-light.png
- modal-open-mobile-dark.png
- dashboard-loading-tablet-light.png
```

### Baseline 업데이트 프로세스

```
1. 변경 의도 확인
2. PR에서 diff 리뷰
3. 팀 승인
4. Baseline 업데이트
5. CI 반영
```

---

## Diff 분석

### Diff 유형

| 유형 | 원인 | 대응 |
|------|------|------|
| 픽셀 Diff | 실제 UI 변경 | 의도 확인 |
| 렌더링 Diff | 폰트/OS 차이 | 환경 표준화 |
| 타이밍 Diff | 애니메이션 | 대기 추가 |
| 데이터 Diff | 동적 콘텐츠 | 마스킹 |

### 마스킹 전략

```typescript
// 동적 콘텐츠 마스킹
browser_run_script({
  script: `
    // 날짜/시간 마스킹
    document.querySelectorAll('[data-testid="timestamp"]')
      .forEach(el => el.textContent = '2024-01-01');

    // 동적 ID 마스킹
    document.querySelectorAll('[data-testid="user-id"]')
      .forEach(el => el.textContent = 'USER-XXX');
  `
});

browser_take_screenshot({ selector: '[data-testid="content"]' });
```

---

## CI/CD 통합

### GitHub Actions 예시

```yaml
visual-regression:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Setup
      run: npm ci

    - name: Run Visual Tests
      run: npm run test:visual

    - name: Upload Diff
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: visual-diff
        path: __snapshots__/__diff__/
```

### Docker 환경 (일관성)

```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0

# 폰트 설치
RUN apt-get update && apt-get install -y \
    fonts-noto-cjk \
    fonts-noto-color-emoji

WORKDIR /app
COPY . .
RUN npm ci

CMD ["npm", "run", "test:visual"]
```

---

## 트러블슈팅

### 일반적인 문제

| 문제 | 원인 | 해결 |
|------|------|------|
| 불안정한 diff | 애니메이션 | 비활성화 |
| 폰트 차이 | OS별 렌더링 | Docker 사용 |
| 이미지 로딩 | 네트워크 지연 | 대기 조건 |
| 스크롤 위치 | 자동 스크롤 | 명시적 위치 |

### 디버깅 팁

```typescript
// 1. 스크린샷 전 대기
browser_wait_for({ state: 'visible', selector: '[data-loaded="true"]' });

// 2. 네트워크 유휴 대기
browser_wait_for({ state: 'networkidle' });

// 3. 특정 요소 대기
browser_wait_for({ selector: '[data-testid="chart"]', state: 'visible' });

// 4. 지연 추가 (최후의 수단)
browser_run_script({ script: 'await new Promise(r => setTimeout(r, 1000))' });
```

---

## 체크리스트

### 테스트 작성 전

- [ ] 뷰포트 크기 결정
- [ ] 테마 (light/dark) 결정
- [ ] 상태 매트릭스 정의
- [ ] 동적 콘텐츠 마스킹 계획

### 테스트 실행 후

- [ ] Diff 결과 검토
- [ ] False positive 확인
- [ ] Baseline 업데이트 필요성 판단
- [ ] 팀 리뷰 요청

### CI 설정

- [ ] Docker 환경 구성
- [ ] Baseline 저장소 설정
- [ ] Diff 리포팅 설정
- [ ] 실패 시 알림 설정

---

*참조*:
- [Playwright MCP 도구 목록](./playwright-mcp-tools.md)
