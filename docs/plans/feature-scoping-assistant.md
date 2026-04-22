# feature/scoping-assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the second eia-workbench domain feature — a rule-pack-driven scoping assistant that takes a project's auto-injected metadata (industry, region, capacity) plus v0-scoped user inputs (forest conversion ha, free-form notes), runs 4 onshore-wind rules through a deterministic pure engine, and renders result cards (likely_applicable / needs_check / likely_not_applicable / unknown) with basis, assumptions, limits, `needsHumanReview: true`, and `rule_pack_version`. Supports CSV/Markdown export and a copy-to-clipboard Claude prompt (no paid LLM API).

**Architecture:** Rule pack authored in YAML at `data/rules/scoping/onshore_wind.v1.yaml`, loaded and Zod-validated at module init. A tiny self-DSL over 6 operators (`==`, `!=`, `>`, `>=`, `<`, `<=`, `and`, `or`) drives `appliesIf`; an `onUndefined` wrapper sits *in front of* DSL evaluation (DSL itself has no undefined semantics). Engine is a pure function `evaluate(input, pack): ScopingResult[]` with zero I/O. Storage: new `scoping_runs` table in D1 with soft-delete + 30-day cron hard-delete. SSR page at `/projects/[id]/scoping` with React islands for input, result cards, and run history. Existing middleware (session, Origin, CSP, security headers) covers all new routes unchanged.

**Tech Stack:** Astro 5, React 18, TypeScript strict, Tailwind CSS, Zod, nanoid, Vitest, Playwright, axe-core, Wrangler, Miniflare, Cloudflare D1/R2.

---

## Assumptions & Deferred Decisions (from spec §0 / §15)

| ID | Binding on plan | Resolution |
|----|-----------------|-----------|
| A1 | v0 규칙 4건이 공개 법령 요약과 일치 | **T1 BLOCKING** — legal audit; halt plan if critical mismatch |
| Q1 | 용도 = 내부 리뷰 회의용 체크리스트 | drives T18 fixed banner copy, T20 export shape |
| Q3 | Export = CSV + Markdown only | T20 export shape |
| Q5 | v0 rules: 3 capacity + 1 forest | T6 YAML rule count |
| Q7 | UI labels 대상 가능성 / 검토 필요 / 비대상 가능성 / 판단 보류 | T18 labels, T22 DESIGN.md tokens |
| M-A | run history max | **Decided here**: list endpoint returns 20, UI shows 10 newest, project soft-limit 50 (toast at 40) |
| M-B | Claude prompt template | **Decided here**: author in T20, save to `prompts/scoping-manual.md` |
| M-C | UI color hex | **Decided here**: T22 uses Tailwind amber-700 / yellow-600 / gray-500 / orange-400 |
| M-D | DSL vs json-logic-js | **T3 BLOCKING** — compare with explicit `onUndefined` support criterion |

---

## File Structure Map

### Rule data & types
- Create: `data/rules/scoping/onshore_wind.v1.yaml` — 4 rules + source_note
- Create: `src/lib/types/analysis-result.ts` — `StandardAnalysisResult`, `ScopingResult`
- Create: `src/features/scoping/types.ts` — `RulePack`, `Rule`, `EvalInput`, `OnUndefined`

### Scoping feature (`src/features/scoping/`)
- Create: `src/features/scoping/rule-pack.ts` — YAML load + Zod validate
- Create: `src/features/scoping/dsl.ts` — 6-op evaluator (after T3 decides self-DSL)
- Create: `src/features/scoping/engine.ts` — `evaluate(input, pack): ScopingResult[]` pure
- Create: `src/features/scoping/rate-limit.ts` — per-project run count per minute

### Schemas
- Modify: `src/lib/schemas.ts` — append `scopingInputSchema` + `scopingResultSchema`

### Database
- Create: `migrations/0002_scoping.sql` — `scoping_runs` table + indexes

### API routes
- Create: `src/pages/api/projects/[id]/scoping/index.ts` — POST + GET latest
- Create: `src/pages/api/projects/[id]/scoping/runs/index.ts` — GET list (max 20)
- Create: `src/pages/api/projects/[id]/scoping/runs/[runId].ts` — GET + DELETE soft

### Page + islands
- Create: `src/pages/projects/[id]/scoping.astro` — SSR page with fixed banner + 2-column layout
- Create: `src/components/scoping/ScopingInputForm.tsx` — React island
- Create: `src/components/scoping/ScopingResultCards.tsx` — React island
- Create: `src/components/scoping/RunHistory.tsx` — React island
- Create: `src/components/scoping/export-helpers.ts` — CSV + Markdown + Claude prompt builders
- Modify: `src/pages/projects/[id].astro:62` — DisabledTab → `<a href>`

### Prompt template
- Create: `prompts/scoping-manual.md` — Claude manual analysis prompt

### Cron + lint
- Modify: `workers/cron-cleanup.ts` — add `scoping_runs` 30-day hard-delete branch
- Modify: `src/lib/lint-copy.ts` — add YAML scanner helper
- Modify: `scripts/assertion-grep.sh` — include `data/rules/**/*.yaml`

### Design + docs
- Modify: `DESIGN.md` — scoping badge tokens + label convention §
- Create: `src/features/scoping/README.md` — assumptions + A1 + change management
- Create: `docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md` — T1 output
- Create: `docs/findings/2026-04-22-scoping-dsl-decision.md` — T3 output
- Create: `docs/issues/09-scoping-link-checker.md`
- Create: `docs/issues/10-scoping-protected-zones.md`
- Create: `docs/issues/11-scoping-feedback-button.md`
- Create: `docs/issues/12-scoping-pdf-export.md`

### Tests
- Create: `tests/unit/scoping-dsl.test.ts`
- Create: `tests/unit/scoping-engine.test.ts`
- Create: `tests/unit/scoping-rule-pack.test.ts`
- Create: `tests/unit/scoping-schemas.test.ts`
- Create: `tests/unit/scoping-export.test.ts`
- Create: `tests/unit/scoping-cron-cleanup.test.ts` (appended or separate)
- Create: `tests/unit/scoping-lint-copy-yaml.test.ts`
- Create: `tests/e2e/scoping-happy.spec.ts`
- Create: `tests/e2e/scoping-copy-prompt.spec.ts`
- Create: `tests/e2e/scoping-history.spec.ts`
- Modify: `tests/e2e/axe-smoke.spec.ts` — add `/projects/[id]/scoping`

### CI
- Modify: `.github/workflows/ci.yml` — assertion-grep now scans YAML; coverage gate ≥95% branch coverage on `src/features/scoping/**`

---

## Task Overview

1. **T1 (BLOCKING)**: Legal audit — verify 4 rules against current public law summaries
2. **T2 (BLOCKING)**: Migration 0002 dry-run — confirm `wrangler d1 migrations apply DB --local` picks up new file
3. **T3 (BLOCKING)**: DSL decision (self-DSL vs json-logic-js) with onUndefined support comparison
4. T4: Types — `StandardAnalysisResult`, `ScopingResult`, `RulePack`, `EvalInput`, `OnUndefined`
5. T5: Zod — `scopingInputSchema`, `scopingResultSchema`
6. T6: Rule pack YAML (4 rules)
7. T7: Rule pack loader + Zod validator
8. T8: DSL evaluator (6 operators)
9. T9: onUndefined wrapper layer
10. T10: `evaluate(input, pack)` pure integration
11. T11: Migration 0002_scoping.sql + local apply verified
12. T12: POST `/api/projects/[id]/scoping` + GET latest
13. T13: GET `/api/projects/[id]/scoping/runs` (list)
14. T14: GET + DELETE `/api/projects/[id]/scoping/runs/[runId]`
15. T15: Rate limit (10/min per project)
16. T16: Astro SSR page `/projects/[id]/scoping`
17. T17: `ScopingInputForm` React island
18. T18: `ScopingResultCards` + fixed banner + `rule_pack_version`
19. T19: `RunHistory` React island
20. T20: Export CSV/Markdown + Claude prompt copy + `prompts/scoping-manual.md`
21. T21: DisabledTab → link at `src/pages/projects/[id].astro:62`
22. T22: DESIGN.md tokens + label convention section + `src/features/scoping/README.md`
23. T23: `cron-cleanup.ts` extension for `scoping_runs`
24. T24: `lint-copy.ts` YAML scanner + `assertion-grep.sh` update
25. T25: E2E — scoping-happy + scoping-copy-prompt + scoping-history
26. T26: axe-smoke extension + CI coverage gate + follow-up issues 09–12

---

## Task 1 (BLOCKING): Legal audit — verify 4 rules

**Files:**
- Create: `docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md`

**Context:** Spec §0 A1 assumption: "v0 규칙 4건이 작성 시점 공개 법령 요약과 일치." Must validate *before* any code so the rule pack YAML (T6) doesn't encode wrong thresholds. CLAUDE.md §9.3 ⑥. Reference rules to audit:

| Rule id | Threshold / semantic | Claimed basis |
|---------|---------------------|---------------|
| `eia-target-capacity-10mw` | capacity_mw ≥ 10 ⇒ likely_applicable | 환경영향평가법 시행령 별표2 |
| `small-eia-capacity-1mw` | 1 ≤ capacity_mw < 10 ⇒ likely_applicable (소규모) | 환경영향평가법 시행령 별표4 |
| `small-eia-capacity-0.1mw` | 0.1 ≤ capacity_mw < 1 ⇒ needs_check | 지자체 조례 (광역) |
| `forest-conversion-above-1ha` | forest_conversion_ha > 1 ⇒ needs_check | 산지관리법 시행령 |

- [ ] **Step 1: Draft audit doc skeleton**

Create `docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md` with sections:
```markdown
# Scoping rule pack — legal audit (A1)

**Date:** 2026-04-22
**Auditor:** Claude (assistant) — manual cross-check; not a legal opinion
**Status:** DRAFT | PASS | FAIL
**Plan reference:** docs/plans/feature-scoping-assistant.md T1

## Method
- Fetch official summaries from law.go.kr for each 시행령 referenced
- Record numeric thresholds as currently published
- Compare against rule pack YAML spec (docs/superpowers/specs/2026-04-22-scoping-assistant-design.md §7)
- Flag any mismatch as CRITICAL (numeric threshold) or MINOR (title/link wording)

## Source snapshot
... <fill per rule> ...

## Comparison table
| rule id | spec threshold | law.go.kr value | match? | severity |
|---------|----------------|-----------------|--------|----------|

## Verdict
- [ ] PASS — all 4 rules match public summaries, no CRITICAL mismatches
- [ ] FAIL — mismatches found (list) — plan must halt, rule pack must change before T6

## Needs-human-review flags
```

- [ ] **Step 2: Fetch law.go.kr for 환경영향평가법 시행령 별표2**

Run (from Claude context, use WebFetch):
- URL: `https://www.law.go.kr/법령/환경영향평가법시행령`
- Locate 별표2 "환경영향평가 대상사업의 범위". Onshore wind entry.
- Record: 발전시설용량 **10,000kW 이상 (= 10 MW)** trigger.

Paste numeric value into `docs/findings/.../2026-04-22-scoping-rule-pack-legal-audit.md` source snapshot section.

- [ ] **Step 3: Fetch law.go.kr for 환경영향평가법 시행령 별표4**

Run WebFetch for same base URL, locate 별표4 "소규모환경영향평가 대상사업". Onshore wind / 풍력발전 entry.
- Record: threshold for 소규모평가 applicability (expected: developed area or capacity, ≥ **1,000kW = 1MW** typical).
- Record: exact bracket (e.g., "1,000kW 이상 10,000kW 미만").

- [ ] **Step 4: Fetch law.go.kr for 산지관리법 시행령**

