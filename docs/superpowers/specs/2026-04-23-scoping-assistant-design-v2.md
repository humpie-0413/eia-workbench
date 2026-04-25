# feature/scoping-assistant — 설계문서 (v2)

> Office Hours v2 (2026-04-23) + PDF 기반 T1 재감사 PASS 반영 최종안.
> 다음 단계: plan v2 (`docs/plans/feature-scoping-assistant-v2.md`, 2–5분 태스크 분해) → `/autoplan` + CLAUDE.md §9.3 도메인 리뷰.
> v1 문서: `2026-04-22-scoping-assistant-design-v1-superseded-by-v2.md` (감사 이력 보존).

## §0. v2 전환 배경 + 현행 가정

**작성일**: 2026-04-23
**승계 대상**: `2026-04-22-scoping-assistant-design.md` (v1, rename 됨)
**기반 문서**:
- `docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md` §8 (2026-04-23 재감사 결과, PASS)
- `docs/office-hours/2026-04-23-scoping-assistant-v2-redesign.md` (v2 설계 질문 세트)
- `docs/office-hours/2026-04-23-scoping-assistant-v2-draft-answers.md` (Q1~Q10 답변 확정, Claude 추천 전체 수락 + Q10 3단계 분리 커밋)
- `docs/issues/13-spec-law-audit-mandatory.md` (법령 원문 대조 의무화 정책)
- `data/rules/scoping/reference/*.pdf` (법제처 원문 3개, 로컬 레퍼런스)

### v2 에서 교정된 핵심 결함 (v1 대비)

| ID | v1 오류 | v2 교정 | 근거 |
|----|---------|---------|------|
| E1 | rule 1 `capacity_mw >= 10` (10배 오류) | `capacity_mw >= 100` | 별표3 제3호 다목1) "10만 킬로와트" |
| E2 | rule 1 citation `별표2` (전략환경영향평가) | `별표3 제3호 다목1)/라목1)` | 별표3 제목 원문 |
| E3 | rule 2/3 `capacity_mw` 기반 소규모 EIA 판정 (법령 축 불일치) | `site_area_m2 × land_use_zone` 축 재설계 | 별표4 는 MW 축 없음 |
| E4 | 입력 스키마에 `site_area_m2`, `land_use_zone` 없음 | 필수 필드로 승격 | OH Q4=a |
| E5 | rule 4 `forest_conversion_ha > 1` (약 15배 완화) | `forest_conversion_m2 >= 660` | 산지관리법 시행령 별표4 제2호 다목 |

### §0 공통 법령 숫자 가정 (issue #13 §B 정책 적용)

> 본 spec 에 등장하는 모든 법령 관련 수치(MW, ㎡, 일수, 원/위반 등)는 **2026-04-23 시점 기준** 이며, 법제처 PDF 원문 대조 감사 (§findings §8) 를 통과한 값이다. 법령 개정 시 `docs/findings/` 에 재감사 리포트를 추가하고 `rule_pack_version` 을 bump 한다. T1 BLOCKING gate 는 재감사 없이는 재활성화.

### 현행 미검증 가정 (파일럿 고객 확보 시 재검증)

| ID | 가정 | 변경 시 영향 |
|----|------|-------------|
| Q1-v2 | 업종 = **onshore_wind 단일** 유지 | 육상 태양광·해상풍력 지원 시 v3 spec 분기 (법령 확장 필수) |
| Q3-v2 | ㎡/ha 이중 입력 UX 가 수동 환산보다 오류율 낮음 | 사용자 피드백 기반 단일 단위 재도입 가능 |
| Q6-v2 | `capacity_mw` 초기 검토 단계 미확정 케이스가 빈번 | 필수화 요구 시 rule 1 UX 재설계 |
| Q7-v2 | accordion 접기 기본 = 발동 rule 만 보여주는 간결 UX 선호 | 회색 카드 전개 등 대체 UX 검토 |
| C1 | 산지관리법 **시행규칙** 별표 4 (수령 미완) 에 풍력 특화 660㎡ 세부 기준이 없을 경우 시행령 별표 4 일반 기준으로 충분 | 시행규칙 별표 4 수령 후 재검토, 필요 시 rule 5 보강 |

