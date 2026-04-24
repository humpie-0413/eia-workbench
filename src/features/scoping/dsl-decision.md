# Scoping DSL — 확장 결정 (M-D)

**Date:** 2026-04-23
**Decision:** self-DSL (인하우스 정의) 채택
**Alternative rejected:** json-logic-js

## Rationale

### 1. 의존성 축소

- json-logic-js 는 ~50KB + 추가 런타임 의존성
- MVP 5 규칙은 단순 조건 + zone-based lookup 만 필요 → 커스텀 evaluator 50줄 내

### 2. zone-based lookup (gte_by_zone) 특수 처리

- 규칙 4 (소규모 EIA 기타 3존) 는 zone 별 서로 다른 임계값 비교 필요:
  ```yaml
  when:
    gte_by_zone:
      field: site_area_m2
      thresholds:
        agricultural_forestry: 7500
        natural_environment_conservation: 5000
        production_management: 7500
  ```
- json-logic 의 표준 연산자로는 매핑 불가 → 어차피 커스텀 확장 필요
- self-DSL 은 `gte_by_zone` 를 engine 에서 직접 처리 가능

### 3. 확장 operator 집합 (MVP)

- `equals`: `{ field: 'land_use_zone', value: 'conservation_management' }`
- `gte` / `gt` / `lt` / `lte`: `{ field: 'site_area_m2', value: 5000 }`
- `one_of`: `{ field: 'land_use_zone', values: ['agricultural_forestry', 'natural_environment_conservation', 'production_management'] }`
- `gte_by_zone`: `{ field: 'site_area_m2', thresholds: { zone: threshold, ... } }`

### 4. `onUndefined: skip` 시맨틱

- 입력 필드가 undefined (예: `capacity_mw_override` 미입력) 이면 `skip_reason='input_undefined'` 로 skipped 처리
- 조건 불일치 (zone mismatch 등) 도 skip 처리, 단 다른 `skip_reason`

### 5. 향후 교체 용이성

- `evalCondition()` 순수 함수 → json-logic 또는 다른 엔진으로 교체 시 이 한 함수만 바꾸면 됨

## Implementation Path

1. `engine.ts` 내 `evalCondition(input, whenClause)` 순수 함수 정의
2. 연산자 6종 switch-case 구현
3. `evaluate(rulePack, input)` 는 모든 규칙을 순회하며 `evalCondition` 호출

## Tradeoffs

- **장점:** 외부 의존성 0, zone-based lookup 네이티브 지원, 테스트 용이
- **단점:** 규칙이 100개 이상으로 확장되면 json-logic-js 가 더 적합할 수 있음 — 그 시점에 재평가

## References

- spec v2 §7 (rule pack YAML 구조) — `docs/superpowers/specs/2026-04-23-scoping-assistant-design-v2.md`
- plan v2 Task 10 (engine 구현) — `docs/plans/feature-scoping-assistant-v2.md`
