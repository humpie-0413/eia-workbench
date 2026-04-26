# progress.md

## 현재 목표
similar-cases v0 운영 배포 완료 (PR #8 머지 + hotfix 9건 + 풍력 10건 적재 + 사용자 브라우저 검증 4건 PASS). 다음: P1 — detail API 통합 (`evaluation_stage` / `region` 채움).

## 2026-04-26 similar-cases v0 운영 배포 완료 + hotfix 9건
- **PR #8 머지** (squash `4ad871d` on main, 2026-04-26). 운영 D1 `migrations/0003_similar_cases.sql` 원격 적용.
- **운영 검증 (사용자 브라우저, 4 PASS)**:
  - `/cases` 검색 페이지 정상 렌더링
  - 검색어 "풍력" → 미리보기 패널 정상
  - EIASS deep-link 정상 (hotfix 후 404 해소)
  - Markdown export 정상 (`docs/cases-2026-04-26.md` 산출물 보존)
- **부트스트랩 결과**: 풍력 10건 적재 (전체 75건 중 onshore_wind filter 통과). source 데이터셋 = 15142987 (협의현황).
- **hotfix 체인 (main 9 commits, 4ad871d → 49a0678)**:
  - `356674b fix(portal-client): force _type=json query param (15142998 XML default)`
  - `9d27bb4 chore(cases-indexer): add per-reason skip counters for diagnosis`
  - `5a5413a fix(cases-indexer): list zod schema + bizGubunCd propagation`
  - `6b20062 chore(cases-indexer): log first 5 zod fail issues for diagnosis`
  - `5cea609 fix(cases-indexer): split strategy list/detail schema (perCd PK)`
  - `5a8536a fix(cases-indexer): switch dataset 15142998 → 15142987 (협의현황)`
  - `157279c docs(similar-cases): patch spec for 15142998 → 15142987 dataset switch`
  - `2447043 fix(eiass-link): correct deep-link URL to /biz/base/info/searchListNew.do`
  - `49a0678 fix(cases-ui): rename '승인기관' label to '협의기관' (data is ccilOrganNm)`
- **추가 migration**: `0004_relax_cases_constraints.sql` (NOT NULL 완화 — bizSize·eiaAddrTxt 빈 값 인덱싱 허용).
- **CLAUDE.md §10 신규** (`a8ff209`): §10.1 사전 결함 자동 제외 + §10.2 블로킹 시 디폴트 액션.
- **알려진 한계 6건** (`docs/handover/2026-04-26-similar-cases-deployed.md` §3):
  - 3.1 evaluation_stage='unknown' 모든 10건 (P1, detail API 통합으로 해결)
  - 3.2 region NULL 모든 10건 (P1, 동일 PR)
  - 3.3 approv_organ_nm 컬럼명·값 misalignment (P3, 운영 영향 없음)
  - 3.4 cron 자동 활성화 안 됨 (`invalid cron string`) (P2)
  - 3.5 eia_cases_sync 빈 응답 (인덱서 sync 행 INSERT 누락) (P2)
  - 3.6 T0-2/T0-3/T0-5 미실측 (P3, 추가 데이터셋 부트스트랩 후 v1)
- **다음 단계**:
  - P1 — detail API 통합 (한계 §3.1 + §3.2 동시 해결)
  - P2 — cron trigger 등록 디버깅 (§3.4)
  - P2 — eia_cases_sync 행 INSERT 누락 (§3.5)
  - P3 — approv_organ_nm 컬럼명 정정 (§3.3)
  - 4건 follow-up GitHub Issue 사용자 등록 대기.

## 2026-04-25 feature/similar-cases v0 구현 완료 (Subagent-Driven Development)
- **스코프**: `docs/plans/feature-similar-cases.md` (36 task / Phase 0–7) Auto Mode 자율 실행.
- **커밋 체인 (29 task + 1 prettier)**: T0-1/T0-4 → T1-1..T1-7 → T2-1..T2-2 → T3-1..T3-4 → T4-1..T4-6 → T5-1..T5-2 → T6-1..T6-4 → T7-1.
- **검증**: typecheck 0/0/0 (137 files), lint clean, unit 258/258 (48 files), build success (CaseSearchPage 62.97 kB / gzip 15.76 kB), assertion-grep 2단 clean, dist 에 SERVICE_KEY 노출 없음.
- **§9.3 도메인 리뷰**: 6/6 PASS (`docs/reports/2026-04-25-similar-cases-domain-review.md`). 단정어 grep 가드 2단(전역 + similar-cases 전용) CI 차단.
- **데이터셋 결정**: 15000800 (GIS) 부적합 확인 → 15142998 (draft-display) 로 spec §2 교체.
- **검색 인프라**: D1 + FTS5 unicode61 + LIKE fallback (q≤3) + searchText 보조. stage-and-swap 트랜잭션. source_payload 화이트리스트로 본문 재호스팅 차단.
- **운영 보류**: 부트스트랩 1회 실측은 SERVICE_KEY 운영 환경에서 USER 직접 실행. T0-2/T0-3/T0-5 (실 페이로드 분포 검증) 후속 plan.
- **다음 단계**: PR open (Option 2) → review → squash merge → wrangler trigger cases-indexer (운영) → ADR 0001 보강 commit.

## 2026-04-25 feature/scoping-assistant v2 운영 배포 + /design-review + 후속 7 이슈
- **PR #7 머지** (squash `47c960b` on main). 운영 D1 `migrations/0002_scoping.sql` 원격 적용. `SERVICE_KEY` (data.go.kr 일반 인증키) `wrangler pages secret put` 주입.
- **운영 배포**: `e951ed3b.eia-workbench-v0.pages.dev` 활성.
- **운영 스모크 PASS**: 농림 8000㎡ + 산지 800㎡ → 발동 2건 (소규모 EIA + 산지전용) + 스킵 3건 (입력 미정의 / zone 불일치) 정확.
- **`/design-review`** (정적 분석 — Chrome 미설치로 Playwright 불가):
  - 종합 PASS (minor improvements). A/B/D 카테고리 모두 PASS.
  - 자동 수정 1건: CATEGORY_BADGE 하드코딩 hex → critical/attention/positive 토큰화 (commit `8817265` on `feature/scoping-assistant`).
  - **주의: `8817265` 는 PR #7 squash 전 main 에 반영되지 않음** — 후속 cherry-pick 또는 별도 PR 필요.
  - 수동 검토 보류 2건 → Issue #5, #6 으로 등록 대기.
- **후속 이슈 7건 본문 준비**:
  - **P1**: B-1 Markdown export `## 입력` 빈 `{}`, B-2 Claude 프롬프트 `## 사용자 입력` 빈 `{}` (한 PR 권장)
  - **P2**: B-3 스킵 규칙 카드 "근거 참조 없음"
  - **P3**: B-4 timestamp KST/UTC 혼재, C 사람 검토 필요 배지 대비, D `role="tab"` 제거, E 탭 가시성 일관성

## 2026-04-24 feature/scoping-assistant v2 구현 완료 (FULL-AUTO Phase 1–8)
- **스코프**: spec v2 (`docs/superpowers/specs/2026-04-23-scoping-assistant-design-v2.md`) + plan v2 (`docs/plans/feature-scoping-assistant-v2.md`) 기반 T2–T33 자율 실행.
- **커밋 체인 (10)**: `7a68395 Phase 1 DSL 결정` → `14f9cfe Phase 2 schema/migration` → `b7923e2 Phase 3 rule pack + engine` → `bc90c3c Phase 4 API` → `94a6b0a+0b555dc Phase 5 UI/export/prompt` → `2777232 Phase 5 log` → `f4b19cb Phase 6 cron/YAML grep/audit trip-wire` → `e48433f Phase 6 log` → `f4f3db5 Phase 7 E2E + hydration fixes`.
- **테스트 (로컬)**: unit 193/193, E2E 12/12 (2연속 안정, 23s), typecheck 0, lint 0, verify:rule-pack-audit PASS, build 495ms.
- **법령 대조**: T1 BLOCKING 감사 (2026-04-23) PDF 3개 기반 PASS. rule pack v2 `rule_pack_audit` 메타 + `scripts/verify-rule-pack-audit.mjs` CI step 이 회귀 trip-wire.
- **§9.3 도메인 리뷰**: 6/6 PASS (`docs/reviews/feature-scoping-assistant-v2.md`). ⑥ 법령 숫자 원문 대조 (issue #13) 포함.
- **알려진 한계**:
  - 엔진 `equals` 연산자 false → `condition_not_met` (사용자 직관은 `zone_mismatch` 예상 가능 — 파일럿 후 UX 재검토).
  - v2 는 육상풍력 단독 (태양광·해상풍력 요청 시 v3).
  - `/design-review` 는 대화형 세션 필요 — USER 수동 실행.
  - PDF export, run history 필터·검색, UI "규칙 부정확" 신고 버튼 v3 로 연기.
- **후속 이슈 후보**: 09 법령 refLink 체커 (P2), 10 도시지역 rule (P2), 11 산지관리법 시행규칙 별표4 (P3), 12 보호구역 GIS 연동 (P3), 13 client:load hydration signal 표준화 (Phase 7 경험 반영).

## 2026-04-22/23 feature/scoping-assistant v1 T1 법령 감사 FAIL → A안 채택 → 세션 정리

## 2026-04-22/23 feature/scoping-assistant v1 T1 법령 감사 FAIL → A안 채택 → 세션 정리
- **T1 법령 감사 결과 FAIL (CRITICAL 2 + HIGH 2)**:
  - C1 (10배 오류): `capacity_mw >= 10` → 실제 **100 MW (10만 kW)** 이상이 EIA 대상
  - C2 (별표 오류): citation `별표2` → 실제 **별표3** (별표2 는 전략환경영향평가)
  - H3 (축 오류): 소규모 EIA 는 발전용량 기준 아닌 **면적 × 용도지역** 기준
  - H4 (15배 오류): `forest_conversion_ha > 1` → 풍력발전시설 **660㎡ (0.066 ha)** 이상
- **STOP GATE 정상 작동.** plan T1 BLOCKING task 가 숫자 오류를 spec→구현→배포 경로에서 사전 차단.
- **A안 채택** (입력 스키마·rule pack 재설계 + 원문 확보 후 재착수). 이유:
  - 면적·용도지역 축 누락은 숫자 교정만으로 해결 불가 (스키마 자체 재설계 필요)
  - law.go.kr 별표 PDF 는 JS 렌더링이라 자동 fetch 실패 → 사용자 수동 다운로드 필요
- 산출물 (WIP commit 으로 보존):
  - `docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md` — T1 감사 리포트
  - `docs/office-hours/2026-04-23-scoping-assistant-v2-redesign.md` — spec v2 설계 질문 Q1~Q10
  - `data/rules/scoping/reference/{README,MANIFEST}.md` — PDF 배치 정책 (재호스팅 금지)
  - `.gitignore` — `data/rules/scoping/reference/*.pdf` 로컬 전용 제외
  - `docs/issues/13-spec-law-audit-mandatory.md` — CLAUDE.md §9.3 에 ⑥ 항목 추가 제안
- v1 산출물 (`docs/superpowers/specs/2026-04-22-scoping-assistant-design.md`, `docs/plans/feature-scoping-assistant.md`) 은 그대로 WIP commit 에 포함. v2 작성 시 `*-superseded-by-v2` suffix 로 rename (OH Q9 기본값).

## 완료

## 2026-04-22 v0 Cloudflare 배포 완료
- Phase 0~8 전체 완료. `https://eia-workbench-v0.pages.dev` 로 프로덕션 운용 가능.
- Phase 1: D1 (`eia-workbench-v0`), R2 (`eia-workbench-v0-uploads`), Pages 프로젝트 생성.
- Phase 2: `wrangler.toml` 에 `database_id` + 실제 버킷 이름 반영.
- Phase 3: D1 원격 마이그레이션 적용. 테이블 4개(`d1_migrations`, `login_attempts`, `projects`, `uploads`) + D1 플랫폼 아티팩트(`_cf_KV`) 확인.
- Phase 4: Secrets 3건 (`APP_PASSWORD`, `JWT_SECRET`, `TURNSTILE_SECRET_KEY`) `wrangler pages secret put` 주입.
- **Phase 4.A 설계 변경:** 최초 "Cloudflare 대시보드 UI 로 plain var 주입" 계획은 `wrangler.toml [vars]` 선언으로 대시보드가 잠겨 불가. `[env.production.vars]` 블록으로 해결 (`docs/plans/deploy-v0-wrangler-env-fix.md` + commit `0bfd35c`).
- Phase 5: Pages 배포. 두 건의 post-ship 수정:
  - **CSS fix (commit `79a8a7b`):** `@astrojs/tailwind` `applyBaseStyles:false` 환경에서 `<link rel="stylesheet" href="/src/...">` 는 dev-only 경로. 레이아웃 frontmatter `import '../styles/global.css';` 로 Vite 번들 그래프에 편입. `scripts/check-build-css.sh` (2-signal: preflight + global.css 토큰) 로 회귀 방지.
  - **Wrangler env fix (commit `0bfd35c`):** `[env.production.vars]` + `[[env.production.d1_databases]]` + `[[env.production.r2_buckets]]` 재선언. `scripts/check-wrangler-prod-vars.sh` (5-signal) 로 회귀 방지.
- Phase 5.4: Turnstile widget hostname 을 `eia-workbench-v0.pages.dev` 단일 허용으로 축소. 로그인 정상 통과.
- Phase 6: Cleanup worker(`eia-workbench-cleanup`) 별도 배포. cron `0 18 * * *` (03:00 KST).
- Phase 7: 프로덕션 시크릿 창 스모크 통과. 핵심 플로우(login 302 → 프로젝트 생성 201 → 상세 페이지 → 파일 업/삭/복 → 최근 삭제 드로어) 모두 동작. `docs/deploy/v0-smoke-playbook.md` 로 정리.
- Phase 8: 본 progress.md 갱신 + `docs/changelog/session_log.md` + `docs/plans/deploy-v0.md` fixup + `docs/issues/01-07` 7건 follow-up 등록.
- 증명된 스택: Astro 5 SSR + `@astrojs/cloudflare` + Tailwind 빌드 + Turnstile Managed + APP_ORIGIN CSRF + HS256 JWT + D1 + R2 + Turnstile hostname scope.

## 2026-04-21 feature/project-shell shipped
- PR #1 머지 (14d0958)
- T1~T32 완료 (32/34). 잔여 2건은 이슈 #2, #3 으로 이관
- CI 최초 실행에서 a11y 위반 2건 발견 → 3커밋으로 fix → verify green on abc9955
- AuthLayout 분리, PilotWarningBanner 를 header 내부로 이동, axe-smoke 강화

- 저장소 초기화 (`git init`, main 브랜치).
- 기본 폴더·파일 25종 생성 + 첫 커밋 `d9529f6`.
- `CLAUDE.md` v0 작성 (§9 gstack+SP 운용 규칙 포함).
- `.gitignore` / `.claudeignore` / `.editorconfig` / `.vscode/{settings,extensions}.json` 설정.
- `progress.md` 초기 버전, `README.md`.
- 프롬프트 팩 11종 (`prompts/gs_sp/00_session_boot.md` ~ `95_ship_checkpoint.md`).
- `prompts/00_project_context.md` — 세션 앞머리 컨텍스트 1장.
- `scripts/bootstrap.sh` — 스캐폴드 재생성용.
- **결정 반영**:
  - 프로젝트명: `eia-workbench` 확정.
  - 대상 업종: **육상풍력** 1개.
  - 프런트엔드: **Astro 5 + React islands + TS strict** (`docs/design/adr-0001-frontend-framework.md`).
  - 개발 환경: Windows + Git Bash + VSCode + Claude Max.
- `DESIGN.md` v0 초안 (색/타이포/간격/접근성/컴포넌트/법적단정 검출 가드).
- `docs/design/feature-project-shell.md` 사전 초안 (Office Hours 전 베이스).
- `data/samples/public/README.md` — 3개 공개 샘플 조달 가이드.
- `data/samples/private/README.md`, `data/rules/README.md`, `data/templates/README.md`.
- Claude Code CLI + gstack + Superpowers 설치·확인.

## 진행 중
- **`feature/similar-cases` v0 Office Hours**: 공공데이터포털 카테고리 B 기반 유사사례 검색. Q1~Q8 답변 대기 (1차 데이터셋, 필터 차원, UI, 원문 정책, 일 1k 한도, 로컬 우선, MVP 범위, 검색 UX).
- **scoping-assistant 후속**: Issue #1~#7 GitHub 등록 (USER), `8817265` token-fix commit cherry-pick 또는 폐기 결정.
- 참고 문서: `docs/reports/2026-04-23-scoping-assistant-mvp-completion.md`, `docs/reviews/feature-scoping-assistant-v2.md`

## 최근 완료 (2026-04-20)
- `feature/project-shell` Office Hours Q&A 6세트 + 보안 리뷰 12건 완료.
- `docs/design/feature-project-shell.md` v1 확정 (§10 보안 설계, §11 도메인 위험 갱신).
- 주요 결정:
  - auth v0: 싱글 패스워드 + Turnstile, `owner_id` 예약
  - 업로드: Worker proxy, 30MB/파일, 300MB/프로젝트, 30파일/프로젝트
  - 입지: KOSTAT 시/도·시/군/구 코드 드롭다운 + 라벨 캐시
  - HWP/HWPX: v0는 차단·안내. rhwp `@rhwp/core`는 v0.5 `feature/hwp-ingest` + `ADR-0002`로 분리
  - 테스트: Vitest + Playwright 3 시나리오 + axe lint, ~25 테스트
  - 비활성 탭: `aria-disabled` + tooltip
  - 소프트삭제: 최근 30일 드로어 + Cron 하드삭제
  - 중복: `(project_id, sha256)` UNIQUE
  - 보안 12건: 브루트포스 방어, magic bytes 검증, CSRF Origin, CSP, 로깅 PII 제외, Cron 안전가드 등 모두 설계 반영.

## 다음 작업

### 다음 세션 시작 시 (최우선)
1. **사용자**: feature/similar-cases OH Q1~Q8 답변 (채팅 출력 — 본 세션 결과 참조)
2. **사용자**: 본 세션의 7 이슈 (B-1~B-4 + design-review C/D + 탭 가시성) 를 GitHub Issues 로 등록 (P1 B-1+B-2 먼저)
3. **사용자 결정**: `8817265` (token-fix on `feature/scoping-assistant`) cherry-pick to main 또는 폐기

### 백로그
4. `docs/issues/13` (spec 법령 감사 의무화) 를 CLAUDE.md §9.3 에 ⑥ 항목으로 반영
5. `docs/issues/01-07` 7건을 GitHub Issues 로 올리기 (P1 #02, #03 먼저) — v0 배포 후속
6. `DESIGN.md` 기본 섹션 확장 또는 `/design-consultation` 1회
7. 이슈 #2 + #3 해결 (`fix/project-shell-hardening` 단일 브랜치 권장)
8. (이슈 #4, #5, #6 은 v0.5/v1 트리거 대기)

### v0 배포 후속(2026-04-22 도입)
6. `docs/issues/01-wrangler-3-to-4-migration.md` — wrangler 4.x 업그레이드
7. `docs/issues/02-preview-branch-app-origin-mismatch.md` — preview 배포 정책 확정
8. `docs/issues/03-prod-like-e2e-wrangler-pages-dev.md` — CF 런타임 기반 E2E
9. `docs/issues/04-dev-vars-example-template.md` — `.dev.vars.example`
10. `docs/issues/05-vars-precedence-docs.md` — vars precedence docs
11. `docs/issues/06-byte-identical-deploy-curl-verify.md` — `public/.build-version` + curl verify
12. `docs/issues/07-plan-cf-kv-annotation.md` — 완료됨, 이슈는 로그 목적
13. `docs/issues/08-cleanup-worker-local-verify.md` — cleanup worker 로컬 드라이런 CI step (P1)

## 이슈/막힌 점
- **scoping-assistant v2 블록**: PDF 3개 미확보 상태에서는 T1 재감사 불가 → spec v2 작성 불가 → 전체 feature 구현 정지. 사용자 수동 다운로드 필요.
- (기존) 공개 샘플 PDF/DOCX 3종 조달이 QA 단계 선행 조건

## 결정된 설계
- 운영 LLM 은 MVP 에서 "프롬프트 생성기 + 사용자 수동 Claude 실행" 전용.
- 셸 Git Bash/WSL2 고정. PowerShell 전용 스크립트 금지.
- 기능별 브랜치·워크트리: `feature/<name>`.
- 프런트엔드: Astro 5 + React islands (ADR-0001).
- 대상 업종: 육상풍력. v2 에서 다른 업종 추가 검토.
- UI 라이브러리 통째 도입 금지. shadcn/ui 방식 복붙 + Lucide 아이콘만.
- v0 운용 원칙: **"1 배포 = 1 조직"** (멀티테넌트는 v1).
- HWP 지원: v0.5로 분리 (ADR-0002).
- 모든 페이지는 `<main>` 랜드마크 필수. 비로그인 페이지는 `AuthLayout` 사용.
- CI 트리거는 `push: branches:[main]` + `pull_request` 만 사용 (PR 당 2 런 방지).
- `.dev.vars` 는 CI 워크플로 내부에서 seed, 절대 커밋 금지.

## 검증 상태
- unit 104/104, E2E 6/6, axe-smoke 3/3, typecheck / lint / prettier all green.
- CI `verify` green on `0bfd35c` (2026-04-22, check-build-css + check-wrangler-prod-vars 포함).
- 프로덕션 스모크 `docs/deploy/v0-smoke-playbook.md` S1~S9 통과 (2026-04-22).

## 남은 리스크
- **저작권**: EIASS 비-KOGL 자료 취급 경계 유지. 업로드 UI 문구에 "사용자 책임·공공원문 재배포 금지" 고정 표시 필요.
- **범위 팽창**: 기능 욕심 생기면 `docs/plans/` 새 계획서부터.
- **Astro + CF 어댑터**: D1/R2 바인딩 호환 테스트는 첫 plan 에 편입. 치명적 이슈 시 ADR-0001 파기 조건.
- **토큰 소모**: `/autoplan` 은 기능당 1회, 결과는 plan 에 캐시.
- **로컬 "E2E pass" 신뢰성**: 병합 전 리뷰 노트의 "E2E passed" 가 실제로는 Playwright Chromium 바이너리 자체가 미설치이거나 D1 migrations 미적용인 상태에서의 허위였음 (2026-04-21 확인). 가드: `scripts/check-e2e-prereqs.sh` + README "로컬에서 E2E 돌리기" 섹션. 머지 직전에는 반드시 스크립트가 FAIL=0 인 상태에서 `npm run test:e2e` 가 실제로 통과한 출력을 직접 확인한다.
- **CSP 가 Turnstile + Astro island 를 조용히 차단하는 패턴** (2026-04-21 PR #1 fix commit i 회고): 초기 `script-src 'self'` 는 (a) Turnstile 외부 `api.js` 와 (b) Astro 가 `client:load` 디렉티브마다 주입하는 인라인 부트스트랩 스크립트를 모두 차단한다. 결과: 로그인 실패 + 모든 React island 가 hydrate 실패 → 모달/토스트/드로어 비작동. 이 상태에서 axe-smoke 만 돌리면 SSR HTML 은 정상이라 "그린"처럼 보인다. 가드: (a) CSP 변경 시 반드시 `npm run test:e2e` 4 spec 전체 실행, (b) DESIGN §10.4.1 에 현재 허용 항목과 v1 nonce 마이그레이션 계획 기록, (c) `src/middleware.ts` 주석 블록에 `'unsafe-inline'` 이 필요한 이유 명문화.
- **단일 뷰 내부 구성요소의 a11y semantics 누락 패턴** (2026-04-21 PR #1 fix commit j 회고): landmark 레벨(commits a–h) 을 고쳐도 tablist 내부의 `DisabledTab` 이 `<span>` 래퍼 안에 `role` 없는 `<button>` 을 갖고 있어 `aria-required-children` 이 critical 로 떨어졌다. 또 `text-primary #1F6FEB` 가 4.21:1 로 WCAG AA 4.5:1 미달이었음. 가드: (a) axe-smoke 를 항상 로그인 이후 페이지까지 뻗게 (commit i 에서 확정), (b) `includedImpacts: ['moderate','serious','critical']` 로 강제, (c) 색상 변경 시 contrast ratio 계산을 주석으로 남김, (d) 복합 role (tablist/listbox) 은 자식 요소가 모두 해당 role 을 갖는지 컴포넌트 레벨에서 확인.
- **Cloudflare 배포 완료** (2026-04-22): Pages + Cleanup Worker 배포됨. 후속 하드닝은 `docs/issues/01-07` 참고.
- **Preview 브랜치 APP_ORIGIN mismatch** (`docs/issues/02`): git-integrated preview 활성화 시 localhost APP_ORIGIN 이 preview URL 로 leak 되어 CSRF 가 모든 POST 를 거부. v0 는 Direct Upload 만 사용해 비노출이지만, preview 기능을 켤 때 반드시 선처리.
- **byte-identical deploy silent skip** (`docs/issues/06`): `wrangler pages deploy` 가 이전과 동일한 `dist/` 를 스킵. 환경변수만 바꾼 배포가 조용히 실패할 수 있음. `public/.build-version` + 배포 후 curl 검증으로 가드 예정.
- **wrangler 3.x → 4.x 보류 유지** (`docs/issues/01`): 이번 배포는 3.114.17 로 완료. 마이그레이션은 major breaking 가능성 → 별도 PR 로.
- **`owner_id` 미적용**: 멀티테넌트 전환 시 v1 이슈 #5 선행. 현 v0 는 "1 배포 = 1 조직" 전제.
- **cron 원자성 미보장**: R2 객체 삭제와 D1 row 삭제가 별개 트랜잭션. 장기 운영 시 이슈 #4 해결 필요.
- **wrangler major bump (3.x → 4.x) 보류**: 2026-04-21 배포 세션에서 로컬 `wrangler 3.114.17` 확인. 4.84.0 업그레이드 알림이 있으나 major 라 breaking changes 가능. 이번 v0 배포는 3.x 로 진행. **배포 완료 후 GitHub 이슈로 마이그레이션 작업 생성** 예정 (`wrangler.toml` compatibility_date 상향 + Pages/Worker 빌드 재검증).
- **Windows 로컬 `npm run lint` 실패 패턴** (2026-04-21 Phase 0 회고): `core.autocrlf=true` (Windows 기본) + `.prettierrc.json` 에 `endOfLine` 미설정 → working tree CRLF ↔ prettier 기본 `lf` 충돌. 로컬만 red, CI(Linux) 는 LF 라 green. 임시 우회: 로컬 `git config core.autocrlf input`. **근본 해결책은 `.gitattributes` 에 `* text=auto eol=lf` 추가** (별도 이슈). 또는 `.prettierrc.json` 에 `"endOfLine": "auto"` (단 config-protection hook 이 prettierrc 수정을 차단하므로 hook 완화 필요).
