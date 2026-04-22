# [process] 법령 기반 feature 의 spec T1 법령 숫자 원문 대조 의무화

**작성일:** 2026-04-22
**우선순위:** P1 (향후 모든 법령 기반 feature 의 재앙 방지선)
**영향 범위:** CLAUDE.md §9.3, 모든 feature spec §0, PR 리뷰 체크리스트

## 배경

2026-04-22 `feature/scoping-assistant` 세션에서 T1 법령 감사 실행 결과, 초안 spec §7 rule pack 의 **4개 규칙 모두 법령 원문과 불일치** 확인. Severity:

- **CRITICAL #1 (10배 오류)**: `capacity_mw >= 10` → 실제 법령은 **100 MW (10만 kW)** 이상.
- **CRITICAL #2 (별표 오류)**: citation `별표2` → 실제는 **별표3** (별표2 는 전략환경영향평가).
- **HIGH #3 (축 오류)**: 소규모 EIA 판단이 발전용량 축으로 작성됨 → 실제 법령은 **면적 × 용도지역** 축.
- **HIGH #4 (15배 오류)**: `forest_conversion_ha > 1` → 풍력발전시설은 **660㎡ (0.066 ha)** 이상.

감사 결과: `docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md`

### 근인

spec §0 에 "법령 원문 대조 미수행" 이 **가정(assumption)** 으로 명시돼 있었고, spec §16 경고 #1 에서도 해당 내용이 반복 명시됨. 즉 **spec 단계에서 이미 "이 숫자는 미검증"** 이 표면에 드러나 있었음. 그러나:

1. `feature/project-shell` (v0) 는 법령 수치가 없는 CRUD·업로드 기능이라 이 문제가 없었고,
2. CLAUDE.md §9.3 도메인 리뷰 5개 항목은 "법적 결론 단정 표현" 은 체크하지만 **"숫자의 법령 정합성"은 체크하지 않음**.

결과: "미검증 숫자" 가 spec 에 박힌 채 plan T6 까지 흘러갔고, T1 블록킹이 없었다면 구현·배포까지 통과했을 가능성.

### 왜 spec §0 의 "가정" 만으로는 부족했나

- spec §0 은 리뷰어·구현자가 "이미 읽고 받아들인 것" 으로 취급되기 쉬움.
- §16 경고도 spec 본문 끝에 있어 plan·구현 시 시야 밖.
- **plan T1 이 BLOCKING 게이트로 있었던 것이 실제로 방어 성공** — 이 패턴을 명시적 정책으로 격상해야 함.

## 제안

### A. CLAUDE.md §9.3 확장 — 6번째 체크 추가

기존 5개 항목:
1. 법적 결론 단정 여부
2. 현지조사 대체 주장 여부
3. EIASS 원문 재호스팅 여부
4. 주민·기관 의견 축약·왜곡 여부
5. 결과 객체 표준 스키마 포함 여부

**추가:**
> ⑥ **법령 숫자 원문 대조 여부**. 규칙·임계값·면적·발전용량 등 숫자가 등장하면, plan 에 T1 에 해당하는 "법령 원문 대조" BLOCKING task 를 **반드시** 포함하고, 감사 결과 `docs/findings/` 문서 생성을 완료 조건으로 한다. 2차 자료만으로는 PASS 불가 — 최종 구현 전 법제처 PDF 원문 크로스체크 필수.

### B. feature spec §0 공통 가정 보강

모든 신규 feature spec §0 에 **기본 가정** 으로 다음 문장을 고정 삽입:

> **법령 숫자 가정**: 본 spec 에 등장하는 모든 법령 관련 수치(MW, ha, ㎡, 일수, 원/위반 등)는 **작성 시점 기준 추정값** 이며, plan T1 에서 법제처 PDF 원문 대조 감사가 PASS 할 때까지 **구현 반영 불가**. T1 FAIL 시 spec 수정 후 재감사.

