# feature/similar-cases — 설계문서 v0

> Office Hours 8문항 (Q1–Q8) + 추가 노트 3건 반영. 사용자가 모든 추천안을 채택 (2026-04-25).
> **2026-04-25 보정**: 사용자 직접 검증 결과 데이터셋 ID 15000800 은 GIS 좌표 기반 측정 API 로 확인되어 부적합. **15142998 환경영향평가 초안 공람정보** 로 교체. §2 / §4 / §6 / §10 / §12 패치.
> **2026-04-26 보정**: 부트스트랩 실행 결과 15142998 은 현재 공람 진행 중인 사업만 노출 (총 15건 / 풍력 0건). 인덱싱 가치 부재. **15142987 환경영향평가 협의현황** 으로 재교체 (총 7,434건 / 풍력 후보 ~44건). list-only 적재로 단순화하고 detail 통합은 후속 작업으로 분리. §2 / §4 / §6 / §10 / §12 패치, migration 0004 추가.
> **2026-04-26 P1 보정**: list-only 운영 후 후속으로 분리했던 detail API 통합을 본 patch 로 반영. Office Hours Q1~Q8 결정 (2026-04-26): Ing detail (`getDscssSttusDscssIngDetailInfoInqire`) 단독 채택, evaluation_stage 매핑 (stateNm 패턴), region_sido fallback (biz_nm regex + sigungu LUT — 두 detail endpoint 모두 `eiaAddrTxt` 부재 확정), detail 실패 시 retry 1 + list-only fallback. migration 불요. §2 / §4.3 / 신규 §4.4 / §6 / §10.4 / §11 / §12 patch.
> 다음 단계: 본 spec 사용자 검토 → 승인 → `writing-plans`로 `docs/plans/feature-similar-cases.md` 작성.

## 1. 목적

평가사가 새 사업의 환경영향평가 보고서·스코핑·협의 대응을 작성할 때, **국내에서 이미 진행된 유사 사업의 환경영향평가 사례를 빠르게 찾아 참조**할 수 있게 한다. 자체 본문 호스팅은 하지 않는다 — 메타데이터만 D1에 인덱싱하고, 사용자는 EIASS 원문 페이지로 deep-link 이동해 본문을 읽는다 (CLAUDE.md §2-4).

이 기능 완료 시점에서 사용자는:

- "강원 평창 30MW 풍력 — 비슷한 사례가 있나?" 1분 안에 후보 5–10건 확인.
- 각 사례의 사업명·위치·규모·평가시기 메타데이터 비교.
- EIASS 원문으로 1-click 이동해 본문/협의의견 확인.
- 현재 facet/검색 결과를 Markdown으로 내려받아 보고서 부록·참고 목록에 첨부.

## 2. 대상 사용자·업종

- 사용자: 환경영향평가사 (project-shell의 인증 사용자 그대로). B2B.
- 대상 업종: **육상풍력 (onshore_wind)** 1개. 다른 업종은 v2.
- 인덱스 데이터셋: data.go.kr **`15142987` 환경영향평가 협의현황** 단일 (2026-04-26 교체).
  - Base URL: `https://apis.data.go.kr/1480523/EnvrnAffcEvlDscssSttusInfoInqireService`
  - Operation 2종 사용 (v0 list + P1 detail, 2026-04-26 P1 보정):
    - `getDscssBsnsListInfoInqire` (협의대상 사업 목록, `searchText` 지원)
    - `getDscssSttusDscssIngDetailInfoInqire` (협의 진행 상세 — 풍력 후보 행에 한해 호출, `eiaCd` 키)
  - 풍력 식별 필터: list 응답에 `bizGubunCd` 가 없으므로 `bizNm` 정규식만 사용 (`/풍력/` AND NOT `/해상\s*풍력/`).
  - 일 호출 한도: 개발계정 **10,000회/일**.
  - 부트스트랩 추정: list ≈ 80–100 호출 + Ing detail onshore 후보 N건(현 운영 N=10, 해상풍력 ~68 skip, retry ≤1 포함) → 합계 **≤ 170 호출/sync** (N≤500 까지 안전 마진).
- 사용 안 함 detail endpoint (2026-04-26 P1 결정):
  - `getDscssSttusDscssOpinionDetailInfoInqire` (의견 detail) — 응답에 `eiaAddrTxt` 부재이므로 region 보강 가치 없음. 또한 `ccilMemEmail`/`ccilMemNm` (CCM 담당자 PII) 포함되므로 §10.4 재호스팅 가드 위반 위험. 호출 자체 회피.
- 기존 후보 (rollback 보존, v0에서 인덱싱 안 함):
  - `15142998` 환경영향평가 초안 공람정보 — 현재 공람 진행 중 사업만 노출 (총 15건). 풍력 0건이라 인덱싱 가치 부재. zod 스키마(`draftListItemSchema`/`strategyDraftListItemSchema`)와 endpoint 빌더는 코드 보존.

## 3. 핵심 사용자 여정

| 단계 | 행동                                      | 결과                                                       | 라우트/엔드포인트                                  |
| ---- | ----------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| A    | 좌측 네비 또는 `/projects/[id]`에서 진입  | `/cases` 검색 페이지 (경고 배너 고정)                      | `src/pages/cases/index.astro`                      |
| B    | 검색어 입력 (debounce 300ms)              | `GET /api/cases?q=...&region=...&capacity=...&year=...`    | `src/pages/api/cases/index.ts`                     |
| C    | 좌측 facet (업종/시·도/규모/연도) 클릭    | URL 쿼리 갱신 → 결과 재조회                                | 같음                                               |
| D    | 결과 카드 클릭 (데스크톱)                 | 우측 미리보기 패널에 상세 메타데이터 표시 (페이지 이동 X) | 클라이언트 상호작용만                              |
| D'   | 결과 카드 클릭 (모바일 <768px)            | `/cases/[caseId]` 상세 페이지로 이동 (`caseId === eiaCd`)  | `src/pages/cases/[caseId].astro`                   |
| E    | 미리보기/상세에서 "EIASS 원문 열기" 클릭  | 새 탭으로 EIASS deep-link 이동 (`eiassProjectUrl()`)       | 외부                                               |
| F    | "Markdown 내보내기"                       | 현재 facet+검색어로 필터된 결과 목록을 `.md` 다운로드      | 클라이언트 빌드 (서버 호출 없음)                   |

검색어·facet 선택·클릭 이력은 **서버에 저장하지 않는다** (Q7 결정).

## 4. 데이터 모델

### 4.1 인덱스 테이블 (D1)

스키마는 **raw API 필드(snake_case)** 와 **derived/normalized 컬럼** 을 병기한다. 변환 알고리즘은 §4.3.

