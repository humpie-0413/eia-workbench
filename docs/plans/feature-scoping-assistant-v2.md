# feature/scoping-assistant — Implementation Plan v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 환경영향평가 프로젝트의 스코핑 보조 기능 v2 구현 — 입지·용도지역·면적 기반 5 rule pack + 법령 원문 대조 PASS + 감사 친화 UI (섹션 분리 + accordion).

**Architecture:** Astro SSR 페이지 + Cloudflare D1 (scoping_runs 테이블) + R2 없음 (입력·결과 JSON 만 D1 저장) + 순수 함수 engine + YAML rule pack (onshore_wind/v2.2026-04-23) + Zod 검증. v1 의 T1 BLOCKING 감사는 2026-04-23 PASS 완료 — plan v2 는 구현부터 시작.

**Tech Stack:** TypeScript strict, Astro 5 + React islands, Zod, Vitest, Playwright, Cloudflare D1, YAML parser, js-yaml. 기존 프로젝트 쉘 (v0) 의 middleware/CSP/auth/PII-safe logger 재사용.

**Source docs:**
- spec: `docs/superpowers/specs/2026-04-23-scoping-assistant-design-v2.md`
- findings (T1 PASS): `docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md` §8
- OH answers: `docs/office-hours/2026-04-23-scoping-assistant-v2-draft-answers.md`
- issue #13: `docs/issues/13-spec-law-audit-mandatory.md`

**Branch strategy:** `feature/scoping-assistant-v2` 워크트리 (using-git-worktrees). main 에 merge 는 사용자 승인 후.

---

## File Structure

### Files to create

