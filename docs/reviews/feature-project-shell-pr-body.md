# PR Body — feature/project-shell

**Paste into GitHub PR description at:**
https://github.com/humpie-0413/eia-workbench/pull/new/feature/project-shell

**Title:** `feat(project-shell): 프로젝트 워크스페이스 MVP 기반`

---

## 요약

환경영향평가 보고서 작성·검수 워크스페이스의 v0 프로젝트 셸을 구현합니다. 육상풍력 업종을 대상으로 단일 패스워드 + Turnstile 로그인, 프로젝트 CRUD, 파일 업로드 파이프라인(30MB/파일·300MB/프로젝트·30파일/프로젝트), 소프트삭제/30일 하드삭제 Cron, 법적 단정 표현 자동 검출 가드, E2E 시나리오 4종을 포함합니다.

## 배경 문서

- 설계: [`docs/design/feature-project-shell.md`](../blob/feature/project-shell/docs/design/feature-project-shell.md) (v1 — Office Hours Q&A 6세트 + 보안 리뷰 12건 반영)
- 계획: [`docs/plans/feature-project-shell.md`](../blob/feature/project-shell/docs/plans/feature-project-shell.md) (T1–T28 TDD, §Reviews + §Domain Review 섹션 포함)
- 리뷰 노트: [`docs/reviews/feature-project-shell.md`](../blob/feature/project-shell/docs/reviews/feature-project-shell.md) (CLAUDE.md §8)
- ADR: [`docs/design/adr-0001-frontend-framework.md`](../blob/feature/project-shell/docs/design/adr-0001-frontend-framework.md) (Astro 5 + React islands)

## QA 결과

| 시나리오 | 결과 | 비고 |
|---|---|---|
| Unit 104/104 | ✅ Pass | Vitest `--run` |
| Typecheck | ✅ Pass | `astro check && tsc --noEmit` (0 error/warning) |
| Lint | ✅ Pass | ESLint flat config + per-file globals (0 error, 186 → 0) |
| Prettier | ✅ Pass | `prettier --check` |
| assertion-grep | ✅ Pass | 법적 단정어·유료 LLM 키 0건 |
| E2E: CRUD happy path | ✅ Pass | `tests/e2e/crud-happy.spec.ts` |
| E2E: HWP 거부 + Hancom 안내 | ✅ Pass | `tests/e2e/hwp-reject.spec.ts` |
| E2E: 30MB 초과 거부 | ✅ Pass | `tests/e2e/quota-exceeded.spec.ts` |
| E2E: axe smoke (3 페이지) | ✅ Pass | `tests/e2e/axe-smoke.spec.ts` (login/list/detail) |
| 최종 Opus 브랜치 리뷰 | ✅ Pass | P2 `r2_key` 누출 1건 지적 → 수정 후 READY |

## 변경 파일 (대분류별)

| 분류 | 개수 |
|---|---|
| 유닛 테스트 | 20 |
| 기타(config/lock/etc) | 17 |
| 라이브러리(`src/lib/`) | 13 |
| 라우트(`src/pages/`) | 12 |
| 컴포넌트(`src/components/`) | 9 |
| E2E 테스트 | 4 |
| Cron 워커(`workers/`) | 2 |
| 스크립트(`scripts/`) | 2 |
| D1 마이그레이션 | 2 |
| 문서(`docs/`) | 2 |
| 미들웨어 | 1 |
| 레이아웃 | 1 |
| CI 워크플로 | 1 |

총 40 커밋, 84 files changed.

## 알려진 제약 / 가드 확인

- **무료 티어 유지**: ✅ Cloudflare Pages/Workers/D1/R2/Turnstile 무료 구간만 사용. 유료 LLM API 상시 호출 없음.
- **법적 단정 표현 금지**: ✅ `src/lib/lint-copy.ts` 정규식 + `scripts/assertion-grep.sh` CI 게이트. UI·토스트·에러 메시지에 단정어 0건.
- **유료 API 키 참조 없음**: ✅ `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY` 코드 참조 0건(assertion-grep 검증).
- **EIASS 원문 재호스팅 없음**: ✅ DB/R2/픽스처에 공공원문 0건. `PilotWarningBanner`가 AppLayout 최상단에 "사용자 책임·공공원문 재배포 금지" 고정 표시.
- **Origin/CSP/security headers**: ✅ `src/middleware.ts` — 변경 메서드 Origin 필수, object-src 'none', frame-ancestors 'none'.
- **PII-safe logger**: ✅ IP 마스킹 + jti 해시.

## 보안 설계 반영 (§10 12건)

- 10.1 로그인: timing-safe compare + 5회/분 rate-limit + 300ms floor + HS256 JWT + Secure/HttpOnly/SameSite=Lax
- 10.2 업로드: magic-bytes 검증 + 랜덤 R2 키 + 30MB/파일·300MB/프로젝트·30파일/프로젝트 + ZIP 스캔 64KiB 경계
- 10.3 CSRF: 변경 메서드 Origin 강제, GET 사이드이펙트 없음
- 10.4 CSP: object-src 'none', frame-ancestors 'none', script-src 'self'
- 10.5 로깅: IP 마스킹 + jti 해시, PII 제외
- 10.6 Zod 캡: 모든 입력 길이·크기 상한
- 10.7 Cron: 1000행 상한 + per-DELETE try/catch + 성공/실패 alert

## Out of Scope

- HWP/HWPX 파싱·편집: v0에서는 차단·Hancom 안내만. `feature/hwp-ingest` + ADR-0002(v0.5)로 분리.
- 자동 배포: CLAUDE.md §9.5에 따라 PR 생성까지만. Cloudflare Pages/Workers 배포는 머지 후 수동.
- 권한 관리·멀티테넌트: `owner_id`는 스키마에 예약만. "1 배포 = 1 조직" 원칙 하 v0 운영. v1에서 라우트 WHERE 절 전면 적용.
- 백그라운드 OCR·파싱: v0.5+.
- 유료 LLM 분석: 금지(§2-2).

## 병합 후 팔로업 이슈(본 PR 범위 아님)

- [ ] Housekeeping #40 — `src/lib/kostat.ts` empty-string subCode 경화 + blind cast 제거
- [ ] Housekeeping #41 — `/api/projects/[id]` 배치 캐스케이드 + GET/DELETE/PATCH try/catch 일관화
- [ ] Cron R2/D1 원자성 — R2 실패 시 D1 row 잔존 방지(v1 two-phase queue)
- [ ] `owner_id` v1 전면 적용 — 멀티테넌트 스코프
- [ ] `feature/hwp-ingest` + ADR-0002 — HWP/HWPX 지원 v0.5

## 배포 전 체크(머지 직전 재확인)

- [ ] GitHub Secrets: `E2E_APP_PASSWORD`, Turnstile 테스트키
- [ ] `wrangler secret` 설정: `APP_PASSWORD`, `JWT_SECRET`, `TURNSTILE_SECRET_KEY`
- [ ] D1 원격 마이그레이션: `npx wrangler d1 migrations apply DB --remote`
- [ ] Cron 워커 별도 배포: `workers/cleanup.wrangler.toml`

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