> **2026-04-26 갱신**: migration 0004 적용 후 실제 운영 스키마는 (a) `biz_gubun_cd CHECK ('C','L')` 제거, (b) `evaluation_stage CHECK` 에 `'unknown'` 추가, (c) `source_dataset` 값이 `'15142987'`. 아래 SQL 은 0003 원본 — **현재 운영 정의는 `migrations/0004_relax_cases_constraints.sql` 참조**.

```sql
-- D1 migration 0003_similar_cases.sql (initial)

CREATE TABLE eia_cases (
  -- raw API fields (15142998 응답 그대로 보존)
  eia_cd                TEXT PRIMARY KEY,            -- API: eiaCd
  eia_seq               TEXT,                        -- API: eiaSeq (회차/시퀀스). 응답은 number, 인덱서가 string 으로 coerce
  biz_gubun_cd          TEXT NOT NULL,               -- 인덱서가 list 호출 시 사용한 bizGubn 파라미터('C'|'L'). 응답 자체에는 누락
  biz_gubun_nm          TEXT NOT NULL,               -- API: bizGubunNm (라벨)
  biz_nm                TEXT NOT NULL,               -- API: bizNm (사업명)
  biz_main_nm           TEXT,                        -- detail API: bizmainNm (사업주관기관)
  approv_organ_nm       TEXT,                        -- detail API: approvOrganNm (승인기관)
  biz_money             INTEGER,                     -- strategy detail: bizMoney (사업비, 원)
  biz_size              TEXT,                        -- strategy detail: bizSize (사업규모 raw)
  biz_size_dan          TEXT,                        -- strategy detail: bizSizeDan (단위 raw)
  drfop_tmdt            TEXT,                        -- list/detail: drfopTmdt (공람기간 raw, "YYYY.MM.DD ~ YYYY.MM.DD" 점 구분자)
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
```

검색어 `q`는 `eia_cases_fts MATCH ?`로 매칭하고, 한글 토큰화 한계와 `searchText` 서버측 보조는 §4.2에서 다룬다. 컬럼 변환 규칙은 §4.3.

### 4.2 한국어 검색 보조 — 인덱서 + 핸들러 이중 전략

(1) **인덱서 단계 (cron, 풍력 1차 필터)**

15142987 list operation 은 `searchText` 파라미터를 지원한다 (서버측 LIKE). 인덱서는 다음 패턴을 순회 호출하여 풍력 후보를 수집한다:

```
searchText ∈ ['풍력', '해상풍력', '육상풍력']
× 페이지네이션 (numOfRows=100)
```

응답에 `bizGubunCd` 가 없으므로 `bizNm` 정규식 `/풍력/` 으로 식별하고, 해상풍력은 `/해상\s*풍력/` 로 제외한다 (industry='onshore_wind' 가드).

(2) **사용자 검색 단계 (FTS5 + LIKE fallback, D1)**

사용자가 `/cases?q=...` 로 검색하면 D1 인덱스만 본다 (SERVICE_KEY 미사용, §10.2). FTS5 `unicode61` 토크나이저는 공백·구두점만 분리하므로 한국어 부분일치가 약하다. v0 대응:

1. **prefix 매칭**: `eia_cases_fts MATCH 'biz_nm:강원*'` (FTS5 prefix). 어두 매칭은 됨.
2. **LIKE fallback**: `q.length <= 3` 또는 prefix 결과 0건이면 `biz_nm LIKE '%' || q || '%' OR region_sido LIKE ... OR region_sigungu LIKE ...` 보조 쿼리. 인덱스 미사용이지만 v0 인덱스 규모(육상풍력 1업종 ≤ 5000건 추정)에서 허용.
3. **n-gram은 v1**. `tokenize='trigram'`은 D1 SQLite 빌드에 따라 가용성 변동 — v0 도입 비용 대비 가치 낮음.

이 한계는 사용자에게도 표시한다 (§5.1 "검색 가이드" 라벨).

> **왜 D1+FTS5 유지인가**: list operation의 `searchText` 는 인덱서 단계의 풍력 후보 수집용 보조이지, 사용자 실시간 검색의 백엔드가 아니다. 매 요청마다 외부 API 호출은 (a) 10,000회/일 한도 잠식 (b) p95 latency 증가 (c) SERVICE_KEY 노출 면적 확장 — 셋 다 §10.2/Q5/Q7과 충돌한다.

### 4.3 컬럼 변환 규칙 (raw API → derived)

인덱서는 list+detail API 응답을 다음 규칙으로 derived 컬럼에 매핑한다. 변환 실패는 NULL (인덱싱은 진행) 또는 skip (행 자체 미적재) 둘 중 하나이며, skip 사유는 `eia_cases_sync.records_skipped` 카운트에만 반영한다.

