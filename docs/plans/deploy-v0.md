# eia-workbench v0 — Cloudflare 배포 계획

**작성일:** 2026-04-21
**대상 커밋:** `origin/main` @ `76c27dd` (plan revisions) 기반, 배포 직전 커밋은 Phase 2.5 에서 확정
**배포 대상:** Cloudflare Pages (`eia-workbench-v0`) + Cron Worker (`eia-workbench-cleanup`)

---

## 0. 상수 (이 계획서 안에서 고정)

| 키 | 값 | 출처 |
|---|---|---|
| Cloudflare Account ID | `7c8faeeccbac7891d37a140bf586e315` | 사용자 제공 |
| Pages project name | `eia-workbench-v0` | 사용자 제안 |
| D1 database name (prod) | `eia-workbench-v0` | Pages 프로젝트와 동일 네이밍 |
| R2 bucket name (prod) | `eia-workbench-v0-uploads` | Pages 프로젝트 접두 + `-uploads` |
| Cron worker name | `eia-workbench-cleanup` | `workers/cleanup.wrangler.toml` 현재값 |
| Production origin | `https://eia-workbench-v0.pages.dev` | Pages 기본 도메인. 커스텀 도메인은 v0 범위 밖 |
| Turnstile Site Key | `0x4AAAAAADAUrmpBcDS4csj4` | 사용자 제공. 공개값 (브라우저에 렌더됨) |
| Turnstile widget 허용 도메인 | `eia-workbench-v0.pages.dev` | Cloudflare 대시보드 Turnstile 설정에서 제한 필수 |

---

## 1. 시크릿 분류 (Claude 는 값을 받지 않음)

| 이름 | 분류 | 저장소 | 주입 방법 |
|---|---|---|---|
| `APP_PASSWORD` | secret | Pages (prod) + Cleanup worker (불필요) | `wrangler pages secret put` 대화형 |
| `JWT_SECRET` | secret | Pages (prod) | `wrangler pages secret put` 대화형 |
| `TURNSTILE_SECRET_KEY` | secret | Pages (prod) | `wrangler pages secret put` 대화형 |
| `TURNSTILE_SITE_KEY` | plain var (공개) | Pages (prod) | Cloudflare 대시보드 Pages → Settings → Environment variables |
| `APP_ORIGIN` | plain var (공개) | Pages (prod) **only** | Cloudflare 대시보드. `wrangler.toml [vars]` 에는 **로컬 기본값** (`http://localhost:3000`) 만 유지. 두 소스 동시 존재 금지. |
| `CLOUDFLARE_API_TOKEN` | env var (로컬 셸) | 사용자 셸 env | 사용자가 `export CLOUDFLARE_API_TOKEN=…` 로 주입, wrangler 가 자동 사용 |

**Cron worker (`eia-workbench-cleanup`) 는 시크릿 불필요.** DB/R2 바인딩만 있으면 동작. `workers/cron-cleanup.ts` 의 의존성 확인 완료.

**중요**: Claude 는 위 값들을 받지 않는다. 각 `wrangler * secret put` 은 대화형 프롬프트가 열리므로, 사용자가 직접 터미널에 붙여넣는다.

---

## 2. Phase 0 — 배포 전 로컬 검증 (5분)

- [ ] **0.1** `git status` clean, `git log --oneline -1` 이 `76c27dd` (또는 이후 plan 커밋) 와 일치하는지 확인. `origin/main` 과 동기화 상태여야 함.
- [ ] **0.2** `npm ci` 재설치 (node_modules lock 확인)
- [ ] **0.3** `npm run typecheck && npm run lint && npm test` → all green
- [ ] **0.4** `npm run build` → `dist/` 생성 확인
- [ ] **0.5** `npx wrangler --version` 출력 확인 (사용자 세션에 wrangler 설치되어 있는지)
- [ ] **0.6** `npx wrangler whoami` → Account ID `7c8faeeccbac7891d37a140bf586e315` 와 일치 확인
  - 불일치 시 `export CLOUDFLARE_API_TOKEN=…` 후 재확인 (사용자 셸)

