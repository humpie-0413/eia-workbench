# eia_cd 충돌 처리 fixture

Task 13 의 indexer 통합 단위 테스트가 사용:

- 일반 list 에 `eiaCd='X-001'`, `bizSize` 없음
- 전략 list 에도 `eiaCd='X-001'`, `bizSize='30'`, `bizSizeDan='MW'`
- merge 결과: 운영 인덱스 1행, `evaluation_stage='전략'`, `capacity_mw=30`

spec 참조: `docs/design/feature-similar-cases.md` §4.3 특이 케이스.