---

## §1. 목적

환경영향평가 프로젝트의 **입지·규모 기반 사전 검토 보조**. 프로젝트 메타(업종·지역·용량) 자동 주입 + 사용자 입력 (**사업면적 + 용도지역** 필수, 산지전용 면적·발전용량 선택) 을 받아, **규칙 팩 v2 (YAML, 5 rules)** 이 법령별 4단계 결과 배지 (대상 가능성·검토 필요·비대상 가능성·판단 보류) 를 제시. 근거·가정·한계·`needsHumanReview: true` 표준 스키마. CSV/Markdown export. **Claude 수동 분석 프롬프트 생성기** (클립보드 복사) 제공.

**완료 시점 (v0 범위)**: 평가사가 매뉴얼 없이 스코핑 페이지에 들어가, 프로젝트별로 **내부 리뷰 회의용 체크리스트 초안**을 생성·export 할 수 있다.

---

## §2. 스코프 밖

- LLM 자동 판정 (CLAUDE.md §2-2)
- GIS 자동 조회 + 보호구역 규칙 (v3)
- 법령 원문 DB 동기화 (citation_url 만, 본문 재호스팅 금지 CLAUDE.md §2-4)
- 다른 업종 (육상풍력 외)
- 보고서 초안 생성 (feature/draft-checker)
- 주민 의견 처리 (feature/opinion-response)
- PDF export, 공유 URL (수요 발생 시 v3)
- UI "이 규칙 부정확해요" 신고 버튼 (v3)
- 법령 refLink 체커 자동화 (follow-up issue)

---

## §3. 핵심 사용자 여정

| 단계 | 행동 | 결과 | 라우트/엔드포인트 |
|------|------|------|---|
| A | 프로젝트 상세 → "스코핑" 탭 클릭 | `/projects/[id]/scoping` 네비게이트 | SSR 페이지 |
| B | 자동 주입값 확인 + 사용자 입력 (site area, zone, optional forest area, optional capacity, notes) | 입력 폼 | 폼 내부 state |
| C | "검토 실행" 클릭 | engine 실행 → run 저장 → 결과 영역 표시 | `POST /api/projects/[id]/scoping` |
| D | 결과 영역 스크롤 + 배지 확인, **skip 섹션 펼쳐 감사 추적** | 발동 rule / skip rule 분리 + accordion | 페이지 state |
| E | Export (CSV/MD) 또는 Claude 분석 프롬프트 복사 | 파일 다운로드 또는 클립보드 카피 | 클라이언트 로직 |
| F | 좌측 run history 에서 과거 run 로드 | 해당 run 상태로 복원 | `GET /api/projects/[id]/scoping/runs/[runId]` |

---

## §4. 데이터 모델 (`migrations/0002_scoping.sql`)

```sql
CREATE TABLE scoping_runs (
  id                 TEXT PRIMARY KEY,           -- nanoid(12)
  project_id         TEXT NOT NULL REFERENCES projects(id),
  rule_pack_version  TEXT NOT NULL,              -- 'onshore_wind/v2.2026-04-23'
  input_json         TEXT NOT NULL,              -- 입력 복원용 (정규화된 ㎡ 기준)
  output_json        TEXT NOT NULL,              -- ScopingResult[] 직렬화
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at         TEXT
);
CREATE INDEX scoping_runs_project ON scoping_runs(project_id, created_at DESC);
CREATE INDEX scoping_runs_deleted ON scoping_runs(deleted_at);
```

- 프로젝트당 run 수 상한: 50 (soft-limit 토스트 경고)
- history: soft-delete + 30일 Cron 하드삭제 (기존 `workers/cron-cleanup.ts` 확장, 동일 가드 `CRON_HARD_DELETE_ROW_CEILING=1000` 적용)

---

## §5. 입력 스키마 (Zod)