| derived 컬럼 | 출처 | 변환 규칙 | 실패 시 |
|---|---|---|---|
| `industry` | `bizNm` (regex only) | `/풍력/.test(bizNm)` AND NOT `/해상\s*풍력/.test(bizNm)` → `'onshore_wind'`. 15142987 list 응답에 `bizGubunCd` 가 부재하므로 regex 단독 식별 (2026-04-26). | **skip** (행 미적재) |
| `region_sido` | `bizNm` (regex fallback, 2026-04-26 P1) | 15142987 list/Ing/Opinion detail 응답 모두 `eiaAddrTxt` 부재 (사용자 raw 검증). 시·군·구 토큰을 `bizNm` 에서 추출 → `data/region/sigungu-lut.json` 으로 시·도 역매핑. 우선순위: ① 광역시 토큰(서울/부산/대구/인천/광주/대전/울산/세종) → 광역시 즉시 ② 시·군·구 토큰 LUT 첫 매치 → `sido` ③ 둘 다 부재 → NULL. 알고리즘 §4.4. | NULL |
| `region_sido_code` | `region_sido` | 17개 시·도 → KOSTAT 2자리 코드 매핑 LUT (project-shell 의 `kostat-code.ts` 패턴). LUT entry 의 `sidoCode` 동시 적재. | NULL |
| `region_sigungu` | `bizNm` (LUT 매칭, 2026-04-26 P1) | `bizNm` 의 `(?<![가-힣])(\S+?(?:시|군|구))(?![가-힣])` 정규식 토큰 중 LUT 등록된 첫 매치 (어두/어말 경계로 `광역시`·`자치구` 잡음 토큰 제외). LUT 미매칭 → NULL. 알고리즘 §4.4. | NULL |
| `capacity_mw` | (전략) `bizSize`·`bizSizeDan` / (일반) `bizNm` | 우선순위 ① `bizSizeDan='MW' or 'kW' or '㎾'`이면 `bizSize` 숫자 추출 후 단위 변환 (kW→MW: ÷1000) ② `bizNm` 정규식 `/(\d+(?:\.\d+)?)\s*(MW|㎿)/i` 첫 매칭 ③ 둘 다 실패 → NULL | NULL (검색 결과에는 노출, 규모 facet 에서는 제외) |
| `area_ha` | (전략) `bizSize`·`bizSizeDan` | `bizSizeDan` 분기: `'ha'` 그대로 / `'㎡'` ÷ 10000 / `'㎢'` × 100 / 그 외(`MW`, `kW` 등) → NULL. 일반 operation 응답에는 `bizSize` 가 없으므로 NULL. | NULL |
| `evaluation_year` | `stepChangeDt` (15142987) | 첫 4자리 정수 (점·대시 구분자 허용). `< 2000` 또는 `> 현재연도+1` 이면 NULL. 15142987 list 응답에는 `drfopStartDt`/`drfopTmdt` 가 없고 `stepChangeDt='YYYY.MM.DD'` 만 사용 가능. | NULL |
| `evaluation_stage` | Ing detail `items[].stateNm` (정렬 후 first, 2026-04-26 P1) | 매핑 우선순위: ① `stateNm.includes('전략')` → `'전략'` ② `stateNm.includes('본안')` OR `stateNm === '협의'` OR `stateNm.includes('변경협의')` → `'본안'` ③ 그 외 (예: `'소규모'`, `'재협의'`, `'재의견'`) → `'unknown'`. 정렬 키: `resReplyDt DESC` → `applyDt DESC` → API order. detail 호출 실패/items 빈 응답 → `'unknown'` (CHECK 통과). | (`'unknown'` 적재) |
| `source_payload` | list + Ing detail merge (2026-04-26 P1) | list item 화이트리스트 (`eiaCd, eiaSeq, bizNm, ccilOrganNm, stepChangeDt, rnum`) + Ing detail 화이트리스트 (`stateNm, resReplyDt, applyDt` 만, items 정렬 후 상위 3건까지) + region 매칭 결과 (`matched_token, matched_sido, matched_sigungu`) JSON.stringify. **본문 텍스트·PII (CCM 담당자명/이메일) 필드는 화이트리스트 미포함** (§2-4, §10.4 재호스팅 가드). | (불가, 적재 거부) |
| `eia_cd` | `eiaCd` | 그대로 (`PRIMARY KEY`). list 응답에서 누락된 행은 적재 거부. | (skip) |

특이 케이스 (2026-04-26 P1 갱신):
- 15142987 list 응답에는 본안/전략 구분 없음. evaluation_stage 는 Ing detail `stateNm` 패턴 매핑으로 결정 (§4.3 evaluation_stage 행).
- `bizNm` 에 `'30MW'` 형태 용량 토큰이 포함된 경우 `capacity_mw` 추출 가능. list-only 적재이므로 `bizSize` 미가용 → `bizNm` 정규식만 사용.
- `bizNm` 에 다중 시·군·구 토큰 (`'영월 평창 풍력'`) → LUT 첫 매치만 적재. 후속 토큰 무시.
- detail 호출 실패 (HTTP 에러, zod 실패, items 빈 응답) → list-only fallback. evaluation_stage='unknown', detail 화이트리스트 필드 부재. `eia_cases_sync` `detail_failed` 1 증가, `error` 미기록 (정상 fallback 으로 간주).

### 4.4 region 매핑 알고리즘 — biz_nm regex + sigungu LUT (P1 신설)

#### 4.4.1 배경 (왜 biz_nm fallback 인가)

15142987 list / Ing detail / Opinion detail 응답 모두 `eiaAddrTxt` 부재 (사용자 raw payload 검증, 2026-04-26 P1 OH Q1). detail endpoint 추가 호출로도 주소 미수신 → 사업명 자체에서 시·군·구 토큰 추출이 유일한 region 보강 경로. 본 알고리즘은 detail 호출 결과와 무관하게 list 행 모두에 적용.

#### 4.4.2 토큰 추출

```
const SIGUNGU_TOKEN = /(?<![가-힣])(\S+?(?:시|군|구))(?![가-힣])/g;
```

- 한글 어두/어말 경계 lookbehind/lookahead 로 `광역시`·`자치구`·`시민` 등 잡음 분해 차단.
- `bizNm` 전체에 `matchAll` 적용 → 토큰 배열 (등장 순서 보존).
- 광역시 토큰 (서울/부산/대구/인천/광주/대전/울산/세종) 은 4.4.4 우선순위 ①에서 별도 분기.

> **운영 데이터 보강 (2026-04-27)**: 운영 풍력 적재 10건 분석 결과 사업명에 `시`·`군`·`구` 접미사가 포함된 비율은 0% (`docs/cases-2026-04-26.md` 참조). 토큰 정규식만으로는 100% NULL → 50% DoD 불가능. 4.4.4 step 2.5 어근 substring fallback 으로 해결.

#### 4.4.3 LUT 구조 (`data/region/sigungu-lut.json`)

```json
{
  "영양": { "sido": "경상북도", "sidoCode": "47", "sigungu": "영양군" },
  "강릉": { "sido": "강원도",   "sidoCode": "42", "sigungu": "강릉시" },
  "의성": { "sido": "경상북도", "sidoCode": "47", "sigungu": "의성군" },
  "청송": { "sido": "경상북도", "sidoCode": "47", "sigungu": "청송군" },
  "삼척": { "sido": "강원도",   "sidoCode": "42", "sigungu": "삼척시" },
  "양양": { "sido": "강원도",   "sidoCode": "42", "sigungu": "양양군" }
}
```

- 키: `시`·`군`·`구` 접미사 **제거한** 한글 어근 (`'영양군'` → `'영양'`).
- 값: KOSTAT 시·도 코드 + 정규화된 `sigungu` 라벨.
- v0 1차 import 필수 6개 (운영 적재 10건 매칭): 영양/강릉/의성/청송/삼척/양양.
- 19개 entry 목표 (v0 풍력 후보 추정 ~44건의 50% 커버). 누락 시군구는 NULL 적재 후 운영 로그에서 식별 → LUT 추가.

> **Phase 1 주의 (sidoCode 잠정값)**: 위 6개 entry 의 `sidoCode` 값은 **잠정**. KOSTAT 행정구역 코드 manual 확인 후 확정 필수. 특히:
> - 강원도: `'42'` (전환 전) vs `'51'` (강원특별자치도 전환 후, 2023-06 시행) — 운영 시점 코드 검증 필수.
> - 경상북도: `'47'` 검증 필수.
> - 6개 entry 각각 출처 URL (KOSTAT 코드표 또는 통계청 행정구역 분류) 또는 코드 출처 표기.
> - Phase 1 GREEN 전에 LUT 검증 단위 테스트 1건 추가 (예: `'영양'.sidoCode === '47'`).

