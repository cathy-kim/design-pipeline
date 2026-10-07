# Interaction Pattern Decision — Modal · Bottom Sheet · Expandable · Page

> ui-designer `ux-pattern-decision.md` 에서 결정 로직만 남겼다. 원본의 하드코딩 색 예시 코드는 버렸다 —
> 시스템 프리미티브는 Button·Input·Card·Nav 뿐이다. Dialog/Sheet/Accordion 은 Radix(shadcn) 를 시스템 토큰으로 재스킨해 쓴다 — artifact 모드는 스캐폴드에 이미 들어 있다.
> 근거: Material Design 3, Apple HIG, W3C WAI-ARIA APG (P1) · Radix UI, shadcn/ui (P2) · NN/g (P3).

## 1. 트리거 키워드

```yaml
modal:        [삭제, delete, 제거, 확인, confirm, 승인, 로그아웃, 로그인, 결제, payment, 경고, alert, 팝업, 모달]
bottom_sheet: [필터, filter, 정렬, sort, 공유, share, 내보내기, export, 옵션, 선택, picker]
expandable:   [상세, details, 자세히, more, FAQ, Q&A, 스펙, 사양, 리뷰, 후기, 설명]
page:         [결제, checkout, 주문, 프로필, profile, 계정, account, 대시보드, 복잡한 설정]
```

## 2. 결정 트리

```
작업 완료가 필수이거나 위험한가?
├─ 위험(삭제·결제 확정) ............................ Modal (alertdialog, focus trap)
├─ 필수 + 모바일 ................................... Modal Bottom Sheet
└─ 필수 + 데스크톱 ................................. Modal Dialog
선택적·보조 콘텐츠인가? (FAQ·스펙·상세) ............. Expandable (Accordion/Disclosure)
복잡한 워크플로우인가? (체크아웃·프로필·대시보드) ...... Separate Page (라우트)
그 외 ............................................. Inline
```

Separate Page 를 고르는 추가 신호: SEO 인덱싱 필요, URL 공유 필요, 브라우저 뒤로가기 지원 필요.

## 3. 플랫폼별 기본값

| 상황 | Mobile-first | Desktop-first |
|---|---|---|
| 빠른 액션(필터·공유·옵션) | Bottom Sheet | Sidebar(접이식) 또는 Popover |
| 확인(삭제·로그아웃) | Bottom Sheet(alert 스타일) | Centered Modal |
| 상세(스펙·FAQ·리뷰) | Expandable | Expandable 또는 Sidebar |
| 복잡한 흐름(결제·설정) | Separate Page | Separate Page 또는 다단 레이아웃 |

## 4. 접근성 체크 (패턴별)

**Modal Dialog**
- `role="dialog"` 또는 `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`
- focus trap, Esc 로 닫기, 닫힌 뒤 트리거로 focus 복귀
- 텍스트 대비 ≥ 4.5:1, 터치 타겟 ≥ 44×44px(모바일) / ≥ 40×40px(데스크톱)

**Bottom Sheet**
- modal 타입이면 위 항목 전부 + scrim
- swipe to dismiss, drag handle 표시, safe area

**Expandable**
- `aria-expanded`, (선택) `aria-controls`, Enter/Space 토글
- 상태 아이콘(chevron), 콘텐츠 영역 `role="region"`

## 5. 출처

- Material Design 3 — Bottom Sheets: https://m3.material.io/components/bottom-sheets/guidelines
- Apple HIG — Sheets: https://developer.apple.com/design/human-interface-guidelines/sheets
- WAI-ARIA APG — Dialog (Modal): https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- WAI-ARIA APG — Disclosure: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
- Radix UI Dialog / Accordion, shadcn/ui Dialog / Drawer / Accordion
- NN/g — Modal & Nonmodal Dialogs, Bottom Sheets, Confirmation Dialogs
