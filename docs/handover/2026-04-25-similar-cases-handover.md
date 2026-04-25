# 인계 문서 — feature/similar-cases v0
**작성**: 2026-04-25
**다음 세션 시작 시 가장 먼저 읽을 것** (5~10분 정독 후 작업 재개)

---

## 0. 컨텍스트 관리 규칙 (매 세션 필독)

### 0.1 Claude Code 컨텍스트 한계
- 200k 토큰 하드 리밋
- 60~70% 도달 시 `/compact` 또는 `/clear`
- 80% 초과 시 즉시 강제 `/compact`
- 85% 도달 시 사용자 보고 (스톱 게이트)

### 0.2 Phase 경계 강제 /compact
각 Phase 완료 직후, git commit 직후:

```
/compact spec 요약, 현재 진행 Task 번호, 이전 Phase 의 결정 사항
(스키마·함수명·API 경로), 미해결 findings, 다음 Phase 의 첫 Task 만 보존.
구현 중 탐색·시행착오·파일 읽기 내용은 버려도 됨.
```

### 0.3 Subagent 위임 의무
다음 작업은 반드시 subagent (Task tool) 로 실행:
- 코드베이스 탐색 질문
- 대용량 파일 읽기 (spec/plan 재조회)
- 테스트 실패 원인 분석
- design review 스킬 실행

메인 컨텍스트에는 결론 2~3줄만 남길 것.

### 0.4 Phase 별 커밋 + session_log
각 Phase 종료 시 순서:
1. `git add` + `git commit` (Phase X: 요약)
2. `docs/changelog/session_log.md` 에 한 줄 추가
3. `/compact` (0.2 규칙)
4. 다음 Phase 시작

### 0.5 사용자 정책 — 스톱 게이트 7개
1. **main push 금지** — 사용자가 실행. feature 브랜치 push 도 hook 에 막힘 → 사용자 worktree 에서 직접 실행.
2. **Cloudflare 원격 리소스 변경 금지** — D1 원격 migration 포함, `--local` 만 허용. 운영 변경은 사용자 수동.
3. **법령 수치·spec 임의 수정 금지** — `docs/findings/` 에 기록만, 결정은 사용자.
4. **민감값 (SERVICE_KEY, APP_PASSWORD, JWT_SECRET, TURNSTILE_SECRET_KEY) 출력·로그 금지** — 키 이름만, 값은 절대 chat 노출 금지.
5. **findings 누적 20개 초과 시 중단** — 사용자에게 요약 보고 후 우선순위 협의.
6. **동일 명령 5회 연속 실패 시 해당 task skip** — 다음 task 로 진행, findings 에 기록.
7. **ctx 85% 도달 시 강제 중단 + /compact 보고** — 사용자에게 진행 상황 1줄 요약 후 compact 실행.

---

## 1. 프로젝트 현재 상태

### 1.1 main 브랜치 (운영 배포 완료)
- HEAD: `f59a2bc` (`docs(similar-cases): writing-plans v0 — Phase 0-7 (36 TDD tasks)`)
- 운영 URL: https://eia-workbench-v0.pages.dev
- 운영 D1: `0001_init` + `0002_scoping` migration 적용
- 운영 secret: `APP_PASSWORD`, `JWT_SECRET`, `TURNSTILE_SECRET_KEY`, `SERVICE_KEY`

### 1.2 feature/similar-cases 브랜치 (구현 완료, push + PR 대기)
- worktree: `C:\0_project\eia-workbench-feature-similar-cases`
- HEAD: `f4e4830` (`chore(similar-cases): PR body draft for T36 push`)
- main 대비 **32 commits ahead** (29 task commits + 1 prettier + 1 TS strict fix + 1 PR body draft)
- 로컬 검증: typecheck 0 / lint 0 / 258 tests / build 62.97 kB / assertion-grep clean
- **현재 블로커**: feature 브랜치 push 가 hook 에 막힘 → 사용자가 worktree 에서 직접 push 후 Claude 가 PR 생성.

