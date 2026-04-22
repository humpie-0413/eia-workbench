# Office Hours — scoping-assistant spec v2 재설계

**Date:** 2026-04-23
**Trigger:** `docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md` A안 채택
**Pre-requisite:** 사용자가 `data/rules/scoping/reference/` 에 법제처 PDF 3개 배치 (MANIFEST 참조)
**Goal:** spec v1 의 4 rule·MW-only 구조를 → **면적 + 용도지역 + 발전용량** 3축 구조로 확장한 spec v2 설계

---

## 섹션 A — 범위·우선순위 (Scope)

### Q1. MVP v2 대상 업종
- (a) onshore_wind 만 유지 (v1 과 동일 범위, rule 만 확장)
- (b) onshore_wind + onshore_solar (육상 태양광)
- (c) 기타: 해상풍력 / 연료전지 / …

**배경:** 별표3·별표4 는 신재생에너지 전체를 다루므로 규칙 작성 공수는 MW·면적 축만 다르면 동일. 그러나 UI form/검증/E2E 는 업종당 증가.
**추천:** (a) — v1 과 범위 일치 시 검증·리뷰 공수 최소. solar 는 v3 로 분리.

### Q2. spec v2 에서 rule 개수 목표
- (a) 5개 (최소 교정 — EIA 대상, 소규모 EIA·보전관리지역, 소규모 EIA·계획관리지역, 산지전용, 발전용량 경계)
- (b) 6–8개 (용도지역 5개 × 면적 조합 일부 + 발전용량)
- (c) 10개 이상 (별표3·별표4 전체 테이블을 거의 그대로 반영)

**배경:** rule 많을수록 법적 정확도는 오르지만 테스트·유지보수 공수 증가. spec v1 의 "4 rule" 을 "5~8" 정도로 넓히는 안이 현실적.
**추천:** (b) — v2 타겟. 단, 첫 릴리스는 5개로 시작하고 경험 쌓이면 확장 가능하게.

### Q3. "면적 기준" 단위 통일
- (a) 제곱미터 (㎡) — 법령 원문과 일치
- (b) 헥타르 (ha) — 업계 관용 표기 (1 ha = 10,000 ㎡)
- (c) 둘 다 입력 받아 내부 정규화 (ex: ha 입력 → ㎡ 변환)

**추천:** (c) — 사용자 실수 방지 + 법령 대조 용이. 내부 저장은 ㎡.

---

## 섹션 B — 입력 스키마 (`scopingInputSchema` 확장)

### Q4. 추가 필드 확정
- (a) 필수 필드만 추가: `site_area_m2` (number), `land_use_zone` (enum)
- (b) (a) + 선택 필드: `nearby_protected_area_within_km` (보호구역 인접성, 산지·습지 전용타당성조사 보조 판단용)
- (c) (b) + `elevation_change_m` (부지 고저차 — 경사 가파를수록 토양·지형 영향평가 비중↑)

**추천:** (a) — MVP 는 법령 직접 수치만. (b)(c) 는 검토 보조 항목이지만 데이터 신뢰도·입력 피로도 문제.

### Q5. `land_use_zone` enum 항목
국토계획법 제36조에 따른 용도지역. 선택지:
- (a) 5개 관리지역: `conservation_management` / `production_management` / `planning_management` / `agricultural_forestry` / `natural_environment_conservation`
- (b) 6개 (a + `urban` 도시지역 — 육상풍력은 도시지역 설치가 드물지만 이론상 가능)
- (c) 3개 간소화: `conservation` / `management` / `other`

**추천:** (a) — 별표4 가 이 5개 축을 사용. 프로젝트 input 과 별표 규칙이 1-to-1 매핑.

### Q6. `capacity_mw` 필수 여부
- (a) 필수 — v1 과 동일
- (b) 선택 — 사업면적만 있어도 소규모 EIA 판단 가능 (MW 이 없으면 MW 기반 rule 은 `onUndefined: skip`)
- (c) "설정 안 함 / 1 MW 미만 / 정확한 수치" 세 옵션 라디오

**추천:** (b) — 법적으로 MW 모를 때 면적만으로 판단 가능해야 함 (영향평가대행사 초기 검토 단계에서는 발전용량 미확정이 흔함).

---

## 섹션 C — 출력·UI 구조

### Q7. 결과 개수 변동 대응
v1 은 4 rule → 항상 4개 카드. v2 는 조건부 실행 (용도지역이 특정일 때만 발동되는 rule) 이 섞임.
- (a) 발동 안 된 rule 은 숨김 (UI 에 실제 적용된 rule 만)
- (b) 발동 안 된 rule 도 "해당 없음" 으로 회색 표시
- (c) 발동 rule 과 skip rule 을 섹션 분리 ("적용된 검토" / "해당 없는 검토")

**추천:** (c) — 법적 감사·후속 대응 시 "왜 이 rule 은 skip 됐나" 추적 가능. UX 는 accordion 으로 skip 섹션 접음.

### Q8. 근거 citation 링크 처리
- (a) citation 을 text only (복붙 가능), 링크 없음 (v1)
- (b) citation text + `citation_url` 필드 추가, UI 에서 외부링크 열림
- (c) (b) + 링크 클릭 시 "법령 해석 주의 안내" 모달 1회 노출

**추천:** (b) — 법제처 링크는 공개 URL. (c) 는 UX 피로 유발.

---

## 섹션 D — v2 구현 절차

### Q9. v1 산출물 처리
현재 untracked 상태로 커밋 안 된 v1 산출물:
- `docs/superpowers/specs/2026-04-22-scoping-assistant-design.md` (v1 spec)
- `docs/plans/feature-scoping-assistant.md` (v1 plan)

- (a) v1 산출물 그대로 둠, v2 는 새 파일 (`2026-04-23-scoping-assistant-design.md`)
- (b) v1 을 rename 해 보존 (`…-v1-superseded-by-v2.md` suffix), v2 가 canonical
- (c) v1 덮어쓰기 (같은 파일명 유지)

**추천:** (b) — 감사 이력 보존 + 버전 혼선 방지.

### Q10. v2 commit 전략
- (a) v1 findings + v2 spec + v2 plan 을 **한 개 커밋**으로 묶음 ("refactor: rule pack v2 with legal audit")
- (b) 세 단계 커밋: findings → v1 rename → v2 spec + plan
- (c) 기능 브랜치 (`feature/scoping-assistant-v2`) 신설 후 작업

**추천:** (b) — 각 커밋이 독립적으로 revert 가능. `(c)` 는 브랜치 셋업 오버헤드.

---

## 대기 항목 (답변 후 즉시 착수 가능)

위 10개 질문에 답변 + `data/rules/scoping/reference/` 에 PDF 3개 배치 완료 시:

1. T1' — PDF 원문 기반 재감사 (Claude, 자동)
2. spec v2 작성 (Claude, 자동)
3. plan v2 작성 (Claude, 자동)
4. 승인 후 기존 FULL-AUTO DELEGATION 재개

---

## 비고

- Q1~Q10 모두 기본값(추천) 수락 시 "ok" 또는 "기본값 수락" 한 줄로 회신하면 진행.
- 일부만 조정 시 "Q4=b, Q7=a, 나머지 추천" 형태로 회신.
- 감사 PDF 3개 배치 전에는 T1' 만 대기 상태로 멈추고 Q 답변은 받아둘 수 있음.
