# 2026-04-25 — similar-cases API shape 검증 (해결됨)

## 결론

- 초기 spec 의 데이터셋 ID `15000800` 은 **GIS 좌표 기반 환경 측정 API** (15142999 환경영향평가 정보 서비스 계열) 로 확인되어 사례 검색 용도 부적합.
- 사례 검색 정답 데이터셋 = **`15142998` 환경영향평가 초안 공람정보** (한국환경연구원).
- 일 호출 한도 정정: **1,000회/일 → 10,000회/일** (개발계정 기준).
- spec `docs/design/feature-similar-cases.md` 의 §2 / §4.1 / §4.2 / §4.3 / §6 / §10 / §11 / §12 패치 완료.

## 정답 데이터셋 메타 (사용자 직접 검증)

- Base URL: `https://apis.data.go.kr/1480523/EnvrnAffcEvlDraftDsplayInfoInqireService`
- Operation 4종:
  - `getDraftPblancDsplayListInfoInqire` — 일반 환경평가 초안 공람 목록
  - `getDraftPblancDsplaybtntOpinionDetailInfoInqire` — 일반 상세 (by `eiaCd`)
  - `getStrategyDraftPblancDsplayListInfoInqire` — 전략환경평가 초안 공람 목록
  - `getStrategyDraftPblancDsplaybtntOpinionDetailInfoInqire` — 전략 상세 (`bizMoney`/`bizSize`/`bizSizeDan` 포함)
- 풍력 식별 1차 필터: `bizGubn=C` (에너지개발) 또는 `bizGubn=L` (산지개발).
- 검색 보조: list operation `searchText` 파라미터 (서버측 LIKE).

## 매핑 표 (확정)

> 매핑 알고리즘은 spec §4.3 (컬럼 변환 규칙) 표 참조.

| spec eia_cases 컬럼 | 실제 API 응답 키 | 매핑 가능 | 변환 |
|---|---|---|---|
| `eia_cd` | `eiaCd` | ✅ | passthrough (PK) |
| `eia_seq` | `eiaSeq` | ✅ | passthrough |
| `biz_gubun_cd` | `bizGubunCd` | ✅ | passthrough, CHECK ('C','L') |
| `biz_gubun_nm` | `bizGubunNm` | ✅ | passthrough |
| `biz_nm` | `bizNm` | ✅ | passthrough (FTS 인덱싱 대상) |
| `biz_main_nm` | `bizmainNm` (detail) | ✅ | passthrough |
| `approv_organ_nm` | `approvOrganNm` (detail) | ✅ | passthrough |
| `biz_money` | `bizMoney` (strategy detail) | ✅ | passthrough (원 단위 INTEGER) |
| `biz_size` | `bizSize` (strategy detail) | ✅ | passthrough (raw, derived 변환 대상) |
| `biz_size_dan` | `bizSizeDan` (strategy detail) | ✅ | passthrough |
| `drfop_tmdt` | `drfopTmdt` | ✅ | passthrough |
| `drfop_start_dt` | `drfopStartDt` (detail) | ✅ | passthrough |
| `drfop_end_dt` | `drfopEndDt` (detail) | ✅ | passthrough |
| `eia_addr_txt` | `eiaAddrTxt` (detail) | ✅ | passthrough (지역 파싱 source) |
| `industry` | (derived) | ✅ | bizGubunCd + bizNm 정규식 (§4.3) |
| `region_sido` / `_code` / `_sigungu` | (derived) | ✅ | eiaAddrTxt 파싱 (§4.3) |
| `capacity_mw` | (derived) | ⚠️ | 일반 API 는 bizNm 정규식 의존 (NULL 허용) |
| `area_ha` | (derived) | ⚠️ | 전략 API 만, 단위 분기 (NULL 허용) |
| `evaluation_year` | (derived) | ✅ | drfopStartDt 또는 drfopTmdt 파싱 |
| `evaluation_stage` | (derived) | ✅ | origin operation 분기 ('본안'/'전략') |

## 진행 차단 원인 (해결됨)

1. ~~로컬 SERVICE_KEY 부재~~ → 사용자가 직접 데이터셋 메타데이터를 확인하여 우회.
2. ~~외부 문서 접근 실패~~ (data.go.kr / eiass.go.kr 사이트 socket close / cert error) → 사용자 환경에서 직접 조회.

## 후속 조치

- spec patch 4건 (§2 dataset / §4.1 schema / §4.3 변환 규칙 신설 / §6 cron 한도 8000 + 호출량 모델) — 완료.
- spec consistency patch 5건 (§3 caseId, §7 dataset ID, §10.1/§10.4 가드, §11 운영, §12 결정 로그) — 완료.
- ADR 0001 의 "1,000회/일" 표기는 별도 commit 으로 보강 예정 (본 spec 내 §11 에 cross-ref).
- `packages/eia-data` PortalClient 의 base URL / operation 상수 / 응답 zod 스키마는 **plan 단계 Task 0** 에서 정의 (현 spec 은 데이터 모델만 확정).

## 미검증 / 후속 OH 필요

- `bizSize` 의 실제 패턴 분포 (예: `'30MW'`, `'30,000kW'`, `'50ha'`, `'30MW · 50ha'` 중 어느 형태가 다수인지) — 부트스트랩 1회 후 실측.
- `eiaAddrTxt` 다중 시·도 표기 비율 → v1 다중 지역 컬럼 도입 우선순위.
- v1 후보 `15142987` 환경영향평가 협의현황 의 협의의견 본문 텍스트 필드 정책 (§2-4 회색지대) — 별도 OH.

## 보고

A — 매핑 검증 완료, spec 보정 패치 모두 반영. plan 작성 진입 가능.