```ts
// 자동 주입 (read-only, Astro SSR 에서 project record → props):
//   industry, site_region_code, site_sub_region_code, capacity_mw (optional)

// v2: 사용자 입력 필수 (Q4=a minimal):
export const landUseZoneEnum = z.enum([
  'conservation_management',        // 보전관리지역
  'production_management',          // 생산관리지역
  'planning_management',            // 계획관리지역
  'agricultural_forestry',          // 농림지역
  'natural_environment_conservation', // 자연환경보전지역
]);

// 이중 단위 입력 (Q3=c): 내부 저장은 항상 ㎡
export const areaUnitEnum = z.enum(['sqm', 'ha']);

export const scopingInputSchema = z.object({
  site_area_m2: z.number().min(0).max(10_000_000),   // 필수, 정규화 후 ㎡
  site_area_input_unit: areaUnitEnum,                 // UX 단위 기록 (재편집 시 복원)
  land_use_zone: landUseZoneEnum,                    // 필수
  forest_conversion_m2: z.number().min(0).max(10_000_000).optional(),
  forest_conversion_input_unit: areaUnitEnum.optional(),
  capacity_mw_override: z.number().min(0).max(10_000).optional(), // 프로젝트 capacity_mw 와 다를 때만
  notes: z.string().max(1000).optional(),
});

// 엔진 입력 EvalInput (§8 evaluate 함수 인자):
//   EvalInput = 자동 주입값 (industry, site_region_code, site_sub_region_code, capacity_mw)
//             + scopingInputSchema 정규화 결과 (site_area_m2, land_use_zone, forest_conversion_m2)
//             + capacity_mw_override 가 있으면 그 값으로 capacity_mw 대체
//   notes 는 EvalInput 에 포함하지 않음 (DB 저장만).

// 의미론 (§7 규칙 팩과 일치):
// - capacity_mw 미입력 → rule 1 은 onUndefined: skip (발동 skip 섹션으로 분리)
// - forest_conversion_m2 미입력 → rule 5 는 onUndefined: skip
// - site_area_m2, land_use_zone 은 필수이므로 skip 경로 없음
// - notes 는 저장만, 엔진 입력 아님
```

### 단위 정규화 규칙 (내부 유틸)

```ts
// src/features/scoping/units.ts
export const HA_TO_SQM = 10_000;

export function normalizeAreaToSqm(value: number, unit: 'sqm' | 'ha'): number {
  if (unit === 'ha') return value * HA_TO_SQM;
  return value;
}

export function denormalizeSqmToInputUnit(sqm: number, unit: 'sqm' | 'ha'): number {
  if (unit === 'ha') return sqm / HA_TO_SQM;
  return sqm;
}
```

---

## §6. 표준 결과 스키마

`src/lib/types/analysis-result.ts`:

```ts
export interface Citation {
  id: string;
  title: string;
  refLink?: string;
  citation_url?: string;   // v2 신규 (Q8=b): 법제처 외부 링크
}

export interface StandardAnalysisResult {
  result: 'likely_applicable' | 'needs_check' | 'likely_not_applicable' | 'unknown' | 'skipped';
  basis: Citation[];
  assumptions: string[];
  limits: string[];
  needsHumanReview: true;  // 리터럴 true
}

export interface ScopingResult extends StandardAnalysisResult {
  ruleId: string;
  title: string;
  category: 'eia_target' | 'small_eia' | 'forest_conversion';
  rule_pack_version: string;  // 결과 카드 표시 의무
  triggered: boolean;  // v2 신규: accordion 섹션 분리용 (Q7=c)
  skip_reason?: 'input_undefined' | 'zone_mismatch' | 'condition_not_met';
}
```

UI 라벨 매핑:

| code enum | UI 라벨 | 색 토큰 |
|-----------|---------|--------|
| `likely_applicable` | 대상 가능성 | `scoping-badge-applicable` (진한 주황) |
| `needs_check` | 검토 필요 | `scoping-badge-check` (노랑) |
| `likely_not_applicable` | 비대상 가능성 | `scoping-badge-not-applicable` (회색) |
| `unknown` | 판단 보류 | `scoping-badge-unknown` (연한 주황 + ? 아이콘) |
| `skipped` | 해당 없음 (accordion 내부) | `scoping-badge-skipped` (옅은 회색, 취소선 없이) |