### C. plan writing-plans 스킬 호출 시 자동 T1 템플릿

`writing-plans` 호출 시 spec 에 법령 citation 이 1개 이상 있으면 **T1 = "법령 원문 대조 감사 (BLOCKING before 구현)"** 를 자동 생성. 본 세션의 `docs/plans/feature-scoping-assistant.md` T1 을 참고 템플릿으로.

### D. PR 리뷰 체크리스트 항목 추가

`.github/PULL_REQUEST_TEMPLATE.md` (존재한다면) 또는 `docs/reviews/` 체크리스트에 다음 추가:

- [ ] 코드에 등장하는 법령 숫자·citation 의 **출처 URL** 이 해당 소스 파일·테스트·UI 에 명시돼 있는가?
- [ ] `docs/findings/` 에 본 PR 수치에 대한 감사 문서가 PASS 상태로 존재하는가? (없으면 reject)
- [ ] `assertion-grep` 이 YAML rule pack 파일까지 커버하는가?

### E. 적용 대상 feature (장기)

본 이슈가 정책화되면 다음 feature 들에서 동일 감사 필요:

| Feature | 필요 감사 |
|---|---|
| `feature/scoping-assistant` (진행 중) | ✅ T1 실패 확인됨. A안(spec v2 재설계) 채택. |
| `feature/draft-checker` | EIA 보고서 서식·서술 기준의 법령 수치 (예: 주민설명회 고지기간, 공람기간) |
| `feature/opinion-response` | 의견 수렴·답변 기간 (환경영향평가법 시행령) |
| `feature/risk-assessment` (가정) | 환경기준 수치 (대기질, 수질, 소음 등 각 개별법) |

각 feature spec §0 에 본 이슈를 back-ref 하고, 최초 plan T1 로 감사 착수.

## 수용 기준

- [ ] `CLAUDE.md §9.3` 에 ⑥ 항목 추가 (commit)
- [ ] 본 이슈를 GitHub Issue 로 등록 (P1 라벨)
- [ ] 향후 spec 작성 시 §0 에 법령 숫자 가정 문장 삽입 (template 업데이트)
- [ ] PR 리뷰 체크리스트에 법령 출처 검증 항목 추가
- [ ] `feature/scoping-assistant` A안 완료 시 본 이슈 회고 항목 (성공 사례) 로 close

## 교훈 (for future sessions)

1. **"Office Hours 의 미검증 가정 §0" 이 실제로 재앙 방지선으로 작동.** spec 에 "이 숫자 미검증" 이 드러나 있었기에 plan T1 에 감사 task 를 넣을 수 있었음. §0 이 없었다면 숫자가 소스 코드에 박혀 릴리스됐을 가능성.
2. **Claude 와 사용자 양쪽 다 "그럴 것 같다" 로 지어내는 경향.** spec v1 작성 시점에 "10MW 가 맞을 것 같다" 는 근거 없는 추정이 그대로 수치화됨. 체크포인트(T1 BLOCKING) 없이는 자동 전파.
3. **2차 자료는 감사 증거로 부분적으로만 유효.** WebSearch 결과로 오류의 존재는 확인됐으나 정확한 최종 수치는 원문 PDF 대조 전까지 확정 불가. "존재 확인" 과 "값 확정" 은 다른 단계.

## 관련

- `docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md` — T1 감사 리포트
- `docs/office-hours/2026-04-23-scoping-assistant-v2-redesign.md` — A안 후속 OH 질문
- `data/rules/scoping/reference/README.md` — 법령 PDF 로컬 레퍼런스 정책
- `docs/plans/feature-scoping-assistant.md` — v1 plan (v2 작성 시 archive 이동)
- `docs/superpowers/specs/2026-04-22-scoping-assistant-design.md` — v1 spec (동일)
- Cross-ref: `CLAUDE.md §9.3`, `CLAUDE.md §2-3` (법적 결론 단정 금지), `CLAUDE.md §2-4` (EIASS 재호스팅 금지)
