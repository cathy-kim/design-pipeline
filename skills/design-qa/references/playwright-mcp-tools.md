# Playwright MCP 도구 레퍼런스

Playwright MCP에서 제공하는 브라우저 자동화 도구의 상세 가이드입니다.

---

## 도구 카테고리

| 카테고리 | 도구 | 용도 |
|----------|------|------|
| Navigation | `browser_navigate`, `browser_go_back/forward` | 페이지 이동 |
| Interaction | `browser_click`, `browser_type`, `browser_hover` | 사용자 상호작용 |
| Capture | `browser_take_screenshot`, `browser_pdf_save` | 화면 캡처 |
| Analysis | `browser_snapshot`, `browser_console_messages` | 화면 분석 |
| Wait | `browser_wait_for` | 동기화 |
| Utility | `browser_resize`, `browser_run_script` | 유틸리티 |

---

## Navigation 도구

### browser_navigate

페이지로 이동합니다.

```typescript
browser_navigate({
  url: 'https://example.com/page'
});
```

### browser_go_back / browser_go_forward

브라우저 히스토리 탐색입니다.

```typescript
browser_go_back();    // 뒤로
browser_go_forward(); // 앞으로
```

---

## Interaction 도구

### browser_click

요소를 클릭합니다.

```typescript
// 기본 클릭
browser_click({
  selector: '[data-testid="submit-btn"]'
});

// 좌표로 클릭
browser_click({
  selector: '[data-testid="canvas"]',
  position: { x: 100, y: 200 }
});
```

### browser_type

텍스트를 입력합니다.

```typescript
browser_type({
  selector: '[data-testid="email-input"]',
  text: 'test@example.com',
  clear: true  // 기존 텍스트 지우고 입력
});
```

### browser_hover

요소 위에 마우스를 올립니다.

```typescript
browser_hover({
  selector: '[data-testid="dropdown-trigger"]'
});
```

### browser_press_key

키보드 키를 누릅니다.

```typescript
browser_press_key({ key: 'Enter' });
browser_press_key({ key: 'Tab' });
browser_press_key({ key: 'Escape' });
browser_press_key({ key: 'ArrowDown' });
```

### browser_select_option

select 요소에서 옵션을 선택합니다.

```typescript
browser_select_option({
  selector: '[data-testid="country-select"]',
  values: ['kr']  // value 속성 기준
});
```

### browser_drag

드래그 앤 드롭을 수행합니다.

```typescript
browser_drag({
  startSelector: '[data-testid="drag-item"]',
  endSelector: '[data-testid="drop-zone"]'
});
```

---

## Capture 도구

### browser_take_screenshot

스크린샷을 캡처합니다.

```typescript
// 전체 페이지
browser_take_screenshot({
  raw: true  // base64 반환
});

// 특정 요소만
browser_take_screenshot({
  selector: '[data-testid="modal"]',
  raw: false  // 파일로 저장
});

// 전체 페이지 (스크롤 포함)
browser_take_screenshot({
  fullPage: true
});
```

### browser_pdf_save

페이지를 PDF로 저장합니다.

```typescript
browser_pdf_save({
  filename: 'report.pdf'
});
```

---

## Analysis 도구

### browser_snapshot

접근성 트리 스냅샷을 생성합니다.

```typescript
browser_snapshot();
// 화면의 모든 요소를 접근성 관점에서 분석
```

**반환 예시:**
```
- banner "Site Header"
  - link "Home"
  - navigation "Main Navigation"
    - link "Products"
    - link "About"
- main
  - heading "Welcome" (level 1)
  - button "Get Started"
```

### browser_console_messages

콘솔 메시지를 가져옵니다.

```typescript
browser_console_messages();
// 에러, 경고, 로그 메시지 확인
```

### browser_network_requests

네트워크 요청을 모니터링합니다.

```typescript
browser_network_requests();
// API 호출, 리소스 로딩 확인
```

---

## Wait 도구

### browser_wait_for

특정 조건까지 대기합니다.

```typescript
// 요소가 보일 때까지
browser_wait_for({
  selector: '[data-testid="modal"]',
  state: 'visible'
});

// 요소가 사라질 때까지
browser_wait_for({
  selector: '[data-testid="loading"]',
  state: 'hidden'
});

// 요소가 DOM에 추가될 때까지
browser_wait_for({
  selector: '[data-testid="new-item"]',
  state: 'attached'
});

// 네트워크 요청 완료까지
browser_wait_for({
  state: 'networkidle'
});
```

