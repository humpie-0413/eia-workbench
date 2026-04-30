# Handover: stateNm 매핑 확장 조사 — root cause = API 영구 빈 응답

**작성일:** 2026-04-30  
**담당:** feature/statenm-mapping-expand worktree  
**결과:** 코드 변경 없음 (가짜 작업으로 판명)

---

## §1 — 작업 개요

| 항목 | 내용 |
|------|------|
| 작업명 | P3 §3(b) "stateNm 매핑 확장" 조사 |
| 대상 케이스 | WJ2020A001 (삼척 천봉), GW2025C001 (양양 내현) |
| 가설 | evaluation_stage='unknown' ← stateNm 값이 매핑 규칙에 미커버 |
| **실제 결과** | **가짜 작업. stateNm 필드 자체 부재 ← API 영구 빈 응답** |
| 코드 변경 | 없음 |
| worktree | feature/statenm-mapping-expand (commit 없이 종료) |

---

## §2 — Phase 0 분석 발견

### 가설 vs 실제 root cause

| 구분 | 가설 | 실제 |
|------|------|------|
| 문제 위치 | `mapEvaluationStage()` classify 함수 | Ing detail API 응답 |
| 증상 원인 | stateNm 패턴이 규칙에 미커버 | items 배열 자체 비어있음 |
| 해결 방향 | classifier 에 새 패턴 추가 | 다른 데이터셋 또는 endpoint 조회 |

### 운영 D1 source_payload 비교

**정상 본안 케이스 (DG2009L001, WJ2014M001)**
```json
{
  "eiaCd": "DG2009L001",
  "bizNm": "영양풍력발전단지 건설사업",
  "stateNm": "협의",
  "resReplyDt": "2009.11.13",
  ...
}
```

**unknown 케이스 (WJ2020A001, GW2025C001)**
```json
{
  "eiaCd": "WJ2020A001",
  "bizNm": "삼척 천봉풍력발전단지 조성사업",
  "ccilOrganNm": "기후에너지환경부",
  "stepChangeDt": "2025.06.11",
  "matched_token": "삼척",
  "matched_sido": "강원도",
  "matched_sigungu": "삼척시"
}
```

stateNm / resReplyDt / applyDt 필드 전체 부재.

### 코드 경로 (transform.ts:213)

```ts
// detail 의 상위 1건만 payload 에 포함
if (detailHead[0]) {          // items가 비어있으면 이 블록 실행 안 됨
  payloadSource.stateNm = detailHead[0].stateNm;
  payloadSource.resReplyDt = detailHead[0].resReplyDt;
  payloadSource.applyDt = detailHead[0].applyDt;
}
```

인덱싱 시점에 `detailItems = []`로 들어왔기 때문에 `mapEvaluationStage([])` → `'unknown'` (정상 동작).  
mapper 버그 없음. 매핑 규칙 확장해도 효과 없음.

---

## §3 — API 직접 조회 결과

**조회 명령 (키 마스킹):**
```
curl "https://apis.data.go.kr/.../getDscssSttusDscssIngDetailInfoInqire
     ?serviceKey=<MASKED>
     &eiaCd=WJ2020A001
     &pageNo=1&numOfRows=10"
```

**WJ2020A001 (삼척 천봉) 응답:**
- `resultCode`: 00 (성공)
- `totalCount`: 0
- `items`: 비어있음

**GW2025C001 (양양 내현) 응답:**
- 동일. `totalCount`: 0, `items` 비어있음.

**결론:** 두 사업 모두 현재 시점(2026-04-30)에도 Ing detail API 데이터 영구 부재.  
인덱싱 시점의 일시적 실패가 아닌 구조적 부재.

---

## §4 — 의미 + 진짜 해결안

### 왜 API가 비어있는가

`getDscssSttusDscssIngDetailInfoInqire` (15142987 Ing detail) 는 **"협의 진행 중"** 사업의 검토 단계 이력만 수록한다.

- 두 사업이 현재 협의 진행 중 상태가 아님 (완료됐거나 협의 미시작)
- 협의완료 사업은 별도 데이터셋(15142988)에 수록됨

### 진짜 해결 옵션

| 옵션 | 내용 | 규모 |
|------|------|------|
| **A** | 15142988 (협의완료) 데이터셋 추가 인덱싱 | 6-8h (큰 작업) |
| **B** | UI 라벨 변경: `'unknown'` → "협의 정보 미수록" (cosmetic) | 30min |
| **C** | 다른 endpoint (BsnsList detail 등) 추가 호출 | 미정 |

### 본 작업 (mapper 확장)으로 해결 불가

`mapEvaluationStage()`는 정상 작동 중. classifier 에 어떤 패턴을 추가해도 items가 비어있는 한 'unknown'을 반환한다.

---

## §5 — P3 한계 정의 갱신

### 이전 정의 (2026-04-28 handover)

> P3 §3(b): stateNm 매핑 확장 — 삼척/양양 unknown 2건 stateNm 미커버

### 갱신 정의

> P3 §3(b) → **영구 한계로 재분류**: Ing detail API 영구 빈 응답 케이스(삼척/양양).  
> stateNm 매핑 확장으로 해결 불가. 15142988 데이터셋 추가 또는 UI 라벨 변경 필요.

### GitHub Issue 등록 권장 텍스트

```
Title: [P3] cases-stage: Ing detail API 영구 빈 응답 케이스 처리

## 발견
WJ2020A001 (삼척 천봉) + GW2025C001 (양양 내현) 의 evaluation_stage='unknown' 은
stateNm 매핑 결함이 아닌 data.go.kr Ing detail API 의 영구 빈 응답이 원인.

## 검증 (2026-04-30)
- 두 사업 모두 totalCount=0, items 비어있음
- 인덱싱 시점만의 일시적 문제 아님 (직접 재조회 확인)
- transform.ts:213 `if (detailHead[0])` 가드로 stateNm 기록 자체 안 됨

## 해결 옵션
A. 15142988 (협의완료) 데이터셋 추가 인덱싱  
B. UI 라벨 명시적 변경 ("협의 정보 미수록")  
C. 다른 endpoint (BsnsList detail 등) 호출

## 우선순위
P3 — 다른 사업 8건 정상 매핑, 사용자 가시 영향 작음
```

---

## §6 — 다음 액션

### 즉시
- [ ] worktree 정리 사용자 직접: `git worktree remove ../eia-workbench-statenm-expand`
- [ ] 필요 시 GitHub Issue 등록 (§5 텍스트 사용)

### 다음 작업 후보 (우선순위 낮은 순)

| 후보 | 규모 | 비고 |
|------|------|------|
| 카드 UI mobile subtitle 정리 | ~30min | cosmetic |
| landmark LUT 확장 (시·군 추가) | 1-2h | region 매칭률 ↑ |
| 15142988 협의완료 데이터셋 인덱싱 | 6-8h | 삼척/양양 unknown 해결 포함 |
| 신규 feature 기획 | TBD | 사용자 결정 |

**사용자 결정 대기.**
