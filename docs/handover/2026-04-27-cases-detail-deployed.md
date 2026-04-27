# Handover — cases detail integration deployed (P1)

**Date:** 2026-04-27
**Branch:** main (cases-detail worktree)
**Scope:** data.go.kr 15142987 Ing detail (`getDscssSttusDscssIngDetailInfoInqire`) 통합으로
`evaluation_stage='unknown'` 와 `region_sido=NULL` 갭을 채우는 P1 작업 마감.

관련 커밋:
- `34b508c` test(cases): add sigungu-parser 어근-only RED case (운영 데이터 패턴)
- `69e35dd` feat(cases): add sigungu LUT + bizNm region parser with substring fallback (P1)
- `211c0a6` feat(cases): integrate Ing detail + evaluation-stage-mapper into transform (P1)
- `1970855` feat(cases-indexer): add Ing detail fetch with retry + list-only fallback (P1)
- `b05e564` fix(cases-ui): map facet short labels to KOSTAT codes for D1 matching

---

## 1. 배포 결과

cases-indexer Worker 1회 실행 카운터 (production, 2026-04-27):

| 카운터 | 값 |
|---|---|
| records_total | 78 |
| records_added | 10 |
| records_skipped | 68 (wind_offshore) |
| detail_called | 10 |
| detail_success | 10 |
| detail_retry | 0 |
| detail_failed | 0 |
| region_matched | 6 |
| region_unmatched | 4 |

UI: Cloudflare Pages `https://459fa583.eia-workbench-v0.pages.dev` (verified).

---

## 2. DoD 통과 결과

spec §11.2 DoD 임계 — 전 항목 PASS.

| 항목 | 임계 | 실측 | 결과 |
|---|---|---|---|
| evaluation_stage NOT NULL | 100% | 10/10 (본안 8 + unknown 2) | PASS |
| region_sido NULL 비율 | < 50% | 4/10 = 40% | PASS |
| detail call 성공률 | ≥ 80% | 10/10 = 100% | PASS |
| PII 누출 (ccilMemEmail/Nm) | 0건 | 0건 | PASS |
| facet 시·도 필터 동작 | 정상 | 강원 3 / 경북 3 / 결합 6 / 리셋 10 | PASS |

---

## 3. 알려진 한계 (P3 트래킹)

### (a) sido fallback 누락 — 강원풍력(리파워링) NULL
`bizNm = "강원풍력(리파워링)"` 의 경우 SIGUNGU_TOKEN 매치 실패 + 어근 substring LUT 미스 →
`region_sido = NULL` 로 적재. 광역시·시군구 명사가 없는 행정명(예: "강원풍력") 패턴은
sido-only fallback (e.g. '강원' → sidoCode '51') 가 필요.

### (b) stateNm 매핑 확장 — 삼척 천봉 / 양양 내현 stage=unknown
`stateNm = "본안협의 (협의이전)"` 또는 사전협의 단계 전 텍스트는 mapper 가 unknown 으로 분류.
운영 데이터 샘플:
- `GW2025C001 양양 내현풍력발전단지` → stage=unknown
- `GW2024C019 삼척 천봉풍력발전단지` → stage=unknown

mapper classify 룰을 substring 확장하거나 LIST 단계 정보 (stepChangeDt + bizSizeDan)
fallback 으로 보강 필요.

### (c) CasePreviewPane "위치: 미상" — region_sido/region_sigungu 미참조
`src/components/cases/CasePreviewPane.tsx` 가 `eia_addr_txt` 만 표시하고
`region_sido`/`region_sigungu` 는 참조하지 않음. P1 단계에서 region 6/10 채워졌으나
미리보기 패널은 여전히 "위치: 미상" 출력. UI 컴포넌트 fallback 추가 필요.

---

## 4. 다음 작업 후보

1. **LUT 19 entry 확장** — `data/region/sigungu-lut.json` 6 → 19 (전국 풍력 사업장 시군구 망라).
   현재 6개 (영양/의성/청송/강릉/삼척/양양) 만 등록 → 영덕·울진·제주 등 누락.
2. **다른 EIA 데이터셋 (15142988)** — 협의완료 (Cmpln) 데이터셋. 본안 confirmed 사례
   확보로 검색 풍부도 강화. spec §1 의 "future scope" 후보.
3. **트라이그램 한글 토크나이저** — 현 FTS5 default tokenizer 는 한글 음절 분리 비효율.
   `unicode61 separators=' .,;:?!'` 또는 trigram tokenizer 도입 검토.
4. **광역시 자치구 분리** — 부산 강서구 / 인천 옹진군 등 광역시 자치구 단위 매핑.
   현재 `METRO` 배열은 시·도 레벨에서 정지. 자치구 LUT 추가 시 매칭 정밀도 향상.

---

## 5. GitHub Issue 등록 텍스트 (3건)

### Issue 1 — sido fallback 누락 (P3)

**Title:** `sido fallback for bizNm without sigungu token (e.g. "강원풍력(리파워링)")`

**Body:**
```
## 문제
P1 cases-detail 통합 (2026-04-27) 후 region_sido NULL 비율 40% (4/10).
원인: SIGUNGU_TOKEN 미매치 + 어근 substring LUT 미스 — 행정명 없는 사업명 패턴.

## 사례
- "강원풍력(리파워링)" → region_sido=NULL
- "강원풍력 30MW" → region_sido=NULL

## 해결안
sigungu-parser 에 step 3 추가:
- '강원'/'경북' 등 SIDO_LUT.short substring 매치 → sidoCode + sigungu=null

## 참고
- docs/handover/2026-04-27-cases-detail-deployed.md §3(a)
- src/features/similar-cases/sigungu-parser.ts
```

### Issue 2 — stateNm 매핑 확장 (P3)

**Title:** `evaluation-stage-mapper: extend stateNm patterns for "본안협의" / pre-협의 phases`

**Body:**
```
## 문제
운영 데이터 일부 stateNm 패턴이 mapper 에서 unknown 으로 떨어짐.

## 사례
- "GW2025C001 양양 내현풍력발전단지" → stage=unknown
- "GW2024C019 삼척 천봉풍력발전단지" → stage=unknown

## 원인
mapper classify() 가 '본안' / '협의' (strict) / '변경협의' / '전략' 만 인식.
"본안협의" 또는 사전협의 phase 텍스트 미커버.

## 해결안
1. mapper classify substring 룰 확장 ('본안협의' → 본안)
2. detailItems 비어있을 때 LIST stepChangeDt 기반 fallback

## 참고
- docs/handover/2026-04-27-cases-detail-deployed.md §3(b)
- src/features/similar-cases/evaluation-stage-mapper.ts
```

### Issue 3 — CasePreviewPane region 미참조 (P3)

**Title:** `CasePreviewPane shows "위치: 미상" despite region_sido populated`

**Body:**
```
## 문제
P1 후 region 6/10 채워졌으나 미리보기 패널은 모두 "위치: 미상" 출력.

## 원인
src/components/cases/CasePreviewPane.tsx 가 eia_addr_txt 만 사용.
region_sido / region_sigungu fallback 없음.

## 해결안
표시 우선순위:
1. eia_addr_txt (있으면 그대로)
2. else `${region_sido} ${region_sigungu}` (둘 다 있으면)
3. else `${region_sido}` (시·도만 있으면)
4. else "위치: 미상"

## 참고
- docs/handover/2026-04-27-cases-detail-deployed.md §3(c)
- src/components/cases/CasePreviewPane.tsx
```
