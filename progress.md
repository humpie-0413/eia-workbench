# progress.md

## 현재 목표
v0 Cloudflare 배포 완료. 다음 세션에서 `feature/design-system` 착수 또는 follow-up 이슈 7건 처리.

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
(비어 있음)

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
1. `docs/issues/01-07` 7건을 GitHub Issues 로 올리기 (우선순위: P1 #02, #03 먼저).
2. `DESIGN.md` 기본 섹션 확장 또는 `/design-consultation` 1회.
3. `feature/design-system` 의 `/office-hours` 준비.
4. 이슈 #2 + #3 해결 (`fix/project-shell-hardening` 단일 브랜치 권장).
5. (이슈 #4, #5, #6 은 v0.5/v1 트리거 대기)

### v0 배포 후속(2026-04-22 도입)
6. `docs/issues/01-wrangler-3-to-4-migration.md` — wrangler 4.x 업그레이드
7. `docs/issues/02-preview-branch-app-origin-mismatch.md` — preview 배포 정책 확정
8. `docs/issues/03-prod-like-e2e-wrangler-pages-dev.md` — CF 런타임 기반 E2E
9. `docs/issues/04-dev-vars-example-template.md` — `.dev.vars.example`
10. `docs/issues/05-vars-precedence-docs.md` — vars precedence docs
11. `docs/issues/06-byte-identical-deploy-curl-verify.md` — `public/.build-version` + curl verify
12. `docs/issues/07-plan-cf-kv-annotation.md` — 완료됨, 이슈는 로그 목적

## 이슈/막힌 점
- 없음. (공개 샘플 PDF/DOCX 3종 조달이 QA 단계 선행 조건)

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