### 1.3 165 task 상태 (TaskList ID #1~#175)
- 157 done · 3 in progress · 5 open
- **진행 중** (3):
  - `#133` Phase 7: E2E + reports (T24-T33) ← scoping 구버전 (실제로는 완료, 마킹만 남음)
  - `#167` similar-cases plan: Phase 0 검증 (T0-2/0-3/0-5 사용자 deferred)
  - `#174` similar-cases plan: Phase 7 최종 리포트 + plan self-review (T34/T35 완료, T36 push 대기)
- **대기** (5, 전부 P2):
  - `#40` Housekeeping: kostat hardening (empty-string subCode + drop blind cast)
  - `#41` Housekeeping: route hardening (batch cascade + consistent try/catch)
  - `#140` Phase 8 T29-T32 도메인 리뷰 (scoping 구버전, 사실상 완료)
  - `#141` 최종 리포트 2건 (scoping 구버전, 사실상 완료)
  - `#142` design-review 수동 실행 메모

---

## 2. 다음 작업 — 즉시 할 것

### 2.1 사용자 직접 실행 (5분)

```bash
# worktree 로 이동
cd C:/0_project/eia-workbench-feature-similar-cases

# 상태 확인
git status
git log --oneline -3
# 기대: f4e4830 PR body draft / 270c495 completion report / 9baedda domain review

# push (hook 우회 — feature 브랜치는 사용자만 가능)
git push -u origin feature/similar-cases

# 기대 결과:
# - "Branch 'feature/similar-cases' set up to track 'origin/feature/similar-cases'"
# - GitHub Actions CI 가 자동 트리거됨
```

### 2.2 push 성공 후 Claude 에 즉시 보낼 메시지 (한 덩어리 복붙)

```
push 완료 (feature/similar-cases → origin).
docs/handover/2026-04-25-similar-cases-handover.md 읽고 PR 생성·CI green 까지 진행.

PR body: docs/reviews/feature-similar-cases-pr-body.md (이미 작성됨, 본 worktree 에 있음)

다음 단계:
1. gh pr create --base main --head feature/similar-cases --title "feat(similar-cases): v0 (FTS5 검색 + facet + Markdown export + EIASS deep-link)" --body-file docs/reviews/feature-similar-cases-pr-body.md
2. PR URL 확보
3. CI 모니터링 (typecheck / lint / test / assertion-grep / build / E2E)
4. CI red 시 fix-forward, green 시 사용자에게 머지 권한 위임
5. 머지는 사용자 수동 (squash 권장, scoping-assistant 와 동일 패턴)
```

### 2.3 Claude 가 받자마자 할 일

1. **컨텍스트 로드 순서** (의무):
   - 본 인계 문서 (`docs/handover/2026-04-25-similar-cases-handover.md`)
   - `docs/reports/2026-04-25-similar-cases-completion.md` (산출물 inventory)
   - `docs/reviews/feature-similar-cases.md` (핵심 결정)
   - `docs/reviews/feature-similar-cases-pr-body.md` (PR body 원문)
   - `CLAUDE.md` §9 (gstack + Superpowers 운용 규칙)
   - `progress.md` 최상단 entry (2026-04-25 similar-cases v0)

2. **PR 생성 명령** (worktree 에서 실행):
   ```bash
   cd C:/0_project/eia-workbench-feature-similar-cases
   gh pr create \
     --base main \
     --head feature/similar-cases \
     --title "feat(similar-cases): v0 (FTS5 검색 + facet + Markdown export + EIASS deep-link)" \
     --body-file docs/reviews/feature-similar-cases-pr-body.md
   ```

3. **CI 모니터링** (PR URL 확보 후):
   ```bash
   gh pr checks <PR_NUMBER> --watch
   # 또는 mcp__plugin_ecc_github__get_pull_request_status 로 폴링
   ```