#### 4.4.4 매핑 우선순위

```
function deriveRegion(bizNm: string, lut: SigunguLut): RegionResult {
  // 1. 광역시 토큰 우선
  const METRO = ['서울','부산','대구','인천','광주','대전','울산','세종'];
  for (const metro of METRO) {
    if (bizNm.includes(metro)) {
      return { sido: metro, sidoCode: METRO_CODE[metro], sigungu: null, matched_token: metro };
    }
  }
  // 2. 시·군·구 LUT 첫 매치 (suffix 포함된 토큰)
  const tokens = [...bizNm.matchAll(SIGUNGU_TOKEN)].map(m => m[1]);
  for (const token of tokens) {
    const stem = token.replace(/(시|군|구)$/, '');
    if (lut[stem]) {
      return { sido: lut[stem].sido, sidoCode: lut[stem].sidoCode, sigungu: lut[stem].sigungu, matched_token: token };
    }
  }
  // 2.5. (NEW, P1 보강) LUT 어근 substring 매치 — suffix 없는 어근만 있는 bizNm 대응
  //      운영 풍력 10건은 모두 어근 only ('영양풍력', '강릉 안인풍력' 등). 4.4.2 토큰화로는 0% 매칭.
  for (const stem of Object.keys(lut)) {
    if (bizNm.includes(stem)) {
      return { sido: lut[stem].sido, sidoCode: lut[stem].sidoCode, sigungu: lut[stem].sigungu, matched_token: stem };
    }
  }
  // 2.7. (NEW, P3 §3(a)) 광역도 short token substring fallback — sigungu LUT 미매치 + landmark 부재.
  //      운영 D1 (2026-04-28) 4건 (ME2022C006 '강원풍력', ... ) 의 region_sido NULL 해소.
  //      legacyLabel ('강원도') 사용 — sigungu-lut.json 의 sido 컨벤션 일관 (canonical '강원특별자치도' 회피).
  for (const entry of SIDO_LUT) {
    if (bizNm.includes(entry.short)) {
      return { sido: entry.legacyLabel, sidoCode: entry.code, sigungu: null, matched_token: entry.short };
    }
  }
  // 3. 매칭 실패
  return { sido: null, sidoCode: null, sigungu: null, matched_token: null };
}
```

- 광역시 토큰 존재 시 시·군·구 LUT 보다 우선 (광역시 안의 자치구 분리는 v1).
- 광역시 토큰 부재 시 시·군·구 LUT 첫 매치. LUT 미등록 토큰은 무시.
- step 2 (suffix 토큰 매치) 실패 시 step 2.5 어근 substring 매치로 fallback. `Object.keys(lut)` 삽입 순서 = LUT JSON 정의 순서 (영양 → 강릉 → 의성 → 청송 → 삼척 → 양양).
- step 2.5 도 실패하고 광역도 short token (`'강원'`/`'경기'`/`'경북'` 등) 만 등장하는 bizNm 인 경우 step 2.7 sido fallback 으로 시·도만 채움 (sigungu=null). landmark token (예: `'풍백'`) 매칭은 별도 LUT (v1).

#### 4.4.5 source_payload 기록

`derivedRegion.matched_token` 을 `source_payload` 에 함께 직렬화하여 운영 디버깅 시 매칭 근거 추적 가능. (§10.4 화이트리스트 정책 부합 — bizNm 자체 한글 토큰은 본문 텍스트가 아닌 메타데이터.)

#### 4.4.6 50% DoD (P1 부트스트랩 후)

- 운영 적재 N 건 중 `region_sido IS NOT NULL` 비율 ≥ **50%**.
- 미달 시 운영 로그에서 LUT 미매칭 토큰 top-N 추출 → `data/region/sigungu-lut.json` 추가 → 재인덱싱.
- 100% 달성은 v1 목표.

#### 4.4.7 v1 추적 — LUT 어근 충돌 검증

step 2.5 의 `Object.keys(lut)` 순회는 LUT JSON 삽입 순서에 의존한다. P1 LUT 6개 어근 (영양/강릉/의성/청송/삼척/양양) 은 서로 substring 으로 포함되지 않아 충돌 없음. v1 에서 LUT 19+ 로 확장 시:

- LUT 추가 전 충돌 검증 단위 테스트 추가 — 각 새 어근이 기존 어근의 substring 인지 / 기존 어근에 새 어근이 포함되는지 검사.
- 충돌 발견 시: ① 더 긴 어근 우선 정렬 (`'영양읍'` vs `'영양'` → 긴 것 먼저) ② 또는 LUT 데이터에 명시적 우선순위 필드 추가.
- v1 LUT 임포트 PR 의 DoD 에 본 검증 절차 1줄 명시 필수.

#### 4.4.8 sido label drift 정책 (P3 §3(a))

`sigungu-lut.json` 의 `sido` 필드 (`"강원도"`, `"전라북도"`, `"제주도"`) 와 `sido-lut.ts` 의 canonical `label` (`'강원특별자치도'`, `'전북특별자치도'`, `'제주특별자치도'`) 사이에 **광역도 3건** label drift 가 존재한다 (2023~2024 행정 명칭 전환).

| short | legacy (sigungu-lut.json, D1 region_sido) | canonical (sido-lut.ts label) | 전환 시점 |
| ----- | ----------------------------------------- | ----------------------------- | --------- |
| 강원  | 강원도                                    | 강원특별자치도                | 2023-06   |
| 전북  | 전라북도                                  | 전북특별자치도                | 2024-01   |
| 제주  | 제주도                                    | 제주특별자치도                | 2006-07   |

step 2.7 sido fallback 의 `matched_sido` 는 **legacyLabel** (sido-lut.ts 의 별도 컬럼) 을 반환하여 sigungu-lut.json + 운영 D1 적재값 (`region_sido`) 컨벤션과 일관 유지. 광역시 8개 + 경기/충북/충남/전남/경북/경남 6개는 legacy = canonical 동일 (drift 없음).

v1 정책: D1 `region_sido` 값을 일괄 canonical 로 마이그레이션 + UI/필터 호환 레이어 추가. 본 P3 fix 는 drift 회피로 v0 일관성만 우선 보장.

## 5. 화면 구조

### 5.1 검색 페이지 (`/cases`)

레이아웃 (≥768px, 데스크톱):