**게이트:** 0.1 ~ 0.6 모두 ✅ 전에는 Phase 1 진입 금지.

---

## 3. Phase 1 — Cloudflare 인프라 생성 (10분)

> 이 단계는 새 리소스를 만든다. 멱등성 없음 — 같은 이름으로 재실행 시 충돌.

- [ ] **1.1** D1 database 생성
  ```
  npx wrangler d1 create eia-workbench-v0
  ```
  출력에 `database_id = "xxxx-…"` 값 확인. **이 ID 를 계획서 §4 에 기록**.

- [ ] **1.2** R2 bucket 생성
  ```
  npx wrangler r2 bucket create eia-workbench-v0-uploads
  ```
  출력 "Created bucket …" 확인.

- [ ] **1.3** Pages 프로젝트 생성 (direct upload 모드, Git 연동 X)
  ```
  npx wrangler pages project create eia-workbench-v0 --production-branch main
  ```
  - Git 연동은 의도적으로 하지 않음 (`CLAUDE.md §9.5` 자동 배포 금지).
  - 사용자 질문: `Do you want to connect a repository?` → **No** 선택.
  - 참고: `--production-branch` 는 Direct Upload 프로젝트에서 메타값. 실제 프로덕션 판정은 매 배포 시 `--branch main` 플래그가 결정 (§5.2 참고).

**게이트:** 1.1 database_id, 1.2 bucket 존재, 1.3 프로젝트 생성 모두 ✅. Turnstile 도메인 제한은 배포 URL 확정 후 §5.4 에서 실시.

---

## 4. Phase 2 — `wrangler.toml` 프로덕션 값 반영 (5분)

현재 값은 로컬 개발 플레이스홀더. 프로덕션 값으로 교체하는 커밋이 필요하다.

- [ ] **2.1** `wrangler.toml` 편집
  - `[[d1_databases]].database_name = "eia-workbench-v0"`
  - `[[d1_databases]].database_id = "<<Phase 1.1 에서 받은 ID>>"` — UUID, 비밀 아님. 커밋 안전.
  - `[[r2_buckets]].bucket_name = "eia-workbench-v0-uploads"`
  - `[vars].APP_ORIGIN` — **그대로 유지** (`http://localhost:3000`). 로컬 개발 기본값. 프로덕션 APP_ORIGIN 은 §4.1 Pages 대시보드가 단독 소스.
  - `[vars]` 블록 위에 주석 1줄 추가:
    `# [vars] are local-dev defaults. Production overrides come from the Pages dashboard env vars.`

- [ ] **2.2** `workers/cleanup.wrangler.toml` 편집 (동일 D1/R2 를 가리켜야 함)
  - `database_name = "eia-workbench-v0"`
  - `database_id = "<<Phase 1.1 ID>>"`
  - `bucket_name = "eia-workbench-v0-uploads"`
  - `triggers.crons = ["0 18 * * *"]` 유지 (03:00 KST, UTC 18:00)

- [ ] **2.3** `.gitignore` 에 `wrangler.toml` **넣지 않음**. database_id 는 식별자이지 인증 토큰이 아님 (Cloudflare 공식 입장). 커밋한다.

- [ ] **2.4** 로컬 개발은 `wrangler.toml` + `.dev.vars` 로컬 경로가 유지되는지 확인
  - `[[d1_databases]]` 가 `--local` 시 miniflare 의 local D1 을 만듦. prod `database_id` 값이 있어도 `--local` 플래그가 오버라이드.
  - `npx wrangler d1 migrations apply DB --local` 재실행 → 여전히 로컬 sqlite 만 건드리는지 확인.

- [ ] **2.5** 커밋 + 푸시
  ```
  git add wrangler.toml workers/cleanup.wrangler.toml
  git commit -m "chore(deploy): wire production D1/R2/APP_ORIGIN for v0"
  git push origin main
  ```
  - 이 푸시는 CI `verify` 를 한 번 돈다 (`pull_request` 트리거는 아니지만 `push: branches:[main]` 트리거). 그린 확인 후 Phase 3.