4. **CI 결과 분류**:
   - **All green** → 사용자에게 보고, 머지 권한 위임 (사용자가 squash merge 수행).
   - **typecheck/lint red** → 즉시 fix-forward (Edit + commit + push by USER).
   - **test red** → systematic-debugging Phase 1 진입 (root cause 우선).
   - **assertion-grep red** → 단정 표현이 코드에 들어간 것. UI 문자열 검토 후 수정.
   - **build red** → bundle 분석. 가장 흔한 원인은 island import 순환.
   - **E2E red** → CI 환경에서만 실패하는 경우 자주 발생. `tests/e2e/fixtures/cases-seed.sql` 적용 여부, Turnstile 우회 (test 모드 토큰), Playwright 타임아웃 우선 확인.

### 2.4 CI green 이후 (사용자 수동 머지)

1. 사용자에게 보고: PR URL + CI 결과 표 + 머지 옵션 (squash 권장).
2. 사용자 머지 후:
   - main pull (`git pull` in main worktree)
   - 운영 D1 migration 적용 권한 위임 (`wrangler d1 migrations apply DB --remote`) — 사용자 수동
   - 운영 secret `SERVICE_KEY` 확인 (이미 적용됨)
   - 부트스트랩 1회 실측 — 사용자 수동 (`scripts/cases-bootstrap.ts`)
   - cron trigger 활성화 (`workers/cases-indexer.wrangler.toml`) — 사용자 수동 deploy

---

## 3. 머지 후 운영 절차 (사용자 수동, Claude 는 가이드 + 검증만)

### 3.1 D1 migration 적용
```bash
# 사용자 실행
cd C:/0_project/eia-workbench
wrangler d1 migrations list DB --remote   # 0001 + 0002 만 보여야 함
wrangler d1 migrations apply DB --remote  # 0003_similar_cases 적용
wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'eia_cases%'"
# 기대: eia_cases / eia_cases_fts / eia_cases_staging / eia_cases_sync
```

### 3.2 부트스트랩 1회 실측
```bash
# 사용자 실행 (운영 SERVICE_KEY 환경)
cd C:/0_project/eia-workbench
tsx scripts/cases-bootstrap.ts
# 기대 출력:
#   - records_added: 100~1000 범위
#   - records_skipped: 0 또는 wind-filter 제외분
#   - api_calls: 8000 이하 (cap)
#   - error_message: null
# 결과를 docs/reports/2026-MM-DD-similar-cases-bootstrap.md 로 기록
```

**주의**:
- 부트스트랩 1회 실측 결과로 T0-2 (drfopTmdt 형식) / T0-3 (bizSize 분포) / T0-5 (eiaAddrTxt multi-region) 검증 데이터 확보.
- 실패 시 `eia_cases_sync.error_message` 확인 후 fix-forward.

### 3.3 cron trigger 활성화
```bash
# 사용자 실행
cd C:/0_project/eia-workbench
cat workers/cases-indexer.wrangler.toml | grep -A2 "\[triggers\]"
# 기대: crons = ["0 18 * * 0"]  (매주 일요일 18:00 UTC = 한국 월요일 03:00)
wrangler deploy --config workers/cases-indexer.wrangler.toml
```

### 3.4 모니터링
- `eia_cases_sync` 테이블 주간 점검 (`SELECT * FROM eia_cases_sync ORDER BY started_at DESC LIMIT 10`)
- Cloudflare Logs → cases-indexer worker 알람 설정 (records_skipped > 100 시 통보)
- 한도 사용률 = `api_calls / 10,000` (일 한도) — 주간 평균 80% 초과 시 cap 재조정 검토.

---

## 4. 주요 파일 & 디렉터리 인덱스

### 4.1 spec / plan / 리포트
- `docs/design/feature-similar-cases.md` — spec v0 (§1-§12, 데이터셋 15142998 + 컬럼 매핑 정합화 패치 9건 적용본)
- `docs/plans/feature-similar-cases.md` — plan v0 (Phase 0-7, 36 task)
- `docs/reports/2026-04-25-similar-cases-completion.md` — Phase 0-7 산출물 inventory
- `docs/reports/2026-04-25-similar-cases-domain-review.md` — §9.3 6/6 PASS 표
- `docs/reviews/feature-similar-cases.md` — 핵심 결정 + 단정어 가드 + 운영 위험
- `docs/reviews/feature-similar-cases-pr-body.md` — PR body 원문

