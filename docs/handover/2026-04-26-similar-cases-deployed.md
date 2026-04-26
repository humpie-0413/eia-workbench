# 인계 문서 — similar-cases v0 운영 배포 완료
**작성**: 2026-04-26
**전제 문서**: `docs/handover/2026-04-25-similar-cases-handover.md` (PR/머지 직전 상태). 본 문서는 머지·hotfix 9건·운영 검증 완료 시점의 후속 인계.
**다음 세션 시작 시 가장 먼저 읽을 것** (5~10분 정독 후 작업 재개)

---

## 0. 컨텍스트 관리 규칙 (매 세션 필독)

### 0.1 Claude Code 컨텍스트 한계
- 200k 토큰 하드 리밋
- 60~70% 도달 시 `/compact` 또는 `/clear`
- 80% 초과 시 즉시 강제 `/compact`
- 85% 도달 시 사용자 보고 (스톱 게이트)

### 0.2 Phase 경계 강제 /compact
각 Phase / hotfix 완료 직후, git commit 직후:

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
각 Phase / hotfix 종료 시 순서:
1. `git add` + `git commit` (요약)
2. `docs/changelog/session_log.md` 에 한 줄 추가
3. `/compact` (0.2 규칙)
4. 다음 Phase 시작

### 0.5 사용자 정책 — 스톱 게이트 7개
1. **main push 금지** — 사용자가 실행. Claude 는 commit 까지.
2. **Cloudflare 원격 리소스 변경 금지** — D1 원격 migration 포함, `--local` 만 허용. 운영 변경은 사용자 수동.
3. **법령 수치·spec 임의 수정 금지** — `docs/findings/` 에 기록만, 결정은 사용자.
4. **민감값 (SERVICE_KEY, APP_PASSWORD, JWT_SECRET, TURNSTILE_SECRET_KEY) 출력·로그 금지** — 키 이름만, 값은 절대 chat 노출 금지.
5. **findings 누적 20개 초과 시 중단** — 사용자에게 요약 보고 후 우선순위 협의.
6. **동일 명령 5회 연속 실패 시 해당 task skip** — 다음 task 로 진행, findings 에 기록.
7. **ctx 85% 도달 시 강제 중단 + /compact 보고** — 사용자에게 진행 상황 1줄 요약 후 compact 실행.

### 0.6 CLAUDE.md §10 신규 규칙 (2026-04-26 추가)
- **§10.1 사전 결함 자동 제외** — baseline (현재 main HEAD 이전) 에서도 발생하는 실패 / 본 작업 diff 와 무관한 파일의 실패 / `npm install` 만으로 해결되는 환경 문제는 검증 기준에서 자동 제외. 별도 hotfix PR 로만 처리.
- **§10.2 블로킹 시 디폴트 액션** — 의사결정 필요할 때 사용자에게 "선택지 N개" 묻지 말고, 가장 안전·reversible 한 디폴트를 즉시 실행하고 사후 보고. 예외 3종: ① 코드 영구 삭제 ② 운영 데이터 영구 변경 ③ secret 다루는 작업.

---

## 1. 프로젝트 현재 상태

### 1.1 main 브랜치 (운영 배포 완료)
- HEAD: `49a0678` (`fix(cases-ui): rename '승인기관' label to '협의기관' (data is ccilOrganNm)`)
- main = origin/main 동기화 완료 (사용자 push 완료)