- `migrations/0002_scoping.sql` — scoping_runs 테이블
- `src/features/scoping/units.ts` — ㎡/ha 정규화 유틸 + 테스트
- `src/features/scoping/zone.ts` — land_use_zone enum + 라벨 매핑
- `src/features/scoping/engine.ts` — 순수 함수 evaluate (5 rules)
- `src/features/scoping/engine.test.ts` — 25+ 단위 테스트
- `src/features/scoping/rule-pack-loader.ts` — YAML 로더 + audit 메타 검증
- `src/features/scoping/prompt-generator.ts` — Claude 수동 분석 프롬프트 빌더
- `src/features/scoping/csv-export.ts` — CSV 변환
- `src/features/scoping/markdown-export.ts` — Markdown 변환
- `src/features/scoping/README.md` — 가정 중복 표기 (spec §0 가정 Q1-v2 등)
- `src/lib/types/analysis-result.ts` — StandardAnalysisResult, Citation, ScopingResult
- `src/lib/schemas/scoping.ts` — Zod scopingInputSchema
- `data/rules/scoping/onshore_wind.v2.yaml` — rule pack v2
- `src/pages/projects/[id]/scoping.astro` — SSR 페이지
- `src/pages/api/projects/[id]/scoping/index.ts` — POST/GET
- `src/pages/api/projects/[id]/scoping/runs/index.ts` — GET list
- `src/pages/api/projects/[id]/scoping/runs/[runId].ts` — GET one / DELETE
- `src/components/scoping/ScopingForm.tsx` — 입력 폼 React island
- `src/components/scoping/ScopingResults.tsx` — 결과 영역 React island (섹션 분리 + accordion)
- `src/components/scoping/RunHistoryList.tsx` — 좌측 history 사이드바
- `src/components/scoping/AreaInput.tsx` — 숫자 + ㎡/ha 단위 selector 재사용
- `scripts/verify-rule-pack-audit.ts` — build-time audit 메타 검증 (issue #13 증거)
- `tests/e2e/scoping-happy-v2.spec.ts`
- `tests/e2e/scoping-unit-toggle-v2.spec.ts`
- `tests/e2e/scoping-accordion-v2.spec.ts`
- `tests/e2e/scoping-copy-prompt.spec.ts`
- `tests/e2e/scoping-history.spec.ts`

### Files to modify

- `workers/cron-cleanup.ts` — scoping_runs 30일 하드삭제 쿼리 추가
- `src/pages/projects/[id].astro` — DisabledTab("스코핑") → `<a>` 링크로 교체
- `scripts/lint-copy.ts` — yaml 규칙 파일까지 단정어 grep 확장
- `DESIGN.md` — §N 에 badge 색 토큰 5종 + accordion 정책 추가
- `.github/workflows/ci.yml` — verify-rule-pack-audit step 추가
- `package.json` — `js-yaml` devDep (YAML 로더용, 이미 있으면 skip)

### Files already fixed (Phase A 완료)

- `docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md` §8 append (PASS)
- `data/rules/scoping/reference/*.pdf` 3개 파일명 정정 (README 반영)
- `docs/superpowers/specs/2026-04-22-…-v1-superseded-by-v2.md` (rename)
- `docs/plans/feature-scoping-assistant-v1-superseded-by-v2.md` (rename)

---

## Phase 1 — 준비 및 사전 체크

### Task 1: 워크트리 생성 + 사전 상태 체크

**Files:**
- 워크트리: `../eia-workbench-feature-scoping-assistant-v2` (superpowers:using-git-worktrees)

- [ ] **Step 1: 워크트리 생성**

Run: `git worktree add ../eia-workbench-feature-scoping-assistant-v2 -b feature/scoping-assistant-v2`
Expected: 새 디렉터리 생성, 브랜치 `feature/scoping-assistant-v2` checked out.

- [ ] **Step 2: 의존성 설치**

Run (in worktree): `npm ci`
Expected: 0 errors.

- [ ] **Step 3: 기존 테스트 baseline 확인**

Run: `npm run typecheck && npm run lint && npm test`
Expected: 모두 green (v0 project-shell 기반, 영향 없음 확인).

- [ ] **Step 4: 법령 PDF 로컬 배치 verify**

Run: `ls data/rules/scoping/reference/*.pdf*`
Expected: 3개 파일 존재 (enforcement-decree-eia-…-annex-03 / -04, enforcement-decree-forest-management-act-…-annex-04).

- [ ] **Step 5: findings §8 PASS 확인**

Run: `grep -c "Verdict:.*PASS" docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md`
Expected: `>= 1` (§8.4 PASS 섹션).

- [ ] **Step 6: commit baseline 체크**

Run: `git log --oneline -n 5`
Expected: 최근 3 commit 에 `T1 재감사 PASS`, `spec v2 + v1 rename`, `plan v2` 가 순서대로 있음.

---

### Task 2: DSL 확장 결정 (M-D) — `gte_by_zone` 지원 방식

**Context:** spec §7 의 rule 4 는 `gte_by_zone` 연산자 요구. json-logic-js 는 기본 미지원 — self-DSL 확장 유력. plan 내 결정 문서화.

**Files:**
- Create: `src/features/scoping/dsl-decision.md` (결정 근거 기록)

- [ ] **Step 1: 결정 문서 작성**

Create `src/features/scoping/dsl-decision.md`:

```markdown
# DSL vs json-logic-js 결정 (M-D, spec §15 미정)

**Date:** 2026-04-23
**Decision:** self-DSL 확장 채택

## 비교

| 항목 | self-DSL | json-logic-js |
|---|---|---|
| 6연산자 (==, !=, >, >=, <, <=) | 직접 구현 | 내장 |
| `one_of` | 커스텀 | `in` 있음 |
| `gte_by_zone` (v2 rule 4) | **직접 구현 자연** | **커스텀 operator 등록 필요, 2-layer lookup** |
| onUndefined 래퍼 | 엔진 내 처리 | 외부 래퍼 필요 |
| 의존성 | 0 | +1 npm package |
| 테스트 표면 | 작음 | 커짐 (lib + 커스텀 op) |

## 결론

self-DSL 확장이 dependencies 0, 로직 명시성, onUndefined 래퍼 결합 측면에서 우위.
`gte_by_zone` 은 engine 에서 rule.when 파싱 시 특수 분기 처리.
```

- [ ] **Step 2: Commit**

```bash
git add src/features/scoping/dsl-decision.md
git commit -m "docs(scoping): DSL 확장 채택 결정 (M-D, self-DSL)"
```

---

## Phase 2 — Migration & Types

### Task 3: migration 0002_scoping.sql 작성

**Files:**
- Create: `migrations/0002_scoping.sql`
- Test: `tests/unit/migrations/0002_scoping.test.ts` (sqlite in-memory)

- [ ] **Step 1: 테스트 작성 (실패 확인용)**

Create `tests/unit/migrations/0002_scoping.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

describe('migrations/0002_scoping.sql', () => {
  it('creates scoping_runs table with expected columns and indexes', () => {
    const db = new Database(':memory:');
    const base = fs.readFileSync(path.join(__dirname, '../../../migrations/0001_init.sql'), 'utf-8');
    const mig = fs.readFileSync(path.join(__dirname, '../../../migrations/0002_scoping.sql'), 'utf-8');
    db.exec(base);
    db.exec(mig);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scoping_runs'").all();
    expect(tables.length).toBe(1);
    const cols = db.prepare("PRAGMA table_info(scoping_runs)").all() as Array<{ name: string }>;
    const names = cols.map(c => c.name);
    expect(names).toEqual(
      expect.arrayContaining(['id', 'project_id', 'rule_pack_version', 'input_json', 'output_json', 'created_at', 'deleted_at'])
    );
    const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='scoping_runs'").all();
    expect(idx.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

Run: `npx vitest run tests/unit/migrations/0002_scoping.test.ts`
Expected: FAIL ("migrations/0002_scoping.sql" not found).

- [ ] **Step 3: migration 작성**

Create `migrations/0002_scoping.sql`:

```sql
CREATE TABLE scoping_runs (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES projects(id),
  rule_pack_version  TEXT NOT NULL,
  input_json         TEXT NOT NULL,
  output_json        TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at         TEXT
);
CREATE INDEX scoping_runs_project ON scoping_runs(project_id, created_at DESC);
CREATE INDEX scoping_runs_deleted ON scoping_runs(deleted_at);
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `npx vitest run tests/unit/migrations/0002_scoping.test.ts`
Expected: PASS.

- [ ] **Step 5: migration runner 호환성 체크**

Run: `wrangler d1 migrations list DB --local 2>&1 | head -10` (local only, remote 는 사용자 권한)
Expected: 0001_init.sql + 0002_scoping.sql 둘 다 리스트.

- [ ] **Step 6: Commit**

```bash
git add migrations/0002_scoping.sql tests/unit/migrations/0002_scoping.test.ts
git commit -m "feat(scoping): migration 0002 — scoping_runs 테이블"
```

---

### Task 4: 단위 정규화 유틸 (sqm/ha)

**Files:**
- Create: `src/features/scoping/units.ts`
- Test: `src/features/scoping/units.test.ts`

- [ ] **Step 1: 테스트 작성**

Create `src/features/scoping/units.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeAreaToSqm, denormalizeSqmToInputUnit, HA_TO_SQM } from './units';

describe('units', () => {
  it('converts ha → sqm via HA_TO_SQM=10000', () => {
    expect(HA_TO_SQM).toBe(10_000);
    expect(normalizeAreaToSqm(1, 'ha')).toBe(10_000);
    expect(normalizeAreaToSqm(0.066, 'ha')).toBeCloseTo(660, 5);
    expect(normalizeAreaToSqm(500, 'sqm')).toBe(500);
  });
  it('round-trip identity', () => {
    const value = 7500;
    const roundTrip = denormalizeSqmToInputUnit(normalizeAreaToSqm(value, 'sqm'), 'sqm');
    expect(roundTrip).toBe(value);
    const haRoundTrip = denormalizeSqmToInputUnit(normalizeAreaToSqm(0.75, 'ha'), 'ha');
    expect(haRoundTrip).toBeCloseTo(0.75, 10);
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL**

Run: `npx vitest run src/features/scoping/units.test.ts`
Expected: FAIL (units.ts not found).

- [ ] **Step 3: 구현**

Create `src/features/scoping/units.ts`:

```ts
export const HA_TO_SQM = 10_000 as const;

export function normalizeAreaToSqm(value: number, unit: 'sqm' | 'ha'): number {
  if (unit === 'ha') return value * HA_TO_SQM;
  return value;
}

export function denormalizeSqmToInputUnit(sqm: number, unit: 'sqm' | 'ha'): number {
  if (unit === 'ha') return sqm / HA_TO_SQM;
  return sqm;
}
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `npx vitest run src/features/scoping/units.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/scoping/units.ts src/features/scoping/units.test.ts
git commit -m "feat(scoping): 단위 정규화 유틸 (sqm/ha)"
```

---

### Task 5: land_use_zone enum + 라벨

**Files:**
- Create: `src/features/scoping/zone.ts`
- Test: `src/features/scoping/zone.test.ts`

- [ ] **Step 1: 테스트 작성**

Create `src/features/scoping/zone.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LAND_USE_ZONES, zoneLabelKo } from './zone';

describe('zone', () => {
  it('enumerates 5 management zones per spec §5', () => {
    expect(LAND_USE_ZONES).toEqual([
      'conservation_management',
      'production_management',
      'planning_management',
      'agricultural_forestry',
      'natural_environment_conservation',
    ]);
  });
  it('provides Korean labels for each zone', () => {
    expect(zoneLabelKo('conservation_management')).toBe('보전관리지역');
    expect(zoneLabelKo('planning_management')).toBe('계획관리지역');
    expect(zoneLabelKo('natural_environment_conservation')).toBe('자연환경보전지역');
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL**

Run: `npx vitest run src/features/scoping/zone.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

Create `src/features/scoping/zone.ts`:

```ts
export const LAND_USE_ZONES = [
  'conservation_management',
  'production_management',
  'planning_management',
  'agricultural_forestry',
  'natural_environment_conservation',
] as const;

export type LandUseZone = (typeof LAND_USE_ZONES)[number];

const LABELS_KO: Record<LandUseZone, string> = {
  conservation_management: '보전관리지역',
  production_management: '생산관리지역',
  planning_management: '계획관리지역',
  agricultural_forestry: '농림지역',
  natural_environment_conservation: '자연환경보전지역',
};

export function zoneLabelKo(zone: LandUseZone): string {
  return LABELS_KO[zone];
}
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `npx vitest run src/features/scoping/zone.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/scoping/zone.ts src/features/scoping/zone.test.ts
git commit -m "feat(scoping): land_use_zone enum + 한국어 라벨"
```

---

### Task 6: 표준 결과 스키마 타입

**Files:**
- Create: `src/lib/types/analysis-result.ts`
- Test: `src/lib/types/analysis-result.test.ts`

- [ ] **Step 1: 테스트 작성**

Create `src/lib/types/analysis-result.test.ts`:

```ts
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { StandardAnalysisResult, Citation, ScopingResult } from './analysis-result';

describe('StandardAnalysisResult type', () => {
  it('enforces result enum', () => {
    const r: StandardAnalysisResult = {
      result: 'likely_applicable',
      basis: [],
      assumptions: [],
      limits: [],
      needsHumanReview: true,
    };
    expect(r.needsHumanReview).toBe(true);
  });
  it('ScopingResult requires triggered boolean', () => {
    const r: ScopingResult = {
      ruleId: 'x',
      title: 'x',
      category: 'eia_target',
      rule_pack_version: 'v2',
      triggered: false,
      skip_reason: 'input_undefined',
      result: 'skipped',
      basis: [],
      assumptions: [],
      limits: [],
      needsHumanReview: true,
    };
    expect(r.triggered).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL**

Run: `npx vitest run src/lib/types/analysis-result.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

Create `src/lib/types/analysis-result.ts`:

```ts
export interface Citation {
  id: string;
  title: string;
  refLink?: string;
  citation_url?: string;
}

export interface StandardAnalysisResult {
  result: 'likely_applicable' | 'needs_check' | 'likely_not_applicable' | 'unknown' | 'skipped';
  basis: Citation[];
  assumptions: string[];
  limits: string[];
  needsHumanReview: true;
}

export interface ScopingResult extends StandardAnalysisResult {
  ruleId: string;
  title: string;
  category: 'eia_target' | 'small_eia' | 'forest_conversion';
  rule_pack_version: string;
  triggered: boolean;
  skip_reason?: 'input_undefined' | 'zone_mismatch' | 'condition_not_met';
}
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `npx vitest run src/lib/types/analysis-result.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/analysis-result.ts src/lib/types/analysis-result.test.ts
git commit -m "feat(scoping): StandardAnalysisResult + ScopingResult 타입"
```

---

### Task 7: Zod 입력 스키마

**Files:**
- Create: `src/lib/schemas/scoping.ts`
- Test: `src/lib/schemas/scoping.test.ts`

- [ ] **Step 1: 테스트 작성**

Create `src/lib/schemas/scoping.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scopingInputSchema } from './scoping';

describe('scopingInputSchema', () => {
  it('accepts minimal required fields', () => {
    const r = scopingInputSchema.parse({
      site_area_m2: 5000,
      site_area_input_unit: 'sqm',
      land_use_zone: 'conservation_management',
    });
    expect(r.site_area_m2).toBe(5000);
  });
  it('rejects out-of-range site_area_m2', () => {
    expect(() => scopingInputSchema.parse({
      site_area_m2: -1,
      site_area_input_unit: 'sqm',
      land_use_zone: 'conservation_management',
    })).toThrow();
  });
  it('rejects unknown land_use_zone', () => {
    expect(() => scopingInputSchema.parse({
      site_area_m2: 100,
      site_area_input_unit: 'sqm',
      land_use_zone: 'urban',
    })).toThrow();
  });
  it('forest_conversion_m2 optional', () => {
    const r = scopingInputSchema.parse({
      site_area_m2: 100,
      site_area_input_unit: 'sqm',
      land_use_zone: 'planning_management',
    });
    expect(r.forest_conversion_m2).toBeUndefined();
  });
});
```

- [ ] **Step 2: FAIL 확인**

Run: `npx vitest run src/lib/schemas/scoping.test.ts`

- [ ] **Step 3: 구현**

Create `src/lib/schemas/scoping.ts`:

```ts
import { z } from 'zod';
import { LAND_USE_ZONES } from '../../features/scoping/zone';

export const landUseZoneEnum = z.enum(LAND_USE_ZONES as unknown as [string, ...string[]]);
export const areaUnitEnum = z.enum(['sqm', 'ha']);

export const scopingInputSchema = z.object({
  site_area_m2: z.number().min(0).max(10_000_000),
  site_area_input_unit: areaUnitEnum,
  land_use_zone: landUseZoneEnum,
  forest_conversion_m2: z.number().min(0).max(10_000_000).optional(),
  forest_conversion_input_unit: areaUnitEnum.optional(),
  capacity_mw_override: z.number().min(0).max(10_000).optional(),
  notes: z.string().max(1000).optional(),
});

export type ScopingInput = z.infer<typeof scopingInputSchema>;
```

- [ ] **Step 4: 테스트 PASS 확인**

Run: `npx vitest run src/lib/schemas/scoping.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/scoping.ts src/lib/schemas/scoping.test.ts
git commit -m "feat(scoping): Zod scopingInputSchema"
```

---

## Phase 3 — Rule Pack & Engine

### Task 8: rule pack YAML v2 작성

**Files:**
- Create: `data/rules/scoping/onshore_wind.v2.yaml`

- [ ] **Step 1: YAML 파일 작성** (spec §7 확정 구조 그대로)

Create `data/rules/scoping/onshore_wind.v2.yaml`:

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

source_note: >
  v2 규칙 5건. T1 재감사 (2026-04-23) PDF 원문 대조 PASS.
  rule 추가/수정 PR 은 CLAUDE.md §9.3 + issue #13 법령 숫자 원문 대조 BLOCKING 통과 필수.

rules:
  - id: eia_target_capacity
    title: 환경영향평가 대상사업 가능성 (발전시설용량 10만 kW 이상)
    category: eia_target
    when:
      capacity_mw:
        gte: 100
    onUndefined: skip
    result: likely_applicable
    basis:
      - id: eia-act-sched-3-article-3-da-1
        title: 환경영향평가법 시행령 별표3 제3호 다목1)
        citation_url: https://law.go.kr/법령/환경영향평가법시행령
    assumptions:
      - 사용자 입력 capacity_mw 는 정격 기준 (발전시설용량)
    limits:
      - 단일 사업장 기준. 인접 사업장 누적 용량 미반영.
      - 발전사업용 전기저장장치 결합 여부는 별표3 라목 별도 판단 필요.

  - id: small_eia_conservation
    title: 소규모 환경영향평가 대상 가능성 (보전관리지역 · 5천㎡ 이상)
    category: small_eia
    when:
      land_use_zone:
        equals: conservation_management
      site_area_m2:
        gte: 5000
    onUndefined: skip
    result: likely_applicable
    basis:
      - id: small-eia-act-sched-4-conservation
        title: 환경영향평가법 시행령 별표4 (보전관리)
        citation_url: https://law.go.kr/법령/환경영향평가법시행령
    assumptions:
      - 사업 계획 면적 기준
    limits:
      - 용도지역 경계 중첩 시 가장 보전 등급 높은 지역 기준 판정.

  - id: small_eia_planning
    title: 소규모 환경영향평가 대상 가능성 (계획관리지역 · 1만㎡ 이상)
    category: small_eia
    when:
      land_use_zone:
        equals: planning_management
      site_area_m2:
        gte: 10000
    onUndefined: skip
    result: likely_applicable
    basis:
      - id: small-eia-act-sched-4-planning
        title: 환경영향평가법 시행령 별표4 (계획관리)
        citation_url: https://law.go.kr/법령/환경영향평가법시행령
    assumptions:
      - 사업 계획 면적 기준
    limits:
      - 용도지역 경계 중첩 시 가장 보전 등급 높은 지역 기준 판정.

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
        title: 환경영향평가법 시행령 별표4 (농림/자연환경보전/생산관리)
        citation_url: https://law.go.kr/법령/환경영향평가법시행령
    assumptions:
      - 사업 계획 면적 기준
      - 생산관리지역은 관리지역 세부 구분
    limits:
      - 용도지역 경계 중첩 시 가장 보전 등급 높은 지역 기준 판정.
      - 자연환경보전지역 내 추가 행위제한은 자연환경보전법 별도 확인 필요.

  - id: forest_conversion_review
    title: 산지전용타당성조사 대상 가능성 (산지전용 면적 660㎡ 이상)
    category: forest_conversion
    when:
      forest_conversion_m2:
        gte: 660
    onUndefined: skip
    result: needs_check
    basis:
      - id: forest-act-decree-sched-4-article-2-da
        title: 산지관리법 시행령 별표4 제2호 다목
        citation_url: https://law.go.kr/법령/산지관리법시행령
    assumptions:
      - 사용자 입력 산지전용 면적은 사업 전체 기준
      - 평균경사도 25도 이하 일반 기준 적용
    limits:
      - 보전산지(공익용/임업용) 여부는 별도 확인 필요.
      - 풍력발전시설 특화 세부 기준은 산지관리법 시행규칙 별표4 확인 권장.
```

- [ ] **Step 2: YAML 파일 존재 확인 + 파싱 smoke test**

Run: `node -e "console.log(require('js-yaml').load(require('fs').readFileSync('data/rules/scoping/onshore_wind.v2.yaml','utf-8')).rules.length)"`
Expected: `5`.

- [ ] **Step 3: Commit**

```bash
git add data/rules/scoping/onshore_wind.v2.yaml
git commit -m "feat(scoping): rule pack v2 YAML (5 rules, T1 감사 PASS)"
```

---

### Task 9: rule pack loader (YAML → 타입 + audit 검증)

**Files:**
- Create: `src/features/scoping/rule-pack-loader.ts`
- Test: `src/features/scoping/rule-pack-loader.test.ts`

- [ ] **Step 1: 테스트 작성**

Create `src/features/scoping/rule-pack-loader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadRulePackFromString, validateAudit } from './rule-pack-loader';

const SAMPLE_VALID = `
version: onshore_wind/v2.2026-04-23
industry: onshore_wind
rule_pack_audit:
  findings_doc: docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md
  audit_verdict: PASS
  audit_date: 2026-04-23
  source_pdfs: []
source_note: x
rules: []
`;

describe('rule-pack-loader', () => {
  it('parses YAML and extracts version/rules', () => {
    const pack = loadRulePackFromString(SAMPLE_VALID);
    expect(pack.version).toBe('onshore_wind/v2.2026-04-23');
    expect(pack.rules).toEqual([]);
  });
  it('validateAudit throws if audit_verdict != PASS', () => {
    const bad = SAMPLE_VALID.replace('PASS', 'FAIL');
    const pack = loadRulePackFromString(bad);
    expect(() => validateAudit(pack)).toThrow(/audit/i);
  });
});
```

- [ ] **Step 2: FAIL**

Run: `npx vitest run src/features/scoping/rule-pack-loader.test.ts`

- [ ] **Step 3: 구현**

Create `src/features/scoping/rule-pack-loader.ts`:

```ts
import yaml from 'js-yaml';

export interface RulePackAudit {
  findings_doc: string;
  audit_verdict: 'PASS' | 'FAIL' | 'PARTIAL';
  audit_date: string;
  source_pdfs: string[];
}

export interface RulePack {
  version: string;
  industry: string;
  rule_pack_audit: RulePackAudit;
  source_note: string;
  rules: unknown[];  // 세부 타입은 engine 에서
}

export function loadRulePackFromString(text: string): RulePack {
  const parsed = yaml.load(text) as RulePack;
  if (!parsed.rule_pack_audit) {
    throw new Error('rule pack: rule_pack_audit meta 누락 (issue #13)');
  }
  return parsed;
}

export function validateAudit(pack: RulePack): void {
  if (pack.rule_pack_audit.audit_verdict !== 'PASS') {
    throw new Error(`rule pack audit FAIL: ${pack.rule_pack_audit.audit_verdict}`);
  }
}
```

- [ ] **Step 4: PASS**

Run: `npx vitest run src/features/scoping/rule-pack-loader.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/features/scoping/rule-pack-loader.ts src/features/scoping/rule-pack-loader.test.ts
git commit -m "feat(scoping): rule pack YAML loader + audit verdict 검증"
```

---

### Task 10: Engine — rule evaluate + onUndefined skip

**Files:**
- Create: `src/features/scoping/engine.ts`
- Test: `src/features/scoping/engine.test.ts`

- [ ] **Step 1: 핵심 테스트 작성 (5 rule × 경계값)**

Create `src/features/scoping/engine.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { evaluate } from './engine';
import { loadRulePackFromString } from './rule-pack-loader';

const pack = loadRulePackFromString(
  fs.readFileSync(path.join(__dirname, '../../../data/rules/scoping/onshore_wind.v2.yaml'), 'utf-8')
);

describe('engine.evaluate — 5 rules', () => {
  describe('rule 1 eia_target_capacity (capacity_mw >= 100)', () => {
    it('triggers when capacity_mw = 100', () => {
      const r = evaluate({ capacity_mw: 100, site_area_m2: 0, land_use_zone: 'planning_management' }, pack);
      const rule = r.find(x => x.ruleId === 'eia_target_capacity')!;
      expect(rule.triggered).toBe(true);
      expect(rule.result).toBe('likely_applicable');
    });
    it('does not trigger when capacity_mw = 99', () => {
      const r = evaluate({ capacity_mw: 99, site_area_m2: 0, land_use_zone: 'planning_management' }, pack);
      expect(r.find(x => x.ruleId === 'eia_target_capacity')!.triggered).toBe(false);
    });
    it('skips when capacity_mw undefined', () => {
      const r = evaluate({ site_area_m2: 0, land_use_zone: 'planning_management' }, pack);
      const rule = r.find(x => x.ruleId === 'eia_target_capacity')!;
      expect(rule.triggered).toBe(false);
      expect(rule.skip_reason).toBe('input_undefined');
    });
  });

  describe('rule 2 small_eia_conservation', () => {
    it('triggers at 5000㎡ with conservation zone', () => {
      const r = evaluate({ site_area_m2: 5000, land_use_zone: 'conservation_management' }, pack);
      expect(r.find(x => x.ruleId === 'small_eia_conservation')!.triggered).toBe(true);
    });
    it('does not trigger at 4999', () => {
      const r = evaluate({ site_area_m2: 4999, land_use_zone: 'conservation_management' }, pack);
      expect(r.find(x => x.ruleId === 'small_eia_conservation')!.triggered).toBe(false);
    });
    it('zone mismatch when planning zone', () => {
      const r = evaluate({ site_area_m2: 999999, land_use_zone: 'planning_management' }, pack);
      const rule = r.find(x => x.ruleId === 'small_eia_conservation')!;
      expect(rule.triggered).toBe(false);
      expect(rule.skip_reason).toBe('zone_mismatch');
    });
  });

  describe('rule 3 small_eia_planning', () => {
    it('triggers at 10000㎡ with planning zone', () => {
      const r = evaluate({ site_area_m2: 10000, land_use_zone: 'planning_management' }, pack);
      expect(r.find(x => x.ruleId === 'small_eia_planning')!.triggered).toBe(true);
    });
    it('does not trigger at 9999', () => {
      const r = evaluate({ site_area_m2: 9999, land_use_zone: 'planning_management' }, pack);
      expect(r.find(x => x.ruleId === 'small_eia_planning')!.triggered).toBe(false);
    });
  });

  describe('rule 4 small_eia_other_zones (gte_by_zone)', () => {
    it('triggers agricultural_forestry at 7500', () => {
      const r = evaluate({ site_area_m2: 7500, land_use_zone: 'agricultural_forestry' }, pack);
      expect(r.find(x => x.ruleId === 'small_eia_other_zones')!.triggered).toBe(true);
    });
    it('triggers natural_environment_conservation at 5000', () => {
      const r = evaluate({ site_area_m2: 5000, land_use_zone: 'natural_environment_conservation' }, pack);
      expect(r.find(x => x.ruleId === 'small_eia_other_zones')!.triggered).toBe(true);
    });
    it('triggers production_management at 7500', () => {
      const r = evaluate({ site_area_m2: 7500, land_use_zone: 'production_management' }, pack);
      expect(r.find(x => x.ruleId === 'small_eia_other_zones')!.triggered).toBe(true);
    });
    it('does not trigger natural_environment_conservation at 4999', () => {
      const r = evaluate({ site_area_m2: 4999, land_use_zone: 'natural_environment_conservation' }, pack);
      expect(r.find(x => x.ruleId === 'small_eia_other_zones')!.triggered).toBe(false);
    });
    it('zone mismatch with conservation_management', () => {
      const r = evaluate({ site_area_m2: 99999, land_use_zone: 'conservation_management' }, pack);
      const rule = r.find(x => x.ruleId === 'small_eia_other_zones')!;
      expect(rule.triggered).toBe(false);
      expect(rule.skip_reason).toBe('zone_mismatch');
    });
  });

  describe('rule 5 forest_conversion_review', () => {
    it('triggers at 660㎡', () => {
      const r = evaluate({
        site_area_m2: 0, land_use_zone: 'planning_management', forest_conversion_m2: 660,
      }, pack);
      expect(r.find(x => x.ruleId === 'forest_conversion_review')!.triggered).toBe(true);
    });
    it('does not trigger at 659', () => {
      const r = evaluate({
        site_area_m2: 0, land_use_zone: 'planning_management', forest_conversion_m2: 659,
      }, pack);
      expect(r.find(x => x.ruleId === 'forest_conversion_review')!.triggered).toBe(false);
    });
    it('skips when forest_conversion_m2 undefined', () => {
      const r = evaluate({ site_area_m2: 0, land_use_zone: 'planning_management' }, pack);
      expect(r.find(x => x.ruleId === 'forest_conversion_review')!.skip_reason).toBe('input_undefined');
    });
  });

  it('all rules carry rule_pack_version', () => {
    const r = evaluate({ site_area_m2: 0, land_use_zone: 'planning_management' }, pack);
    r.forEach(rule => expect(rule.rule_pack_version).toBe('onshore_wind/v2.2026-04-23'));
  });

  it('all rules have needsHumanReview: true', () => {
    const r = evaluate({ site_area_m2: 0, land_use_zone: 'planning_management' }, pack);
    r.forEach(rule => expect(rule.needsHumanReview).toBe(true));
  });
});
```

- [ ] **Step 2: FAIL**

Run: `npx vitest run src/features/scoping/engine.test.ts`

- [ ] **Step 3: 구현**

Create `src/features/scoping/engine.ts`:

```ts
import type { ScopingResult, Citation } from '../../lib/types/analysis-result';
import type { RulePack } from './rule-pack-loader';
import type { LandUseZone } from './zone';

export interface EvalInput {
  capacity_mw?: number;
  site_area_m2?: number;
  land_use_zone?: LandUseZone;
  forest_conversion_m2?: number;
}

interface RawRule {
  id: string;
  title: string;
  category: ScopingResult['category'];
  when: Record<string, Record<string, unknown>>;
  onUndefined: 'skip' | 'unknown' | 'false';
  result: 'likely_applicable' | 'needs_check' | 'likely_not_applicable';
  basis: Citation[];
  assumptions: string[];
  limits: string[];
}

export function evaluate(input: EvalInput, pack: RulePack): ScopingResult[] {
  const rules = pack.rules as RawRule[];
  return rules.map(rule => evaluateOne(rule, input, pack.version));
}

function evaluateOne(rule: RawRule, input: EvalInput, version: string): ScopingResult {
  const base = {
    ruleId: rule.id,
    title: rule.title,
    category: rule.category,
    rule_pack_version: version,
    basis: rule.basis,
    assumptions: rule.assumptions,
    limits: rule.limits,
    needsHumanReview: true as const,
  };

  const fields = Object.keys(rule.when);

  // onUndefined skip check
  for (const field of fields) {
    if (input[field as keyof EvalInput] === undefined) {
      return {
        ...base,
        triggered: false,
        skip_reason: 'input_undefined',
        result: 'skipped',
      };
    }
  }

  // Evaluate each field condition
  let zoneMismatch = false;
  let allPass = true;
  for (const field of fields) {
    const cond = rule.when[field];
    const value = input[field as keyof EvalInput];
    const result = evalCondition(field, cond, value, input);
    if (result === 'zone_mismatch') {
      zoneMismatch = true;
      break;
    }
    if (!result) {
      allPass = false;
    }
  }

  if (zoneMismatch) {
    return {
      ...base,
      triggered: false,
      skip_reason: 'zone_mismatch',
      result: 'skipped',
    };
  }

  if (!allPass) {
    return {
      ...base,
      triggered: false,
      skip_reason: 'condition_not_met',
      result: 'likely_not_applicable',
    };
  }

  return {
    ...base,
    triggered: true,
    result: rule.result,
  };
}

function evalCondition(
  field: string,
  cond: Record<string, unknown>,
  value: unknown,
  fullInput: EvalInput
): boolean | 'zone_mismatch' {
  if ('equals' in cond) return value === cond.equals;
  if ('gte' in cond) return typeof value === 'number' && value >= (cond.gte as number);
  if ('gt' in cond) return typeof value === 'number' && value > (cond.gt as number);
  if ('lt' in cond) return typeof value === 'number' && value < (cond.lt as number);
  if ('lte' in cond) return typeof value === 'number' && value <= (cond.lte as number);
  if ('one_of' in cond) {
    const arr = cond.one_of as string[];
    return arr.includes(value as string) ? true : 'zone_mismatch';
  }
  if ('gte_by_zone' in cond) {
    const zone = fullInput.land_use_zone;
    if (!zone) return false;
    const lookup = cond.gte_by_zone as Record<string, number>;
    if (!(zone in lookup)) return 'zone_mismatch';
    return typeof value === 'number' && value >= lookup[zone];
  }
  return false;
}
```

- [ ] **Step 4: 테스트 실행 → PASS**

Run: `npx vitest run src/features/scoping/engine.test.ts`
Expected: 모든 케이스 PASS.

- [ ] **Step 5: 커버리지 체크**

Run: `npx vitest run --coverage src/features/scoping/engine.ts`
Expected: branch coverage ≥ 95%.

- [ ] **Step 6: Commit**

```bash
git add src/features/scoping/engine.ts src/features/scoping/engine.test.ts
git commit -m "feat(scoping): engine — 5 rule evaluate + onUndefined skip + gte_by_zone"
```

---

## Phase 4 — API Endpoints

### Task 11: POST /api/projects/[id]/scoping

**Files:**
- Create: `src/pages/api/projects/[id]/scoping/index.ts`
- Test: `tests/unit/api-scoping-post.test.ts`

- [ ] **Step 1: 테스트 작성**

Create `tests/unit/api-scoping-post.test.ts` (기존 프로젝트 API 테스트 패턴 준수):

```ts
import { describe, it, expect } from 'vitest';
// 기존 project-shell 테스트의 D1 mock 패턴 재사용
// ... (기존 api-uploads-post.test.ts 스타일)
```

실제 구현 시 기존 `tests/unit/api-*` 의 mock 패턴을 그대로 참조. 최소 테스트:
- 200 POST with valid input → 201 + ScopingResult[] (triggered + skipped 혼합)
- 400 when input invalid (missing land_use_zone)
- 401 when not authenticated
- 404 when project id missing

- [ ] **Step 2: FAIL**

- [ ] **Step 3: 구현**

Create `src/pages/api/projects/[id]/scoping/index.ts`:

```ts
import type { APIRoute } from 'astro';
import { scopingInputSchema } from '../../../../../lib/schemas/scoping';
import { evaluate } from '../../../../../features/scoping/engine';
import { loadRulePackFromString, validateAudit } from '../../../../../features/scoping/rule-pack-loader';
import { normalizeAreaToSqm } from '../../../../../features/scoping/units';
import { newId } from '../../../../../lib/id';
import { getProjectById } from '../../../../../lib/projects';
// ... (기존 middleware/logger import 재사용)

export const POST: APIRoute = async ({ params, request, locals }) => {
  // auth check via middleware
  const projectId = params.id!;
  const body = await request.json();
  const parsed = scopingInputSchema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });

  const project = await getProjectById(locals.env.DB, projectId);
  if (!project) return new Response(JSON.stringify({ error: 'project not found' }), { status: 404 });

  // rule pack load + audit verify
  const yamlText = await locals.env.ASSETS.fetch('/data/rules/scoping/onshore_wind.v2.yaml').then(r => r.text());
  const pack = loadRulePackFromString(yamlText);
  validateAudit(pack);

  // EvalInput 구성
  const input = {
    capacity_mw: parsed.data.capacity_mw_override ?? project.capacity_mw ?? undefined,
    site_area_m2: parsed.data.site_area_m2,  // 이미 정규화됨 (API 진입 시)
    land_use_zone: parsed.data.land_use_zone,
    forest_conversion_m2: parsed.data.forest_conversion_m2,
  };

  const results = evaluate(input, pack);
  const runId = newId(12);
  await locals.env.DB.prepare(
    'INSERT INTO scoping_runs (id, project_id, rule_pack_version, input_json, output_json) VALUES (?,?,?,?,?)'
  ).bind(runId, projectId, pack.version, JSON.stringify(parsed.data), JSON.stringify(results)).run();

  return new Response(JSON.stringify({ runId, results, rule_pack_version: pack.version }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 4: 테스트 PASS**

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/projects/[id]/scoping/index.ts tests/unit/api-scoping-post.test.ts
git commit -m "feat(scoping): POST /api/projects/[id]/scoping — engine 실행 + run 저장"
```

---

### Task 12: GET /api/projects/[id]/scoping (최신 run)

**Files:**
- Modify: `src/pages/api/projects/[id]/scoping/index.ts` (GET 핸들러 추가)
- Test: 기존 파일에 추가

- [ ] **Step 1: 테스트 추가**

- [ ] **Step 2: GET 핸들러 구현 + `latest run` SELECT + { runs: [] } on empty**

- [ ] **Step 3: 테스트 PASS**

- [ ] **Step 4: Commit**

---

### Task 13: GET/DELETE /api/projects/[id]/scoping/runs + /runs/[runId]

**Files:**
- Create: `src/pages/api/projects/[id]/scoping/runs/index.ts`
- Create: `src/pages/api/projects/[id]/scoping/runs/[runId].ts`
- Test: `tests/unit/api-scoping-runs.test.ts`

- [ ] **Step 1: 테스트 작성** (list 20건, specific run, soft-delete via UPDATE deleted_at)

- [ ] **Step 2: FAIL**

- [ ] **Step 3: 구현**

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

---

## Phase 5 — UI

### Task 14: Astro SSR 페이지 + AppLayout 통합

**Files:**
- Create: `src/pages/projects/[id]/scoping.astro`
- Modify: `src/pages/projects/[id].astro` (DisabledTab → 링크 교체)

- [ ] **Step 1: 테스트 작성** (CI smoke — page 응답 200, landmark 존재)

- [ ] **Step 2: FAIL**

- [ ] **Step 3: 페이지 작성**

`src/pages/projects/[id]/scoping.astro`:
- SSR props: project 로드 (`getProjectById`)
- 레이아웃: AppLayout (기존)
- 상단 네비 + 프로젝트 배지
- 좌 30% 입력 폼 (React island: ScopingForm)
- 우 70% 결과 영역 (React island: ScopingResults)
- 좌측 하단 run history (React island: RunHistoryList)

- [ ] **Step 4: DisabledTab 교체**

`src/pages/projects/[id].astro`:
```astro
- <DisabledTab label="스코핑" ... />
+ <a href={`/projects/${project.id}/scoping`} role="tab">스코핑</a>
```

- [ ] **Step 5: PASS**

- [ ] **Step 6: Commit**

---

### Task 15: ScopingForm React 컴포넌트 (입력 폼 + AreaInput)

**Files:**
- Create: `src/components/scoping/AreaInput.tsx`
- Create: `src/components/scoping/ScopingForm.tsx`
- Test: `tests/unit/components/ScopingForm.test.tsx`

- [ ] **Step 1: 테스트 작성** (site_area 숫자+㎡/ha selector, zone select, submit callback)

- [ ] **Step 2: FAIL**

- [ ] **Step 3: 구현**

`src/components/scoping/AreaInput.tsx`:
- props: { label, value, unit, onValueChange, onUnitChange }
- 내부: number input + `<select>` 단위 selector

`src/components/scoping/ScopingForm.tsx`:
- state: site_area, site_unit, zone, forest_area, forest_unit, capacity_override, notes
- submit: normalize (sqm) → POST /api/projects/[id]/scoping → onResults(data.results)

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

---

### Task 16: ScopingResults React 컴포넌트 (섹션 분리 + accordion)

**Files:**
- Create: `src/components/scoping/ScopingResults.tsx`
- Test: `tests/unit/components/ScopingResults.test.tsx`

- [ ] **Step 1: 테스트 작성**
  - 발동 섹션: triggered=true 카드만
  - skip 섹션: accordion 접힘 기본, 펼치면 triggered=false 리스트
  - skip_reason 텍스트 매핑 (input_undefined / zone_mismatch / condition_not_met)
  - rule_pack_version 텍스트 DOM 존재
  - 고정 배너 DOM 존재

- [ ] **Step 2: FAIL**

- [ ] **Step 3: 구현**

`<details>` + `<summary>` 기본 + ARIA 보강. badge 색은 Tailwind 토큰 (DESIGN.md 에서 정의).

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

---

### Task 17: DESIGN.md badge 색 토큰 추가

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1: DESIGN.md 갱신**

§N (기존 color token 섹션 아래) 에 5종 badge 토큰 정의. 접근성 대비 WCAG AA ≥ 4.5:1 확인.

- [ ] **Step 2: Commit**

---

### Task 18: RunHistoryList + 과거 run 로드

**Files:**
- Create: `src/components/scoping/RunHistoryList.tsx`
- Test: `tests/unit/components/RunHistoryList.test.tsx`

- [ ] **Step 1~5: 표준 TDD**

- [ ] **Step 6: Commit**

---

### Task 19: Export (CSV + Markdown) 클라이언트 유틸

**Files:**
- Create: `src/features/scoping/csv-export.ts`
- Create: `src/features/scoping/markdown-export.ts`
- Test: 각각 유닛

- [ ] **Step 1~5: 표준 TDD**

- [ ] **Step 6: Commit**

---

### Task 20: Claude 프롬프트 생성기 + 클립보드 복사

**Files:**
- Create: `src/features/scoping/prompt-generator.ts`
- Create: `prompts/scoping-manual.md` (템플릿)
- Test: `src/features/scoping/prompt-generator.test.ts`

- [ ] **Step 1: 템플릿 작성** (`prompts/scoping-manual.md` — spec M-B)

- [ ] **Step 2: 생성기 테스트 + 구현**

입력: ScopingInput + ScopingResult[]
출력: Claude 에게 붙일 markdown 블록 (입력 요약 + 발동 rule + skip rule + CLAUDE.md §2-2 준수 안내)

- [ ] **Step 3: Commit**

---

## Phase 6 — Cron / Guards / Build Verify

### Task 21: workers/cron-cleanup.ts scoping_runs 하드삭제 확장

**Files:**
- Modify: `workers/cron-cleanup.ts`
- Test: `tests/unit/cron-cleanup-scoping.test.ts`

- [ ] **Step 1: 테스트** (30+ 일 지난 soft-deleted scoping_runs → 삭제, 가드 CEILING 1000 확인)

- [ ] **Step 2: 구현** — 기존 uploads 삭제 쿼리 옆에 scoping_runs 쿼리 추가

- [ ] **Step 3: PASS**

- [ ] **Step 4: Commit**

---

### Task 22: lint-copy.ts YAML 단정어 grep 확장

**Files:**
- Modify: `scripts/lint-copy.ts`
- Test: `tests/unit/lint-copy-yaml.test.ts`

- [ ] **Step 1: 테스트** (yaml 내 "대상입니다", "승인", "통과" → exit 1)

- [ ] **Step 2: 구현 확장** (glob 에 `data/rules/**/*.yaml` 추가)

- [ ] **Step 3: PASS**

- [ ] **Step 4: Commit**

---

### Task 23: issue #13 증거 — scripts/verify-rule-pack-audit.ts

**Files:**
- Create: `scripts/verify-rule-pack-audit.ts`
- Modify: `.github/workflows/ci.yml` (verify step)

- [ ] **Step 1: 스크립트 작성**

`scripts/verify-rule-pack-audit.ts`:
- glob `data/rules/scoping/*.yaml`
- 각 파일의 `rule_pack_audit.audit_verdict === 'PASS'`, `findings_doc` 파일 존재, `source_pdfs` 파일 존재 verify
- FAIL 시 exit 1

- [ ] **Step 2: CI step 추가**

`.github/workflows/ci.yml`:
```yaml
- name: Verify rule pack audit
  run: npm run verify:rule-pack-audit
```

`package.json` scripts:
```json
"verify:rule-pack-audit": "tsx scripts/verify-rule-pack-audit.ts"
```

- [ ] **Step 3: 로컬 실행 → PASS**

Run: `npm run verify:rule-pack-audit`

- [ ] **Step 4: Commit**

---

## Phase 7 — E2E Tests

### Task 24: scoping-happy-v2 E2E

**Files:**
- Create: `tests/e2e/scoping-happy-v2.spec.ts`

- [ ] **Step 1: 테스트 작성**

시나리오:
- login → 프로젝트 생성 (onshore_wind) → /projects/[id]/scoping 이동
- 입력: site_area=8000㎡, land_use_zone='agricultural_forestry', forest_conversion=800㎡, capacity 없음
- "검토 실행" 클릭
- 발동 섹션: small_eia_other_zones + forest_conversion_review 2카드 확인
- skip 섹션 accordion 펼침 → eia_target_capacity (input_undefined) + small_eia_conservation (zone_mismatch) + small_eia_planning (zone_mismatch) 3개 확인
- 고정 배너 + `rule_pack_version` DOM 어서션

- [ ] **Step 2: 로컬 green 확인**

Run: `npm run test:e2e -- scoping-happy-v2`

- [ ] **Step 3: Commit**

---

### Task 25: scoping-unit-toggle-v2 E2E

- [ ] **Step 1~3: ㎡/ha toggle → 내부 ㎡ 정규화 어서션**

- [ ] **Step 4: Commit**

---

### Task 26: scoping-accordion-v2 E2E

- [ ] **Step 1~3: skip 섹션 펼침/접힘 state + skip_reason 텍스트 표시**

- [ ] **Step 4: Commit**

---

### Task 27: scoping-copy-prompt + scoping-history E2E

- [ ] **Step 1~3: 각각 작성**

- [ ] **Step 4: Commit**

---

### Task 28: axe-smoke 페이지 포함

**Files:**
- Modify: `tests/e2e/axe-smoke.spec.ts`

- [ ] **Step 1: `/projects/[id]/scoping` path 추가**

- [ ] **Step 2: 로컬 green 확인**

- [ ] **Step 3: Commit**

---

## Phase 8 — Domain Review / Final / Ship

### Task 29: /design-review (local dev server)

- [ ] **Step 1: `npm run dev` + `/design-review http://localhost:4321/projects/<test-id>/scoping`**

- [ ] **Step 2: 수정 한도 10건 이하 확인. 초과 시 수동 승인.**

- [ ] **Step 3: Commit** (디자인 fix 가 있으면)

---

### Task 30: `/autoplan` 3중 리뷰 (CEO / Design / Eng)

- [ ] **Step 1: `/autoplan` 실행**

- [ ] **Step 2: 결과 리뷰 노트를 `docs/reviews/feature-scoping-assistant-v2.md` 에 저장**

- [ ] **Step 3: Commit**

---

### Task 31: CLAUDE.md §9.3 도메인 리뷰 (6항목)

- [ ] **Step 1: 리뷰 프롬프트 수동 실행 (§9.3 문구 그대로)**

- [ ] **Step 2: 각 항목 Pass/Fail + 근거 표로 기록**

- [ ] **Step 3: FAIL 발견 시 plan 수정 diff 제시 → 재구현 루프**

- [ ] **Step 4: Commit** (리뷰 노트)

---

### Task 32: 최종 검증 + 리뷰 노트

- [ ] **Step 1: 전체 verify 체인**

Run:
- `npm run typecheck` → PASS
- `npm run lint` → PASS
- `npm test` → PASS (engine 25+ 케이스, 분기 커버리지 ≥95%)
- `npm run test:e2e` → PASS (5건 신규 + 기존 + axe-smoke)
- `npm run verify:rule-pack-audit` → PASS
- `npm run build` → PASS

- [ ] **Step 2: `docs/reviews/feature-scoping-assistant-v2.md` 작성**

- [ ] **Step 3: progress.md / session_log 갱신**

- [ ] **Step 4: Commit**

---

### Task 33: PR 생성 (superpowers:finishing-a-development-branch)

- [ ] **Step 1: 모든 테스트 green 재확인**

- [ ] **Step 2: 4-option prompt**:
  1. merge back to main locally
  2. push + PR
  3. keep as-is
  4. discard

**User 선택 대기. main push 는 USER 권한 (memory: feedback_push_authorization).**

---

## Self-Review Checklist

완료 후 본인 검토 항목:

- [ ] spec §1~§16 모든 섹션 별 태스크 매핑 확인
- [ ] 법령 숫자 (100 MW, 5000/7500/10000㎡, 660㎡) 가 engine 테스트에서 **정확히 threshold** 로 검증됨
- [ ] onUndefined: skip 시맨틱이 5 rules 모두에서 테스트됨
- [ ] gte_by_zone 이 rule 4 에서 zone별 3가지 임계값 모두 테스트됨
- [ ] rule_pack_audit 메타가 YAML 에 존재 + CI verify step 이 PASS verdict 검증
- [ ] UI 단정 표현 0건 (lint-copy.ts 확장)
- [ ] 결과 카드 `rule_pack_version` + `needsHumanReview` + 고정 배너 E2E 어서션
- [ ] PDF 3개 로컬 전용 확인 (.gitignore, 배포 번들 배제)
- [ ] 유료 LLM 키 참조 0건 (CI grep)

---

## Notes

- **T1 BLOCKING 해제 이유**: 2026-04-23 PDF 대조 PASS (findings §8). 이후 rule pack YAML 수정 PR 은 issue #13 에 따라 다시 BLOCKING (audit 증거 요구).
- **산지관리법 시행규칙 별표4 미확보 (spec §0 C1)**: 현 시점 rule 5 는 시행령 별표4 660㎡ 일반 기준. 시행규칙 수령 시 Task 8 (YAML) 업데이트 + findings 에 재감사 append.
- **push 는 USER**: 본 plan 은 commit 까지만 자율. push 및 main 머지는 사용자 승인.
