# similar-cases v0 — 완료 리포트 (2026-04-25)

**브랜치:** feature/similar-cases (29 task commits + 1 prettier-format)
**기준 plan:** `docs/plans/feature-similar-cases.md` (Phase 0–7, 36 tasks)
**상태:** 코드/문서 완료 · 로컬 검증 green · PR 생성 준비됨

## 산출물

### Phase 0 — 사전 검증 (T0-1, T0-4)
- `packages/eia-data/src/endpoints/draft-display.ts` + zod 스키마 4 operation
- spec §4.3 `eia_cd` 충돌 처리 6 단계 순서 명시
- T0-2 / T0-3 / T0-5 는 사용자 deferred (실제 페이로드 분포 필요)

### Phase 1 — 인덱싱 워커 (T1-1 ~ T1-7)
- `PortalClient.call` (timeout / retry / redact)
- draft-display 4 endpoint helper (`mainList`, `mainViewL`, `appraisalList`, `appraisalViewL`)
- wind-filter (`bizGubunCd ∈ {C,L}` + `bizNm` 정규식)
- KOSTAT 17 시·도 LUT + region-parser
- transform pipeline (raw API → derived 컬럼) + source_payload 화이트리스트
- `workers/cases-indexer.ts` (주 1회 cron, stage-and-swap)

### Phase 2 — D1 + 부트스트랩 (T2-1 ~ T2-3)
- migration `0003_similar_cases.sql`: `eia_cases` + FTS5 (unicode61) + `eia_cases_sync` + 트리거
- `scripts/cases-bootstrap.ts` 1회 수동 부트스트랩 가이드
- T2-3 (라이브 부트스트랩 실측) 은 SERVICE_KEY 운영 환경에서 USER 직접 실행

### Phase 3 — 검색 API (T3-1 ~ T3-4)
- `EiaCase` / `CaseSearchResult` 타입 + `caseSearchQuerySchema` zod
- `search-query.ts`: FTS5 prefix MATCH (q.length>3) / LIKE fallback (≤3) / facet AND across · OR within
- `GET /api/cases` + `GET /api/cases/[caseId]` (Q7 비로깅: PII는 길이만 기록)

### Phase 4 — UI (T4-1 ~ T4-6)
- `AppLayout` nav 도입 (projects / cases) + `aria-current`
- `/cases` 페이지 + `CaseSearchPage` island (debounce 300ms · URL replaceState)
- `CaseFacetPanel` (시·도 / 규모 / 평가시기 — OR within, AND across)
- `CaseResultCard` / `CasePreviewPane` / `CaseSearchGuide` (어두 매칭 설명)
- `/cases/[caseId]` mobile fallback 상세 페이지 (서버 D1 직조회)
- `/projects/[id]` → `/cases?sido=...&capacity_band=...` 프리필 링크

### Phase 5 — Markdown export (T5-1 ~ T5-2)
- `markdown-export.ts`: 표(eiaCd / 사업명 / 위치 / 규모 / 평가시기 / 단계 / EIASS 링크) + filter 헤더 + 현지조사 한계 disclaimer + 파이프 escape
- 5 단위 테스트 (header / 미상 fallback / multi-value / pipe escape / disclaimer)
- 검색 페이지 export 버튼 hookup (results 0건 시 disabled)

### Phase 6 — E2E + 가드 (T29 ~ T33)
- `tests/e2e/cases-search-happy.spec.ts`: 강원 풍력 검색 → article ≥ 1 + EIASS deep-link
- `tests/e2e/cases-facet-combo.spec.ts`: 강원 OR 전남 + 10-50 MW → URL params + region 일치
- `tests/e2e/cases-axe.spec.ts`: moderate+ violations 0
- `tests/e2e/cases-lighthouse.spec.ts`: 수동 stub (네트워크 throttling 충돌 회피)
- `tests/e2e/fixtures/cases-seed.sql`: 4 synthetic 육상풍력 (TESTSEED-* prefix; EIASS 무관)
- `scripts/check-similar-cases-assertions.sh`: 5종 단정어 차단 + CI step

### Phase 7 — 도메인 리뷰 + 리포트 (T34 ~ T36)
- `docs/reports/2026-04-25-similar-cases-domain-review.md`: §9.3 6/6 PASS
- 본 완료 리포트 + review note + progress/session_log 갱신
- T36: PR 생성 (`finishing-a-development-branch` Option 2)

## 검증 결과

| 단계 | 결과 |
|---|---|
| `npm run typecheck` | 0 errors / 0 warnings (137 files) |
| `npm run lint` | clean (eslint + prettier) |
| `npm test` | 258 passed (48 files) |
| `bash scripts/assertion-grep.sh` | clean |
| `bash scripts/check-similar-cases-assertions.sh` | clean |
| `npm run build` | success — `CaseSearchPage.js` 62.97 kB / gzip 15.76 kB |
| `grep SERVICE_KEY= dist/` | OK (no leak) |
| §9.3 도메인 리뷰 | 6/6 PASS |

## 부트스트랩 1회 실측

USER 가 운영에서 별도 실행. 다음 메트릭 기록 위치:
- `eia_cases_sync.records_added` / `records_skipped` / `error_message`
- 한도 사용률 = api_calls / 10,000 (일 한도)

부트스트랩 절차는 `scripts/cases-bootstrap.ts` 헤더 주석 참조.

## 미해결 / v1 후보

- 관련도순 정렬 (BM25 weight tuning) — 현재는 evaluation_year DESC
- n-gram 한국어 토크나이저 (`사업명 어두만 매칭` 한계 해소)
- 추가 데이터셋: 15142987 / 15142988 (전략·소규모)
- multi-region 컬럼 (T0-5 결과로 결정)
- scoping ↔ similar-cases 결합 ("해당 facet 으로 시뮬레이션")

## 운영 절차

1. cron 트리거 활성화 — `workers/cases-indexer.wrangler.toml` 의 `[triggers].crons` 이미 등록됨, 운영 deploy 필요.
2. `eia_cases_sync` 모니터링 — `records_skipped` / `error_message` 알람 필요 (Cloudflare Logs / 별도 dashboard).
3. ADR 0001 보강 commit — SERVICE_KEY rate-limit / 부트스트랩 절차 / 한도 가드 운영 메모 (별도 PR).

## 도메인 리뷰 요약

§9.3 6 항목 모두 PASS. 단정어 grep 가드 2단(전역 + similar-cases 전용) CI 차단. EIASS 본문 재호스팅 없음 — `source_payload` 화이트리스트 + alarm trim. 협의의견 본문 인덱싱 컬럼 부재.