**게이트:** 커밋 해시 기록, CI 그린.

---

## 5. Phase 3 — D1 원격 마이그레이션 (5분)

- [ ] **3.1** 마이그레이션 드라이런
  ```
  npx wrangler d1 migrations list DB --remote
  ```
  - 예상 출력: `0001_init.sql | pending`

- [ ] **3.2** 적용
  ```
  npx wrangler d1 migrations apply DB --remote
  ```
  - 사용자 수동 확인 프롬프트 → y.

- [ ] **3.3** 스키마 검증
  ```
  npx wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
  ```
  - 기대 테이블:
    - **애플리케이션:** `d1_migrations`, `login_attempts`, `projects`, `uploads` (4개)
    - **D1 내부:** `_cf_KV` (Cloudflare 메타, 자동 생성. 무시 가능)
    - **AUTOINCREMENT 사용 시:** `sqlite_sequence` (자동 생성)
  - 애플리케이션 4개가 모두 포함되면 통과. `_cf_KV`, `sqlite_sequence` 는 D1 플랫폼 아티팩트이므로 "의도치 않은 테이블" 로 취급하지 않는다.

**게이트:** 애플리케이션 테이블 4개가 모두 포함.

---

## 6. Phase 4 — Pages 환경변수 + 시크릿 주입 (10분)

### 4.A. Plain vars (공개값) — `wrangler.toml [env.production.vars]`

> **변경 사유(2026-04-22):** 최초 계획은 Cloudflare Pages 대시보드 UI 로 주입이었으나, `wrangler.toml` 에 `[vars]` 가 선언된 순간 대시보드가 잠긴다 ("Environment variables for this project are being managed through wrangler.toml"). 실제 수정은 `docs/plans/deploy-v0-wrangler-env-fix.md` 에서 `[env.production.vars]` 블록 도입으로 해결. 자세한 precedence 규칙: `docs/issues/05-vars-precedence-docs.md`.

- [x] **4.1** `APP_ORIGIN = "https://eia-workbench-v0.pages.dev"` → `wrangler.toml [env.production.vars]`
- [x] **4.2** `TURNSTILE_SITE_KEY = "0x4AAAAAADAUrmpBcDS4csj4"` → `wrangler.toml [env.production.vars]`
- [x] 비상속 바인딩 재선언: `[[env.production.d1_databases]]`, `[[env.production.r2_buckets]]` (Cloudflare 규칙)
- [x] CI 검증: `scripts/check-wrangler-prod-vars.sh` (5-signal)

### 4.B. Secrets (암호화) — `wrangler pages secret put` 대화형

각 명령은 값 프롬프트를 연다. **Claude 는 값을 보지 않는다.** 사용자가 터미널에 붙여넣는다.

- [ ] **4.3** `npx wrangler pages secret put APP_PASSWORD --project-name eia-workbench-v0`
- [ ] **4.4** `npx wrangler pages secret put JWT_SECRET --project-name eia-workbench-v0`
- [ ] **4.5** `npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name eia-workbench-v0`

- [ ] **4.6** 주입 확인 (값은 마스킹됨)
  ```
  npx wrangler pages secret list --project-name eia-workbench-v0
  ```
  - 기대: 3 건 (`APP_PASSWORD`, `JWT_SECRET`, `TURNSTILE_SECRET_KEY`).

**게이트:** vars 2 + secrets 3 = 총 5 건 주입 완료.

---

## 7. Phase 5 — Pages 배포 (10분)

- [ ] **5.1** 최신 커밋에서 클린 빌드
  ```
  git pull --ff-only
  npm ci
  npm run build
  ```

