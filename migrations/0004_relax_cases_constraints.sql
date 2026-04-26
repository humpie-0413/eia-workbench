-- 0004_relax_cases_constraints.sql
-- 데이터셋 교체 15142998 → 15142987 (협의현황) 에 따른 CHECK 제약 완화.
--
-- 변경 사항
-- 1. biz_gubun_cd CHECK ('C','L') 제거. 15142987 list 응답에 bizGubunCd 가 없어
--    공백 문자열로 채워지므로 CHECK 가 실패함.
-- 2. evaluation_stage CHECK ('본안','전략') → ('본안','전략','unknown') 로 확장.
--    list-only 인덱싱이므로 본안/전략 식별 불가 → 'unknown' 허용.
-- 3. biz_gubun_cd / biz_gubun_nm NOT NULL 은 유지 (빈 문자열은 NOT NULL 통과).
--
-- 주의: eia_cases 테이블은 부트스트랩 단계에서 0 행 상태이므로 데이터 보존 없이
-- DROP & CREATE. 인덱서가 staging swap 으로 재구축하므로 운영 손실 없음.
-- eia_cases_sync 메타 테이블은 보존.

DROP TRIGGER IF EXISTS eia_cases_au;
DROP TRIGGER IF EXISTS eia_cases_ad;
DROP TRIGGER IF EXISTS eia_cases_ai;
DROP TABLE IF EXISTS eia_cases_fts;
DROP INDEX IF EXISTS eia_cases_stage;
DROP INDEX IF EXISTS eia_cases_capacity;
DROP INDEX IF EXISTS eia_cases_sido;
DROP INDEX IF EXISTS eia_cases_industry_year;
DROP TABLE IF EXISTS eia_cases;
DROP TABLE IF EXISTS eia_cases_staging;
DROP TABLE IF EXISTS eia_cases_old;

CREATE TABLE eia_cases (
  eia_cd                TEXT PRIMARY KEY,
  eia_seq               TEXT,
  biz_gubun_cd          TEXT NOT NULL,
  biz_gubun_nm          TEXT NOT NULL,
  biz_nm                TEXT NOT NULL,
  biz_main_nm           TEXT,
  approv_organ_nm       TEXT,
  biz_money             INTEGER,
  biz_size              TEXT,
  biz_size_dan          TEXT,
  drfop_tmdt            TEXT,
  drfop_start_dt        TEXT,
  drfop_end_dt          TEXT,
  eia_addr_txt          TEXT,

  industry              TEXT NOT NULL,
  region_sido           TEXT,
  region_sido_code      TEXT,
  region_sigungu        TEXT,
  capacity_mw           REAL,
  area_ha               REAL,
  evaluation_year       INTEGER,
  evaluation_stage      TEXT NOT NULL,

  source_dataset        TEXT NOT NULL,
  source_payload        TEXT NOT NULL,
  fetched_at            TEXT NOT NULL DEFAULT (datetime('now')),

  CHECK (industry = 'onshore_wind'),
  CHECK (evaluation_stage IN ('본안','전략','unknown'))
);

CREATE INDEX eia_cases_industry_year ON eia_cases(industry, evaluation_year DESC);
CREATE INDEX eia_cases_sido          ON eia_cases(region_sido_code);
CREATE INDEX eia_cases_capacity      ON eia_cases(capacity_mw);
CREATE INDEX eia_cases_stage         ON eia_cases(evaluation_stage);

CREATE VIRTUAL TABLE eia_cases_fts USING fts5(
  biz_nm,
  region_sido,
  region_sigungu,
  content='eia_cases',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER eia_cases_ai AFTER INSERT ON eia_cases BEGIN
  INSERT INTO eia_cases_fts(rowid, biz_nm, region_sido, region_sigungu)
  VALUES (new.rowid, new.biz_nm, new.region_sido, new.region_sigungu);
END;
CREATE TRIGGER eia_cases_ad AFTER DELETE ON eia_cases BEGIN
  INSERT INTO eia_cases_fts(eia_cases_fts, rowid, biz_nm, region_sido, region_sigungu)
  VALUES ('delete', old.rowid, old.biz_nm, old.region_sido, old.region_sigungu);
END;
CREATE TRIGGER eia_cases_au AFTER UPDATE ON eia_cases BEGIN
  INSERT INTO eia_cases_fts(eia_cases_fts, rowid, biz_nm, region_sido, region_sigungu)
  VALUES ('delete', old.rowid, old.biz_nm, old.region_sido, old.region_sigungu);
  INSERT INTO eia_cases_fts(rowid, biz_nm, region_sido, region_sigungu)
  VALUES (new.rowid, new.biz_nm, new.region_sido, new.region_sigungu);
END;