---

## Utility 도구

### browser_resize

브라우저 크기를 변경합니다.

```typescript
// 모바일
browser_resize({ width: 375, height: 667 });

// 태블릿
browser_resize({ width: 768, height: 1024 });

// 데스크탑
browser_resize({ width: 1280, height: 800 });
```

### browser_run_script

JavaScript를 실행합니다.

```typescript
// 스크롤
browser_run_script({
  script: 'window.scrollTo(0, document.body.scrollHeight)'
});

// 요소 속성 확인
browser_run_script({
  script: 'document.querySelector("[data-testid=btn]").disabled'
});

// 스타일 주입
browser_run_script({
  script: `
    document.head.insertAdjacentHTML('beforeend',
      '<style>* { animation: none !important; }</style>'
    );
  `
});
```

### browser_file_upload

파일을 업로드합니다.

```typescript
browser_file_upload({
  selector: '[data-testid="file-input"]',
  paths: ['/path/to/file.png']
});
```

---

## Tab 관리

### browser_tab_list

열린 탭 목록을 가져옵니다.

```typescript
browser_tab_list();
```

### browser_tab_new

새 탭을 엽니다.

```typescript
browser_tab_new({
  url: 'https://example.com'
});
```

### browser_tab_select

탭을 선택합니다.

```typescript
browser_tab_select({
  tabId: 'tab-id'
});
```

### browser_tab_close

탭을 닫습니다.

```typescript
browser_tab_close({
  tabId: 'tab-id'
});
```

---

## 검증 도구

### browser_verify_element_visible

요소 가시성을 검증합니다.

```typescript
browser_verify_element_visible({
  selector: '[data-testid="success-message"]'
});
```

### browser_verify_text_visible

텍스트 표시를 검증합니다.

```typescript
browser_verify_text_visible({
  text: '저장되었습니다'
});
```

---

## 일반적인 테스트 패턴

### 폼 제출 테스트

```typescript
// 1. 폼 입력
browser_type({
  selector: '[data-testid="email"]',
  text: 'test@example.com',
  clear: true
});

browser_type({
  selector: '[data-testid="password"]',
  text: 'password123',
  clear: true
});

// 2. 제출
browser_click({
  selector: '[data-testid="submit-btn"]'
});

// 3. 결과 확인
browser_wait_for({
  selector: '[data-testid="success"]',
  state: 'visible'
});

browser_take_screenshot({
  selector: '[data-testid="result"]'
});
```

### 모달 테스트

```typescript
// 1. 모달 열기
browser_click({
  selector: '[data-testid="open-modal-btn"]'
});

// 2. 모달 표시 대기
browser_wait_for({
  selector: '[role="dialog"]',
  state: 'visible'
});

// 3. 스크린샷
browser_take_screenshot({
  selector: '[role="dialog"]'
});

// 4. 닫기 테스트 (Escape)
browser_press_key({ key: 'Escape' });

// 5. 닫힘 확인
browser_wait_for({
  selector: '[role="dialog"]',
  state: 'hidden'
});
```

### 반응형 테스트

```typescript
const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 }
];

for (const vp of viewports) {
  browser_resize({ width: vp.width, height: vp.height });
  browser_take_screenshot({ raw: false });
  // 저장: component-{vp.name}.png
}
```

### 접근성 테스트

```typescript
// 1. 키보드 네비게이션
browser_press_key({ key: 'Tab' });
browser_press_key({ key: 'Tab' });
browser_press_key({ key: 'Enter' });

// 2. 접근성 스냅샷
browser_snapshot();
// role, aria-label 등 확인

// 3. 포커스 상태 스크린샷
browser_take_screenshot({
  selector: ':focus'
});
```

---

## 에러 처리

### Timeout 에러

```typescript
// 기본 타임아웃: 30초
// 긴 작업의 경우 대기 조건 명시

browser_wait_for({
  selector: '[data-testid="large-report"]',
  state: 'visible',
  timeout: 60000  // 60초
});
```

### 요소 없음 에러

```typescript
// 요소 존재 확인 후 작업
browser_snapshot();  // 현재 상태 확인
browser_click({ selector: '[data-testid="btn"]' });
```

### 네트워크 에러

```typescript
// 네트워크 안정화 대기
browser_wait_for({ state: 'networkidle' });
browser_take_screenshot();
```

---

*참조*:
- [Visual Regression Guide](./visual-regression-guide.md)
- [공식 Playwright MCP 문서](https://github.com/microsoft/playwright-mcp)