- [ ] **5.2** 배포
  ```
  npx wrangler pages deploy dist --project-name eia-workbench-v0 --branch main --commit-hash=$(git rev-parse HEAD) --commit-dirty=true
  ```
  - `--branch main` 이 프로덕션으로 승격.
  - `--commit-hash` 로 배포 메타데이터에 현재 커밋 해시 박음.
  - `--commit-dirty=true` 는 로컬 working tree 에 untracked 파일이 있어도 진행. `public/.build-version` 같은 gitignored 빌드 아티팩트가 생길 수 있으므로 필요.
  - 출력 URL 포맷 확정은 §5.3 에서 수행.
  - **byte-identical skip 주의:** wrangler 는 이전 배포와 `dist/` 가 동일하면 "No files to upload" 로 건너뛴다. 환경변수만 바꾸고 `dist/` 는 동일할 때 silent fail 됨. `docs/issues/06-byte-identical-deploy-curl-verify.md` 참고.

- [ ] **5.3** 배포 URL 확정 + 헬스체크
  - `wrangler pages deploy` 출력 URL 을 그대로 기록. 출력 형식:
    **`배포 URL: https://<...>.pages.dev — 기대값 https://eia-workbench-v0.pages.dev 와 일치: [예/아니오]`**
  - 불일치 시: Pages 가 이름 충돌로 suffix 를 붙인 것. §12 의사결정 대기에 등록 후 진행 중지.
  - 일치 시: 해당 URL/login 접속 → Turnstile 위젯 로드 확인 (현재 hostname 제한 미적용 상태 — §5.4 에서 좁힘).
  - 로그인 → `/` 진입.
  - DevTools → CSP 헤더에 `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com` 포함 확인.

- [ ] **5.4** Turnstile 도메인 제한 (Cloudflare 대시보드 UI)
  - **전제:** §5.3 에서 배포 URL 이 기대값과 일치한 경우에만 실행.
  - Turnstile → 해당 위젯 → Hostname Management → `eia-workbench-v0.pages.dev` 한 줄로 축소.
  - 불일치였다면 실제 URL 로 변경 후 §12 에 의사결정 기록.
  - **Scope 주의:** Turnstile hostname 제한은 **위젯의 bot-challenge 허용 범위**를 제한한다. CSRF origin 체크(`env.APP_ORIGIN`)·로그인 경로와는 독립이다. 로그인 실패 디버깅 시 이 둘을 혼동하지 말 것 (2026-04-22 세션에서 혼동 사례 있음).

**게이트:** 로그인 성공 + CSP 헤더 확인 + Turnstile hostname 제한 적용.

---

## 8. Phase 6 — Cleanup Worker 별도 배포 (5분)

- [ ] **6.1** 배포
  ```
  npx wrangler deploy --config workers/cleanup.wrangler.toml
  ```
  - 출력에 `eia-workbench-cleanup` 가 크론 `0 18 * * *` 로 등록됨을 확인.

- [ ] **6.2** D1/R2 바인딩 검증
  - Cloudflare 대시보드 → Workers → `eia-workbench-cleanup` → Settings → Bindings
  - `DB` 바인딩 = D1 `eia-workbench-v0` 인지
  - `UPLOADS` 바인딩 = R2 `eia-workbench-v0-uploads` 인지

- [ ] **6.3** 드라이런 (cron 대기하지 말고 즉시 트리거)
  ```
  npx wrangler deploy --config workers/cleanup.wrangler.toml --dry-run
  ```
  출력에 번들 문제 없는지만 본다. 실제 실행은 03:00 KST 에 자동.

**게이트:** 바인딩 2개 프로덕션 리소스와 일치.

---

## 9. Phase 7 — 프로덕션 스모크 (10분)

사용자 수행. 실 사용자 경로 1회 왕복.

- [ ] **7.1** `/login` → 로그인 성공
- [ ] **7.2** `/` → `새 프로젝트` 생성 (이름 + 시/도 + 시군구)
- [ ] **7.3** 상세 페이지 → PDF 1건 업로드 → 목록에 표시
- [ ] **7.4** 파일 삭제 → `최근 삭제` 드로어에 표시
- [ ] **7.5** 드로어에서 복원 → 파일 목록에 돌아옴
- [ ] **7.6** 프로젝트 삭제 → `/` 목록에서 사라짐 + `최근 삭제` 드로어에 표시
- [ ] **7.7** `/logout` → 쿠키 무효화
- [ ] **7.8** HWP 파일 업로드 시도 → 거부 메시지 + 안내 토스트
- [ ] **7.9** (선택) 30MB 초과 파일 업로드 → 쿼터 거부