```
┌─────────────────────────────────────────────────────────────────┐
│ [경고 배너: PilotWarningBanner 그대로]                          │
├─────────────────────────────────────────────────────────────────┤
│ [검색바]  "사업명·지역명 검색 (예: 강원 평창 풍력)" │ [내보내기]│
├──────────────┬─────────────────────────────┬────────────────────┤
│ Facet 패널   │ 결과 리스트 (카드)          │ 미리보기 패널      │
│              │                             │                    │
│ ▸ 업종       │ • 강원평창풍력단지 (2024)   │ 사업명: ...        │
│   ☑ 육상풍력 │   강원 평창군 · 30MW        │ 위치: ...          │
│              │ • 영월새푸른풍력 (2023)     │ 규모: 30MW         │
│ ▸ 시·도      │   강원 영월군 · 21MW        │ 평가시기: 2024     │
│   ☐ 강원     │ ...                         │ [EIASS 원문 ↗]     │
│   ☐ 전남     │                             │                    │
│   ...        │                             │                    │
│ ▸ 규모(MW)   │                             │                    │
│   ☐ <10      │                             │                    │
│   ☐ 10-50    │                             │                    │
│   ☐ 50-100   │                             │                    │
│   ☐ ≥100     │                             │                    │
│ ▸ 평가시기   │                             │                    │
│   ☐ 2024     │                             │                    │
│   ☐ 2023     │                             │                    │
│   ☐ 2022     │                             │                    │
│   ☐ ~2021    │                             │                    │
└──────────────┴─────────────────────────────┴────────────────────┘
```

레이아웃 (<768px, 모바일 fallback):

- Facet 패널은 상단 collapsible (`<details>`).
- 미리보기 패널 없음. 카드 클릭 시 `/cases/[caseId]` 상세 페이지로 이동.

상세 컴포넌트 규칙:

- 검색바 placeholder: "사업명·지역명 검색 (예: 강원 평창 풍력)".
- 검색 가이드 (`<details>`):
  > "사업명에 공백이 없는 경우 어두만 매칭됩니다. '강원풍력'은 '강원'으로 찾을 수 있지만 '풍력'으로는 찾을 수 없습니다. 짧은 검색어(3자 이하)는 부분일치를 함께 시도합니다."
- 결과 카드: 사업명(h3), 시·도/시·군·구, 용량(MW), 평가시기, EIASS 링크 아이콘.
- 빈 상태: "조건에 맞는 사례가 없습니다. facet 을 줄이거나 검색어를 짧게 해보세요."
- 정렬: **최신순(`evaluation_year DESC, fetched_at DESC`) 고정**. 관련도순(BM25)은 v1.
- 페이지네이션: `LIMIT 50` 고정. "더 보기" 버튼으로 50씩 추가. 총 카운트는 `<details>` 안에 작게 표기 ("전체 N건").
- "Markdown 내보내기" 버튼: 현재 화면의 카드 데이터를 표 형식 `.md`로 다운로드.
- **Facet 의미 규칙**: 같은 facet 안의 다중 체크는 **OR** (예: 시·도 강원+전남 = 강원 OR 전남), 서로 다른 facet 간은 **AND** (시·도 ∩ 규모 ∩ 연도). v0는 facet별 카운트(예: "강원 (123)")를 **표시하지 않는다** — 카운트 쿼리 추가 비용 회피, v1+에서 평가.

### 5.2 상세 페이지 (`/cases/[caseId]`, 모바일 전용 + 데스크톱 직접 진입 fallback)

- 상단: 사업명 (h1) + 업종 배지 + 위치 + 용량 + 평가시기.
- 본문: 메타데이터 dl 목록 + "EIASS 원문 열기" CTA (큰 버튼).
- 본문 미인용. "본 도구는 사례 메타데이터만 표시합니다. 본문은 EIASS 원문에서 확인하세요."

### 5.3 진입 동선

- 좌측 네비에 "유사사례" 링크 추가.
- `/projects/[id]` 자료 탭 옆에 "유사사례" 버튼 (현재 프로젝트의 시·도·용량을 prefilled facet으로 전달).

## 6. 기술 선택

- 인덱싱 워커: Cloudflare **Cron Trigger** (별도 Worker 또는 기존 cleanup worker에 일정 추가).
- 동기화 주기: **주 1회** (매주 월요일 03:00 KST = 일요일 18:00 UTC). 이유:
  1. 환경영향평가 신규 협의 빈도가 일 단위가 아님.
  2. **10,000회/일** 한도 안전 마진 확보 (실측 전 추정).
  3. 첫 부트스트랩은 **수동 1회** (Wrangler `--var BOOTSTRAP=true` 식 트리거). 정기 cron은 그 후 활성화.
- 호출량 모델 (cron 1회 sync 기준, 2026-04-26 P1 갱신):
  - list `getDscssBsnsListInfoInqire` × `searchText∈['풍력','해상풍력','육상풍력']` × 페이지(`numOfRows=100`, 부트스트랩 ≤ 50p) = 3 × 50 = **≤ 150 호출**.
  - Ing detail `getDscssSttusDscssIngDetailInfoInqire` × **onshore** 후보 N건 (현 운영 N=10; 해상풍력 ~68건은 wind_offshore filter 로 skip) × retry ≤1 → **≤ 20 호출/sync**.
  - 합계: **≤ 170 호출/sync** (한도 10,000/일의 1.7%).
  - 부트스트랩 실측 추정 (15142987 total 7,434, onshore 풍력 ~10): **≤ 170 호출/sync**.
  - N 변동 시 자동 스케일링 — N ≤ 500 까지 안전 마진 유지 (한도의 5% 이내).
  - 주간 신규분만: ≤ 30 호출/주 추정 (대부분 list, detail 거의 없음). 한도의 0.3% 미만.
- 호출 한도 가드: 인덱서가 `api_calls > 8000` 도달 시 즉시 중단·`error`에 기록·다음 주 재개. (실측 호출량 ≤ 170 으로 큰 마진.)
- 검색 API: D1 `prepare().bind().all()`. FTS5 + LIKE fallback (§4.2).
- 클라이언트 상태: URL 쿼리 단일 소스 (facet/검색어/페이지). `nanostores` 미사용.
- Markdown export: 클라이언트만으로 생성 (기존 `src/features/scoping/markdown-export.ts` 패턴 재사용).
- 테스트: Vitest 단위 (인덱서·검색 쿼리·markdown export) + Playwright e2e 2 시나리오 (검색 happy path, facet 조합).
- HTTP 캐시: `GET /api/cases?...`는 `Cache-Control: public, max-age=300` (5분). 같은 쿼리 반복 시 D1 부하 절감.

## 7. Out of Scope (v0에서 하지 않는 것)

