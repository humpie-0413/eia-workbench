# Handover — P3 CasePreviewPane region fix deployed

**Date:** 2026-04-28
**Branch:** main (PR #11 + PR #12 merged)
**Scope:** P1 cases-detail integration 후속 결함 fix. CasePreviewPane 와
`[caseId].astro` 가 `eia_addr_txt` (운영 D1 전 행 NULL) 만 참조하여 항상 "위치:
미상" 출력하던 결함을 `region_sido`/`region_sigungu` fallback chain 으로 해소.
`formatLocation` helper 추출하여 카드 (CaseResultCard) 와 동일 패턴 적용.

관련 커밋:
- `0060a92` fix(cases-ui): CasePreviewPane region 표시 결함 (region_sido/sigungu fallback) (#11)
- `338c1df` [P3] cases-ui: CasePreviewPane region 표시 결함 fix (#12)
  (PR #12 = #11 merge 직후 사전 결함 prettier drift 2 file 사후 정리)

---

## 1. 배포 결과

**Pages deploy**: `79b5d022` (Cloudflare Pages production, 2026-04-28).
**운영 URL**: https://eia-workbench-v0.pages.dev/cases.

| 검증 항목 | 결과 | 비고 |
|---|---|---|
| 청송 면봉산 카드 클릭 → 미리보기 "위치: 경상북도 청송군" | PASS | 사용자 spot check |
| 9건 동작 (region 6 + NULL 4) | PASS (코드 인용) | helper 단일 진입점, spot check 미실시 |
| 모바일 fallback 페이지 (`/cases/[eiaCd]`) 동일 fix | PASS | helper import + 1줄 patch |

운영 D1 직접 검증 (2026-04-28):

```
SELECT COUNT(*), SUM(CASE WHEN region_sido IS NOT NULL THEN 1 ELSE 0 END) FROM eia_cases;
-- {total: 10, with_region: 6} → P1 결과 그대로 (60%)
SELECT evaluation_stage, COUNT(*) FROM eia_cases GROUP BY evaluation_stage;
-- {본안: 8, unknown: 2}
```

---

## 2. DoD 검증

| 항목 | 임계 | 실측 | 결과 |
|---|---|---|---|
| 카드 ↔ 패널 데이터 일관성 | 동일 region 표시 | 양쪽 `formatLocation(eiaCase)` 호출 | PASS |
| 신규 helper 단위 테스트 | 4 케이스 GREEN | 4/4 PASS | PASS |
| 회귀 (320+ tests) | regression 0 | 320 PASS | PASS |
| Typecheck | clean (§10.1 격리 후) | 1 pre-existing (better-sqlite3) | PASS |
| ESLint | 0 error | clean | PASS |
| Prettier (diff 파일) | clean | format-location.{ts,test.ts} clean | PASS |
| Prettier (사전 drift 2 file) | §10.1 격리 → 사후 정리 | PR #12 에서 evaluation-stage-mapper.test / transform.test 정리 | RESOLVED |
| assertion-grep | 0 결과 | clean | PASS |

수정 전 (`ea5b15b`):
```tsx
<dd className="inline">{eiaCase.eia_addr_txt ?? '미상'}</dd>
```
운영 D1 의 `eia_addr_txt` 모든 행 NULL → 항상 "위치: 미상" 출력.

수정 후 (`338c1df`):
```tsx
<dd className="inline">{formatLocation(eiaCase)}</dd>
```
`region_sido`/`region_sigungu` 우선 fallback. 카드 (CaseResultCard) 와 동일 패턴.

`formatLocation` 시그니처:
```ts
formatLocation({ region_sido, region_sigungu }):
  region_sido + sigungu      → "{sido} {sigungu}"
  region_sido (sigungu null) → "{sido}"
  region_sido null           → "지역 미상"
```

---

## 3. 알려진 한계 (P1 잔존 + 신규 발견)

### (a) sido fallback 미구현 — 4건 NULL (P1 §3(a) 그대로)

`bizNm` SIGUNGU_TOKEN 미매치 + 어근 substring LUT 미스 → `region_sido = NULL`:
- `ME2022C006 강원풍력 발전단지 건설사업(리파워링)`
- `DG2018C001 풍백 풍력발전단지 조성사업`
- `DG2015L001 현종산 풍력발전단지 조성사업`
- `WJ2014M001 흘리 풍력발전소 조성사업`

운영 영향: 미리보기 / 모바일 / 카드 모두 "지역 미상" 표시. 검색 facet "강원" /
"경북" 필터 시 누락. sido-only fallback (`'강원'` → sidoCode '51' 등) 필요. 이번
hotfix scope 외.

### (b) stateNm 매핑 확장 — 2건 unknown (P1 §3(b) 그대로)

mapper classify 가 "본안협의" / pre-협의 텍스트 미커버:
- `GW2025C001 양양 내현풍력발전단지 조성사업` → stage=unknown
- `WJ2020A001 삼척 천봉풍력발전단지 조성사업` → stage=unknown

운영 영향: 카드/미리보기 stage 배지에 "unknown" 표시. mapper classify substring 룰
확장 또는 LIST `stepChangeDt` fallback 으로 보강 필요. 이번 hotfix scope 외.

### (c) ✅ 해소 — CasePreviewPane region 표시 결함 (P1 §3(c))

이번 세션에서 fix. `formatLocation` helper 추출 + 2 UI 파일 patch. 카드 ↔ 패널
데이터 일관성 확보.

### (d) 신규 발견 — 모바일 subtitle leading " · " (cosmetic)

`src/pages/cases/[caseId].astro:32-35`:
```astro
<p class="text-small text-text-secondary">
  {row.region_sido}
  {row.region_sigungu} · {row.capacity_mw ?? '미상'} MW · {row.evaluation_year ?? '미상'}
</p>
```
region NULL 4건 (§(a)) 에서 leading 공백 + " · 미상 MW · 미상" 노출. 동일
`formatLocation(row)` 적용으로 정리 가능. cosmetic, P3.

---

## 4. 다음 작업 후보

| 우선순위 | 작업 | 예상 시간 | 가치 |
|---|---|---|---|
| 1 | LUT 19 entry 확장 (`data/region/sigungu-lut.json` 6→19) | 2-3h | region 매칭 60→90% |
| 2 | sido fallback (`bizNm` 어근 substring → sidoCode 매핑) | 1h | (a) 4건 해소 |
| 3 | stateNm 매핑 확장 (`'본안협의'` substring + LIST fallback) | 1h | (b) 2건 해소 |
| 4 | 모바일 subtitle cosmetic fix (`[caseId].astro:32-35`) | 30min | (d) 해소 |
| 5 | 다른 EIA 데이터셋 (15142988 협의완료) 통합 | 6-8h | 본안 confirmed 사례 풍부도 |
| 6 | 신규 feature (draft-checker / opinion-response 등) | 8-12h | 새 사용자 가치 영역 |

다음 세션 시작 시 `docs/status/2026-04-28-project-status.md` 정독 후 #1 또는 #5
중에서 결정 권장.

---

## 5. GitHub Issue 후보 (1건 신규)

기존 P1 (a)(b) 한계는 2026-04-27 handover §5 의 Issue 1+2 텍스트 그대로 등록
권장 (사용자 시간 될 때). 이번 세션 신규 발견:

### Issue — [P3] cases-ui: 모바일 subtitle leading " · " (cosmetic)

**Title:** `cases-ui: [caseId].astro 모바일 subtitle leading " · " (region NULL 4건)`

**Body:**
```
## 문제
[caseId].astro lines 32-35 의 subtitle 이 region_sido/sigungu 를 fallback 없이 dump.
region NULL 4건 (강원풍력(리파워링)/풍백/현종산/흘리) 에서:
  → " · 미상 MW · 미상" 형태로 leading 공백 + 구분자 표시.

## 원인
P3 region-fix 는 dl `<dd>` 만 formatLocation 적용. subtitle `<p>` 은 미적용.

## 해결안
subtitle 도 formatLocation(row) 호출로 통일. 1줄 patch + 기존 unit test 재사용.

## 참고
- docs/handover/2026-04-28-p3-region-fix-deployed.md §3(d)
- src/pages/cases/[caseId].astro:32-35
- src/features/similar-cases/format-location.ts
```

---

**끝.** 본 문서가 P3 region-fix 운영 배포 완료의 단일 진입점. 다음 권장 작업은
`docs/status/2026-04-28-project-status.md` §7 표 참조.