### 1.2 운영 기능 인벤토리
- **scoping-assistant v2** (PR #7, squash `47c960b`, 2026-04-25 머지) — 운영 배포 완료, 5 rule pack (onshore_wind), 스모크 PASS.
- **similar-cases v0** (PR #8, squash `4ad871d`, 2026-04-26 머지) — 운영 배포 완료, 풍력 10건 적재, 사용자 브라우저 검증 4건 PASS.

### 1.3 similar-cases v0 사용자 검증 결과 (2026-04-26)
| 검증 항목 | 결과 | 비고 |
|---|---|---|
| `/cases` 검색 페이지 렌더링 | PASS | 인트로 disclaimer 노출 |
| 검색어 "풍력" → 10건 결과 | PASS | facet 패널 동작 |
| 미리보기 패널 (CasePreviewPane) | PASS | 데스크톱에서 기본 펼침 |
| EIASS deep-link 클릭 → 외부 이동 | PASS | hotfix 후 404 해소 |
| Markdown export (10건 / 풍력 필터) | PASS | `docs/cases-2026-04-26.md` 산출물 보존 |

---

## 2. 운영 환경

### 2.1 URL / 자원
- **운영 URL**: https://eia-workbench-v0.pages.dev (Cloudflare Pages 프로덕션)
- **D1 binding**: `DB`
- **D1 database_name**: `eia-workbench-v0`
- **D1 database_id**: `afca9a24-7725-4530-8c49-e3d001bd24d8`
- **R2 bucket**: `eia-workbench-v0-uploads` (similar-cases 는 R2 미사용)

### 2.2 적용된 D1 migrations (운영 D1)
| 번호 | 파일 | 적용일 | 내용 |
|---|---|---|---|
| 0001 | `migrations/0001_init.sql` | 2026-04-22 | login_attempts / projects / uploads / d1_migrations |
| 0002 | `migrations/0002_scoping.sql` | 2026-04-25 (PR #7 머지 후) | scoping_runs |
| 0003 | `migrations/0003_similar_cases.sql` | 2026-04-26 (PR #8 머지 후) | eia_cases / eia_cases_fts (FTS5 unicode61) / eia_cases_staging / eia_cases_sync + 트리거 |
| 0004 | `migrations/0004_relax_cases_constraints.sql` | 2026-04-26 (hotfix) | NOT NULL 완화 (region / capacity_mw / evaluation_year 등) — bizSize·eiaAddrTxt 빈 값 인덱싱 허용 |

### 2.3 Secrets (운영 Pages, `wrangler pages secret put` 으로 주입됨)
- `APP_PASSWORD` — 파일럿 로그인
- `JWT_SECRET` — HS256
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile
- `SERVICE_KEY` — data.go.kr 일반 인증키 (similar-cases 인덱서가 사용)

### 2.4 Workers
- `eia-workbench-cleanup` — `workers/cleanup.wrangler.toml`, cron `0 18 * * *` (03:00 KST). 운영 활성.
- `eia-workbench-cases-indexer` — `workers/cases-indexer.wrangler.toml`, cron `0 18 * * 0` (월요일 03:00 KST 주 1회). **현재 비활성 — invalid cron string 에러로 wrangler deploy 미실행** (한계 §3.4 참조).

### 2.5 부트스트랩 (1회 실측 완료)
- 사용자 수동 실행 완료. 결과: `eia_cases` 풍력 10건 적재 (전체 75건 중 onshore_wind filter 통과).
- 적재 source 데이터셋: **15142987** (협의현황) — 15142998 (초안 공람정보) 부적합 확인 후 hotfix 로 교체.
- `eia_cases_sync` 테이블에는 sync 행이 INSERT 되지 않음 (한계 §3.5 참조).

---

## 3. 알려진 한계 — 다음 hotfix 후보

### 3.1 evaluation_stage='unknown' (모든 10건)
- **증상**: `eia_cases.evaluation_stage` 컬럼이 적재된 10건 모두 `unknown`. UI 표 (`docs/cases-2026-04-26.md`) 의 "단계" 열도 `unknown` 일관.
- **근인 추정**: 15142987 list 응답 (현재 인덱서 입력) 에 evaluation_stage 와 매핑 가능한 컬럼이 없음. detail API (별도 endpoint) 통합 시 보정 필요.
- **분류**: **P1 / cases / data-completeness**

### 3.2 region NULL (모든 10건)
- **증상**: `eia_cases.region_sido` 가 모두 NULL. UI 표 "위치" 열이 빈 문자열로 노출.
- **근인 추정**: 동일 — list 응답에 `eiaAddrTxt` 가 없거나 빈 값. region-parser 가 입력 빈 값을 스킵.
- **분류**: **P1 / cases / data-completeness** (3.1 과 동일 PR 로 처리 가능)

### 3.3 approv_organ_nm 컬럼명·값 misalignment
- **증상**: 컬럼명은 `approv_organ_nm` (승인기관) 인데 실제 채워지는 값은 list 응답의 `ccilOrganNm` (협의기관). UI 라벨은 hotfix `49a0678` 으로 "협의기관" 로 정정했으나 컬럼명은 그대로.
- **근인 추정**: 15142998 (초안 공람정보, 승인기관 의미) → 15142987 (협의현황, 협의기관 의미) 데이터셋 교체 시 컬럼명 변경이 누락됨.
- **분류**: **P3 / cases / schema-clarity** (운영 영향 없음, 의미 명확화)

### 3.4 cron 자동 활성화 안 됨 (`invalid cron string`)
- **증상**: `wrangler deploy --config workers/cases-indexer.wrangler.toml` 실행 시 cron 문법 에러로 등록 실패. 현재 인덱서는 사용자 수동 트리거로만 실행됨.
- **근인 추정**: 미확인. `crons = ["0 18 * * 0"]` 자체는 표준 cron 문법이지만 wrangler 가 reject. Cloudflare Workers 플랫폼 측 제약 가능성 (예: Pages 계정에서 Worker cron 등록 권한, 또는 동일 계정에 cleanup worker 와 cron 충돌).
- **분류**: **P2 / cases / cron-trigger**

### 3.5 eia_cases_sync 빈 응답 (인덱서가 sync 행 INSERT 안 함)
- **증상**: 부트스트랩 실행 후 `SELECT * FROM eia_cases_sync` 결과 0행. 본래 인덱서가 시작·종료 시 sync 행을 INSERT 하기로 spec 에 명시되어 있음.
- **근인 추정**: `workers/cases-indexer.ts` 의 sync row INSERT 경로가 hotfix 과정에서 skip 되거나, INSERT 실패가 silent 하게 무시됨.
- **분류**: **P2 / cases / observability** (운영 모니터링 차단)

### 3.6 T0-2 / T0-3 / T0-5 미실측 (Phase 0 deferred 잔존)
- **T0-2** `drfopTmdt` 실제 형식 — `evaluation_year` 파싱 검증 미완.
- **T0-3** `bizSize` 분포 — capacity_mw 정규식 검증 미완.
- **T0-5** `eiaAddrTxt` multi-region — 단일 sido 가정 검증 미완.
- **현황**: 부트스트랩 1회 실측 완료했으나 적재 데이터가 10건뿐이라 분포 캘리브레이션 부족. 추가 데이터셋 (15142988 소규모 등) 부트스트랩 후 v1 plan 으로.
- **분류**: **P3 / cases / calibration** (v1 후보)

---

## 4. 다음 작업 후보 (우선순위)

### P1 — detail API 통합 (한계 §3.1 + §3.2 동시 해결)
- 15142987 의 detail endpoint 호출 → `eiaAddrTxt`, evaluation_stage 매핑 가능 컬럼 확보 → `transform.ts` 보정 → 풍력 10건 재인덱싱.
- **결과 예상**: `evaluation_stage` 가 unknown 외 값으로 채워지고, region_sido 가 NULL 아닌 값으로 채워짐.
- **선결 조건**: 15142987 detail API 의 응답 shape 사용자 확인 (Postman / 브라우저 직접) 또는 인덱서가 detail 1건 호출 후 raw payload 를 `console.log` 로 노출 → 사용자 캡처.

### P2 — cron trigger 등록 디버깅 (한계 §3.4)
- `wrangler deploy --config workers/cases-indexer.wrangler.toml --dry-run` 으로 reject 메시지 정확히 확보.
- Cloudflare Workers cron triggers 문서 재확인 (계정 한도, Pages 계정 vs Workers 계정 차이).
- **임시 우회**: 사용자 수동 트리거를 주 1회 캘린더 reminder 로 운영하면 단기 무리 없음.

### P2 — eia_cases_sync 행 INSERT 누락 (한계 §3.5)
- `workers/cases-indexer.ts` 의 sync row 경로에 `console.log` 추가 → 부트스트랩 재실행 → 어디서 누락되는지 확인.
- 가장 흔한 패턴: try/catch 안에서 INSERT 실패가 swallowed 되는 케이스.

### P3 — approv_organ_nm 컬럼명 정정 (한계 §3.3)
- migration 0005 로 `ALTER TABLE eia_cases RENAME COLUMN approv_organ_nm TO consult_organ_nm`. 부트스트랩 코드·UI 라벨도 이미 협의기관 의미로 통일된 상태이므로 컬럼명만 정합화.
- D1 의 `ALTER TABLE ... RENAME COLUMN` 지원 여부 사전 확인 (지원 안 하면 staging 테이블 swap 패턴).

### P3 — bizSize / region 다중 / evaluation_year 검증 (한계 §3.6)
- 추가 데이터셋 (15142988 소규모 / 15142989 변경협의 등) 부트스트랩 → 분포 캘리브레이션.
- 결과 기반으로 multi-region 컬럼 도입 여부 결정.

---

## 5. 핵심 파일 위치

### 5.1 인덱서 / 데이터 계약
- `workers/cases-indexer.ts` — 메인 인덱서 (list → transform → stage → swap)
- `workers/cases-indexer.test.ts` — 인덱서 단위 테스트
- `workers/cases-indexer.wrangler.toml` — cron 설정 (현재 미적용)
- `migrations/0003_similar_cases.sql` — eia_cases / FTS5 / staging / sync
- `migrations/0004_relax_cases_constraints.sql` — NOT NULL 완화 (hotfix)
- `scripts/cases-bootstrap.ts` — 1회 부트스트랩 헬퍼

### 5.2 packages/eia-data (data.go.kr 클라이언트)
- `packages/eia-data/src/portal-client.ts` — `PortalClient.call` (`_type=json` 강제, timeout/retry/redact)
- `packages/eia-data/src/endpoints/discussion.ts` — 15142987 협의현황 endpoint helper
- `packages/eia-data/src/endpoints/draft-display.ts` — 15142998 초안 공람정보 helper (현재 인덱서 미사용, v1 후보)
- `packages/eia-data/src/types/discussion.ts` — 15142987 list/detail zod 스키마 (perCd PK)
- `packages/eia-data/src/types/draft-display.ts` — 15142998 zod 스키마
- `packages/eia-data/src/deep-link.ts` — `eiassProjectUrl()` (hotfix 후 `/biz/base/info/searchListNew.do?menu=biz&sKey=BIZ_CD&sVal=...` 형식)
- `packages/eia-data/src/index.ts` — 패키지 exports

### 5.3 features/similar-cases (transform / filter / search)
- `src/features/similar-cases/transform.ts` — list 응답 → eia_cases 행 변환
- `src/features/similar-cases/wind-filter.ts` — `bizGubunCd ∈ {C,L}` + `bizNm` 정규식
- `src/features/similar-cases/region-parser.ts` — `eiaAddrTxt` → sido/sigungu
- `src/features/similar-cases/sido-lut.ts` — KOSTAT 17 시·도 LUT
- `src/features/similar-cases/payload-whitelist.ts` — `source_payload` 화이트리스트 (재호스팅 차단)
- `src/features/similar-cases/search-query.ts` — FTS5 prefix MATCH + LIKE fallback + facet AND/OR
- `src/features/similar-cases/markdown-export.ts` — 표 + EIASS deep-link + disclaimer

### 5.4 UI (Astro + React island)
- `src/pages/cases/index.astro` — `/cases` SSR shell + nav + 인트로 disclaimer
- `src/pages/cases/[caseId].astro` — 모바일 fallback 상세 페이지
- `src/components/cases/CaseSearchPage.tsx` — React island (debounce 300ms · URL replaceState)
- `src/components/cases/CaseFacetPanel.tsx` — 시·도 / 규모 / 평가시기 (OR within, AND across)
- `src/components/cases/CaseResultCard.tsx` — 결과 카드
- `src/components/cases/CasePreviewPane.tsx` — 데스크톱 미리보기 (hotfix 후 "협의기관" 라벨)
- `src/components/cases/CaseSearchGuide.tsx` — 어두 매칭 한계 가이드

### 5.5 API
- `src/pages/api/cases/index.ts` — `GET /api/cases` (FTS5 + facet + Q7 PII-safe logging)
- `src/pages/api/cases/[caseId].ts` — `GET /api/cases/[caseId]` 단건

---

## 6. 활성 skills + 컨텍스트 관리 규칙 재확인

### 6.1 항상 활성 (세션 시작 시 자동 로드)
- `superpowers:using-superpowers` — 모든 skill 진입점
- `superpowers:brainstorming` — 새 기능 진입 시 자동
- `superpowers:writing-plans` — `/office-hours` 후 계획서 작성
- `superpowers:executing-plans` — plan 실행 시
- `superpowers:subagent-driven-development` — 36 task 분해 실행
- `superpowers:using-git-worktrees` — feature 브랜치 = 별도 worktree
- `superpowers:systematic-debugging` — 근인 우선 디버깅
- `superpowers:test-driven-development` — TDD 강제
- `superpowers:finishing-a-development-branch` — PR/머지 마감 절차
- `superpowers:verification-before-completion` — 완료 전 검증
- `superpowers:requesting-code-review` / `superpowers:receiving-code-review`

### 6.2 활성 + 컨텍스트 관리 규칙 (CLAUDE.md §10 신규)
- §10.1 사전 결함 자동 제외 — baseline 에서도 발생하는 실패는 별도 hotfix PR 로
- §10.2 블로킹 시 디폴트 액션 — 사용자에게 선택지 묻지 말고 안전·reversible 디폴트 즉시 실행 후 보고

### 6.3 본 프로젝트 도메인 가드 (CLAUDE.md §9.3)
- 6 항목 도메인 리뷰 (① 법적 결론 단정 ② 현지조사 대체 ③ EIASS 원문 재호스팅 ④ 의견 임의 축약 ⑤ 결과 객체 표준 스키마 ⑥ 법령 숫자 원문 대조)

---

## 7. 자주 쓰는 명령

### 7.1 검증 chain (커밋 전 필수)
```bash
npm run typecheck && npm run lint && npm test
bash scripts/assertion-grep.sh
bash scripts/check-similar-cases-assertions.sh
npm run build
grep -r "SERVICE_KEY=" dist/ || echo "OK (no leak)"
```

### 7.2 wrangler dev (인덱서 수동 트리거 / 로컬)
```bash
# 인덱서 dev 모드 (cron 비활성, HTTP trigger 만)
cd C:/0_project/eia-workbench
wrangler dev --config workers/cases-indexer.wrangler.toml --local

# 별도 터미널에서 trigger
curl http://localhost:8787/__scheduled
```

### 7.3 D1 query (운영)
```bash
# 적재 건수 확인
wrangler d1 execute DB --remote --command "SELECT COUNT(*) FROM eia_cases"

# 풍력 10건 샘플
wrangler d1 execute DB --remote --command "SELECT eia_cd, biz_nm, region_sido, evaluation_stage, evaluation_year FROM eia_cases LIMIT 10"

# sync 행 점검 (현재 빈 결과 — 한계 §3.5)
wrangler d1 execute DB --remote --command "SELECT * FROM eia_cases_sync ORDER BY started_at DESC LIMIT 10"
```

### 7.4 D1 query (로컬)
```bash
wrangler d1 migrations apply DB --local
wrangler d1 execute DB --local --file=tests/e2e/fixtures/cases-seed.sql
wrangler d1 execute DB --local --command "SELECT COUNT(*) FROM eia_cases"
```

### 7.5 빌드 / 배포 (사용자 수동)
```bash
# 빌드 (Pages 자동 빌드와 동일 — 로컬 검증용)
npm run build

# Pages 배포 (사용자 수동, Claude 금지)
# git push origin main → Cloudflare Pages 자동 빌드 트리거

# 인덱서 worker 재배포 (사용자 수동, cron 등록 디버깅 시)
wrangler deploy --config workers/cases-indexer.wrangler.toml
```

---

## 8. 트러블슈팅 (오늘 만난 5가지 문제 + 해결 패턴)

### 8.1 list 응답 zod schema fail (5건 동일 패턴)
- **증상**: 부트스트랩 시 `wrangler dev` 로그에 `list_schema_fail` 5건. `kind="list_schema_fail", stage="strategy", bizGubn=...` 패턴.
- **근인**: 전략환경영향평가 (perCd PK) 와 일반 환경영향평가 (eiaCd PK) 의 list 스키마가 다름. 단일 스키마로 처리하려다 실패.
- **해결**: list 와 detail 스키마를 `strategy` (perCd) / `general` (eiaCd) 로 분리. commit `5cea609` `fix(cases-indexer): split strategy list/detail schema (perCd PK)`.
- **패턴**: 동일 데이터셋 안에 다른 PK 체계가 있을 수 있음. 응답 shape 변경 의심 시 raw payload 첫 5건 `console.log` 로 확인 (`6b20062 chore(cases-indexer): log first 5 zod fail issues for diagnosis`).

### 8.2 데이터셋 15142998 (초안 공람정보) 부적합
- **증상**: 15142998 부트스트랩 결과 풍력 0건 (전체 15건). "공람 진행 중" 윈도우만 노출하는 데이터셋이라 사례 검색 용도로 부적합.
- **해결**: 사용자 직접 검증으로 대안 데이터셋 비교 → 15142987 (협의현황) 채택. spec patch (`157279c`) + 인덱서 교체 (`5a8536a`).
- **패턴**: data.go.kr 데이터셋은 동일 키워드라도 lifecycle 의 다른 단계를 다룸. spec 에 데이터셋 ID 박을 때 사용자 직접 PostMan/브라우저 검증 필수.

### 8.3 EIASS deep-link 404
- **증상**: 미리보기 패널의 "원문" 링크 클릭 시 EIASS 사이트 404.
- **근인**: 기존 `eiassProjectUrl()` 의 URL 형식이 EIASS 라우팅과 불일치 (`/proj/view.do?projCd=...`).
- **해결**: 사용자 직접 EIASS 사이트 탐색으로 정확한 형식 확보 → `/biz/base/info/searchListNew.do?menu=biz&sKey=BIZ_CD&sVal=...`. commit `2447043`.
- **패턴**: 외부 사이트 deep-link 는 라우팅이 자주 바뀜. 단위 테스트로 URL 형식만 검증하지 말고 사용자가 실제 클릭 검증.

### 8.4 portal-client XML 응답 (15142998 디폴트)
- **증상**: 15142998 호출 시 zod 가 첫 토큰부터 fail. 응답 본문이 XML.
- **근인**: data.go.kr OpenAPI 는 `_type` 쿼리 파라미터 미지정 시 데이터셋별 디폴트 (XML/JSON) 가 다름. 15142998 디폴트는 XML.
- **해결**: `PortalClient.call` 에서 `_type=json` 강제 주입. commit `356674b`.
- **패턴**: 외부 API 디폴트는 신뢰하지 말고 명시적으로 형식 지정.

### 8.5 UI "승인기관" vs 데이터 의미 misalignment
- **증상**: 미리보기 패널에 "승인기관" 라벨이 떠 있는데 실제 표시값은 협의기관 (15142987 의 `ccilOrganNm` = 협의기관).
- **해결**: 데이터셋이 협의현황으로 바뀌었으니 UI 라벨도 "협의기관" 으로 정정. commit `49a0678`. (컬럼명 `approv_organ_nm` 정합화는 한계 §3.3 / 별도 hotfix.)
- **패턴**: 데이터셋 교체 시 컬럼명·라벨·문구 3종을 동시 점검. spec 에 데이터셋 ID + 의미 매핑 표 유지 권장.

---

**끝.** 본 문서가 다음 세션의 단일 진입점. 4개 follow-up GitHub Issue 텍스트는 본 commit 의 `docs/issues/2026-04-26-cases-followup-{P1-detail,P2-cron,P2-sync,P3-organnm}.md` 가 아니라 사용자가 별도로 GitHub 에 등록 (Claude 는 텍스트만 출력, 등록은 사용자).