- 다른 EIA 데이터셋 인덱싱 (예: `15142988` 본안 공람 등) — v1. (`15142987` 협의현황은 v0 본 spec 데이터셋, P1 patch 로 detail 통합 완료.)
- 카테고리 A 환경현황 14종 — v1.
- 지도 뷰 (시·도 마커) — v1.
- 관련도순 정렬 (BM25) — v1.
- "이 규칙에 해당하는 과거 사례" scoping↔similar-cases 결합 — v1.
- 즐겨찾기·"최근 본 사례" 사용자별 저장 — v1+ (Q7 정신과 충돌하므로 별도 OH 필요).
- 본문 텍스트 인용 (협의의견 N줄 미리보기 등) — §2-4 회색지대, 별도 OH.
- 트라이그램·n-gram 한글 토크나이저 — v1.
- 다른 업종 (태양광·도로·산업단지) — v2.

## 8. 비-목표 정교화 가드

- "검색어 자동완성" — 사용자 검색어 서버 보존이 필요해지므로(Q7 위반) v0에서 만들지 않음.
- "유사도 점수 표시" — 관련도순(v1) 도입 후 평가.
- "사례 비교 표 (2개 사례 나란히)" — 사용자가 Markdown export로 직접 만들 수 있음. 자동 비교는 v1+.

## 9. 성공 지표 (v0 출시 기준)

- 평가사 1명이 30초 안에 "강원 풍력 ≥10MW 2023년 이후" 사례 5건 이상 식별 가능.
- 인덱스 부트스트랩 완료 후 데이터 누락 ≤ 5% (수동 sampling 10건).
- `/design-review` + 단정 표현 grep 통과.
- Playwright 2 시나리오 (검색 happy / facet 조합) 100% green.
- Lighthouse 성능·접근성 각 ≥ 90 (`/cases`).

## 10. 보안·도메인 가드

### 10.1 CLAUDE.md 정합성 체크리스트

| 조항 | 적용 방법 |
|------|----------|
| §2-2 유료 API 금지 | data.go.kr 무료, FTS5 무료, LLM 미사용. ANTHROPIC_API_KEY 등 미참조. |
| §2-3 법적 결론 단정 금지 | 검색 결과는 사실 메타데이터만. UI 문구에 "유사사례입니다" 단정 X, "참고 가능한 과거 사례" 표현. |
| §2-4 EIASS 원문 재호스팅 금지 | 메타데이터(사업명/지역/규모/연도/주소)만 D1 저장. `eiaAddrTxt` 는 사업지 주소(메타)이며 본문 텍스트가 아니므로 적재 허용. 공람·협의의견 등 본문 텍스트 필드(있다면)는 `source_payload` 화이트리스트에 미포함, 인덱서가 trim. EIASS deep-link만. |
| §2-5 MVP 범위 | Q8a 그대로. data.go.kr EIA 데이터셋 1종(15142987 환경영향평가 협의현황)만 인덱싱. 15142998 zod 스키마는 rollback 보존, 인덱서 경로에서 미사용. |
| §5 표준 스키마 | 검색 결과는 분석 결과가 아니므로 `{result, basis, ...}` 미적용. 단 결과 페이지 하단에 고정 푸터 "본 도구는 검토 보조이며 현지조사·전문가 검토를 대체하지 않습니다." 유지. |
| §9.2 단정 표현 | 카드/배지/툴팁/에러 문구에 "협의 통과", "승인됨", "법적으로 문제없음" 등 단정어 grep 차단 (기존 lint-copy.ts 규칙 그대로 적용). |

### 10.2 SERVICE_KEY 사용 범위

- 인덱싱 워커에서만 사용. 사용자 요청 처리 핸들러에서는 **호출하지 않는다** (Q5a 빌드타임 인덱싱).
- 사용자 검색은 항상 D1 자체 인덱스에서 응답. SERVICE_KEY가 없어도 검색은 동작 (데이터 신선도만 정지).
- key는 `.dev.vars` (로컬) + `wrangler pages secret put SERVICE_KEY` (운영). 채팅·로그·에러 메시지에 값 비노출 (MEMORY 규칙).

### 10.3 검색 로그 비저장 (Q7)

- `GET /api/cases` 핸들러는 검색어·facet·결과 카운트를 **어떤 영구 저장소에도 쓰지 않는다**.
- Cloudflare Workers `console.log`만 허용 (검색어 자체는 로깅 금지, 결과 카운트만). Cloudflare 로그 보존 정책에 의존.
- 사용자 식별자(jwt jti, IP)는 검색 핸들러에서 절대 결합하지 않음.

### 10.4 인덱싱 워커 안전장치

- 호출 한도 가드: 1회 sync `api_calls > 8000` 도달 시 즉시 중단·`error`에 기록·다음 주 재개 (한도 10,000/일의 80% 컷).
- 실패 시 인덱스 손상 방지: 새 데이터를 stage 테이블 (`eia_cases_staging`)에 적재. detail 호출 완료 + derived 컬럼 변환 검증 통과 후 단일 트랜잭션으로 `eia_cases` 와 swap (rename). list 단계 실패 시 stage 폐기, 운영 인덱스 무영향.
- 재호스팅 가드: `source_payload` 는 **§4.3 화이트리스트 필드만** JSON.stringify. API 응답에 본문 텍스트 필드 또는 PII 필드 (CCM 담당자명/이메일 등) 포함 시 인덱서가 (a) alarm 로그 (b) 해당 필드 drop (c) `records_skipped` 증가 시키고 진행. **Opinion detail endpoint 자체를 호출 안 함** (§2 사용 안 함 detail endpoint 정책).
- detail 호출 정책 (P1, 2026-04-26): list 에서 풍력 candidate 식별 행만 Ing detail (`getDscssSttusDscssIngDetailInfoInqire`) 호출. detail 응답 `eiaCd` 누락/불일치 → 해당 detail 폐기 (list-only fallback). envelope `header.resultCode !== '00'` 또는 zod 실패 → **retry 1회 후 list-only fallback**. items 빈 응답 (`totalCount=0`) → list-only fallback (정상 흐름, error 미기록).
- 카운터 (`eia_cases_sync` + console.log): `detail_called`, `detail_success`, `detail_retry`, `detail_failed`, `region_matched`, `region_unmatched`. 부트스트랩/주간 sync 동일 처리 (분기 코드 회피).

### 10.5 EIASS deep-link URL 형식

- **현행 URL**: `https://www.eiass.go.kr/biz/base/info/searchListNew.do?menu=biz&sKey=BIZ_CD&sVal=<eiaCd>`
- 매핑: data.go.kr 의 `eiaCd` ≡ EIASS 의 `BIZ_CD`. 사용자 직접 검증 (2026-04-26).
- 함수 시그니처: `eiassProjectUrl(eiaCd: string): string`. `encodeURIComponent` 적용.
- URL 패턴 변경 시 `packages/eia-data/src/deep-link.ts` 단일 지점만 갱신.
- 폐기된 패턴: `/proj/view.do?projectId=` (404, 2026-04-26 확인).

