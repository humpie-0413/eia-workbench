# feature/similar-cases — 설계문서 v0

> Office Hours 8문항 (Q1–Q8) + 추가 노트 3건 반영. 사용자가 모든 추천안을 채택 (2026-04-25).
> **2026-04-25 보정**: 사용자 직접 검증 결과 데이터셋 ID 15000800 은 GIS 좌표 기반 측정 API 로 확인되어 부적합. **15142998 환경영향평가 초안 공람정보** 로 교체. §2 / §4 / §6 / §10 / §12 패치.
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
- 인덱스 데이터셋: data.go.kr **`15142998` 환경영향평가 초안 공람정보** 단일.
  - Base URL: `https://apis.data.go.kr/1480523/EnvrnAffcEvlDraftDsplayInfoInqireService`
  - Operation 4종 사용:
    - `getDraftPblancDsplayListInfoInqire` (일반 환경평가 목록)
    - `getDraftPblancDsplaybtntOpinionDetailInfoInqire` (일반 상세 by `eiaCd`)
    - `getStrategyDraftPblancDsplayListInfoInqire` (전략환경평가 목록)
    - `getStrategyDraftPblancDsplaybtntOpinionDetailInfoInqire` (전략 상세, `bizMoney/bizSize` 포함)
  - 풍력 식별 필터: `bizGubn=C` (에너지개발) 또는 `bizGubn=L` (산지개발) → 인덱서가 `bizNm` 정규식으로 후처리.
  - 일 호출 한도: 개발계정 **10,000회/일** (ADR 0001 의 1,000 가정 대비 10배 여유).
- v1+ 후보 데이터셋: `15142987` 환경영향평가 협의현황 (협의의견·결과 풍부). 본문 텍스트 정책(§2-4) 별도 OH 후 도입.

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