---

## §7. 규칙 팩 v2 (`data/rules/scoping/onshore_wind.v2.yaml`)

```yaml
version: onshore_wind/v2.2026-04-23
industry: onshore_wind
rule_pack_audit:
  findings_doc: docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md
  audit_verdict: PASS
  audit_date: 2026-04-23
  source_pdfs:
    - data/rules/scoping/reference/enforcement-decree-eia-2025-02-18-annex-03.pdf
    - data/rules/scoping/reference/enforcement-decree-eia-2025-10-01-annex-04.pdf
    - data/rules/scoping/reference/enforcement-decree-forest-management-act-2023-06-07-annex-04.pdf

source_note: |
  v2 규칙 5건. T1 재감사 (2026-04-23) PDF 원문 대조 PASS.
  rule 추가/수정 PR 은 CLAUDE.md §9.3 + issue #13 법령 숫자 원문 대조 BLOCKING 통과 필수.

rules:
  - id: eia_target_capacity
    title: 환경영향평가 대상사업 가능성 (발전시설용량 10만 kW 이상)
    category: eia_target
    when:
      capacity_mw: { '>=': 100 }
    onUndefined: skip               # capacity_mw 미입력 시 skip (Q6=b)
    result: likely_applicable
    basis:
      - id: eia-act-sched-3-article-3-da-1
        title: 환경영향평가법 시행령 별표3 제3호 다목1) (발전소 건설사업 — 발전시설용량)
        citation_url: https://law.go.kr/법령/환경영향평가법시행령
    assumptions:
      - '사용자 입력 capacity_mw 는 정격 기준 (발전시설용량)'
    limits:
      - '단일 사업장 기준. 인접 사업장 누적 용량·행정구역 경계 미반영.'
      - '발전사업용 전기저장장치 결합 여부는 별표3 라목 별도 판단 필요.'

  - id: small_eia_conservation
    title: 소규모 환경영향평가 대상 가능성 (보전관리지역 · 5천㎡ 이상)
    category: small_eia
    when:
      land_use_zone: 'conservation_management'
      site_area_m2: { '>=': 5000 }
    onUndefined: skip
    result: likely_applicable
    basis:
      - id: small-eia-act-sched-4-conservation
        title: 환경영향평가법 시행령 별표4 (소규모 환경영향평가 — 관리지역 중 보전관리)
        citation_url: https://law.go.kr/법령/환경영향평가법시행령
    assumptions:
      - '사업 계획 면적 (도면상 사업 예정지 총 면적) 기준'
    limits:
      - '용도지역 경계 중첩 시 가장 보전 등급 높은 지역 기준 판정. 복합 지역은 전문가 검토 필요.'

  - id: small_eia_planning
    title: 소규모 환경영향평가 대상 가능성 (계획관리지역 · 1만㎡ 이상)
    category: small_eia
    when:
      land_use_zone: 'planning_management'
      site_area_m2: { '>=': 10000 }
    onUndefined: skip
    result: likely_applicable
    basis:
      - id: small-eia-act-sched-4-planning
        title: 환경영향평가법 시행령 별표4 (소규모 환경영향평가 — 관리지역 중 계획관리)
        citation_url: https://law.go.kr/법령/환경영향평가법시행령
    assumptions:
      - '사업 계획 면적 (도면상 사업 예정지 총 면적) 기준'
    limits:
      - '용도지역 경계 중첩 시 가장 보전 등급 높은 지역 기준 판정.'

  - id: small_eia_other_zones
    title: 소규모 환경영향평가 대상 가능성 (농림/자연환경보전/생산관리)
    category: small_eia
    when:
      land_use_zone:
        one_of: [agricultural_forestry, natural_environment_conservation, production_management]
      site_area_m2:
        gte_by_zone:
          agricultural_forestry: 7500
          natural_environment_conservation: 5000
          production_management: 7500
    onUndefined: skip
    result: likely_applicable
    basis:
      - id: small-eia-act-sched-4-other
        title: 환경영향평가법 시행령 별표4 (소규모 환경영향평가 — 농림/자연환경보전/관리지역 중 생산관리)
        citation_url: https://law.go.kr/법령/환경영향평가법시행령
    assumptions:
      - '사업 계획 면적 (도면상 사업 예정지 총 면적) 기준'
      - '생산관리지역은 관리지역 세부 구분 — 보전·계획과 구별'
    limits:
      - '용도지역 경계 중첩 시 가장 보전 등급 높은 지역 기준 판정.'
      - '자연환경보전지역 내 추가 행위제한은 자연환경보전법 별도 확인 필요.'

  - id: forest_conversion_review
    title: 산지전용타당성조사 대상 가능성 (산지전용 면적 660㎡ 이상)
    category: forest_conversion
    when:
      forest_conversion_m2: { '>=': 660 }
    onUndefined: skip               # forest_conversion_m2 미입력 시 skip
    result: needs_check
    basis:
      - id: forest-act-decree-sched-4-article-2-da
        title: 산지관리법 시행령 별표4 제2호 다목 (평균경사도 25도 이하, 660㎡ 이상)
        citation_url: https://law.go.kr/법령/산지관리법시행령
    assumptions:
      - '사용자 입력 산지전용 면적은 사업 전체 기준'
      - '평균경사도 25도 이하 일반 기준 적용 (25도 초과는 별도 조항)'
    limits:
      - '보전산지(공익용/임업용) 여부는 별도 확인 필요. 본 결과는 "검토 필요" 수준.'
      - '풍력발전시설 특화 세부 기준은 산지관리법 시행규칙 별표4 확인 권장 (spec §0 가정 C1).'

# 확장 후보 (v3):
# - 도시지역 (녹지지역 1만㎡ / 도시지역 외 6만㎡)
# - 보호구역 규칙 (GIS 연동 필요)
# - 평균경사도 25도 초과 산지 (별표4 제2호 라목)
```