### 4.2 코드 모듈
- `packages/eia-data/src/endpoints/draft-display.ts` — 15142998 4 endpoint helper
- `packages/eia-data/src/portal-client.ts` — `PortalClient.call` (timeout / retry / redact)
- `src/features/similar-cases/transform.ts` — raw API → derived 컬럼 변환
- `src/features/similar-cases/payload-whitelist.ts` — `source_payload` 화이트리스트
- `src/features/similar-cases/region-parser.ts` — `eiaAddrTxt` → sido/sigungu
- `src/features/similar-cases/wind-filter.ts` — `bizGubunCd ∈ {C,L}` + `bizNm` 정규식
- `src/features/similar-cases/sido-lut.ts` — KOSTAT 17 시·도 LUT
- `src/features/similar-cases/markdown-export.ts` — 표 + EIASS deep-link + disclaimer
- `src/features/similar-cases/search-query.ts` — FTS5 prefix MATCH + LIKE fallback + facet AND/OR

### 4.3 인프라 / API
- `migrations/0003_similar_cases.sql` — `eia_cases` + FTS5 unicode61 + `eia_cases_sync` + 트리거
- `workers/cases-indexer.ts` — 주 1회 cron, stage-and-swap 인덱서
- `workers/cases-indexer.wrangler.toml` — cron 설정
- `scripts/cases-bootstrap.ts` — 1회 수동 부트스트랩 헬퍼
- `src/pages/api/cases/index.ts` — `GET /api/cases` (FTS5 + facet + Q7 PII-safe logging)
- `src/pages/api/cases/[caseId].ts` — `GET /api/cases/[caseId]` 단건

### 4.4 UI
- `src/pages/cases/index.astro` — `/cases` SSR shell + nav + 인트로 disclaimer
- `src/pages/cases/[caseId].astro` — 모바일 fallback 상세 페이지
- `src/components/cases/CaseSearchPage.tsx` — React island (debounce 300ms · URL replaceState)
- `src/components/cases/CaseFacetPanel.tsx` — 시·도 / 규모 / 평가시기 (OR within, AND across)
- `src/components/cases/CaseResultCard.tsx` — 결과 카드
- `src/components/cases/CasePreviewPane.tsx` — 데스크톱 미리보기
- `src/components/cases/CaseSearchGuide.tsx` — 어두 매칭 한계 가이드

### 4.5 테스트
- `tests/unit/similar-cases/*.test.ts` — 50+ 단위 테스트
- `tests/e2e/cases-search-happy.spec.ts` — 강원 풍력 검색 → article ≥ 1
- `tests/e2e/cases-facet-combo.spec.ts` — 시·도 OR + 규모 AND
- `tests/e2e/cases-axe.spec.ts` — moderate+ violations 0
- `tests/e2e/cases-lighthouse.spec.ts` — 수동 stub
- `tests/e2e/fixtures/cases-seed.sql` — TESTSEED-* 4건 (CI E2E 용)

### 4.6 가드
- `scripts/assertion-grep.sh` — 전역 단정어 차단
- `scripts/check-similar-cases-assertions.sh` — feature 전용 5종 단정어
- `.github/workflows/ci.yml` — 두 가드 모두 step 화

---

## 5. 누적 findings / 미해결

### 5.1 사용자 deferred (Phase 0)
- **T0-2** `drfopTmdt` 실제 형식 — 부트스트랩 1회 실측 후 `evaluation_year` 파싱 로직 검증 필요. `transform.ts` 의 `extractYear()` 가 fallback 처리 중.
- **T0-3** `bizSize` 분포 — 캘리브레이션 데이터 미확보. `capacity_mw` 추출이 정규식 의존.
- **T0-5** `eiaAddrTxt` multi-region 사례 — 단일 sido 가정. 실측 후 multi-region 컬럼 도입 결정.

### 5.2 운영 미적용 (사용자 수동)
- D1 0003 migration 운영 적용 (PR 머지 후)
- cron trigger deploy
- 부트스트랩 1회 실측