**게이트:** 7.1 ~ 7.8 전부 통과. 하나라도 실패 시 Phase 10 롤백.

---

## 10. Phase 8 — 사후 정리 + 커밋 (5분)

- [ ] **8.1** `progress.md` 갱신:
  - "현재 목표" → `v0 배포 완료, 사내 파일럿 운영 단계`
  - "완료" 섹션 최상단에 `## 2026-MM-DD v0 Cloudflare 배포` 항목
  - "남은 리스크" 에서 `Cloudflare 배포 미수행` 제거
- [ ] **8.2** `docs/changelog/session_log.md` 에 배포 세션 기록
- [ ] **8.3** 커밋
  ```
  chore(log): v0 deployed to Cloudflare Pages (eia-workbench-v0)
  ```
- [ ] **8.4** GitHub 에 릴리스 태그 (선택)
  ```
  git tag v0.1.0
  git push origin v0.1.0
  ```

---

## 11. 롤백 플랜

| 실패 지점 | 롤백 |
|---|---|
| Phase 1 리소스 생성 실패 | 부분 생성된 리소스 삭제: `wrangler d1 delete`, `wrangler r2 bucket delete`, `wrangler pages project delete`. 재시도. |
| Phase 2 커밋 이후 CI red | `git revert <sha>` → main 으로 푸시. `wrangler.toml` 원복. |
| Phase 3 마이그레이션 실패 | `wrangler d1 execute DB --remote --command "…"` 로 수동 롤백. 단 `0001_init.sql` 실패는 스키마 부분 생성이므로 DB 자체를 재생성 (`d1 delete` + `d1 create` + migration apply) 가 간단. |
| Phase 5 배포 후 500 | Cloudflare 대시보드 → Pages → Deployments → 이전 배포 선택 → `Rollback`. |
| Phase 6 cleanup cron 오동작 | `wrangler deploy --config workers/cleanup.wrangler.toml --keep-vars` 로 재배포 또는 `wrangler delete` 후 재배포. |
| Phase 7 스모크 실패 | Pages 배포 롤백 (위) + 로컬 재현 → 수정 → 재배포. 수정이 커지면 새 `docs/plans/*.md` 작성. |

---

## 12. 의사결정 대기 (현재 비어 있음)

이 섹션은 사용자 확인이 필요한 항목이 생기면 실시간으로 추가.

- (없음)

---

## 13. 수행 규칙 재확인

- `CLAUDE.md §9.5`: `/ship` 은 PR 까지만. 자동 배포 금지. **이 계획서의 모든 `wrangler *` 명령은 사용자 터미널에서 실행**. Claude 는 명령을 실행하지 않고 사용자에게 실행 요청만 한다.
- `CLAUDE.md §2.2`: 운영 코드에 유료 LLM 키 금지. 이 배포에는 해당 없음 (LLM 키 사용하는 경로가 없음).
- `CLAUDE.md §6`: `.dev.vars`, 업로드 파일, `data/samples/private/` 커밋 금지. `.gitignore` 확인 완료.
- 시크릿 값은 Claude 세션에 절대 노출되지 않는다. 사용자는 `wrangler * secret put` 대화형 프롬프트에 직접 입력.

---

## 14. 세션 시작 체크리스트 (다음 세션에서 이 계획서를 집어들 때)

1. `docs/plans/deploy-v0.md` (이 문서) 열어두기
2. Cloudflare Dash 열어두기 (Account `7c8faeeccbac7891d37a140bf586e315`)
3. 로컬 메모장에서 4 시크릿 준비 (`APP_PASSWORD`, `JWT_SECRET`, `TURNSTILE_SECRET_KEY`, `CLOUDFLARE_API_TOKEN`)
4. 터미널에 `export CLOUDFLARE_API_TOKEN=<값>` 주입 + `npx wrangler whoami` 로 계정 일치 확인
5. Phase 0 부터 체크박스 순서대로 진행