### onUndefined 시맨틱 (v2)

- `skip`: 참조 입력 `undefined` 시 해당 rule 은 **발동 skip 섹션으로 분리**. `triggered: false`, `result: 'skipped'`, `skip_reason: 'input_undefined'`.
- `false`: 미발동 처리 (deprecated, v2 에서는 사용 안 함).
- `unknown`: 판단 보류 결과로 발동 (필수 필드는 Zod 에서 차단되므로 v2 rules 전체가 `skip` 만 사용).

### Rule 의 `when` 블록 확장 문법

- 단순 조건: `{ field: { '>=': value } }` (v1 DSL 6연산자 유지)
- enum 매칭: `{ field: 'value' }` (문자열 비교)
- 다중 매칭: `{ field: { one_of: [...] } }` (v2 추가)
- zone 별 임계값: `{ field: { gte_by_zone: { zone1: value1, ... } } }` (v2 추가, rule 4 전용)

→ plan v2 M-D 에서 DSL 확장 vs json-logic-js 재비교. v1 spec 에서는 M-D 미정이었으나 v2 rule 4 의 `gte_by_zone` 연산자 때문에 **self-DSL 확장이 유력** (json-logic-js 는 zone-based lookup 기본 미지원).

---

## §8. 규칙 엔진

`src/features/scoping/engine.ts` — 순수 함수

```ts
export function evaluate(
  input: EvalInput,
  pack: RulePack
): ScopingResult[]
```

- 외부 I/O 없음, 결정적 (deterministic)
- 각 rule 평가 전에 onUndefined 래퍼:
  1. rule.when 의 참조 필드 중 `input[field] === undefined` 가 1개 이상이면 → `triggered: false, result: 'skipped', skip_reason: 'input_undefined'` 즉시 반환
  2. 아니면 rule.when 조건 평가 → 통과 시 `triggered: true, result: rule.result`, 실패 시 `triggered: false, result: 'likely_not_applicable', skip_reason: 'condition_not_met'`
  3. Rule 4 의 `gte_by_zone` 은 `zone_mismatch` 로 분기 (zone 이 `one_of` 에 없으면)
