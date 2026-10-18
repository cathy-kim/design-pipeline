# Stitch tool map

정본: [stitch-tools.snapshot.json](stitch-tools.snapshot.json) (2026-10-18 `--list-tools` 실측, 15 tools). 스키마는 바뀔 수 있다 — 쓰기 예시 전에 실제 스키마와 `scripts/schema-drift.mjs` 로 대조한다.
세션 도구 이름은 `mcp__stitch__<tool>`.

## Read-only — audit 에서 쓰는 것은 이것뿐

| Tool | 필수 인자 | 메모 |
|---|---|---|
| `mcp__stitch__list_projects` | — | `filter` 선택 |
| `mcp__stitch__get_project` | `name` = `projects/{project}` | `screenInstances[]` (instance `id` + `sourceScreen`) 가 여기서 나온다 |
| `mcp__stitch__list_screens` | `projectId` (접두어 없음) | source screen 목록 |
| `mcp__stitch__get_screen` | `name` = `projects/{p}/screens/{s}` | `screenshot.downloadUrl`, `htmlCode.downloadUrl`, `width`, `height`, `deviceType` |
| `mcp__stitch__list_design_systems` | — (`projectId` 선택) | 반환 `name` = `assets/{asset_id}` |

## Writes (`idempotentHint: false`) — propose/refine 만, 한 번씩

| Tool | 필수 인자 | 메모 |
|---|---|---|
| `mcp__stitch__generate_screen_from_text` | `projectId`, `prompt` | 선택 `deviceType`(`MOBILE`/`DESKTOP`/`TABLET`/`AGNOSTIC`), `designSystem`, `modelId`. 수 분. **DO NOT RETRY** |
| `mcp__stitch__edit_screens` | `projectId`, `selectedScreenIds`, `prompt` | `selectedScreenIds` = **source screen ID** (`screens/` 접두어 없음) |
| `mcp__stitch__generate_variants` | `projectId`, `selectedScreenIds`, `prompt`, `variantOptions` | `variantCount`(1–5), `creativeRange`(`REFINE`/`EXPLORE`/`REIMAGINE`), `aspects[]` |
| `mcp__stitch__apply_design_system` | `projectId`, `selectedScreenInstances`, `assetId` | instance 객체 `{id, sourceScreen}`; `assetId` 는 `assets/` 접두어 없음 |
| `mcp__stitch__create_design_system` | `designSystem` | `projectId` 를 비우면 global asset — 쓰지 않는다 |
| `mcp__stitch__update_design_system` | `name`, `projectId`, `designSystem` | `name` = `assets/{id}` |
| `mcp__stitch__upload_design_md` | `projectId`, `designMdBase64` | 직후 `create_design_system_from_design_md` |
| `mcp__stitch__create_design_system_from_design_md` | `projectId`, `selectedScreenInstance` | instance 객체 하나 |
| `mcp__stitch__create_project` | — | 사용자가 새 프로젝트를 원할 때만 |
| `mcp__stitch__delete_project` | `name` | **금지**(사용자 명시 지시 제외). 되돌릴 수 없음 |

## ID 두 종류 — 섞지 않는다

- **source screen ID**: `projects/{p}/screens/{s}` 의 `{s}`. `list_screens`·`get_screen` 에서 나온다 → `edit_screens`·`generate_variants` 의 `selectedScreenIds`.
- **screen instance ID**: `get_project` 의 `screenInstances[].id`. 스키마 원문 "The id of the screen instance, **NOT** the source screen id." → `apply_design_system`·`create_design_system_from_design_md` 의 `{id, sourceScreen}`.

## 없는 도구 — 지어내지 않는다

clone/duplicate, export, screenshot/image upload, publish/share 도구는 없다. 복제가 필요하면 `generate_variants`(`REFINE`) 나 새 생성으로 대체하고 그렇게 적는다.
이미지·HTML 은 `get_screen` 이 돌려준 `downloadUrl` 로만 받는다. 링크는 `https://stitch.withgoogle.com/projects/<projectId>` 만 쓴다.

## Timeout·실패

1. 쓰기가 timeout/연결 오류 → **재전송 금지**. 서버에서는 성공했을 수 있다.
2. `list_screens`(또는 `get_project`)를 30초 간격, 최대 10회 조회해 새 화면이 생겼는지 대조한다.
3. 생겼으면 `writes[].result = "uncertain-reconciled"` 와 그 ID 로 이어간다. 끝내 없으면 `"uncertain-unresolved"` 로 남기고 사용자 판단을 받는다 — 이 상태에서는 승인·handoff 불가.
4. `isError: true` 는 `failed` 로 기록·보고한다.

## CLI 폴백 (같은 백엔드)

MCP 도구가 세션에 없으면 설치된 릴레이 CLI 로 같은 도구를 부른다: `stitch-mcp --list-tools`, `stitch-mcp --call <tool> --args '<json>'`.
위 규칙(읽기만·재전송 금지·실제 URL 만)이 그대로 적용된다. 등록 위치는 README §Stitch MCP.

## 예시 (read-only)

```
mcp__stitch__get_project   {"name": "projects/<projectId>"}
mcp__stitch__list_screens  {"projectId": "<projectId>"}
mcp__stitch__get_screen    {"name": "projects/<projectId>/screens/<sourceScreenId>"}
```

읽기 확인용 예시 프로젝트 `4591407258540771727` 은 사용자가 지목했을 때만 쓴다. 기본값이 아니며 쓰기 대상이 아니다.
