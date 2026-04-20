# feature/project-shell — 병합 전 리뷰 노트

**Date:** 2026-04-20
**Branch:** `feature/project-shell`
**Base HEAD at review:** `84a644d` (39 commits ahead of main)
**Scope:** project shell MVP — auth · 프로젝트 CRUD · 업로드 · 소프트삭제/복구 · Cron 하드삭제 · E2E/CI

## 검증 결과

| 항목 | 상태 | 비고 |
|---|---|---|
| Unit 테스트 | ✅ 104/104 | vitest `--run` 기준 |
| Typecheck | ✅ 0 error | `astro check && tsc --noEmit` |
| Lint | ✅ 0 error | eslint flat config + per-file globals |
| Prettier | ✅ clean | `prettier --check` |
| assertion-grep | ✅ clean | 법적 단정어·유료 LLM 키 0건 |
| E2E (로컬 수동) | ✅ 4 specs green | crud-happy / hwp-reject / quota-exceeded / axe-smoke |

## 리뷰 반영 사항

- **P2 (Eng Review Blocker)**: `POST /api/projects/[id]/uploads` 201 응답에서 `r2_key` 제거. R2 내부 키가 클라이언트에 누출되면 직접 R2 접근 시도 시 정보 제공 리스크가 커진다. 테스트(`tests/unit/api-uploads-post.test.ts`)에 `not.toHaveProperty('r2_key')` assertion 추가.
- Housekeeping #39: `eslint.config.mjs`에 `globals` 패키지 기반 per-file 블록 추가. lint 오류 186 → 0.
- Cron 워커 D1 per-DELETE try/catch + 성공/실패 alert(`cron_cleanup_ok` / `*_failed`).
- RecentlyDeletedDrawer 포커스 트랩·ESC·오프너 복귀.

## CLAUDE.md 가드 확인

- §2-2 유료 LLM API 상시 호출 없음. `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY` 참조 없음 (assertion-grep이 CI에서 재검증).
- §2-3 법적 단정 표현 UI 문자열·토스트·에러 메시지에 없음. `PilotWarningBanner`가 AppLayout 최상단에 상주.
- §2-4 EIASS 원문 재호스팅 없음. DB·R2·픽스처에 공식 자료 원문 0건.
- §5 TS strict on, `any` 없음, Conventional Commits 유지.
- §9.2 `/design-review` 자동 수정 한도 10건 이하 — 이번 브랜치에서는 미실행(로컬 개발 서버 경로, 배포 전에는 운영 URL 사용 금지 규칙 준수).

## 보류 사항 (병합 후 이슈화)

- **Housekeeping #40**: `kostat` 유틸 empty-string subCode 경로 경화 + blind cast 제거.
- **Housekeeping #41**: `/api/projects/[id]` 라우트 배치 캐스케이드 + GET/DELETE/PATCH try/catch 일관화.
- **Cron R2/D1 원자성**: 현재 per-statement try/catch는 실패 시 alert만 남기고 다음 단계로 진행. R2 삭제 실패 시 D1 row는 남김(역순 복구 불가). v1에서 two-phase cleanup 큐로 개선.
- **owner_id 스코프**: 스키마에 예약만 되어 있고 라우트 WHERE 절에는 반영 안 됨. v0 "1 배포 = 1 조직" 운영 원칙에 따라 허용. 멀티테넌트 v1에서 전면 적용.
- **HWP 지원 v0.5**: `feature/hwp-ingest` + `ADR-0002`로 분리. 본 브랜치는 "차단·안내"까지.
- **Turnstile 테스트키 / `.dev.vars`**: `tests/e2e/crud-happy.spec.ts` 머리말 NOTE 블록으로 명시. CI 환경변수(`E2E_APP_PASSWORD` secret + Turnstile 공식 test keys)는 리포지토리 secrets에 세팅 필요.

## 머지 판단

**READY FOR MERGE** — P2 패치 적용 후. CLAUDE.md §9.5에 따라 `/ship` 단계는 PR 생성까지만 허용하며 Cloudflare Pages 배포는 수동 승인 후 별도 커맨드.

## 서명

- 구현: subagent-driven-development (Opus 4.7 controller + Sonnet/Haiku 구현 서브에이전트)
- 최종 브랜치 리뷰: Opus 4.7 agent (id `a4176f43bee12289c`, 2026-04-20)
- 리뷰 노트 작성자: Opus 4.7 controller (동일 세션)