- Vitest 단위 테스트:
  - 5 rules × 경계값 (정확히 threshold / threshold±1 / undefined) ≈ 25 케이스
  - zone enum 5개 × rule 2/3/4 매칭 분기
  - 단위 정규화 (`normalizeAreaToSqm` round-trip)
  - rule_pack_version 주입 확인
- 분기 커버리지 ≥95% 의무 (CI gate)

---

## §9. 엔드포인트

| 경로 | 메서드 | 용도 |
|------|--------|------|
| `/projects/[id]/scoping` | GET | Astro SSR 페이지 |
| `/api/projects/[id]/scoping` | POST | input 검증 → engine 실행 → scoping_runs insert → 201 + ScopingResult[] |
| `/api/projects/[id]/scoping` | GET | 최신 run 반환 (없으면 `{ runs: [] }`) |
| `/api/projects/[id]/scoping/runs` | GET | run 리스트 (created_at desc, 최근 20) |
| `/api/projects/[id]/scoping/runs/[runId]` | GET | 특정 run 상세 |
| `/api/projects/[id]/scoping/runs/[runId]` | DELETE | soft-delete |

기존 middleware (Origin 검사, CSP, 인증, PII-safe logger) 자동 적용.

---

## §10. UI

### 페이지 `/projects/[id]/scoping`

- 상단 네비: ← 프로젝트로 돌아가기 + 프로젝트명·지역·용량 배지
- 레이아웃: 좌 30% 입력 폼 + 우 70% 결과 영역 (모바일: 수직 스택)

### 입력 폼 (좌)

- **자동 주입값** (read-only 배지): 업종, 지역, 용량 MW (있을 경우)
- **사용자 입력 (v2 필수)**:
  - **사업계획 면적**: 숫자 input + 단위 selector (`㎡` / `ha`), helper: "도면상 사업 예정지 총 면적"
  - **용도지역**: 5-option select (`보전관리 / 생산관리 / 계획관리 / 농림 / 자연환경보전`)
- **사용자 입력 (선택)**:
  - 산지전용 면적: 숫자 input + 단위 selector, helper: "미입력 시 해당 rule skip"
  - 발전용량 덮어쓰기: 프로젝트 capacity_mw 와 다를 때만, helper: "프로젝트 설정값과 다른 수치 검토 시"
  - 메모: textarea ≤1000
- **"검토 실행"** CTA (필수 필드 충족 시 활성)

### 결과 영역 (우) — Q7=c 섹션 분리 + accordion

- **최상단 고정 배너**:
  > "스코핑 결과는 **내부 검토용 초안**입니다. 현지조사·전문가 판정·공식 행정절차를 대체하지 않습니다. rule pack 버전: `onshore_wind/v2.2026-04-23`."

- **섹션 1: 발동된 rule** (`triggered: true`)
  - 결과 카드 리스트
  - 각 카드: 결과 배지 + title + category + basis (링크, citation_url 외부로 새창) + assumptions + limits + `needsHumanReview` + `rule_pack_version`

- **섹션 2: 해당 없음 rule** (`triggered: false`, accordion 기본 접힘)
  - accordion 헤더: "해당 없음 / skip 된 규칙 (N개) — 감사 추적용"
  - 펼치면 skip rule 리스트. 각 항목: rule title + skip_reason + "왜 skip 되었나" helper
    - `input_undefined`: "입력값 없음 — 해당 필드를 채우면 재실행 시 평가됨"
    - `zone_mismatch`: "현재 용도지역 '...' 은 본 rule 대상 아님"
    - `condition_not_met`: "조건 불충족 — 입력값이 임계 미만"

- **우측 상단 툴바**:
  - `Export ▾` → CSV / Markdown
  - `Claude 분석 프롬프트 복사` → 입력 + 결과 markdown 블록 → 클립보드

### 좌측 하단 run history
- 최근 10건, 클릭 시 해당 run 로드
- 각 항목: 생성 시각 · 발동 rule 개수 요약 (`2 대상 · 1 검토 · 2 skip`)

### DESIGN.md 갱신 (v0 구현 시)
- 신규 색 토큰: `scoping-badge-applicable/check/not-applicable/unknown/skipped`
- UI 라벨 주석: "2026-04-23 Q7=c 결정, 파일럿 피드백으로 변경 가능"