## 11. 운영 가드

- 인덱스 부트스트랩 1회 호출량(현 추정 ≤ 170, 2026-04-26 P1 갱신: list ≤150 + Ing detail ≤20, onshore N=10 기준) 실측 후 §6 추정값 갱신 + cron 주기 재평가. 일 1회로 변경 시 `docs/design/feature-similar-cases.md` 업데이트 + 별도 commit.
- 인덱스 행 수가 5000건을 넘으면 LIKE fallback 비용 측정 — 트라이그램 도입을 v1로 검토.
- D1 마이그레이션 0003 + 0004 는 **운영 dry-run 후 적용**. project-shell의 0001/scoping의 0002 패턴 그대로. 0004 는 `eia_cases` DROP & CREATE 이므로 (a) 적용 시점 운영 행수 0 인지 확인 후 (b) 인덱서 부트스트랩 재실행 필요.
- 데이터셋 ID 변경 사실 (`15000800` → `15142998` → `15142987`) 은 §12 결정 로그 + ADR 0001 보강(별도 commit) 으로 추적.
- ~~detail API 통합 (15142987 detail operation 식별·zod·transform 확장) 은 별도 hotfix/commit 으로 분리.~~ → **2026-04-26 P1 patch 로 통합 완료** (Ing detail 호출 + biz_nm regex region fallback). list-only 컬럼 (eia_addr_txt, drfop_*, biz_size 등) 은 spec 상 미사용 (15142987 detail 응답에도 부재).

### 11.1 P1 detail 통합 배포 절차 (2026-04-26 P1)

1. **Phase 0** — TDD RED 5 file 1:1 unit tests commit. `npm test` 명백한 실패 확인.
2. **Phase 1** — `data/region/sigungu-lut.json` 19 entry import + KOSTAT 코드 확정 + region-parser GREEN. unit tests pass.
3. **Phase 2** — `transform.ts` Ing detail merge + region merge GREEN. transform unit tests pass.
4. **Phase 3** — cases-indexer Ing detail call 통합 + retry/fallback. 부트스트랩 dry-run (`BOOTSTRAP=true`) 로컬 1회.
5. **Phase 4** — 운영 D1 staging swap. 트리거 명령:
   - 1번 터미널: `npx wrangler dev --config workers/cases-indexer.wrangler.toml --remote --test-scheduled`
   - 2번 터미널: `curl 'http://127.0.0.1:8787/__scheduled?cron=0+18+*+*+0'`
   - 1번 터미널 wrangler dev summary 로그 (records_added / skip_reasons / detail_*) 캡처
   - §11.3 DoD SQL 5건 통과 확인 후 Phase 5a 진입.
6. **Phase 5a** — 운영 검증 (UI 4건 + DoD SQL 5건 + console.log 카운터). **미커밋**.
7. **Phase 5b** — 검증 통과 후 handover doc 갱신 (`2026-04-26-similar-cases-deployed.md` → P1 배포 결과 추가) + commit.

### 11.2 P1 DoD (Definition of Done)

- `evaluation_stage`: CHECK 통과 (`'본안'`/`'전략'`/`'unknown'` 모두 valid — 'unknown' 도 정상 적재). 운영 품질 임계: Ing detail 호출 성공률 = `detail_success / detail_called` ≥ **80%** (호출 자체의 가용성 임계, mapping 결과와 별개).
- `region_sido`: NULL 비율 ≤ **50%** (P1 임계). **분모: 운영 적재 행 전체 (industry='onshore_wind' 통과한 행)**. 운영 10건 기준 추정 7/10 매칭 → NULL 30% → 임계 통과. 미달 시 §11.5 재인덱싱 트리거 절차 발동.
- `region_sido_code`: `region_sido` not NULL 인 행은 모두 not NULL (LUT 일관성).
- `source_payload`: PII 필드 (`ccilMemEmail`, `ccilMemNm`) grep **0 결과** (BLOCKING). 본문 텍스트 필드 grep 0 결과. **검증 timing: Phase 5a §11.3 DoD SQL 4번째 query 실행 시 동시 검증** (사용자 SQL 1회 실행으로 cover). grep 결과 > 0 발견 시 인덱서 즉시 stop + staging 폐기 + spec patch 재논의.
- detail call 카운터: `detail_called >= onshore_후보_수 × 0.9` (90% 이상 호출 시도, retry 포함).

### 11.3 P1 DoD SQL (사용자가 직접 실행할 명령, handover 에 추가 예정)

```sql
-- 분포 (stage / region_sido / NULL count)
SELECT evaluation_stage, COUNT(*) AS n FROM eia_cases GROUP BY evaluation_stage;
SELECT region_sido, COUNT(*) AS n FROM eia_cases GROUP BY region_sido ORDER BY n DESC;
SELECT
  SUM(CASE WHEN evaluation_stage = 'unknown' THEN 1 ELSE 0 END) AS stage_unknown,
  SUM(CASE WHEN region_sido IS NULL THEN 1 ELSE 0 END) AS sido_null,
  COUNT(*) AS total
FROM eia_cases;
-- PII 누출 검증
SELECT COUNT(*) FROM eia_cases WHERE source_payload LIKE '%ccilMemEmail%' OR source_payload LIKE '%ccilMemNm%';
-- 스팟 체크 10건
SELECT eia_cd, biz_nm, region_sido, region_sigungu, evaluation_stage FROM eia_cases LIMIT 10;
```

### 11.4 UI 검증 4건 (Phase 5a)

1. `/cases` 첫 진입: 카드에 `'경상북도 영양군'` 등 region 라벨 표시.
2. 시·도 facet '강원도' 체크 → 강릉/삼척/양양 사례만 노출.
3. 카드 → EIASS deep-link 클릭 → 새 탭 정상 이동.
4. evaluation_stage 배지 (`'본안'`/`'전략'`/`'unknown'`) 카드 우상단에 표시.

### 11.5 재인덱싱 트리거 절차 (region_sido 50% DoD 미달 시)

DoD §11.2 region_sido NULL 비율 > 50% 인 경우:

1. 운영 D1 에서 NULL region 행의 `bizNm` 추출:
   ```sql
   SELECT eia_cd, biz_nm FROM eia_cases WHERE region_sido IS NULL ORDER BY eia_cd;
   ```
