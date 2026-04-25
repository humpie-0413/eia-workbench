# similar-cases — 환경영향평가 도메인 리뷰 (CLAUDE.md §9.3)

**일시:** 2026-04-25
**브랜치:** feature/similar-cases
**범위:** docs/plans/feature-similar-cases.md (Phase 0–7) 산출물 전체

| 항목 | Pass/Fail | 근거 |
|---|---|---|
| ① 법적 결론 단정 여부 | PASS | UI 문구는 "검색 결과", "참고 가능한 사례", "본 도구는 검토 보조" 로 통일. `scripts/check-similar-cases-assertions.sh` (T32) 가 `유사사례입니다·협의 통과·승인됨·법적으로 문제없음·환경영향평가 대상입니다` 5종 단정어를 CI 차단 (clean 통과). 페이지/카드/미리보기/Markdown 헤더 모두 단정 표현 없음. |
| ② 현지조사 대체 주장 여부 | PASS | `/cases` 페이지 인트로(`src/pages/cases/index.astro`) + Markdown export 헤더(`src/features/similar-cases/markdown-export.ts`) 에 모두 "본 도구는 검토 보조이며 현지조사·전문가 검토를 대체하지 않습니다" 동일 문구. `markdown-export.test.ts:40` 이 disclaimer 문자열 누락을 회귀 테스트. |
| ③ EIASS 원문 재호스팅 여부 | PASS | `eia_cases.source_payload` 는 인덱서가 화이트리스트(`src/features/similar-cases/payload-whitelist.ts` + 동명 테스트) 로 메타데이터만 보존. 본문(reviewBody / opinionBody / 협의의견) 인덱싱 컬럼·테이블 없음. 원문 노출은 `eiassProjectUrl()` deep-link 1개로만 한정. |
| ④ 주민·기관 의견 임의 축약 | PASS | 협의의견 본문 컬럼이 schema 에 없음 (§4.3 화이트리스트 미포함). 검색·미리보기 어디에도 의견 텍스트가 등장하지 않으므로 "축약/왜곡" 가능성 자체가 존재하지 않음. |
| ⑤ 표준 스키마(`{result, basis, assumptions, limits, needsHumanReview}`) 적용 | N/A | 본 기능은 LLM 분석 결과를 생성하지 않는 검색·인덱싱 모듈. spec §10.1 에 동일 면제 명시. v1 에서 scoping↔similar-cases 결합 시 별도 결정. |
| ⑥ Markdown export 인용 정합성 | PASS | export 표 컬럼은 `eiaCd / 사업명 / 위치 / 규모 / 평가시기 / 단계 / EIASS 링크` — 모두 메타데이터. 본문/의견 인용 없음. EIASS 컬럼은 `eiassProjectUrl()` 결과만, 외부 deep-link. `markdown-export.test.ts` 5건 통과. |

## 결론

**Fail 항목: 0 건.** plan 수정 없이 PR 진행 가능.

추가 메모:
- 단정어 grep 가드는 `scripts/assertion-grep.sh` (전역) + `scripts/check-similar-cases-assertions.sh` (similar-cases 전용) 2단으로 운영. CI `verify` job 첫 두 step 에서 양쪽 모두 차단.
- 한도 가드(SERVICE_KEY 일 10,000 호출 / 인덱서 8,000 cap) 는 도메인이 아닌 운영 위험이라 본 표에서 제외; spec §6 + ADR 0001 에서 별도 추적.