### 5.3 v1 후보 (별도 plan)
- 관련도순 정렬 (BM25 weight tuning) — 현재 `evaluation_year DESC`
- n-gram 한국어 토크나이저 (어두 매칭 한계 해소)
- 추가 데이터셋: 15142987 (전략) / 15142988 (소규모)
- multi-region 컬럼 (T0-5 결과 기반)
- scoping ↔ similar-cases 결합 (해당 facet 시뮬레이션)
- ADR 0001 보강 commit (별도 PR — SERVICE_KEY rate-limit / 부트스트랩 절차 / 한도 가드 운영 메모)

---

## 6. 자주 쓰는 명령

```bash
# 검증 chain
npm run typecheck && npm run lint && npm test
bash scripts/assertion-grep.sh
bash scripts/check-similar-cases-assertions.sh
npm run build
grep -r "SERVICE_KEY=" dist/ || echo "OK (no leak)"

# 로컬 D1 + seed
wrangler d1 migrations apply DB --local
wrangler d1 execute DB --local --file=tests/e2e/fixtures/cases-seed.sql

# E2E
npm run test:e2e -- tests/e2e/cases-search-happy.spec.ts
npm run test:e2e -- tests/e2e/cases-facet-combo.spec.ts
npm run test:e2e -- tests/e2e/cases-axe.spec.ts

# Lighthouse (수동)
npm run dev &
npx lhci collect --url=http://localhost:3000/cases

# PR 상태 폴링
gh pr checks <NUMBER> --watch
```

---

## 7. 트러블슈팅 / 복구 절차

### 7.1 push 가 hook 에 또 막힘
- 본 문서 §0.5-1 + §2.1 적용. 사용자가 worktree 에서 직접 push.
- Claude 는 `git push` 시도 자체를 하지 말고 명령 블록만 제시.

### 7.2 PR CI red 패턴별 대응
| CI 단계 | red 원인 | 대응 |
|---|---|---|
| typecheck | `verbatimModuleSyntax` 위반, `noUncheckedIndexedAccess` 미체크 | 즉시 fix-forward (Edit + commit) |
| lint | prettier 자동 포맷 누락, eslint rule 위반 | `npm run format` + commit |
| test | flaky timing, fixture 미적용 | systematic-debugging Phase 1 진입 |
| assertion-grep | UI/테스트에 단정 표현 들어감 | 해당 문자열 "가능성/확인 필요" 로 교정 |
| build | island import 순환, 누락된 export | bundle 분석 + 최소 변경 fix |
| E2E | seed 미적용, Turnstile race | `cases-seed.sql` apply 확인, helper login retry |

### 7.3 부트스트랩 실패
- `eia_cases_sync.error_message` 확인 → SERVICE_KEY rate-limit 인지, 데이터셋 응답 shape 변경인지 분류.
- shape 변경 시 `packages/eia-data/src/endpoints/draft-display.ts` zod 스키마 patch + 회귀 테스트.

### 7.4 hook 충돌 / 환경 문제
- `git config --local core.hooksPath` 확인.
- `.husky/` 또는 `.git/hooks/` 의 pre-push hook 검토 — 단, hook 우회 (`--no-verify`) 는 절대 금지 (CLAUDE.md §9.5).

### 7.5 ctx 85% 도달
1. 진행 상황 1줄 요약 사용자에게 보고.
2. `/compact` 실행 (§0.2 규칙 적용).
3. 다음 액션 한 가지만 선택 후 진행.

---

## 8. 세션 종료 절차

PR 머지 + 운영 적용 완료 시:

1. `progress.md` 갱신 (similar-cases v0 운영 배포 entry 추가).
2. `docs/changelog/session_log.md` 에 한 줄 추가.
3. TaskList `#174` (Phase 7) 를 completed 로 마킹.
4. v1 후보를 별도 plan 으로 분리할지 사용자 결정 대기.
5. ADR 0001 보강 commit 별도 PR 작성 (운영 절차 메모).

---

**끝.** 본 문서가 다음 세션의 단일 진입점. 이 문서만 읽고 §2.3 의 컨텍스트 로드 순서를 따르면 작업이 끊김 없이 이어진다.