```sql
-- D1 migration 0003_similar_cases.sql

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

15142998 list operation은 `searchText` 파라미터를 지원한다 (서버측 LIKE). 인덱서는 `bizGubn=C` 또는 `bizGubn=L` 와 함께 다음 패턴을 순회 호출하여 풍력 후보를 수집한다:

```
searchText ∈ ['풍력', '해상풍력', '육상풍력']
× bizGubn ∈ ['C', 'L']
× 페이지네이션
```

응답에서 `bizNm` 정규식 `/풍력|풍력발전/`로 후처리, 해상풍력은 v0에서 제외한다 (industry='onshore_wind' 가드).

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
| `industry` | (queried `bizGubn`) + `bizNm` | (queried `bizGubn`) `∈ {'C','L'}` AND `/풍력|풍력발전/.test(bizNm)` AND NOT `/해상풍력|해상\s*풍력/.test(bizNm)` → `'onshore_wind'`. 실 응답에 `bizGubunCd` 가 누락되므로 인덱서 호출 파라미터를 신뢰 소스로 사용. | **skip** (행 미적재) |
| `region_sido` | `eiaAddrTxt` | 정규식 `^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(특별시\|광역시\|특별자치시\|도\|특별자치도)?` 첫 매칭. 17개 시·도 LUT (`src/lib/region/sido.ts`) 재사용. | NULL |
| `region_sido_code` | `region_sido` | 17개 시·도 → KOSTAT 2자리 코드 매핑 LUT (project-shell 의 `kostat-code.ts` 패턴). | NULL |
| `region_sigungu` | `eiaAddrTxt` | `region_sido` 이후 토큰에서 `/(\S+?(?:시|군|구))/` 첫 매칭. 시·군·구 LUT 검증은 v1 (오탐 허용). | NULL |
| `capacity_mw` | (전략) `bizSize`·`bizSizeDan` / (일반) `bizNm` | 우선순위 ① `bizSizeDan='MW' or 'kW' or '㎾'`이면 `bizSize` 숫자 추출 후 단위 변환 (kW→MW: ÷1000) ② `bizNm` 정규식 `/(\d+(?:\.\d+)?)\s*(MW|㎿)/i` 첫 매칭 ③ 둘 다 실패 → NULL | NULL (검색 결과에는 노출, 규모 facet 에서는 제외) |
| `area_ha` | (전략) `bizSize`·`bizSizeDan` | `bizSizeDan` 분기: `'ha'` 그대로 / `'㎡'` ÷ 10000 / `'㎢'` × 100 / 그 외(`MW`, `kW` 등) → NULL. 일반 operation 응답에는 `bizSize` 가 없으므로 NULL. | NULL |
| `evaluation_year` | `drfopTmdt` 또는 `drfopStartDt` | `drfopStartDt` 우선 (YYYY-MM-DD), 없으면 `drfopTmdt` 첫 4자리 정수 (점·대시 구분자 양쪽 허용). `< 2000` 또는 `> 현재연도+1` 이면 NULL. | NULL |
| `evaluation_stage` | origin operation | `getDraftPblancDsplay*` 계열 → `'본안'`, `getStrategyDraftPblancDsplay*` 계열 → `'전략'`. | (origin operation 외 사용 안 함, CHECK 위반 시 적재 거부) |
| `source_payload` | list+detail merge | list 응답 item + detail 응답 item 의 화이트리스트 필드 (§4.1 컬럼 + 협의 메타) JSON.stringify. **본문 텍스트 필드는 화이트리스트 미포함** (§2-4, §10.4 재호스팅 가드). | (불가, 적재 거부) |
| `eia_cd` | `eiaCd` | 그대로 (`PRIMARY KEY`). list 응답에서 누락된 행은 적재 거부. | (skip) |

특이 케이스:
- 같은 `eia_cd` 가 일반 + 전략 양쪽 list 에 등장 → `evaluation_stage` 우선순위 = **전략**. 인덱서 실행 순서는 **(1) 일반 stage list → (2) 일반 detail → (3) 전략 stage list → (4) 전략 detail → (5) merge (전략 우선 덮어쓰기) → (6) 단일 트랜잭션 swap**. (5) 단계에서 `eia_cd` 충돌은 전략 행이 일반 행을 덮어쓴다 (`INSERT OR REPLACE`).
- `bizSize` 가 `'30MW, 부지 50ha'` 처럼 복합 표기인 경우 → `capacity_mw` 정규식 + `area_ha` 정규식 각각 적용 (둘 다 채움).
- `eiaAddrTxt` 가 다중 시·도 (`'강원 평창군 외 1'`) → `region_sido='강원'` 만 적재. v1 에서 다중 지역 컬럼 검토.

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
- 호출량 모델 (cron 1회 sync 기준):
  - list `getDraftPblancDsplayList...` × `searchText∈['풍력','육상풍력']` × `bizGubn∈['C','L']` × 페이지(`numOfRows=100`, 가정 ≤ 5p) = 4 × 5 = **≤ 20 호출**
  - list `getStrategyDraft...` 동일 조합 = **≤ 20 호출**
  - 풍력 후보 N건 식별 → detail by `eiaCd` (일반 + 전략 각각) = **≤ 2N 호출**
  - 부트스트랩 추정: 풍력 누적 사업 N ≈ 200 → 총 ≈ 40 + 400 = **≤ 440 호출/sync** (실측 후 본 spec 패치)
  - 주간 신규분만: ≤ 50 호출/주 추정. 한도(10,000/일)의 0.5% 미만.
- 호출 한도 가드: 인덱서가 `api_calls > 8000` 도달 시 즉시 중단·`error`에 기록·다음 주 재개.
- 검색 API: D1 `prepare().bind().all()`. FTS5 + LIKE fallback (§4.2).
- 클라이언트 상태: URL 쿼리 단일 소스 (facet/검색어/페이지). `nanostores` 미사용.
- Markdown export: 클라이언트만으로 생성 (기존 `src/features/scoping/markdown-export.ts` 패턴 재사용).
- 테스트: Vitest 단위 (인덱서·검색 쿼리·markdown export) + Playwright e2e 2 시나리오 (검색 happy path, facet 조합).
- HTTP 캐시: `GET /api/cases?...`는 `Cache-Control: public, max-age=300` (5분). 같은 쿼리 반복 시 D1 부하 절감.

## 7. Out of Scope (v0에서 하지 않는 것)

- 다른 EIA 데이터셋 인덱싱 (`15142987` 협의현황, `15142988` 본안 공람 등) — v1.
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
| §2-5 MVP 범위 | Q8a 그대로. data.go.kr EIA 데이터셋 1종(15142998 환경영향평가 초안 공람정보)만 인덱싱. |
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
- 재호스팅 가드: `source_payload` 는 **§4.3 화이트리스트 필드만** JSON.stringify. API 응답에 본문 텍스트 필드(예: 공람 본문, 협의의견 전문)가 포함돼 들어오면 인덱서가 (a) alarm 로그 (b) 해당 필드 drop (c) `records_skipped` 증가 시키고 진행 — spec 위반 자동 차단.
- detail 호출 정책: list 응답이 풍력 candidate 으로 식별된 행만 detail 호출 (전체 list × detail 회피). detail 응답에 `eiaCd` 누락 또는 list 와 불일치 시 skip.

## 11. 운영 가드

- 인덱스 부트스트랩 1회 호출량(현 추정 ≤ 440) 실측 후 §6 추정값 갱신 + cron 주기 재평가. 일 1회로 변경 시 `docs/design/feature-similar-cases.md` 업데이트 + 별도 commit.
- 인덱스 행 수가 5000건을 넘으면 LIKE fallback 비용 측정 — 트라이그램 도입을 v1로 검토.
- D1 마이그레이션 0003은 **운영 dry-run 후 적용**. project-shell의 0001/scoping의 0002 패턴 그대로.
- 데이터셋 ID 정정 사실 (`15000800` → `15142998`) 은 §12 결정 로그 + ADR 0001 보강(별도 commit) 으로 추적.

## 12. 결정 로그 (Office Hours 답변 요약)

| Q | 결정 | 근거 |
|---|------|------|
| Q1 | **15142998** 단일 인덱싱 (보정) | 사례 검색 본질에 가장 직접. 초기 후보 `15000800` 은 GIS 측정 API 로 확인되어 부적합 (2026-04-25 사용자 검증). |
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
