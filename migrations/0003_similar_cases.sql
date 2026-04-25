-- 0003_similar_cases.sql — similar-cases v0 (육상풍력 인덱스)

CREATE TABLE eia_cases (
  -- raw API fields (15142998 응답 그대로 보존)
  eia_cd                TEXT PRIMARY KEY,            -- API: eiaCd
  eia_seq               TEXT,                        -- API: eiaSeq (회차/시퀀스)
  biz_gubun_cd          TEXT NOT NULL,               -- API: bizGubunCd ('C'|'L'|...)
  biz_gubun_nm          TEXT NOT NULL,               -- API: bizGubunNm (라벨)
  biz_nm                TEXT NOT NULL,               -- API: bizNm (사업명)
  biz_main_nm           TEXT,                        -- detail API: bizmainNm (사업주관기관)
  approv_organ_nm       TEXT,                        -- detail API: approvOrganNm (승인기관)
  biz_money             INTEGER,                     -- strategy detail: bizMoney (사업비, 원)
  biz_size              TEXT,                        -- strategy detail: bizSize (사업규모 raw)
  biz_size_dan          TEXT,                        -- strategy detail: bizSizeDan (단위 raw)
  drfop_tmdt            TEXT,                        -- list/detail: drfopTmdt (공람기간 raw, "YYYY-MM-DD ~ YYYY-MM-DD")
  drfop_start_dt        TEXT,                        -- detail: drfopStartDt
  drfop_end_dt          TEXT,                        -- detail: drfopEndDt
  eia_addr_txt          TEXT,                        -- detail: eiaAddrTxt (사업지 주소 raw)

  -- derived/normalized columns (§4.3 변환 규칙)
  industry              TEXT NOT NULL,               -- 'onshore_wind' (변환 실패 → 인덱싱 skip)
  region_sido           TEXT,                        -- 시·도 라벨 (eiaAddrTxt 파싱)
  region_sido_code      TEXT,                        -- KOSTAT 시·도 코드 (LUT)
  region_sigungu        TEXT,                        -- 시·군·구 라벨 (eiaAddrTxt 파싱)
  capacity_mw           REAL,                        -- 발전용량 MW (bizSize/bizNm 추출)
  area_ha               REAL,                        -- 사업면적 ha (bizSize 단위 변환)
  evaluation_year       INTEGER,                     -- drfop 첫 4자리
  evaluation_stage      TEXT NOT NULL,               -- '본안' | '전략' (origin operation 기반)

  -- 메타
  source_dataset        TEXT NOT NULL,               -- '15142998'
  source_payload        TEXT NOT NULL,               -- raw API item JSON (재인덱싱 보험)
  fetched_at            TEXT NOT NULL DEFAULT (datetime('now')),

  CHECK (industry = 'onshore_wind'),                 -- v0 가드. v2에서 enum 확장.
  CHECK (biz_gubun_cd IN ('C','L')),                 -- 풍력 식별 1차 필터
  CHECK (evaluation_stage IN ('본안','전략'))        -- v0 두 origin operation 만 허용
);

CREATE INDEX eia_cases_industry_year ON eia_cases(industry, evaluation_year DESC);
CREATE INDEX eia_cases_sido          ON eia_cases(region_sido_code);
CREATE INDEX eia_cases_capacity      ON eia_cases(capacity_mw);
CREATE INDEX eia_cases_stage         ON eia_cases(evaluation_stage);

-- FTS5 가상 테이블 (외부 콘텐츠 모드: eia_cases 와 동기화)
CREATE VIRTUAL TABLE eia_cases_fts USING fts5(
  biz_nm,
  region_sido,
  region_sigungu,
  content='eia_cases',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- 동기화 트리거
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

-- 인덱스 동기화 메타
CREATE TABLE eia_cases_sync (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at      TEXT NOT NULL,
  finished_at     TEXT,
  records_total   INTEGER,                           -- API total 카운트 (list 응답)
  records_added   INTEGER,
  records_updated INTEGER,
  records_skipped INTEGER,                           -- 풍력 미해당으로 인덱싱 안 한 건수
  api_calls       INTEGER,
  error           TEXT
);