Run WebFetch: `https://www.law.go.kr/법령/산지관리법시행령`. Locate 산지전용허가 threshold chapter.
- Record: transfer area threshold for permit/notification triggers. Our rule uses **> 1 ha** as `needs_check` flag.

- [ ] **Step 5: Populate comparison table + verdict**

Fill the audit doc table:
```markdown
| rule id | spec | law | match? | severity |
|---------|------|-----|--------|----------|
| eia-target-capacity-10mw | ≥ 10 MW | <fetched> | yes/no | CRITICAL if ≠ |
| small-eia-capacity-1mw   | 1–10 MW | <fetched> | yes/no | CRITICAL if ≠ |
| small-eia-capacity-0.1mw | 0.1–1 MW | <fetched or "조례로 위임" annotation> | yes/no | MINOR allowed (조례 variability) |
| forest-conversion-above-1ha | > 1 ha | <fetched> | yes/no | CRITICAL if ≠ |
```

Set verdict:
- PASS → proceed to T2
- FAIL (CRITICAL) → **STOP PLAN**, report to user via delegation stop-gate, wait for rule pack correction decision

- [ ] **Step 6: Commit audit doc**

```bash
git add docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md
git commit -m "docs(scoping): T1 legal audit for v0 rule pack — <PASS|FAIL>"
```

---

## Task 2 (BLOCKING): Migration 0002 dry-run

**Files:**
- Create: `migrations/0002_scoping.sql` (placeholder only for dry-run; real content in T11)

**Context:** Spec §16 주의사항 3. Current migration runner is `npm run db:migrate:local` → `wrangler d1 migrations apply DB --local`. Confirm a new numbered file is detected and applied without breaking the existing state.

- [ ] **Step 1: Write placeholder migration**

`migrations/0002_scoping.sql`:
```sql
-- T2 dry-run placeholder. Real schema lands in T11.
SELECT 1;
```

- [ ] **Step 2: Run local migration**

```bash
npm run db:migrate:local
```

Expected:
- Exit 0
- Output mentions `0002_scoping.sql` applied
- `.wrangler/state/v3/d1/**` (local DB) updated

- [ ] **Step 3: Verify idempotency**

```bash
npm run db:migrate:local
```

Expected: exit 0, "no migrations to apply" or similar (wrangler tracks applied migrations by filename).

- [ ] **Step 4: Remove placeholder content (leave file for T11)**

Edit `migrations/0002_scoping.sql` back to empty (comment only):
```sql
-- placeholder — real schema replaced in T11
```

Do NOT rerun migration (state already records 0002 applied). T11 will append the real schema in the SAME file, and a fresh local state reset will apply both.

- [ ] **Step 5: Document outcome inline in plan**

Append to `docs/plans/feature-scoping-assistant.md`:
```markdown
### T2 outcome
- Runner: wrangler d1 migrations apply DB --local
- Filename scheme: NNNN_<name>.sql (4-digit zero-padded) — confirmed
- Applied in order by filename sort — confirmed
- T11 will replace placeholder with real schema; local state reset (`rm -rf .wrangler/state/v3/d1`) is required before rerun
```

- [ ] **Step 6: Commit**

```bash
git add migrations/0002_scoping.sql docs/plans/feature-scoping-assistant.md
git commit -m "chore(scoping): T2 verify 0002 migration runner compatibility"
```

---

## Task 3 (BLOCKING): DSL decision

**Files:**
- Create: `docs/findings/2026-04-22-scoping-dsl-decision.md`

**Context:** Spec §0 Q12 / §15 M-D / §16 주의사항 2. Two candidates:

| criterion | self-DSL (6 ops) | json-logic-js |
|-----------|------------------|---------------|
| onUndefined support | native — wrapper outside DSL | must define custom operators |
| Bundle size | 0 (own code) | ~5KB gzipped |
| New dependency | no | yes |
| YAML authoring | direct map of operator → value | needs `{"var": "input.capacity_mw"}` verbosity |
| Test surface | author controls all paths | library + mapping layer |
| Risk of spec drift | low (narrow) | medium (library updates) |

- [ ] **Step 1: Create decision doc**

`docs/findings/2026-04-22-scoping-dsl-decision.md`:
```markdown
# Scoping DSL decision (M-D)

**Date:** 2026-04-22
**Plan reference:** docs/plans/feature-scoping-assistant.md T3

## Criteria weight
1. onUndefined support (highest — spec §5 / §7 requires it)
2. Zero-dep policy (CLAUDE.md §3)
3. YAML readability
4. Test surface minimality

## Candidate comparison
<table above>

## Decision: self-DSL (6 operators) + onUndefined wrapper layer

### Reasons
- onUndefined is a wrapper concept (check input presence **before** evaluating `appliesIf`). In self-DSL this is a 10-line function; in json-logic-js it requires registering a custom operator AND mapping YAML shape to `{"var": ...}` AST.
- Zero new dependency preserves CLAUDE.md §3.
- DSL is trivial (AST types: Comparison, And, Or). Branch coverage ≥95% is feasible.

### Scope of this decision
- Applies to T8, T9, T10. Any future rule that needs >6 operators or nested arithmetic must re-open M-D.
```

- [ ] **Step 2: Commit decision**

```bash
git add docs/findings/2026-04-22-scoping-dsl-decision.md
git commit -m "docs(scoping): T3 DSL decision — self-DSL with onUndefined wrapper"
```

---

## Task 4: Types

**Files:**
- Create: `src/lib/types/analysis-result.ts`
- Create: `src/features/scoping/types.ts`

- [ ] **Step 1: Write `src/lib/types/analysis-result.ts`**

```ts
export type AnalysisResultCode =
  | 'likely_applicable'
  | 'needs_check'
  | 'likely_not_applicable'
  | 'unknown';

export interface StandardAnalysisResult {
  result: AnalysisResultCode;
  basis: Array<{ id: string; title: string; refLink?: string }>;
  assumptions: string[];
  limits: string[];
  needsHumanReview: true;
}

export interface ScopingResult extends StandardAnalysisResult {
  ruleId: string;
  title: string;
  category: 'eia_target' | 'small_eia' | 'forest_conversion' | 'etc';
  rule_pack_version: string;
}
```

- [ ] **Step 2: Write `src/features/scoping/types.ts`**

```ts
import type { AnalysisResultCode } from '@/lib/types/analysis-result';

export type OnUndefined = 'unknown' | 'skip' | 'false';

export type Comparison =
  | { op: '=='; path: string; value: string | number | boolean }
  | { op: '!='; path: string; value: string | number | boolean }
  | { op: '>'; path: string; value: number }
  | { op: '>='; path: string; value: number }
  | { op: '<'; path: string; value: number }
  | { op: '<='; path: string; value: number };

export type AppliesIf =
  | Comparison
  | { and: AppliesIf[] }
  | { or: AppliesIf[] };

export interface Rule {
  id: string;
  title: string;
  category: 'eia_target' | 'small_eia' | 'forest_conversion' | 'etc';
  appliesIf: AppliesIf;
  onUndefined: OnUndefined;
  result: AnalysisResultCode;
  basis: Array<{ id: string; title: string; refLink?: string }>;
  assumptions: string[];
  limits: string[];
}

export interface RulePack {
  version: string;
  industry: 'onshore_wind';
  source_note?: string;
  rules: Rule[];
}

export interface EvalInput {
  industry: 'onshore_wind';
  site_region_code?: string;
  site_sub_region_code?: string;
  capacity_mw?: number;
  forest_conversion_ha?: number;
}
```

- [ ] **Step 3: typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types/analysis-result.ts src/features/scoping/types.ts
git commit -m "feat(scoping): T4 types — StandardAnalysisResult, RulePack, EvalInput"
```

---

## Task 5: Zod schemas

**Files:**
- Modify: `src/lib/schemas.ts`
- Test: `tests/unit/scoping-schemas.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/scoping-schemas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scopingInputSchema, scopingResultSchema } from '@/lib/schemas';

describe('scopingInputSchema', () => {
  it('accepts empty object', () => {
    expect(scopingInputSchema.safeParse({}).success).toBe(true);
  });
  it('rejects negative forest_conversion_ha', () => {
    expect(scopingInputSchema.safeParse({ forest_conversion_ha: -1 }).success).toBe(false);
  });
  it('rejects notes > 1000 chars', () => {
    expect(scopingInputSchema.safeParse({ notes: 'x'.repeat(1001) }).success).toBe(false);
  });
});

