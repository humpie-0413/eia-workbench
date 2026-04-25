-- E2E fixture: synthetic 육상풍력 cases for /cases happy-path + facet-combo.
--
-- These are NOT EIASS-derived. The bizNm/주소 are obvious test strings (TESTSEED-*),
-- which the assertion-grep guard will not flag because they contain no banned legal
-- conclusion expressions, and CLAUDE.md §6 (no EIASS reproduction) is preserved
-- because no real EIASS metadata or content is duplicated here.
--
-- Applied via `wrangler d1 execute DB --local --file=tests/e2e/fixtures/cases-seed.sql`
-- in CI right after `wrangler d1 migrations apply`.

INSERT OR REPLACE INTO eia_cases (
  eia_cd, biz_gubun_cd, biz_gubun_nm, biz_nm,
  industry, region_sido, region_sido_code, region_sigungu,
  capacity_mw, evaluation_year, evaluation_stage,
  approv_organ_nm, eia_addr_txt,
  source_dataset, source_payload
) VALUES
  ('TESTSEED-WND-001', 'C', '환경영향평가', 'TESTSEED 강원 풍력 1호',
   'onshore_wind', '강원', '51', '평창군',
   30, 2024, '본안',
   '환경부', '강원 평창군',
   '15142998', '{"_test":true}'),
  ('TESTSEED-WND-002', 'C', '환경영향평가', 'TESTSEED 강원 풍력 2호',
   'onshore_wind', '강원', '51', '태백시',
   45, 2023, '본안',
   '환경부', '강원 태백시',
   '15142998', '{"_test":true}'),
  ('TESTSEED-WND-003', 'L', '전략환경영향평가', 'TESTSEED 전남 해안 풍력',
   'onshore_wind', '전남', '46', '신안군',
   40, 2024, '전략',
   '환경부', '전남 신안군',
   '15142998', '{"_test":true}'),
  ('TESTSEED-WND-004', 'C', '환경영향평가', 'TESTSEED 경북 풍력',
   'onshore_wind', '경북', '47', '영양군',
   80, 2022, '본안',
   '환경부', '경북 영양군',
   '15142998', '{"_test":true}');
