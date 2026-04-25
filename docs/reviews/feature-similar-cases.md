# feature/similar-cases — 리뷰 노트

**브랜치:** feature/similar-cases · **머지 대상:** main
**plan:** `docs/plans/feature-similar-cases.md` (36 task / Phase 0–7)
**완료 일자:** 2026-04-25

## 핵심 결정

- **데이터셋: 15142998** (환경영향평가 초안 공람 — draft-display).
  사전 검증 단계에서 15000800 (GIS 좌표) 부적합 확인 후 spec §2 에서 교체.
- **검색 인프라: D1 + FTS5 unicode61 + LIKE fallback.**
  prefix MATCH 는 q.length>3 에서만 활성화 (한글 어두 매칭 한계 인정 + 사용자 가이드 패널로 명시).
- **인덱서 보조: searchText 컬럼.**
  bizNm/region 의 derived 형태 + 추가 키워드를 포함, FTS5 토크나이저 보조용.
- **stage-and-swap 트랜잭션.**
  부트스트랩/주기 인덱싱 모두 `eia_cases_staging` → DELETE+INSERT FROM staging 으로 atomic 교체.
- **source_payload 화이트리스트.**
  검색 실패 시 재인덱싱 보험으로 raw API item 보존, 단 본문/협의의견 컬럼은 화이트리스트로 차단.
- **Markdown export 만, 본문 재호스팅 없음.**
  표 컬럼은 메타데이터 + EIASS deep-link 1 컬럼. 본문은 deep-link 클릭으로만 도달.

## 단정어 / 도메인 가드

- §9.3 6 항목 PASS (`docs/reports/2026-04-25-similar-cases-domain-review.md`)
- `scripts/assertion-grep.sh` (전역) + `scripts/check-similar-cases-assertions.sh` (feature 전용) 2단 CI 차단
- 페이지 인트로 + Markdown 헤더 + 미리보기 푸터 모두 "검토 보조 / 현지조사 대체 아님" 동일 문구

## 운영 위험 / 한도

- SERVICE_KEY 일 호출 한도 10,000 / 인덱서 1 회 cap 8,000 — spec §6 + ADR 0001
- 부트스트랩 1회 실측은 USER 가 운영에서 별도 수행 (CLAUDE.md §2-2: 운영 LLM 호출 금지가 아니라, **인덱싱은 cron 워커 안에서만**)
- E2E 는 SERVICE_KEY 없는 CI 환경 대비 `tests/e2e/fixtures/cases-seed.sql` (TESTSEED-*) 사용

## 후속 추적

- v1: 관련도순 (BM25), n-gram 한글 토크나이저, scoping↔similar-cases 결합
- v1 데이터셋 확장: 15142987 (전략) / 15142988 (소규모)
- T0-2 / T0-3 / T0-5 (실제 페이로드 분포 기반 검증) 은 부트스트랩 후 별도 plan
- ADR 0001 보강 commit — 운영 절차 부분만 별도 PR

## 변경 통계

- task commits: 29 (T0-1, T0-4, T1-1..T1-7, T2-1..T2-2, T3-1..T3-4, T4-1..T4-6, T5-1..T5-2, T6-1..T6-3, T6-4, T7-1)
- prettier-format commit 1건
- 신규 단위 테스트: ~50건 추가 (총 258 passed / 48 files)
- 신규 E2E spec: 3 (search-happy / facet-combo / cases-axe) + 1 manual stub
- 빌드 결과: `CaseSearchPage.js` 62.97 kB / gzip 15.76 kB (island only)