### 기존 DisabledTab 교체
- `src/pages/projects/[id].astro` 의 `<DisabledTab label="스코핑" ... />` 를 일반 `<a>` 링크로 교체. role="tab" 유지, `aria-disabled` 제거.

---

## §11. 도메인 리뷰 매핑 (CLAUDE.md §9.3 + issue #13 ⑥)

| # | 위험 | 발생 가능성 | 방지책 |
|---|------|------------|--------|
| ① | 법적 결론 단정 | 중간 | `lint-copy.ts` yaml 확장: "대상입니다/승인/통과/합격" grep → build 실패. result enum `likely_` prefix. |
| ② | 현지조사 대체 | 중간 | UI 결과 최상단 고정 배너 (§10). 모든 ScopingResult.limits 비어있지 않음 회귀 테스트. |
| ③ | EIASS 원문 재호스팅 | 낮음 | rule pack basis 에 `citation_url` 만. PDF 는 로컬 `data/rules/scoping/reference/` 전용 (gitignore). |
| ④ | 주민·기관 의견 왜곡 | 해당 없음 | — |
| ⑤ | 결과 객체 표준 스키마 | 중간 | `StandardAnalysisResult` 타입 강제 + Zod 출력 스키마. `needsHumanReview: true` 리터럴. |
| **⑥** | **법령 숫자 원문 대조 (issue #13 신규)** | **완료** | **2026-04-23 T1 재감사 PASS. `docs/findings/2026-04-22-…audit.md` §8 참조. PDF 3개 로컬 배치. rule pack v2 에 `rule_pack_audit` 메타 필드로 감사 이력 연결.** |

---

## §12. 보안·가드

- 유료 LLM 키 참조 회귀: 기존 CI grep (ANTHROPIC/OPENAI/GOOGLE) 유지
- Rate-limit: 프로젝트당 run 생성 분당 10회 (D1 count 기반)
- 로깅: `src/lib/logger.ts` 준수, input_json/output_json 은 로그에 쓰지 않음
- PDF 재호스팅 금지: `data/rules/scoping/reference/*.pdf` 는 `.gitignore` 포함 확인 필수 (배포 번들·R2·퍼블릭 URL 금지)
- `citation_url` 은 공식 law.go.kr 링크만 허용 (YAML lint 로 도메인 화이트리스트)

---

## §13. 테스트

**단위 (Vitest)**:

- engine: 5 rules × 경계값 (정확히 threshold / ±1 / undefined / zone 매칭) ≈ 25 케이스
- onUndefined 래퍼 (skip 시맨틱): 각 rule 의 참조 입력 undefined → `triggered: false, skip_reason: 'input_undefined'`
- 단위 정규화: `normalizeAreaToSqm(x, 'ha') → x * 10000`, round-trip identity
- zone enum 5개 × rule 2/3/4 매칭/미매칭 분기
- 표준 스키마 Zod validator + `Citation.citation_url` URL 검증
- `lint-copy.ts` 확장: yaml 단정어 검출 회귀

**E2E (Playwright)**:

- `scoping-happy-v2`: site_area_m2=8000, land_use_zone='agricultural_forestry', forest_conversion_m2=800
  → 발동 섹션 2 cards (`small_eia_other_zones` 대상 + `forest_conversion_review` 검토 필요)
  → skip 섹션 accordion (`eia_target_capacity` input_undefined + 2개 zone mismatch)
  → 고정 배너 + `rule_pack_version` DOM 존재 어서션
- `scoping-unit-toggle-v2`: ha 로 입력 → 내부 ㎡ 정규화 확인 (input_json 에 ㎡ 값)
- `scoping-accordion-v2`: skip 섹션 펼침/접힘 state, skip_reason 텍스트 표시 확인
- `scoping-copy-prompt`: 클립보드 복사 → 기대 텍스트 존재
- `scoping-history`: run 생성 2회 → history 2건 → 과거 run 로드

**접근성**:

- axe-smoke 에 `/projects/[id]/scoping` 포함
- section 분리 (`<section aria-label>`) + accordion (`<details>/<summary>` 또는 ARIA) landmark 검증 (CLAUDE.md §6.1)

---

## §14. 성공 지표 (v0 출시 기준)

- 평가사가 **매뉴얼 없이 export 까지 도달 가능**
- 결과 UI/데이터 단정 표현 0건 (`lint-copy.ts` 확장 통과)
- 모든 ScopingResult 에 `basis[].citation_url`, `assumptions`, `limits`, `needsHumanReview: true`, `rule_pack_version`, `triggered`
- Vitest 분기 커버리지 ≥95%, E2E 5건 green, axe-smoke green, `/design-review` 통과
- 유료 LLM 키 참조 0건 (CI grep 통과)
- 고정 배너 + 규칙 버전 표시 회귀 어서션 green
- Lighthouse 성능·접근성 각 ≥ 90 (`/projects/[id]/scoping`)
- rule_pack_audit 메타 필드가 YAML 에 존재, findings_doc 링크가 repo 에 존재 (yaml lint)

---

## §15. 리스크 & 미정 사항

### 리스크

- **rule pack 정확성 — 5건** → 2026-04-23 시점 PDF 대조 PASS. 법령 개정 시 재감사 BLOCKING (issue #13).
- **DSL `gte_by_zone` 연산자 구현 복잡도** → plan M-D 에서 self-DSL 확장 + 엔진 내 lookup 로직으로 해결 예상. json-logic-js 대안도 비교 유지.
- **산지관리법 시행규칙 별표4 미확보 (§0 C1)** → 시행령 별표4 660㎡ 로 MVP 충분. 시행규칙 수령 시 rule 5 보강 검토.

### 미정 (plan v2 단계 결정)

| ID | 항목 | 결정 위임 |
|----|------|-----------|
| M-A | run history 최대 건수 | plan |
| M-B | Claude 수동 분석 프롬프트 템플릿 | `prompts/scoping-manual.md` 별도 작성 |
| M-C | UI 카드 색 hex (DESIGN.md 토큰 5종) | plan |
| M-D | DSL 확장 vs json-logic-js (v2 `gte_by_zone` 지원 비교 포함) | plan |
| M-E | accordion 구현 (`<details>` vs React 컴포넌트 + ARIA) | plan |

### Follow-up issue 후보

- `docs/issues/09`: 법령 링크 체커 자동화 (cron or CI 주1회)
- `docs/issues/10`: 도시지역 rule 추가 (v3 — 녹지 1만㎡ / 도시 6만㎡)
- `docs/issues/11`: 산지관리법 시행규칙 별표4 수령 + 풍력 세부 rule (v3)
- `docs/issues/12`: 보호구역 GIS 연동 (v3)

---

## §16. 다음 단계 (writing-plans v2 주의사항)

1. **plan T1 BLOCKING 해제**: v1 의 "T1 = 법령 원문 대조 감사" 는 2026-04-23 PASS 완료. v2 plan T1 은 구현 전 상태 체크 (audit 링크 verify) + migration 호환성 사전 검증으로 시작.
2. **DSL `gte_by_zone` 결정 우선**: plan 초반 태스크로 self-DSL 확장 설계 (zone lookup 로직). json-logic-js 기각 예상이나 근거 문서화.
3. **migration `0002_scoping.sql` 호환성 검증**: 기존 migration runner (`src/lib/migrations/*` 또는 `wrangler d1 migrations apply`) 와 호환되는지 plan 태스크 1–2 에서 확인.
4. 기존 `workers/cron-cleanup.ts` 에 `scoping_runs` 30일 하드삭제 쿼리 추가 (4-line scope, 안전 가드 복사).
5. `lint-copy.ts` 확장 (yaml 단정어) + axe-smoke 페이지 포함 + E2E 5건 spec 모두 plan 태스크로 분리.
6. **issue #13 준수 증거**: rule pack YAML 의 `rule_pack_audit.findings_doc` 링크 존재 + findings §8 PASS 상태를 CI build 단계에서 verify (build 스크립트 추가).
