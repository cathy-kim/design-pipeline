# design-stitch acceptance checklist

빈 칸이 있으면 다음 게이트로 가지 않는다.

- **G1** 앱 근거 경로/캡처 · `get_project` 로 확인한 project ID · source screen ID 와 instance ID 구분 기록 · design system asset ID(있으면)
- **G2** 목표 1–3개 · IA · 여정 · 아래 매트릭스 · 이어받은 결정 목록
- **G3** audit/handoff 쓰기 0건 · 쓰기마다 도구·인자 요약·반환 ID·결과 · variants 이유
- **G4** 화면마다 `get_screen` readback 이미지 · AS-IS↔TO-BE · changelog · 항목별 `visual only` / `interaction verified` · 파생 HTML 표기
- **G5** 승인 상태 · `approved` 면 발화 인용 + revision + 화면 ID
- **G6** handoff.md · 제품 코드 변경 0건

| Screen (source id) | empty | loading | error | ready | permission | 390 | 768 | 1440 | keyboard/focus | contrast |
|---|---|---|---|---|---|---|---|---|---|---|
| … | image / missing / n.a. | | | | | | | | visual only | |

## session.json

```json
{
  "mode": "propose",
  "project": { "id": "<projectId>", "verifiedBy": "get_project" },
  "designSystem": { "assetId": "<assetId>" },
  "screens": [ { "sourceScreenId": "<s>", "instanceId": "<i>", "title": "…" } ],
  "revision": 1,
  "writes": [ { "revision": 1, "tool": "generate_screen_from_text", "result": "ok", "screenIds": ["<s>"] } ],
  "evidence": [ { "revision": 1, "sourceScreenId": "<s>", "image": "r1/<s>.png", "via": "get_screen" } ],
  "approval": { "status": "approved", "revision": 1, "screens": ["<s>"], "quote": "승인", "at": "<ISO8601>" }
}
```

- `writes[].result`: `ok` · `uncertain-reconciled` · `uncertain-unresolved` · `failed`.
- `evidence[].image` 는 `session.json` 기준 상대경로이고 파일이 실제로 있어야 한다.
- 승인은 디자인만 뜻한다. 구현 요청·공개 발행 승인은 이 파일에 기록하지 않는다.

## 금지 확인

`delete_project` 0건 · timeout 쓰기 재전송 0건 · 없는 도구(clone/export/upload) 서술 0건 · 손으로 만든 HTML 을 Stitch 결과로 제시 0건 · 프롬프트에 비밀값/고객 데이터 0건 · 승인 전 제품 코드 변경 0건.
