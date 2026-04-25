## Summary

`/cases` 유사사례 검색 v0 추가. data.go.kr **15142998** (환경영향평가 초안 공람) 데이터셋 → Cloudflare D1 + FTS5 unicode61 인덱스 + Astro SSR + React island UI + Markdown export.

본 도구는 **검토 보조** 이며 EIASS 원문을 재호스팅하지 않는다. 외부 노출은 deep-link 1개 (`eiassProjectUrl()`) 한정.

## 핵심 결정

- **데이터셋:** 15142998 (draft-display). 사전 검증 단계에서 15000800 부적합 확인 후 §2 교체.
- **검색:** FTS5 prefix MATCH (`q.length>3`) + LIKE fallback (≤3). `searchText` 보조 컬럼으로 토크나이저 한계 보완. 한글 어두 매칭 한계는 `CaseSearchGuide` 패널로 사용자에게 명시.
- **인덱싱:** stage-and-swap (`eia_cases_staging` → atomic DELETE+INSERT). 주 1회 cron (한도 SERVICE_KEY 8,000/일).
- **단정 표현 가드:** `scripts/assertion-grep.sh` (전역) + `scripts/check-similar-cases-assertions.sh` (feature 전용) 2단 CI 차단.
- **Markdown export:** 메타데이터 표 + EIASS deep-link 1컬럼만. 본문/협의의견 인용 없음. 현지조사 한계 disclaimer 헤더 고정.

## Phase 별 산출물 (36 task / 29 task commits + 1 prettier)

- **Phase 0** (T0-1, T0-4) — `packages/eia-data` draft-display 4 endpoint + zod 스키마. T0-2/0-3/0-5 USER deferred.
- **Phase 1** (T1-1..T1-7) — `PortalClient.call`, wind-filter, KOSTAT 시·도 LUT, transform pipeline (화이트리스트), `workers/cases-indexer.ts`.
- **Phase 2** (T2-1..T2-2) — migration `0003_similar_cases.sql` + FTS5 + 트리거, `scripts/cases-bootstrap.ts`. T2-3 USER 운영 환경 실측.
- **Phase 3** (T3-1..T3-4) — `EiaCase` / `caseSearchQuerySchema`, `search-query.ts` (AND across · OR within), `GET /api/cases`, `GET /api/cases/[caseId]`.
- **Phase 4** (T4-1..T4-6) — `AppLayout` nav, `/cases` 페이지 + `CaseSearchPage` island (debounce 300ms / URL replaceState), `CaseFacetPanel`/`CaseResultCard`/`CasePreviewPane`/`CaseSearchGuide`, mobile fallback `/cases/[caseId]`, `/projects/[id]` → `/cases?...` 프리필.
- **Phase 5** (T5-1..T5-2) — `markdown-export.ts` + 5 단위 테스트 + 검색 페이지 export 버튼.
- **Phase 6** (T6-1..T6-4) — E2E 3종 (search-happy / facet-combo / axe) + lighthouse manual stub + `tests/e2e/fixtures/cases-seed.sql` (TESTSEED-* 4건) + assertion-grep CI step.
- **Phase 7** (T7-1..T7-2) — `docs/reports/2026-04-25-similar-cases-domain-review.md` 6/6 PASS, completion report + review note.

## §9.3 도메인 리뷰 결과

| 항목 | Pass/Fail |
|---|---|
| ① 법적 결론 단정 | **PASS** (assertion grep 2단 차단) |
| ② 현지조사 대체 주장 | **PASS** (페이지 인트로 + Markdown 헤더 + 미리보기 푸터 동일 disclaimer) |
| ③ EIASS 원문 재호스팅 | **PASS** (`source_payload` 화이트리스트, 본문/의견 컬럼 없음) |
| ④ 의견 임의 축약 | **PASS** (의견 컬럼 schema 부재) |
| ⑤ 표준 스키마 | **N/A** (검색·인덱싱 모듈, LLM 분석 결과 미생성 — spec §10.1 면제) |
| ⑥ Markdown 인용 정합성 | **PASS** (메타데이터만, deep-link 외부) |

상세: `docs/reports/2026-04-25-similar-cases-domain-review.md`

## 검증 결과

| 단계 | 결과 |
|---|---|
| `npm run typecheck` | 0 errors / 0 warnings (137 files) |
| `npm run lint` | clean |
| `npm test` | 258 passed (48 files) |
| `bash scripts/assertion-grep.sh` | clean |
| `bash scripts/check-similar-cases-assertions.sh` | clean |
| `npm run build` | success — `CaseSearchPage.js` 62.97 kB / gzip 15.76 kB |
| `grep SERVICE_KEY= dist/` | OK (no leak) |

## 운영 절차 (PR 머지 후 USER 수행)

1. **Cloudflare D1 migration**: `wrangler d1 migrations apply DB --remote` (`0003_similar_cases.sql`).
2. **부트스트랩 1회**: `tsx scripts/cases-bootstrap.ts` (운영 SERVICE_KEY 환경). 메트릭 위치: `eia_cases_sync.records_added` / `error_message`. 한도 사용률 cap 8,000/일.
3. **cron 트리거 활성화**: `workers/cases-indexer.wrangler.toml` `[triggers].crons` 등록 — deploy 시 활성.
4. **모니터링**: `eia_cases_sync` 테이블 + Cloudflare Logs 알람.

## v1 후보 (별도 plan)

- 관련도순 정렬 (BM25 weight tuning) — 현재 `evaluation_year DESC`
- n-gram 한국어 토크나이저 (어두 매칭 한계 해소)
- 추가 데이터셋: 15142987 (전략) / 15142988 (소규모)
- multi-region 컬럼 (T0-5 결과 기반)
- scoping ↔ similar-cases 결합 (해당 facet 시뮬레이션)
- ADR 0001 보강 commit (별도 PR — SERVICE_KEY rate-limit / 부트스트랩 / 한도 가드 운영 메모)

## Test plan

- [ ] `wrangler d1 migrations apply DB --remote` (0003 적용 확인)
- [ ] 운영 환경 부트스트랩 실측 1회 (`scripts/cases-bootstrap.ts`) — `records_added` / `records_skipped` 기록
- [ ] `/cases` 접속 → 사업명·지역명 검색 → 결과 카드 ≥ 1 + EIASS deep-link
- [ ] 시·도 facet OR + 규모 facet AND 동작 확인
- [ ] Markdown export → 헤더 disclaimer + 표 컬럼 정합 + EIASS 링크 외부
- [ ] `/projects/[id]` → `/cases?sido=...&capacity_band=...` 프리필 동작
- [ ] 모바일 (< 768px) → `/cases/[caseId]` 상세 페이지 fallback

🤖 Generated with [Claude Code](https://claude.com/claude-code)