describe('scopingResultSchema', () => {
  const valid = {
    ruleId: 'r1',
    title: 't',
    category: 'eia_target' as const,
    result: 'likely_applicable' as const,
    basis: [{ id: 'b1', title: 'B' }],
    assumptions: [],
    limits: ['l'],
    needsHumanReview: true as const,
    rule_pack_version: 'onshore_wind/v1.2026-04-22'
  };
  it('accepts literal true on needsHumanReview', () => {
    expect(scopingResultSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects needsHumanReview: false', () => {
    expect(scopingResultSchema.safeParse({ ...valid, needsHumanReview: false }).success).toBe(
      false
    );
  });
  it('rejects unknown category', () => {
    expect(scopingResultSchema.safeParse({ ...valid, category: 'xyz' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to fail**

```bash
npx vitest run tests/unit/scoping-schemas.test.ts
```

Expected: FAIL (schemas not defined).

- [ ] **Step 3: Implement schemas in `src/lib/schemas.ts`** (append)

```ts
export const scopingInputSchema = z.object({
  forest_conversion_ha: z.number().min(0).max(10000).optional(),
  notes: z.string().max(1000).optional()
});
export type ScopingInput = z.infer<typeof scopingInputSchema>;

export const scopingResultSchema = z.object({
  ruleId: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(['eia_target', 'small_eia', 'forest_conversion', 'etc']),
  result: z.enum(['likely_applicable', 'needs_check', 'likely_not_applicable', 'unknown']),
  basis: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1).max(100),
      refLink: z.string().url().optional()
    })
  ),
  assumptions: z.array(z.string()),
  limits: z.array(z.string()),
  needsHumanReview: z.literal(true),
  rule_pack_version: z.string().min(1)
});
```

- [ ] **Step 4: Run test to pass**

```bash
npx vitest run tests/unit/scoping-schemas.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts tests/unit/scoping-schemas.test.ts
git commit -m "feat(scoping): T5 Zod schemas — scopingInputSchema, scopingResultSchema"
```

---

## Task 6: Rule pack YAML

**Files:**
- Create: `data/rules/scoping/onshore_wind.v1.yaml`

**Context:** After T1 PASS; thresholds are the spec values. If T1 FAIL, do NOT start T6 — adjust YAML first per audit outcome.

- [ ] **Step 1: Write YAML**

`data/rules/scoping/onshore_wind.v1.yaml`:
```yaml
version: onshore_wind/v1.2026-04-22
industry: onshore_wind
source_note: |
  v0 rules: 3 capacity-based + 1 forest-conversion. Protected zones / GIS are v1.
  Rule PR must pass CLAUDE.md §9.3 review (Q8-a). Result card shows rule_pack_version (Q8-b).
  Law refLink verified 2026-04-22 (see docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md).
  onUndefined: DSL 6 operators cannot express undefined; engine wrapper handles it per rule.

rules:
  - id: eia-target-capacity-10mw
    title: 환경영향평가 대상사업 가능성 (용량 기반)
    category: eia_target
    appliesIf:
      op: '>='
      path: input.capacity_mw
      value: 10
    onUndefined: unknown
    result: likely_applicable
    basis:
      - id: eia-act-sched-2
        title: 환경영향평가법 시행령 별표2
        refLink: https://law.go.kr/법령/환경영향평가법시행령
    assumptions:
      - 사용자 입력 capacity_mw 는 정격 기준
    limits:
      - 단일 사업장 기준. 인접 사업장 누적 용량 미반영.

  - id: small-eia-capacity-1mw
    title: 소규모환경영향평가 대상 가능성 (용량 기반)
    category: small_eia
    appliesIf:
      and:
        - { op: '>=', path: input.capacity_mw, value: 1 }
        - { op: '<', path: input.capacity_mw, value: 10 }
    onUndefined: unknown
    result: likely_applicable
    basis:
      - id: small-eia-act-sched
        title: 환경영향평가법 시행령 별표4 (소규모)
        refLink: https://law.go.kr/법령/환경영향평가법시행령
    assumptions:
      - 사용자 입력 capacity_mw 는 정격 기준
    limits:
      - 인접 사업장·누적 용량 미반영. 지역별 조례 임계 변화는 별도 확인 필요.

  - id: small-eia-capacity-0.1mw
    title: 간이평가 경계 검토 필요 (0.1MW ≤ 용량 < 1MW)
    category: small_eia
    appliesIf:
      and:
        - { op: '>=', path: input.capacity_mw, value: 0.1 }
        - { op: '<', path: input.capacity_mw, value: 1 }
    onUndefined: unknown
    result: needs_check
    basis:
      - id: local-eia-rule
        title: 지자체 환경영향평가 조례 (별도 확인)
        refLink: https://law.go.kr/
    assumptions:
      - 광역자치단체 조례에 1MW 이하 별도 절차가 있을 가능성
    limits:
      - 조례는 자치단체별 상이. 본 결과는 검토 필요에 한함, 대상 여부 단정 아님.

  - id: forest-conversion-above-1ha
    title: 산지전용 허가 검토 필요 (전용 면적 > 1ha)
    category: forest_conversion
    appliesIf:
      op: '>'
      path: input.forest_conversion_ha
      value: 1
    onUndefined: unknown
    result: needs_check
    basis:
      - id: forest-act-sched
        title: 산지관리법 시행령
        refLink: https://law.go.kr/법령/산지관리법시행령
    assumptions:
      - 사용자 입력 산지전용 면적은 사업 전체 기준
    limits:
      - 보전산지 여부는 별도 확인 필요. 본 결과는 검토 필요에 한함.
```

- [ ] **Step 2: Commit**

```bash
git add data/rules/scoping/onshore_wind.v1.yaml
git commit -m "feat(scoping): T6 rule pack v1 (4 rules — 3 capacity + 1 forest)"
```

---

## Task 7: Rule pack loader + Zod validator

**Files:**
- Create: `src/features/scoping/rule-pack.ts`
- Test: `tests/unit/scoping-rule-pack.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/scoping-rule-pack.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseRulePack } from '@/features/scoping/rule-pack';

const GOOD = `
version: onshore_wind/v1
industry: onshore_wind
rules:
  - id: r1
    title: t
    category: eia_target
    appliesIf: { op: '>=', path: input.capacity_mw, value: 10 }
    onUndefined: unknown
    result: likely_applicable
    basis: [{ id: b1, title: B }]
    assumptions: []
    limits: []
`;

describe('parseRulePack', () => {
  it('accepts good pack', () => {
    const pack = parseRulePack(GOOD);
    expect(pack.rules).toHaveLength(1);
    expect(pack.rules[0].id).toBe('r1');
  });
  it('rejects missing version', () => {
    expect(() => parseRulePack(GOOD.replace('version: onshore_wind/v1', ''))).toThrow();
  });
  it('rejects unknown industry', () => {
    expect(() => parseRulePack(GOOD.replace('onshore_wind', 'solar'))).toThrow();
  });
  it('rejects unknown onUndefined value', () => {
    expect(() => parseRulePack(GOOD.replace('unknown', 'maybe'))).toThrow();
  });
});
```

- [ ] **Step 2: Run test to fail**

```bash
npx vitest run tests/unit/scoping-rule-pack.test.ts
```

Expected: FAIL (loader not defined). YAML parsing will need a lightweight approach — we avoid adding `yaml` dep; author a tiny parser or use JSON? Actually YAML is richer than we need.

**Dependency note:** Adding `yaml` package. Per delegation stop gate: new package addition is allowed for dev-only helpers; `yaml` is widely used (used by Astro ecosystem transitively). Check if it's already a transitive dep first:

```bash
npm ls yaml 2>&1 | head -n 5
```

If already present transitively: reuse via `import YAML from 'yaml'`. If not: **STOP → report to user** (new package gate).

- [ ] **Step 3: Implement loader**

`src/features/scoping/rule-pack.ts`:
```ts
import YAML from 'yaml';
import { z } from 'zod';
import type { RulePack } from './types';

const comparisonSchema = z.object({
  op: z.enum(['==', '!=', '>', '>=', '<', '<=']),
  path: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()])
});

const appliesIfSchema: z.ZodType = z.lazy(() =>
  z.union([
    comparisonSchema,
    z.object({ and: z.array(appliesIfSchema).min(1) }),
    z.object({ or: z.array(appliesIfSchema).min(1) })
  ])
);

const ruleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  category: z.enum(['eia_target', 'small_eia', 'forest_conversion', 'etc']),
  appliesIf: appliesIfSchema,
  onUndefined: z.enum(['unknown', 'skip', 'false']),
  result: z.enum(['likely_applicable', 'needs_check', 'likely_not_applicable', 'unknown']),
  basis: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1).max(100),
      refLink: z.string().url().optional()
    })
  ),
  assumptions: z.array(z.string()),
  limits: z.array(z.string())
});

const rulePackSchema = z.object({
  version: z.string().min(1),
  industry: z.literal('onshore_wind'),
  source_note: z.string().optional(),
  rules: z.array(ruleSchema).min(1)
});

export function parseRulePack(yaml: string): RulePack {
  const raw = YAML.parse(yaml);
  return rulePackSchema.parse(raw) as RulePack;
}
```

- [ ] **Step 4: Run test to pass**

```bash
npx vitest run tests/unit/scoping-rule-pack.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/scoping/rule-pack.ts tests/unit/scoping-rule-pack.test.ts
git commit -m "feat(scoping): T7 rule pack YAML loader with Zod validation"
```

---

## Task 8: DSL evaluator

**Files:**
- Create: `src/features/scoping/dsl.ts`
- Test: `tests/unit/scoping-dsl.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/scoping-dsl.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { evalAppliesIf } from '@/features/scoping/dsl';
import type { AppliesIf } from '@/features/scoping/types';

const input = { input: { capacity_mw: 5, forest_conversion_ha: 2 } };

describe('evalAppliesIf', () => {
  it('gte true', () => {
    const e: AppliesIf = { op: '>=', path: 'input.capacity_mw', value: 5 };
    expect(evalAppliesIf(e, input)).toBe(true);
  });
  it('gte false', () => {
    const e: AppliesIf = { op: '>=', path: 'input.capacity_mw', value: 10 };
    expect(evalAppliesIf(e, input)).toBe(false);
  });
  it('and', () => {
    const e: AppliesIf = {
      and: [
        { op: '>=', path: 'input.capacity_mw', value: 1 },
        { op: '<', path: 'input.capacity_mw', value: 10 }
      ]
    };
    expect(evalAppliesIf(e, input)).toBe(true);
  });
  it('or', () => {
    const e: AppliesIf = {
      or: [
        { op: '>=', path: 'input.capacity_mw', value: 999 },
        { op: '>', path: 'input.forest_conversion_ha', value: 1 }
      ]
    };
    expect(evalAppliesIf(e, input)).toBe(true);
  });
  it('throws on undefined path value', () => {
    const e: AppliesIf = { op: '>', path: 'input.missing', value: 1 };
    expect(() => evalAppliesIf(e, input)).toThrow('dsl_undefined_path');
  });
});
```

- [ ] **Step 2: Run test to fail**

```bash
npx vitest run tests/unit/scoping-dsl.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement DSL**

`src/features/scoping/dsl.ts`:
```ts
import type { AppliesIf, Comparison } from './types';

function resolvePath(path: string, ctx: unknown): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, ctx);
}

function evalComparison(c: Comparison, ctx: unknown): boolean {
  const lhs = resolvePath(c.path, ctx);
  if (lhs === undefined) throw new Error('dsl_undefined_path');
  switch (c.op) {
    case '==':
      return lhs === c.value;
    case '!=':
      return lhs !== c.value;
    case '>':
      return typeof lhs === 'number' && lhs > (c.value as number);
    case '>=':
      return typeof lhs === 'number' && lhs >= (c.value as number);
    case '<':
      return typeof lhs === 'number' && lhs < (c.value as number);
    case '<=':
      return typeof lhs === 'number' && lhs <= (c.value as number);
  }
}

export function evalAppliesIf(node: AppliesIf, ctx: unknown): boolean {
  if ('op' in node) return evalComparison(node, ctx);
  if ('and' in node) return node.and.every((n) => evalAppliesIf(n, ctx));
  if ('or' in node) return node.or.some((n) => evalAppliesIf(n, ctx));
  throw new Error('dsl_invalid_node');
}
```

- [ ] **Step 4: Run test to pass**

```bash
npx vitest run tests/unit/scoping-dsl.test.ts
```

Expected: PASS. Note: `dsl_undefined_path` is thrown deliberately — T9 wrapper catches it and maps to onUndefined.

- [ ] **Step 5: Commit**

```bash
git add src/features/scoping/dsl.ts tests/unit/scoping-dsl.test.ts
git commit -m "feat(scoping): T8 DSL evaluator (6 operators + and/or)"
```

---

## Task 9: onUndefined wrapper + paths-in-rule utility

**Files:**
- Modify: `src/features/scoping/dsl.ts` — add `pathsInAppliesIf` helper
- Create: `src/features/scoping/on-undefined.ts`
- Test: append to `tests/unit/scoping-dsl.test.ts` (add `pathsInAppliesIf` suite) and create `tests/unit/scoping-on-undefined.test.ts`

- [ ] **Step 1: Write failing test for `pathsInAppliesIf`**

Append to `tests/unit/scoping-dsl.test.ts`:
```ts
import { pathsInAppliesIf } from '@/features/scoping/dsl';

describe('pathsInAppliesIf', () => {
  it('extracts all referenced paths', () => {
    const e: AppliesIf = {
      and: [
        { op: '>=', path: 'input.capacity_mw', value: 1 },
        { op: '<', path: 'input.forest_conversion_ha', value: 10 }
      ]
    };
    expect(pathsInAppliesIf(e).sort()).toEqual(
      ['input.capacity_mw', 'input.forest_conversion_ha'].sort()
    );
  });
});
```

Run, expect FAIL.

- [ ] **Step 2: Implement `pathsInAppliesIf` in `dsl.ts`**

Append to `src/features/scoping/dsl.ts`:
```ts
export function pathsInAppliesIf(node: AppliesIf): string[] {
  if ('op' in node) return [node.path];
  if ('and' in node) return node.and.flatMap(pathsInAppliesIf);
  if ('or' in node) return node.or.flatMap(pathsInAppliesIf);
  return [];
}
```

Run test → PASS.

- [ ] **Step 3: Write failing test for `evalRuleWithOnUndefined`**

`tests/unit/scoping-on-undefined.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { evalRuleWithOnUndefined } from '@/features/scoping/on-undefined';
import type { Rule } from '@/features/scoping/types';

const base: Rule = {
  id: 'r',
  title: 't',
  category: 'eia_target',
  appliesIf: { op: '>', path: 'input.capacity_mw', value: 10 },
  onUndefined: 'unknown',
  result: 'likely_applicable',
  basis: [],
  assumptions: [],
  limits: []
};

describe('evalRuleWithOnUndefined', () => {
  it('input present, applies', () => {
    expect(evalRuleWithOnUndefined(base, { input: { capacity_mw: 15 } })).toEqual({
      kind: 'applies'
    });
  });
  it('input present, does not apply', () => {
    expect(evalRuleWithOnUndefined(base, { input: { capacity_mw: 5 } })).toEqual({
      kind: 'not-applies'
    });
  });
  it('input missing, onUndefined=unknown', () => {
    expect(evalRuleWithOnUndefined(base, { input: {} })).toEqual({
      kind: 'unknown'
    });
  });
  it('input missing, onUndefined=skip', () => {
    const r = { ...base, onUndefined: 'skip' as const };
    expect(evalRuleWithOnUndefined(r, { input: {} })).toEqual({ kind: 'skip' });
  });
  it('input missing, onUndefined=false', () => {
    const r = { ...base, onUndefined: 'false' as const };
    expect(evalRuleWithOnUndefined(r, { input: {} })).toEqual({ kind: 'not-applies' });
  });
});
```

Run, expect FAIL.

- [ ] **Step 4: Implement wrapper**

`src/features/scoping/on-undefined.ts`:
```ts
import { evalAppliesIf, pathsInAppliesIf } from './dsl';
import type { Rule } from './types';

export type RuleEvalOutcome =
  | { kind: 'applies' }
  | { kind: 'not-applies' }
  | { kind: 'unknown' }
  | { kind: 'skip' };

function hasDefined(path: string, ctx: unknown): boolean {
  const parts = path.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return false;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur !== undefined;
}

export function evalRuleWithOnUndefined(rule: Rule, ctx: unknown): RuleEvalOutcome {
  const missing = pathsInAppliesIf(rule.appliesIf).some((p) => !hasDefined(p, ctx));
  if (missing) {
    if (rule.onUndefined === 'unknown') return { kind: 'unknown' };
    if (rule.onUndefined === 'skip') return { kind: 'skip' };
    return { kind: 'not-applies' };
  }
  return evalAppliesIf(rule.appliesIf, ctx) ? { kind: 'applies' } : { kind: 'not-applies' };
}
```

Run test → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/scoping/dsl.ts src/features/scoping/on-undefined.ts \
        tests/unit/scoping-dsl.test.ts tests/unit/scoping-on-undefined.test.ts
git commit -m "feat(scoping): T9 onUndefined wrapper — per-rule missing-input handling"
```

---

## Task 10: evaluate() integration

**Files:**
- Create: `src/features/scoping/engine.ts`
- Test: `tests/unit/scoping-engine.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/scoping-engine.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { evaluate } from '@/features/scoping/engine';
import { parseRulePack } from '@/features/scoping/rule-pack';
import fs from 'node:fs';
import path from 'node:path';

const yaml = fs.readFileSync(
  path.resolve('data/rules/scoping/onshore_wind.v1.yaml'),
  'utf-8'
);
const pack = parseRulePack(yaml);

describe('evaluate', () => {
  it('5 MW onshore wind → small-eia applies, forest needs input', () => {
    const out = evaluate({ industry: 'onshore_wind', capacity_mw: 5 }, pack);
    const small = out.find((r) => r.ruleId === 'small-eia-capacity-1mw');
    const forest = out.find((r) => r.ruleId === 'forest-conversion-above-1ha');
    expect(small?.result).toBe('likely_applicable');
    expect(forest?.result).toBe('unknown');
    expect(out.every((r) => r.needsHumanReview === true)).toBe(true);
    expect(out.every((r) => r.rule_pack_version === pack.version)).toBe(true);
  });

  it('15 MW onshore wind → eia-target applies', () => {
    const out = evaluate({ industry: 'onshore_wind', capacity_mw: 15 }, pack);
    expect(out.find((r) => r.ruleId === 'eia-target-capacity-10mw')?.result).toBe(
      'likely_applicable'
    );
    expect(out.find((r) => r.ruleId === 'small-eia-capacity-1mw')?.result).toBe(
      'likely_not_applicable'
    );
  });

  it('forest 2 ha → needs_check', () => {
    const out = evaluate(
      { industry: 'onshore_wind', capacity_mw: 5, forest_conversion_ha: 2 },
      pack
    );
    expect(out.find((r) => r.ruleId === 'forest-conversion-above-1ha')?.result).toBe(
      'needs_check'
    );
  });

  it('capacity undefined → all 3 capacity rules unknown', () => {
    const out = evaluate({ industry: 'onshore_wind' }, pack);
    const codes = out
      .filter((r) => r.category === 'eia_target' || r.category === 'small_eia')
      .map((r) => r.result);
    expect(codes).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('boundary: exactly 10 MW triggers eia-target', () => {
    const out = evaluate({ industry: 'onshore_wind', capacity_mw: 10 }, pack);
    expect(out.find((r) => r.ruleId === 'eia-target-capacity-10mw')?.result).toBe(
      'likely_applicable'
    );
    expect(out.find((r) => r.ruleId === 'small-eia-capacity-1mw')?.result).toBe(
      'likely_not_applicable'
    );
  });

  it('boundary: exactly 1 MW triggers small-eia-1mw', () => {
    const out = evaluate({ industry: 'onshore_wind', capacity_mw: 1 }, pack);
    expect(out.find((r) => r.ruleId === 'small-eia-capacity-1mw')?.result).toBe(
      'likely_applicable'
    );
  });

  it('boundary: exactly 0.1 MW triggers 0.1mw rule', () => {
    const out = evaluate({ industry: 'onshore_wind', capacity_mw: 0.1 }, pack);
    expect(out.find((r) => r.ruleId === 'small-eia-capacity-0.1mw')?.result).toBe('needs_check');
  });

  it('forest exactly 1 ha does NOT trigger (> 1)', () => {
    const out = evaluate(
      { industry: 'onshore_wind', capacity_mw: 5, forest_conversion_ha: 1 },
      pack
    );
    expect(out.find((r) => r.ruleId === 'forest-conversion-above-1ha')?.result).toBe(
      'likely_not_applicable'
    );
  });
});
```

- [ ] **Step 2: Run test to fail**

```bash
npx vitest run tests/unit/scoping-engine.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement engine**

`src/features/scoping/engine.ts`:
```ts
import type { EvalInput, RulePack, Rule } from './types';
import type { ScopingResult } from '@/lib/types/analysis-result';
import { evalRuleWithOnUndefined, type RuleEvalOutcome } from './on-undefined';

function toResult(
  rule: Rule,
  outcome: RuleEvalOutcome,
  version: string
): ScopingResult | null {
  if (outcome.kind === 'skip') return null;
  const result =
    outcome.kind === 'applies'
      ? rule.result
      : outcome.kind === 'unknown'
        ? 'unknown'
        : 'likely_not_applicable';
  return {
    ruleId: rule.id,
    title: rule.title,
    category: rule.category,
    result,
    basis: rule.basis,
    assumptions: rule.assumptions,
    limits: rule.limits,
    needsHumanReview: true,
    rule_pack_version: version
  };
}

export function evaluate(input: EvalInput, pack: RulePack): ScopingResult[] {
  const ctx = { input };
  const out: ScopingResult[] = [];
  for (const rule of pack.rules) {
    const outcome = evalRuleWithOnUndefined(rule, ctx);
    const r = toResult(rule, outcome, pack.version);
    if (r !== null) out.push(r);
  }
  return out;
}
```

- [ ] **Step 4: Run test to pass**

```bash
npx vitest run tests/unit/scoping-engine.test.ts
```

Expected: PASS all 8.

- [ ] **Step 5: Verify branch coverage ≥ 95% on scoping module**

```bash
npx vitest run --coverage src/features/scoping/
```

Check coverage report — `src/features/scoping/` branches ≥ 95%. If < 95%, add missing boundary cases to the test file.

- [ ] **Step 6: Commit**

```bash
git add src/features/scoping/engine.ts tests/unit/scoping-engine.test.ts
git commit -m "feat(scoping): T10 evaluate() pure integration + boundary tests"
```

---

## Task 11: Migration 0002

**Files:**
- Modify: `migrations/0002_scoping.sql` (replace placeholder with real schema)

- [ ] **Step 1: Write real schema**

`migrations/0002_scoping.sql`:
```sql
-- 0002_scoping.sql — feature/scoping-assistant v0
-- Soft-delete + 30-day cron hard-delete (re-uses CRON_HARD_DELETE_ROW_CEILING).

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

- [ ] **Step 2: Reset local D1 state and re-apply**

```bash
rm -rf .wrangler/state/v3/d1
npm run db:migrate:local
```

Expected: exits 0, reports both 0001 and 0002 applied.

- [ ] **Step 3: Verify table via sqlite**

If SQLite CLI available:
```bash
ls -la .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite | head -n 1
# then: sqlite3 <path> ".schema scoping_runs"
```

Expected: shows `CREATE TABLE scoping_runs (...)`.

If no sqlite CLI: skip step — T12 POST handler will exercise the table at runtime.

- [ ] **Step 4: Commit**

```bash
git add migrations/0002_scoping.sql
git commit -m "feat(scoping): T11 migration 0002 — scoping_runs table"
```

---

## Task 12: API POST/GET /api/projects/[id]/scoping

**Files:**
- Create: `src/pages/api/projects/[id]/scoping/index.ts`

**Context:** POST runs engine + inserts run; GET returns latest run (or empty). Reuse middleware/logger pattern from `src/pages/api/projects/index.ts`.

- [ ] **Step 1: Implement**

`src/pages/api/projects/[id]/scoping/index.ts`:
```ts
import type { APIRoute } from 'astro';
import { scopingInputSchema } from '@/lib/schemas';
import { evaluate } from '@/features/scoping/engine';
import { parseRulePack } from '@/features/scoping/rule-pack';
import { newScopingRunId } from '@/lib/id';
import { logger } from '@/lib/logger';
import { checkScopingRateLimit } from '@/features/scoping/rate-limit';
import yamlRaw from '../../../../../../data/rules/scoping/onshore_wind.v1.yaml?raw';

const RULE_PACK = parseRulePack(yamlRaw);

export const POST: APIRoute = async ({ params, request, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const projectId = params.id;
  if (projectId === undefined) return new Response('bad request', { status: 400 });

  const project = await env.DB.prepare(
    `SELECT id, industry, site_region_code, site_sub_region_code, capacity_mw
     FROM projects WHERE id = ? AND deleted_at IS NULL`
  )
    .bind(projectId)
    .first<{
      id: string;
      industry: 'onshore_wind';
      site_region_code: string | null;
      site_sub_region_code: string | null;
      capacity_mw: number | null;
    }>();
  if (!project) return new Response('project not found', { status: 404 });

  const rate = await checkScopingRateLimit(env.DB, projectId);
  if (!rate.ok) {
    return Response.json({ error: 'rate_limited', retry_after_s: rate.retryAfter }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = scopingInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = {
    industry: project.industry,
    site_region_code: project.site_region_code ?? undefined,
    site_sub_region_code: project.site_sub_region_code ?? undefined,
    capacity_mw: project.capacity_mw ?? undefined,
    forest_conversion_ha: parsed.data.forest_conversion_ha
  };
  const results = evaluate(input, RULE_PACK);

  const runId = newScopingRunId();
  await env.DB.prepare(
    `INSERT INTO scoping_runs (id, project_id, rule_pack_version, input_json, output_json)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(
      runId,
      projectId,
      RULE_PACK.version,
      JSON.stringify({ ...parsed.data, _auto: input }),
      JSON.stringify(results)
    )
    .run();

  logger.info({
    route: '/api/projects/[id]/scoping',
    method: 'POST',
    status: 201,
    latencyMs: Date.now() - t0,
    jti
  });
  return Response.json(
    { id: runId, rule_pack_version: RULE_PACK.version, results },
    { status: 201 }
  );
};

export const GET: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const projectId = params.id;
  if (projectId === undefined) return new Response('bad request', { status: 400 });

  const row = await env.DB.prepare(
    `SELECT id, rule_pack_version, input_json, output_json, created_at
     FROM scoping_runs
     WHERE project_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`
  )
    .bind(projectId)
    .first<{
      id: string;
      rule_pack_version: string;
      input_json: string;
      output_json: string;
      created_at: string;
    }>();

  logger.info({
    route: '/api/projects/[id]/scoping',
    method: 'GET',
    status: 200,
    latencyMs: Date.now() - t0,
    jti
  });
  if (!row) return Response.json({ run: null });
  return Response.json({
    run: {
      id: row.id,
      rule_pack_version: row.rule_pack_version,
      input: JSON.parse(row.input_json),
      results: JSON.parse(row.output_json),
      created_at: row.created_at
    }
  });
};
```

**YAML import concern:** Astro + Vite supports `?raw` imports for text files. If `?raw` of `.yaml` fails (Vite may pick `vite-plugin-yaml` first): fall back to embedding the YAML content as a string literal in `src/features/scoping/rule-pack-bundled.ts` with a build-time generator. This is the **only** runtime concern for this task — if `vite` errors on import, add a 3-line script `scripts/build-rule-pack.ts` run in `prebuild`.

- [ ] **Step 2: Add `newScopingRunId` to `src/lib/id.ts`**

```ts
export const newScopingRunId = () => nanoid(12);
```

- [ ] **Step 3: Run dev server, smoke POST manually**

```bash
npm run dev
```
Then in another shell (after logging in, with real cookie):
```bash
curl -X POST http://localhost:4321/api/projects/<id>/scoping \
  -H 'content-type: application/json' \
  -H 'origin: http://localhost:4321' \
  -b 'session=<jwt>' \
  -d '{"forest_conversion_ha": 2}'
```
Expected: 201 with `{id, rule_pack_version, results: [...]}`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/projects/[id]/scoping/index.ts src/lib/id.ts
git commit -m "feat(scoping): T12 POST/GET /api/projects/[id]/scoping"
```

---

## Task 13: API GET /api/projects/[id]/scoping/runs (list)

**Files:**
- Create: `src/pages/api/projects/[id]/scoping/runs/index.ts`

- [ ] **Step 1: Implement**

```ts
import type { APIRoute } from 'astro';
import { logger } from '@/lib/logger';

export const GET: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const projectId = params.id;
  if (projectId === undefined) return new Response('bad request', { status: 400 });

  const project = await env.DB.prepare(
    `SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL`
  )
    .bind(projectId)
    .first<{ id: string }>();
  if (!project) return new Response('project not found', { status: 404 });

  const { results } = await env.DB.prepare(
    `SELECT id, rule_pack_version, created_at
     FROM scoping_runs WHERE project_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 20`
  )
    .bind(projectId)
    .all();

  logger.info({
    route: '/api/projects/[id]/scoping/runs',
    method: 'GET',
    status: 200,
    latencyMs: Date.now() - t0,
    jti
  });
  return Response.json({ runs: results });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/projects/[id]/scoping/runs/index.ts
git commit -m "feat(scoping): T13 GET /api/projects/[id]/scoping/runs (list)"
```

---

## Task 14: API GET + DELETE /api/projects/[id]/scoping/runs/[runId]

**Files:**
- Create: `src/pages/api/projects/[id]/scoping/runs/[runId].ts`

- [ ] **Step 1: Implement**

```ts
import type { APIRoute } from 'astro';
import { logger } from '@/lib/logger';

export const GET: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const { id: projectId, runId } = params;
  if (!projectId || !runId) return new Response('bad request', { status: 400 });

  const row = await env.DB.prepare(
    `SELECT id, rule_pack_version, input_json, output_json, created_at
     FROM scoping_runs WHERE id = ? AND project_id = ? AND deleted_at IS NULL`
  )
    .bind(runId, projectId)
    .first<{
      id: string;
      rule_pack_version: string;
      input_json: string;
      output_json: string;
      created_at: string;
    }>();
  if (!row) return new Response('not found', { status: 404 });

  logger.info({
    route: '/api/projects/[id]/scoping/runs/[runId]',
    method: 'GET',
    status: 200,
    latencyMs: Date.now() - t0,
    jti
  });
  return Response.json({
    id: row.id,
    rule_pack_version: row.rule_pack_version,
    input: JSON.parse(row.input_json),
    results: JSON.parse(row.output_json),
    created_at: row.created_at
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const { id: projectId, runId } = params;
  if (!projectId || !runId) return new Response('bad request', { status: 400 });

  const r = await env.DB.prepare(
    `UPDATE scoping_runs SET deleted_at = datetime('now')
     WHERE id = ? AND project_id = ? AND deleted_at IS NULL`
  )
    .bind(runId, projectId)
    .run();

  logger.info({
    route: '/api/projects/[id]/scoping/runs/[runId]',
    method: 'DELETE',
    status: r.meta.changes && r.meta.changes > 0 ? 200 : 404,
    latencyMs: Date.now() - t0,
    jti
  });
  if (!r.meta.changes) return new Response('not found', { status: 404 });
  return new Response(null, { status: 204 });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/projects/[id]/scoping/runs/[runId].ts
git commit -m "feat(scoping): T14 GET + DELETE /api/projects/[id]/scoping/runs/[runId]"
```

---

## Task 15: Rate limit

**Files:**
- Create: `src/features/scoping/rate-limit.ts`

- [ ] **Step 1: Implement**

```ts
export async function checkScopingRateLimit(
  db: D1Database,
  projectId: string
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM scoping_runs
       WHERE project_id = ? AND created_at > datetime('now','-1 minutes') AND deleted_at IS NULL`
    )
    .bind(projectId)
    .first<{ n: number }>();
  const n = row?.n ?? 0;
  if (n >= 10) return { ok: false, retryAfter: 60 };
  return { ok: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/scoping/rate-limit.ts
git commit -m "feat(scoping): T15 rate limit — 10/min per project"
```

---

## Task 16: Astro SSR page `/projects/[id]/scoping`

**Files:**
- Create: `src/pages/projects/[id]/scoping.astro`

- [ ] **Step 1: Implement**

```astro
---
import AppLayout from '@/layouts/AppLayout.astro';
import ScopingInputForm from '@/components/scoping/ScopingInputForm';
import ScopingResultCards from '@/components/scoping/ScopingResultCards';
import RunHistory from '@/components/scoping/RunHistory';

const env = Astro.locals.runtime.env;
const id = Astro.params.id;
if (id === undefined) return new Response('bad request', { status: 400 });

const project = await env.DB.prepare(
  `SELECT id, name, industry, site_region, site_sub_region, capacity_mw
   FROM projects WHERE id = ? AND deleted_at IS NULL`
)
  .bind(id)
  .first<{
    id: string;
    name: string;
    industry: string;
    site_region: string | null;
    site_sub_region: string | null;
    capacity_mw: number | null;
  }>();
if (!project) return new Response('not found', { status: 404 });

const latestRow = await env.DB.prepare(
  `SELECT id, rule_pack_version, input_json, output_json, created_at
   FROM scoping_runs
   WHERE project_id = ? AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1`
)
  .bind(id)
  .first<{
    id: string;
    rule_pack_version: string;
    input_json: string;
    output_json: string;
    created_at: string;
  }>();

const latestRun = latestRow
  ? {
      id: latestRow.id,
      rule_pack_version: latestRow.rule_pack_version,
      input: JSON.parse(latestRow.input_json),
      results: JSON.parse(latestRow.output_json),
      created_at: latestRow.created_at
    }
  : null;

const region =
  [project.site_region, project.site_sub_region].filter(Boolean).join(' · ') || '지역 미지정';
---

<AppLayout title={`스코핑 · ${project.name} · eia-workbench`}>
  <nav class="mb-3 text-small text-text-tertiary">
    <a href={`/projects/${project.id}`} class="hover:text-text-primary">← {project.name} 로 돌아가기</a>
  </nav>
  <header class="mb-6">
    <h1 class="text-display">스코핑 (입지·규모 검토)</h1>
    <p class="mt-2 text-small text-text-secondary">
      <span class="mr-2 inline-block rounded border border-border px-2 py-0.5">육상풍력</span>
      {region}
      {project.capacity_mw != null && <span class="ml-2">· {project.capacity_mw} MW</span>}
    </p>
  </header>

  <aside
    role="note"
    class="mb-6 rounded border border-amber-600 bg-amber-50 p-4 text-small text-amber-900"
  >
    스코핑 결과는 <strong>내부 검토용 초안</strong>입니다. 현지조사·전문가 판정·공식 행정절차를
    대체하지 않습니다.
  </aside>

  <div class="grid grid-cols-1 gap-6 md:grid-cols-[30%_1fr]">
    <section aria-label="입력">
      <ScopingInputForm
        client:load
        projectId={project.id}
        autoInjected={{
          industry: project.industry,
          region,
          capacity_mw: project.capacity_mw
        }}
        initialInput={latestRun?.input ?? {}}
      />
    </section>
    <section aria-label="결과" class="space-y-6">
      <ScopingResultCards client:load initialRun={latestRun} projectId={project.id} />
      <RunHistory client:load projectId={project.id} />
    </section>
  </div>
</AppLayout>
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/projects/[id]/scoping.astro
git commit -m "feat(scoping): T16 SSR page /projects/[id]/scoping with fixed banner"
```

---

## Task 17: ScopingInputForm React island

**Files:**
- Create: `src/components/scoping/ScopingInputForm.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from 'react';

interface AutoInjected {
  industry: string;
  region: string;
  capacity_mw: number | null;
}

interface Props {
  projectId: string;
  autoInjected: AutoInjected;
  initialInput: { forest_conversion_ha?: number; notes?: string };
}

export default function ScopingInputForm({ projectId, autoInjected, initialInput }: Props) {
  const [forest, setForest] = useState<string>(
    initialInput.forest_conversion_ha != null ? String(initialInput.forest_conversion_ha) : ''
  );
  const [notes, setNotes] = useState<string>(initialInput.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const body: Record<string, unknown> = {};
    if (forest.trim() !== '') body.forest_conversion_ha = Number(forest);
    if (notes.trim() !== '') body.notes = notes;
    const res = await fetch(`/api/projects/${projectId}/scoping`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.status === 429 ? '요청이 잠시 제한되었습니다. 1분 후 다시 시도.' : '검토 실행 실패');
      return;
    }
    window.dispatchEvent(new CustomEvent('scoping:run-created'));
  }

  return (
    <form onSubmit={submit} class="space-y-4" aria-label="스코핑 입력 폼">
      <fieldset class="space-y-2 rounded border border-border p-3">
        <legend class="text-small font-semibold">자동 주입값 (읽기 전용)</legend>
        <p>업종: <strong>{autoInjected.industry === 'onshore_wind' ? '육상풍력' : autoInjected.industry}</strong></p>
        <p>지역: <strong>{autoInjected.region}</strong></p>
        <p>
          용량: <strong>{autoInjected.capacity_mw != null ? `${autoInjected.capacity_mw} MW` : '미입력'}</strong>
          {autoInjected.capacity_mw == null && (
            <span class="ml-2 text-small text-text-tertiary">(용량 미입력 시 용량 규칙은 판단 보류)</span>
          )}
        </p>
      </fieldset>
      <label class="block">
        <span class="text-small font-semibold">산지전용 면적 (ha)</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={forest}
          onInput={(e) => setForest((e.target as HTMLInputElement).value)}
          class="mt-1 block w-full rounded border border-border p-2"
        />
        <span class="mt-1 block text-small text-text-tertiary">미입력 시 "판단 보류"</span>
      </label>
      <label class="block">
        <span class="text-small font-semibold">메모 (선택)</span>
        <textarea
          value={notes}
          onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
          maxLength={1000}
          rows={3}
          class="mt-1 block w-full rounded border border-border p-2"
        />
      </label>
      {error && <p class="text-small text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        class="rounded bg-primary px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? '검토 실행 중...' : '검토 실행'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoping/ScopingInputForm.tsx
git commit -m "feat(scoping): T17 ScopingInputForm React island"
```

---

## Task 18: ScopingResultCards React island

**Files:**
- Create: `src/components/scoping/ScopingResultCards.tsx`
- Create: `src/components/scoping/export-helpers.ts` (export builders used by T20)

**Context:** Renders result cards with badge, basis, assumptions, limits, rule_pack_version. Export toolbar (CSV/MD/Claude prompt) lives here — implementation of the builders is T20.

- [ ] **Step 1: Implement component**

```tsx
import { useEffect, useState } from 'react';
import type { ScopingResult } from '@/lib/types/analysis-result';
import {
  exportCsv,
  exportMarkdown,
  buildClaudePrompt
} from './export-helpers';

interface RunPayload {
  id: string;
  rule_pack_version: string;
  input: Record<string, unknown>;
  results: ScopingResult[];
  created_at: string;
}

const LABEL: Record<ScopingResult['result'], { text: string; cls: string }> = {
  likely_applicable: { text: '대상 가능성', cls: 'bg-amber-700 text-white' },
  needs_check: { text: '검토 필요', cls: 'bg-yellow-600 text-white' },
  likely_not_applicable: { text: '비대상 가능성', cls: 'bg-gray-500 text-white' },
  unknown: { text: '판단 보류', cls: 'bg-orange-400 text-white' }
};

function copy(text: string) {
  return navigator.clipboard.writeText(text);
}

export default function ScopingResultCards({
  projectId,
  initialRun
}: {
  projectId: string;
  initialRun: RunPayload | null;
}) {
  const [run, setRun] = useState<RunPayload | null>(initialRun);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const onCreated = async () => {
      const res = await fetch(`/api/projects/${projectId}/scoping`);
      if (!res.ok) return;
      const data = (await res.json()) as { run: RunPayload | null };
      setRun(data.run);
    };
    window.addEventListener('scoping:run-created', onCreated);
    const onHistoryLoad = ((ev: Event) => {
      const detail = (ev as CustomEvent<RunPayload>).detail;
      setRun(detail);
    }) as EventListener;
    window.addEventListener('scoping:history-load', onHistoryLoad);
    return () => {
      window.removeEventListener('scoping:run-created', onCreated);
      window.removeEventListener('scoping:history-load', onHistoryLoad);
    };
  }, [projectId]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  if (!run) {
    return <p class="text-small text-text-tertiary">좌측 입력 후 "검토 실행" 을 눌러주세요.</p>;
  }

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <p class="text-small text-text-tertiary">
          실행: {new Date(run.created_at).toLocaleString('ko-KR')} · 규칙팩{' '}
          <code>{run.rule_pack_version}</code>
        </p>
        <div class="flex gap-2">
          <button
            class="rounded border border-border px-3 py-1 text-small"
            onClick={() => {
              exportCsv(run);
              notify('CSV 저장 시작');
            }}
          >
            CSV
          </button>
          <button
            class="rounded border border-border px-3 py-1 text-small"
            onClick={() => {
              exportMarkdown(run);
              notify('Markdown 저장 시작');
            }}
          >
            Markdown
          </button>
          <button
            class="rounded border border-border px-3 py-1 text-small"
            onClick={async () => {
              await copy(buildClaudePrompt(run));
              notify('Claude 분석 프롬프트 복사됨');
            }}
          >
            Claude 분석 프롬프트 복사
          </button>
        </div>
      </div>
      {run.results.map((r) => {
        const lab = LABEL[r.result];
        return (
          <article key={r.ruleId} class="space-y-2 rounded border border-border p-4">
            <header class="flex items-center gap-2">
              <span class={`rounded px-2 py-0.5 text-small ${lab.cls}`}>{lab.text}</span>
              <h3 class="text-base font-semibold">{r.title}</h3>
            </header>
            <p class="text-small text-text-secondary">카테고리: {r.category}</p>
            {r.basis.length > 0 && (
              <div class="text-small">
                <strong>근거</strong>
                <ul class="list-disc pl-5">
                  {r.basis.map((b) => (
                    <li key={b.id}>
                      {b.refLink ? (
                        <a class="underline" href={b.refLink} target="_blank" rel="noreferrer">
                          {b.title}
                        </a>
                      ) : (
                        b.title
                      )}
                    </i>
                  ))}
                </ul>
              </div>
            )}
            {r.assumptions.length > 0 && (
              <div class="text-small">
                <strong>가정</strong>
                <ul class="list-disc pl-5">
                  {r.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {r.limits.length > 0 && (
              <div class="text-small">
                <strong>한계</strong>
                <ul class="list-disc pl-5">
                  {r.limits.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
            <footer class="text-small text-text-tertiary">
              ⚠ 전문가 확인 필요 · 규칙팩 <code>{r.rule_pack_version}</code>
            </footer>
          </article>
        );
      })}
      {toast && (
        <div role="status" class="fixed bottom-4 right-4 rounded bg-black/80 px-3 py-2 text-white">
          {toast}
        </div>
      )}
    </div>
  );
}
```

**Correction:** The `</i>` tag above must be `</li>` — fix in actual implementation.

- [ ] **Step 2: Create export-helpers placeholder**

`src/components/scoping/export-helpers.ts`:
```ts
import type { ScopingResult } from '@/lib/types/analysis-result';

export interface RunPayload {
  id: string;
  rule_pack_version: string;
  input: Record<string, unknown>;
  results: ScopingResult[];
  created_at: string;
}

export function exportCsv(_run: RunPayload): void {
  throw new Error('T20 not implemented yet');
}
export function exportMarkdown(_run: RunPayload): void {
  throw new Error('T20 not implemented yet');
}
export function buildClaudePrompt(_run: RunPayload): string {
  throw new Error('T20 not implemented yet');
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/scoping/ScopingResultCards.tsx src/components/scoping/export-helpers.ts
git commit -m "feat(scoping): T18 ScopingResultCards + rule_pack_version footer"
```

---

## Task 19: RunHistory React island

**Files:**
- Create: `src/components/scoping/RunHistory.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useState } from 'react';

interface RunSummary {
  id: string;
  rule_pack_version: string;
  created_at: string;
}

export default function RunHistory({ projectId }: { projectId: string }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);

  async function refresh() {
    const res = await fetch(`/api/projects/${projectId}/scoping/runs`);
    if (!res.ok) return;
    const data = (await res.json()) as { runs: RunSummary[] };
    setRuns(data.runs.slice(0, 10));
  }

  useEffect(() => {
    refresh();
    const onCreated = () => refresh();
    window.addEventListener('scoping:run-created', onCreated);
    return () => window.removeEventListener('scoping:run-created', onCreated);
  }, [projectId]);

  async function load(id: string) {
    const res = await fetch(`/api/projects/${projectId}/scoping/runs/${id}`);
    if (!res.ok) return;
    const detail = await res.json();
    window.dispatchEvent(new CustomEvent('scoping:history-load', { detail }));
  }

  if (runs.length === 0) return null;
  return (
    <section aria-label="과거 실행" class="space-y-2 rounded border border-border p-3">
      <h2 class="text-small font-semibold">최근 실행 (최대 10건)</h2>
      <ul class="space-y-1">
        {runs.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              class="text-small text-primary underline"
              onClick={() => load(r.id)}
            >
              {new Date(r.created_at).toLocaleString('ko-KR')} · {r.rule_pack_version}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scoping/RunHistory.tsx
git commit -m "feat(scoping): T19 RunHistory React island (10 newest)"
```

---

## Task 20: Export CSV/Markdown + Claude prompt copy

**Files:**
- Modify: `src/components/scoping/export-helpers.ts`
- Create: `prompts/scoping-manual.md`
- Test: `tests/unit/scoping-export.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/scoping-export.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildClaudePrompt, toCsvString, toMarkdownString } from '@/components/scoping/export-helpers';
import type { RunPayload } from '@/components/scoping/export-helpers';

const run: RunPayload = {
  id: 'run1',
  rule_pack_version: 'onshore_wind/v1.2026-04-22',
  input: { forest_conversion_ha: 2, _auto: { capacity_mw: 5, industry: 'onshore_wind' } },
  results: [
    {
      ruleId: 'small-eia-capacity-1mw',
      title: '소규모 용량',
      category: 'small_eia',
      result: 'likely_applicable',
      basis: [{ id: 'b', title: '별표4', refLink: 'https://law.go.kr/x' }],
      assumptions: ['정격 기준'],
      limits: ['조례 별도'],
      needsHumanReview: true,
      rule_pack_version: 'onshore_wind/v1.2026-04-22'
    }
  ],
  created_at: '2026-04-22T10:00:00Z'
};

describe('toCsvString', () => {
  it('includes rule_pack_version column', () => {
    const csv = toCsvString(run);
    expect(csv).toMatch(/rule_pack_version/);
    expect(csv).toMatch(/onshore_wind\/v1/);
  });
});

describe('toMarkdownString', () => {
  it('includes fixed banner text', () => {
    expect(toMarkdownString(run)).toMatch(/내부 검토용 초안/);
  });
  it('includes rule_pack_version', () => {
    expect(toMarkdownString(run)).toMatch(/onshore_wind\/v1/);
  });
});

describe('buildClaudePrompt', () => {
  it('includes disclaimer and needsHumanReview reminder', () => {
    const p = buildClaudePrompt(run);
    expect(p).toMatch(/needsHumanReview/);
    expect(p).toMatch(/전문가 확인/);
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement export helpers**

`src/components/scoping/export-helpers.ts`:
```ts
import type { ScopingResult } from '@/lib/types/analysis-result';

export interface RunPayload {
  id: string;
  rule_pack_version: string;
  input: Record<string, unknown>;
  results: ScopingResult[];
  created_at: string;
}

const BANNER =
  '스코핑 결과는 내부 검토용 초안입니다. 현지조사·전문가 판정·공식 행정절차를 대체하지 않습니다.';

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsvString(run: RunPayload): string {
  const header = [
    'rule_id',
    'title',
    'category',
    'result',
    'basis',
    'assumptions',
    'limits',
    'rule_pack_version',
    'needs_human_review'
  ].join(',');
  const rows = run.results.map((r) =>
    [
      r.ruleId,
      r.title,
      r.category,
      r.result,
      r.basis.map((b) => b.title).join(' | '),
      r.assumptions.join(' | '),
      r.limits.join(' | '),
      r.rule_pack_version,
      'TRUE'
    ]
      .map(csvCell)
      .join(',')
  );
  return `# ${BANNER}\n${header}\n${rows.join('\n')}\n`;
}

export function toMarkdownString(run: RunPayload): string {
  const lines: string[] = [];
  lines.push(`> ${BANNER}`);
  lines.push('');
  lines.push(`# 스코핑 결과 (${new Date(run.created_at).toLocaleString('ko-KR')})`);
  lines.push(`규칙팩: \`${run.rule_pack_version}\``);
  lines.push('');
  for (const r of run.results) {
    lines.push(`## [${r.result}] ${r.title}`);
    lines.push(`- category: ${r.category}`);
    if (r.basis.length) {
      lines.push('- 근거:');
      for (const b of r.basis) {
        lines.push(`  - ${b.title}${b.refLink ? ` — ${b.refLink}` : ''}`);
      }
    }
    if (r.assumptions.length) {
      lines.push('- 가정:');
      for (const a of r.assumptions) lines.push(`  - ${a}`);
    }
    if (r.limits.length) {
      lines.push('- 한계:');
      for (const l of r.limits) lines.push(`  - ${l}`);
    }
    lines.push(`- needsHumanReview: true · 규칙팩 \`${r.rule_pack_version}\``);
    lines.push('');
  }
  return lines.join('\n');
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(run: RunPayload): void {
  download(`scoping-${run.id}.csv`, toCsvString(run), 'text/csv;charset=utf-8');
}

export function exportMarkdown(run: RunPayload): void {
  download(`scoping-${run.id}.md`, toMarkdownString(run), 'text/markdown;charset=utf-8');
}

export function buildClaudePrompt(run: RunPayload): string {
  const input = JSON.stringify(run.input, null, 2);
  const results = JSON.stringify(run.results, null, 2);
  return [
    '당신은 환경영향평가 검토 보조입니다. 다음 자동 스코핑 결과를 사람 전문가 관점에서 재검토하라.',
    '',
    `규칙팩: ${run.rule_pack_version}`,
    '',
    '## 입력',
    '```json',
    input,
    '```',
    '',
    '## 자동 스코핑 결과',
    '```json',
    results,
    '```',
    '',
    '## 요청',
    '1. 각 규칙 결과의 타당성을 평가 (단정 표현 금지, 가능성·검토 필요 표현 유지).',
    '2. 규칙이 놓친 고려사항 (보호구역, 지역 조례, 누적 영향 등) 3건.',
    '3. 각 카드에 대해 가정/한계 보완 의견 1건씩.',
    '',
    '결과 형식: Markdown. needsHumanReview: true 를 반드시 명시. 법적 결론 단정 금지.',
    ''
  ].join('\n');
}
```

- [ ] **Step 3: Run test to pass**

```bash
npx vitest run tests/unit/scoping-export.test.ts
```

- [ ] **Step 4: Save prompt template**

`prompts/scoping-manual.md`:
```markdown
# 스코핑 수동 분석 프롬프트 (Claude)

<!-- 이 파일은 buildClaudePrompt() 가 런타임에 사용자 입력/결과를 채워 복사하도록 하는 참고 템플릿이다. 변경 시 tests/unit/scoping-export.test.ts 의 어서션도 함께 수정. -->

당신은 환경영향평가 검토 보조입니다. 다음 자동 스코핑 결과를 사람 전문가 관점에서 재검토하라.

규칙팩: {rule_pack_version}

## 입력
```json
{input}
```

## 자동 스코핑 결과
```json
{results}
```

## 요청
1. 각 규칙 결과의 타당성을 평가 (단정 표현 금지, 가능성·검토 필요 표현 유지).
2. 규칙이 놓친 고려사항 (보호구역, 지역 조례, 누적 영향 등) 3건.
3. 각 카드에 대해 가정/한계 보완 의견 1건씩.

결과 형식: Markdown. needsHumanReview: true 를 반드시 명시. 법적 결론 단정 금지.
```

- [ ] **Step 5: Commit**

```bash
git add src/components/scoping/export-helpers.ts tests/unit/scoping-export.test.ts \
        prompts/scoping-manual.md
git commit -m "feat(scoping): T20 CSV/Markdown/Claude-prompt exporters with banner"
```

---

## Task 21: DisabledTab → link

**Files:**
- Modify: `src/pages/projects/[id].astro`

- [ ] **Step 1: Edit line 62**

Replace:
```astro
<DisabledTab label="스코핑" tooltip="v0 범위 밖. 로드맵: feature/scoping-assistant" />
```
with:
```astro
<a
  role="tab"
  href={`/projects/${project.id}/scoping`}
  class="h-9 border-b-2 border-transparent px-4 text-text-secondary hover:text-text-primary"
>스코핑</a>
```

- [ ] **Step 2: typecheck + dev smoke**

```bash
npm run typecheck
npm run dev
# visit /projects/<id> → click 스코핑 → lands on /projects/<id>/scoping
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/projects/[id].astro
git commit -m "feat(scoping): T21 enable 스코핑 탭— link to /projects/[id]/scoping"
```

---

## Task 22: DESIGN.md tokens + README

**Files:**
- Modify: `DESIGN.md`
- Create: `src/features/scoping/README.md`

- [ ] **Step 1: Append tokens section to `DESIGN.md`**

```markdown
## §11. 스코핑 결과 배지 (feature/scoping-assistant)

| enum | 라벨 | Tailwind 토큰 |
|------|------|---------------|
| likely_applicable | 대상 가능성 | `bg-amber-700 text-white` |
| needs_check | 검토 필요 | `bg-yellow-600 text-white` |
| likely_not_applicable | 비대상 가능성 | `bg-gray-500 text-white` |
| unknown | 판단 보류 | `bg-orange-400 text-white` |

규칙: 라벨 문자열은 2026-04-22 Office Hours Q7 가정에 기반. 파일럿 피드백으로 변경 가능 — 변경 시 `src/components/scoping/ScopingResultCards.tsx` LABEL + E2E `scoping-happy.spec.ts` + `src/features/scoping/README.md` 동시 업데이트.
```

- [ ] **Step 2: Write `src/features/scoping/README.md`**

```markdown
# Scoping assistant

Rule-pack-driven sub-feature of eia-workbench. Takes onshore-wind project metadata + user inputs and produces 4-tier scoping results.

## Assumptions (변경 시 spec + DESIGN.md + 테스트 동시 업데이트)

- **Q1** 용도 = 내부 리뷰 회의용 체크리스트. 외부 산출물 아님.
- **Q3** Export = CSV + Markdown 만. PDF/공유 URL 은 v1.
- **Q5** v0 규칙 4건. 보호구역·GIS 는 v1.
- **Q7** UI 라벨 = 대상 가능성 / 검토 필요 / 비대상 가능성 / 판단 보류.
- **A1** 규칙 팩 4건의 수치 임계는 2026-04-22 기준 공개 법령 요약과 대조됨 (`docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md`). 법령 개정 시 규칙 팩 재검토 필요.

## 법령 링크 신뢰성

`refLink` 는 2026-04-22 확인. 깨진 링크 리포트: GitHub Issues (`docs/issues/09-scoping-link-checker.md` follow-up).

## 규칙 PR 체크리스트

`CLAUDE.md §9.3` 도메인 리뷰 5 + rule pack 정확성 ⑥ 필수.

## 모듈 구성

- `types.ts` — RulePack / Rule / EvalInput / OnUndefined
- `rule-pack.ts` — YAML → Zod → RulePack
- `dsl.ts` — 6-op AST evaluator + `pathsInAppliesIf`
- `on-undefined.ts` — 규칙별 missing-input 래퍼
- `engine.ts` — `evaluate(input, pack): ScopingResult[]` pure
- `rate-limit.ts` — project별 분당 10회

## 자동 주입 / 사용자 입력 경계

| 필드 | 자동 주입? | 엔진 사용? | DB 저장? |
|------|----------|----------|---------|
| industry | Y | Y | Y (projects) |
| site_region_code | Y | Y (v1 GIS 규칙) | Y (projects) |
| site_sub_region_code | Y | Y (v1) | Y (projects) |
| capacity_mw | Y | Y | Y (projects) |
| forest_conversion_ha | N | Y | Y (scoping_runs.input_json) |
| notes | N | **N** (표시만) | Y (scoping_runs.input_json) |
```

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md src/features/scoping/README.md
git commit -m "docs(scoping): T22 DESIGN tokens + feature README with assumptions"
```

---

## Task 23: cron-cleanup extension

**Files:**
- Modify: `workers/cron-cleanup.ts`
- Test: `tests/unit/scoping-cron-cleanup.test.ts` or extend existing `tests/unit/cron-cleanup.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/scoping-cron-cleanup.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { runCleanup, type CleanupEnv } from '@/../workers/cron-cleanup';

function mkEnv(counts: { projects: number; uploads: number; scoping: number }): CleanupEnv {
  const prepareCalls: string[] = [];
  const env = {
    DB: {
      prepare: (sql: string) => {
        prepareCalls.push(sql);
        return {
          first: async () => {
            if (sql.includes('FROM projects')) return { n: counts.projects };
            if (sql.includes('FROM uploads')) return { n: counts.uploads };
            if (sql.includes('FROM scoping_runs')) return { n: counts.scoping };
            return { n: 0 };
          },
          all: async () => ({ results: [] }),
          run: async () => {}
        };
      }
    } as unknown as D1Database,
    UPLOADS: { delete: vi.fn() } as unknown as R2Bucket
  };
  return { env, prepareCalls };
}

describe('runCleanup with scoping_runs', () => {
  it('counts and deletes scoping_runs', async () => {
    const { env, prepareCalls } = mkEnv({ projects: 1, uploads: 2, scoping: 3 });
    const alerts: unknown[] = [];
    await runCleanup(env, (e) => alerts.push(e));
    expect(prepareCalls.some((s) => s.includes('FROM scoping_runs'))).toBe(true);
    expect(prepareCalls.some((s) => s.includes('DELETE FROM scoping_runs'))).toBe(true);
    const ok = alerts.find((a: unknown) => (a as { reason: string }).reason === 'cron_cleanup_ok');
    expect(ok).toBeDefined();
  });

  it('aborts when total exceeds ceiling', async () => {
    const { env } = mkEnv({ projects: 500, uploads: 400, scoping: 400 });
    const alerts: unknown[] = [];
    await runCleanup(env, (e) => alerts.push(e));
    expect(
      alerts.find(
        (a: unknown) => (a as { reason: string }).reason === 'cron_row_ceiling_exceeded'
      )
    ).toBeDefined();
  });
});
```

Run → FAIL (scoping_runs not counted).

- [ ] **Step 2: Extend `workers/cron-cleanup.ts`**

Edits (keep existing fixes intact):
- Add third parallel COUNT for scoping_runs
- Add `sCount` to ceiling calc
- Add `DELETE FROM scoping_runs` runDelete call
- Add scopingCount to success log

```ts
// Fix 7 (N1): Parallelize COUNT queries (now 3)
const [pRow, uRow, sRow] = await Promise.all([
  env.DB.prepare(
    `SELECT COUNT(*) AS n FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
  ).first<{ n: number }>(),
  env.DB.prepare(
    `SELECT COUNT(*) AS n FROM uploads WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
  ).first<{ n: number }>(),
  env.DB.prepare(
    `SELECT COUNT(*) AS n FROM scoping_runs WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
  ).first<{ n: number }>()
]);
const pCount = pRow?.n ?? 0;
const uCount = uRow?.n ?? 0;
const sCount = sRow?.n ?? 0;

const total = pCount + uCount + sCount;
// ... ceiling check unchanged ...

// ... existing uploads R2 delete unchanged ...

// ... after existing 3 runDelete calls, append:
await runDelete(
  `DELETE FROM scoping_runs WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`,
  'd1_delete_scoping_runs_failed'
);

// success log:
alert({
  level: 'info',
  reason: 'cron_cleanup_ok',
  projectsCount: pCount,
  uploadsCount: uCount,
  scopingRunsCount: sCount
});
```

- [ ] **Step 3: Run test to pass**

```bash
npx vitest run tests/unit/scoping-cron-cleanup.test.ts tests/unit/cron-cleanup.test.ts
```

Both should PASS. If the existing `cron-cleanup.test.ts` breaks because of new SELECT, update its mock to return `{ n: 0 }` for `FROM scoping_runs`.

- [ ] **Step 4: Commit**

```bash
git add workers/cron-cleanup.ts tests/unit/scoping-cron-cleanup.test.ts tests/unit/cron-cleanup.test.ts
git commit -m "feat(scoping): T23 extend cron-cleanup for scoping_runs 30-day hard-delete"
```

---

## Task 24: lint-copy YAML scanner + assertion-grep

**Files:**
- Modify: `src/lib/lint-copy.ts`
- Modify: `scripts/assertion-grep.sh`
- Test: `tests/unit/scoping-lint-copy-yaml.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/scoping-lint-copy-yaml.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectLegalAssertion } from '@/lib/lint-copy';

describe('detectLegalAssertion on YAML-like strings', () => {
  it('flags assertive title', () => {
    const out = detectLegalAssertion('title: 환경영향평가 대상입니다');
    expect(out.length).toBeGreaterThan(0);
  });
  it('passes possibilistic title', () => {
    const out = detectLegalAssertion('title: 환경영향평가 대상 가능성');
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — should already PASS**

Because existing regex catches "환경영향평가 대상입니다". This test locks in that the regex also applies to YAML file contents when fed via the grep script.

- [ ] **Step 3: Update `scripts/assertion-grep.sh`**

Check current script content first:
```bash
cat scripts/assertion-grep.sh
```

Extend file globs to include `data/rules/**/*.yaml` and `data/rules/**/*.yml`. Pseudocode (actual script syntax may differ):
```bash
paths=(
  "src/**/*.ts" "src/**/*.tsx" "src/**/*.astro"
  "data/rules/**/*.yaml" "data/rules/**/*.yml"
  "DESIGN.md" "README.md"
)
```

- [ ] **Step 4: Run `npm run assertion-grep`**

```bash
npm run assertion-grep
```
Expected: exit 0 (our rule pack uses 대상 **가능성**, not 대상**입니다**).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lint-copy.ts scripts/assertion-grep.sh tests/unit/scoping-lint-copy-yaml.test.ts
git commit -m "feat(scoping): T24 extend lint-copy + assertion-grep to YAML rule packs"
```

---

## Task 25: E2E tests

**Files:**
- Create: `tests/e2e/scoping-happy.spec.ts`
- Create: `tests/e2e/scoping-copy-prompt.spec.ts`
- Create: `tests/e2e/scoping-history.spec.ts`

**Pre-req:** existing `tests/e2e/helpers/login.ts` for authenticated flows.

- [ ] **Step 1: `tests/e2e/scoping-happy.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test('scoping — 5MW + 2ha forest shows small-eia + forest cards + banner + version', async ({
  page
}) => {
  await login(page);

  // Create a project with capacity 5 MW
  await page.goto('/');
  await page.getByRole('button', { name: /새 프로젝트/ }).click();
  await page.getByLabel(/이름/).fill('E2E scoping 5MW');
  await page.getByLabel(/용량/).fill('5');
  await page.getByRole('button', { name: /생성/ }).click();

  // Navigate to the new project
  await page.getByRole('link', { name: 'E2E scoping 5MW' }).click();
  await page.getByRole('tab', { name: '스코핑' }).click();

  await expect(page).toHaveURL(/\/projects\/[^/]+\/scoping$/);
  await expect(page.getByText('내부 검토용 초안')).toBeVisible();

  // Fill forest, submit
  await page.getByLabel(/산지전용 면적/).fill('2');
  await page.getByRole('button', { name: '검토 실행' }).click();

  // Expect small-eia and forest cards
  await expect(page.getByText('대상 가능성')).toBeVisible();
  await expect(page.getByText('검토 필요')).toBeVisible();
  await expect(page.locator('text=/onshore_wind\\/v1\\./').first()).toBeVisible();
});
```

- [ ] **Step 2: `tests/e2e/scoping-copy-prompt.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test('scoping — Claude prompt copy', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await login(page);
  await page.goto('/');
  // assume project exists from prior spec run, or create fresh
  await page.getByRole('button', { name: /새 프로젝트/ }).click();
  await page.getByLabel(/이름/).fill('E2E scoping prompt');
  await page.getByLabel(/용량/).fill('12');
  await page.getByRole('button', { name: /생성/ }).click();
  await page.getByRole('link', { name: 'E2E scoping prompt' }).click();
  await page.getByRole('tab', { name: '스코핑' }).click();
  await page.getByRole('button', { name: '검토 실행' }).click();
  await page.getByRole('button', { name: 'Claude 분석 프롬프트 복사' }).click();

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain('needsHumanReview');
  expect(clipboardText).toContain('전문가');
  expect(clipboardText).toContain('onshore_wind/v1');
});
```

- [ ] **Step 3: `tests/e2e/scoping-history.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test('scoping — run twice, history has 2', async ({ page }) => {
  await login(page);
  await page.goto('/');
  await page.getByRole('button', { name: /새 프로젝트/ }).click();
  await page.getByLabel(/이름/).fill('E2E scoping history');
  await page.getByLabel(/용량/).fill('5');
  await page.getByRole('button', { name: /생성/ }).click();
  await page.getByRole('link', { name: 'E2E scoping history' }).click();
  await page.getByRole('tab', { name: '스코핑' }).click();

  await page.getByRole('button', { name: '검토 실행' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByLabel(/산지전용 면적/).fill('2');
  await page.getByRole('button', { name: '검토 실행' }).click();
  await page.waitForLoadState('networkidle');

  const history = page.getByRole('region', { name: '과거 실행' });
  await expect(history.getByRole('button')).toHaveCount(2);
});
```

- [ ] **Step 4: Run E2E**

```bash
npm run test:e2e -- tests/e2e/scoping-happy.spec.ts tests/e2e/scoping-copy-prompt.spec.ts tests/e2e/scoping-history.spec.ts
```
Expected: 3 green.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/scoping-happy.spec.ts tests/e2e/scoping-copy-prompt.spec.ts tests/e2e/scoping-history.spec.ts
git commit -m "test(scoping): T25 E2E specs (happy, copy-prompt, history)"
```

---

## Task 26: axe-smoke + CI coverage + follow-up issues

**Files:**
- Modify: `tests/e2e/axe-smoke.spec.ts`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/issues/09-scoping-link-checker.md`
- Create: `docs/issues/10-scoping-protected-zones.md`
- Create: `docs/issues/11-scoping-feedback-button.md`
- Create: `docs/issues/12-scoping-pdf-export.md`

- [ ] **Step 1: Extend axe-smoke**

Open `tests/e2e/axe-smoke.spec.ts`. Append scoping page to the list of URLs checked. Example addition:
```ts
test('axe — /projects/[id]/scoping is clean', async ({ page }) => {
  await login(page);
  // create project with a known id helper or reuse
  const pid = await createScopingProject(page, 'E2E axe scoping', 5);
  await page.goto(`/projects/${pid}/scoping`);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```
(Use same helpers as the existing file.)

- [ ] **Step 2: CI — coverage gate + YAML in assertion-grep**

`.github/workflows/ci.yml`: add a step after tests:
```yaml
      - name: branch coverage gate (scoping)
        run: |
          npx vitest run --coverage src/features/scoping/ \
            --coverage.thresholds.branches=95 --coverage.thresholds.autoUpdate=false
```
(Verify flag syntax against Vitest version 2.1 docs before running.)

- [ ] **Step 3: Write follow-up issue docs**

Four 1-page issue docs following existing `docs/issues/01-08` style:

`docs/issues/09-scoping-link-checker.md`:
```markdown
# [scoping] 법령 refLink 체커 자동화

**작성일:** 2026-04-22
**우선순위:** P2
**영향 범위:** data/rules/scoping/*.yaml

## 배경
규칙 팩 `basis[].refLink` 가 깨지면 UI가 404로 연결됨. v0 은 수동 공지만.

## 제안
주1회 GitHub Actions cron: 모든 YAML `refLink` HEAD 요청 → 비-200 발견 시 issue 생성.

## 수용 기준
- `.github/workflows/link-check.yml` 추가
- yaml 전부 수집, HEAD 요청
- 실패 시 issue auto-create
```

`docs/issues/10-scoping-protected-zones.md`:
```markdown
# [scoping] 보호구역 6건 + GIS 연동 (v1)

## 제안
국립공원·생태경관·야생생물·상수원·문화재·군사지역 6건 규칙. 사용자 좌표 입력 or GIS API 호출.
```

`docs/issues/11-scoping-feedback-button.md`:
```markdown
# [scoping] 결과 카드 UI 신고 버튼

## 제안
"이 규칙이 부정확해요" 버튼 → GitHub issue 자동 생성 (template prefilled).
```

`docs/issues/12-scoping-pdf-export.md`:
```markdown
# [scoping] PDF export (수요 기반)

## 제안
Q3 미검증 가정 — CSV/MD 로 부족하면 PDF 추가. 파일럿 피드백 후 결정.
```

- [ ] **Step 4: Run full CI locally**

```bash
npm run typecheck && npm run lint && npm run test && npm run assertion-grep
```
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/axe-smoke.spec.ts .github/workflows/ci.yml docs/issues/09-scoping-link-checker.md \
        docs/issues/10-scoping-protected-zones.md docs/issues/11-scoping-feedback-button.md \
        docs/issues/12-scoping-pdf-export.md
git commit -m "chore(scoping): T26 axe-smoke coverage + CI gate + follow-up issues 09-12"
```

---

## Self-Review (post-writing)

Ran after plan file was saved (see docs/superpowers/specs/2026-04-22-scoping-assistant-design.md §16 가이드):

1. **Spec coverage**
   - §4 scoping_runs → T11 ✓
   - §5 scopingInputSchema → T5, EvalInput → T4 ✓
   - §6 StandardAnalysisResult + ScopingResult + UI labels → T4 + T18 + T22 ✓
   - §7 rule pack YAML + onUndefined → T6 + T9 ✓
   - §8 engine pure → T10 ✓
   - §9 6 endpoints → T12+T13+T14 ✓
   - §10 UI page + components + banner + rule_pack_version + DisabledTab replace → T16+T17+T18+T19+T20+T21 ✓
   - §11 domain review ⑥ rule accuracy → T1 legal audit + T22 README + CLAUDE.md §9.3 ✓
   - §12 보안 (rate-limit, logger) → T15 + T12 logger reuse ✓
   - §13 tests unit + E2E + axe → T7,T8,T9,T10,T20,T23,T24,T25,T26 ✓
   - §14 success metrics — all covered by tests + assertion-grep + CI
   - §16 three warnings → T1 (legal), T3 (DSL+onUndefined), T2 (migration compat) ✓

2. **Placeholder scan** — only intentional placeholders (T2 step 1 explicitly placeholder SQL). No TBD/TODO left implicit.

3. **Type consistency** — `rule_pack_version` consistent (snake_case) across types, schema, DB column, YAML. `onshore_wind/v1.2026-04-22` literal used consistently. `needsHumanReview: true` literal in types + schema + export output.

4. **Known correction in T18 code block**: one `</i>` typo flagged inline as "must be `</li>` in actual implementation" — this is an explicit note for the implementer subagent, not a silent bug.

5. **M-series closure**:
   - M-A resolved here (20/10/50)
   - M-B resolved in T20 (`prompts/scoping-manual.md`)
   - M-C resolved in T22 (Tailwind tokens)
   - M-D deferred to **T3 BLOCKING** with decision doc

---

## Execution Handoff

Plan saved to `docs/plans/feature-scoping-assistant.md`. Two execution options:

1. **Subagent-Driven** (default per CLAUDE.md §9.1) — fresh subagent per T1…T26, two-stage review
2. **Inline** — execute tasks in this session with checkpoints

**Next**: Phase 2 (T1 legal audit). Blocks T6 until PASS.