2. `bizNm` 에서 시·군·구 토큰 수동 추출 (예: `'완도해상풍력'` → `'완도'`).
3. `data/region/sigungu-lut.json` 에 entry 추가 (sidoCode 검증 포함).
4. region-parser unit test 1건 추가 (TDD RED → GREEN).
5. 운영 D1 staging swap 재실행 (§11.1 Phase 4 절차 그대로).
6. §11.2 region_sido NULL 비율 재측정 → 50% 통과 시 종료, 미달 시 1번부터 반복.
7. 모든 단계는 별도 commit (LUT 추가 + test 추가 + 재인덱싱 결과 handover 갱신).

## 12. 결정 로그 (Office Hours 답변 요약)

| Q | 결정 | 근거 |
|---|------|------|
| Q1 | **15142987** 단일 인덱싱 (재보정 2026-04-26) | 15142998 (공람정보) 은 현재 공람창 사업만 노출 → 풍력 0건. 15142987 (협의현황) 은 7,434건 전수, 풍력 후보 ~44건 확보. 초기 후보 `15000800` (2026-04-25 부적합 판정) 이력 유지. |
| Q2 | 4 facet (업종/시·도/규모/연도) | 풍력 1업종이지만 v0에 충분 |
| Q3 | 데스크톱 리스트+미리보기, 모바일 768px 이하 리스트만 | 지도는 좌표 결손 비용 ↑, 모바일은 단순화 |
| Q4 | 메타데이터만, EIASS deep link | §2-4 정신 가장 보수적 해석 |
| Q5 | 빌드타임 인덱싱 (cron 주 1회) | **10,000회/일** 한도 안전 마진 |
| Q6 | D1 + FTS5 (unicode61) + 인덱서 단계 `searchText` 보조 | 무료, 풍력 1업종 규모에 충분 |
| Q7 | 검색어/결과 서버 보존 0 | "서버 업로드 0 유지" 정신 |
| Q8 | 검색창 + 리스트 + 4 facet + EIASS deep link + Markdown export | scoping 결합은 v1 |

추가 노트:
- Q3 미리보기 패널은 데스크톱 우선, 모바일 768px 이하는 리스트만 (사용자 명시).
- Q5 cron 주기: **주 1회 월요일 03:00 KST** (본 spec에서 결정).
- Q8 v0 정렬: **최신순 1개만**. 관련도순(BM25)은 v1.
- **데이터셋 ID 정정 (2026-04-25)**: 초기 spec 의 `15000800` 은 실제로 GIS 좌표 기반 환경 측정 API. 사례 검색용 정답은 `15142998` (환경영향평가 초안 공람정보). 사용자 직접 검증으로 확정. 일 한도도 **1,000 → 10,000** 으로 정정.
- **데이터셋 재교체 (2026-04-26)**: 부트스트랩 1차 실행 결과 `15142998` 은 현재 공람 진행 사업만 노출 (총 15건, 풍력 0건). 인덱싱 가치 부재 확인 후 `15142987` (환경영향평가 협의현황, 7,434건) 으로 재교체. 응답 shape 변경 (bizGubunCd/drfopTmdt/eiaAddrTxt 등 부재) 에 따라 (a) zod 스키마 신규(`dscssBsnsListItemSchema`), (b) wind-filter regex-only, (c) transform list-only + `evaluation_stage='unknown'`, (d) migration 0004 (CHECK 완화) 도입. 기존 `15142998` zod 스키마는 rollback 가능성 위해 코드 보존. ~~detail API 통합은 후속 commit 으로 분리.~~ → **2026-04-26 P1 patch 로 통합 (§12.1 참조)**.
- **EIASS deep-link URL 보정 (2026-04-26)**: 기존 `https://www.eiass.go.kr/proj/view.do?projectId=<eiaCd>` 가 404 응답. 사용자 브라우저 직접 검증 결과 실제 동작 URL 은 `/biz/base/info/searchListNew.do?menu=biz&sKey=BIZ_CD&sVal=<eiaCd>` (BIZ_CD ≡ eiaCd). `eiassProjectUrl(ref: EiassProjectRef)` → `eiassProjectUrl(eiaCd: string)` 시그니처 단순화. `EiassProjectRef` 타입 제거. 모든 caller (markdown-export, CasePreviewPane, [caseId].astro) 호출부 수정. §10.5 신설.

### 12.1 Office Hours P1 — detail API 통합 (2026-04-26)

| Q | 결정 | 근거 |
|---|------|------|
| Q1 | **Ing detail 단독 채택**, Opinion detail 미사용 | 사용자 raw payload 검증: 둘 다 `eiaAddrTxt` 부재 → region 보강 가치 동일. Opinion 은 PII (CCM 이메일/이름) 포함 → 호출 자체 회피가 §10.4 가드에 부합. |
| Q2 | **Full refresh, no delay, no timeout** | v0 풍력 N<500 → 호출 한도 안전. stateNm 변동이 stepChangeDt 와 비동기 → incremental 누락 위험. 코드 단순 = 결함 표면 최소화. |
| Q3 | **Retry 1회 → list-only fallback**, 부트스트랩/cycle 동일 처리 | list PK 누락 시 `unknown` skip 유지. 분기 코드 회피로 결함 표면 ↓. |
| Q4 | **stateNm 매핑 5단계 + 정렬 후 first + 빈 응답 → 'unknown'** | 매핑 우선순위 ① '전략' ② '본안'/'협의'/'변경협의' ③ 그 외. 정렬 키 `resReplyDt DESC → applyDt DESC → API order`. CHECK 통과. |
| Q5 | **biz_nm regex + sigungu LUT, sigungu first → first match → 광역시 우선, 50% DoD** | 두 detail 모두 `eiaAddrTxt` 부재. LUT 1차 import 6개 (영양/강릉/의성/청송/삼척/양양) 으로 운영 10건 즉시 매칭. |
| Q6 | **transform 호출 시그니처 확장 + test fixtures + TDD** | Phase 0 RED 우선. fixture 4종 (1차 협의/1차변경협의본안/변경협의/빈 응답). |
| Q7 | **Vertical modular 5 file + DoD SQL + 기존 swap backup + sync 별도 트랙** | 5 file 시그니처 검토 게이트 in Design. transform.ts 확장 영향 명시. |
| Q8 | **handover 갱신 + DoD 임계 (region 50%, detail success 80%) + Phase 5a/5b 분리** | 5a 검증 (no commit) → 5b handover commit. |

추가 노트:
- §4.4 region 매핑 알고리즘 신설. biz_nm regex + sigungu LUT 1차 import 6 entry. **KOSTAT 시·도 코드 확정은 Phase 1** (현 spec 의 sidoCode 잠정값).
- Ing detail envelope zod 는 `response.body.items.item` union (single object | array) 처리 (data.go.kr 공통 envelope 패턴).
- §11.1 Phase 5 분리: 5a (검증, 미커밋) + 5b (handover commit).
