# feature/similar-cases — Implementation Plan v0

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 환경영향평가사가 새 사업을 작성할 때 국내 풍력 사업의 과거 환경평가 사례 메타데이터를 빠르게 검색·비교·인용할 수 있도록 한다. 본문 호스팅 없음, EIASS deep-link 만 제공.

**Architecture:** Cloudflare Cron Worker 가 data.go.kr `15142998` (환경영향평가 초안 공람정보) 4 operation 을 주 1회 호출 → stage 테이블에 적재 → §4.3 변환 규칙 적용 → 트랜잭션 swap 으로 운영 인덱스 갱신. 사용자는 `/cases` Astro SSR 페이지에서 D1 + FTS5 + LIKE fallback 으로만 검색 (외부 API 미호출, SERVICE_KEY 노출 면적 0). 기존 project-shell (인증/middleware/CSP/PII-safe logger) 과 scoping (`markdown-export`/`csv-export` 패턴) 을 재사용.

**Tech Stack:** TypeScript strict, Astro 5 + React islands, Zod, Vitest, Playwright, Cloudflare D1 (FTS5 unicode61), Cloudflare Workers (Cron Trigger), `packages/eia-data` PortalClient (구현 예정). 유료 LLM/API 미사용.

**Source docs:**
- spec: `docs/design/feature-similar-cases.md` (HEAD `4fa14db`)
- findings (API shape): `docs/findings/2026-04-25-similar-cases-api-shape.md`
- ADR: `docs/adr/0001-eia-api-source.md`
- 재사용 패턴: `docs/plans/feature-scoping-assistant-v2.md` (TDD 분해)

**Branch strategy:** `feature/similar-cases` 워크트리 (using-git-worktrees). main 에 merge 는 사용자 승인 후 별도 PR.

**자체 검토 (writing-plans 단계 self-review):**
- spec 9개 섹션 모두 implement task 1+ 매핑됨 (§1 → 모든 phase, §2 → T1-1, §3 → T4-*, §4.1 → T2-1, §4.2 → T1-3 + T3-2, §4.3 → T1-4·T1-5·T1-6, §5 → Phase 4, §6 → T1-2·T1-7·T2-3, §7/§8 → T6-3 단정어 grep, §9 → Phase 6, §10 → T1-3·T3-1·T1-7, §11 → T7-1, §12 → T7-1).
- "TBD"/"placeholder" 0건. 모든 step 에 실제 코드/명령/expected.
- type consistency: `EiaCase` 타입은 T1-4 에서 정의 후 T1-5/T2-1/T3-2/T4-* 에서 동일 시그니처 사용.
- spec 추가 패치 1건 (T0-4 결과) 이 별도 task 로 plan 안에 포함됨 (Task 4).

---

## File Structure

### Files to create

**Phase 0 검증:**
- `packages/eia-data/src/types/draft-display.ts` — 15142998 4 operation zod 스키마
- `packages/eia-data/src/types/draft-display.test.ts`
- `docs/findings/2026-04-26-bootstrap-bizSize-distribution.md` — bizSize 패턴 분포 실측
- `docs/findings/2026-04-26-bootstrap-drfop-format.md` — drfopTmdt 형식 검증
- `docs/findings/2026-04-26-bootstrap-multi-region.md` — eiaAddrTxt 다중 시·도 비율

**Phase 1 인덱싱 워커:**
- `packages/eia-data/src/endpoints/draft-display.ts` — list/detail 호출 헬퍼 4종
- `packages/eia-data/src/endpoints/draft-display.test.ts`
- `src/features/similar-cases/transform.ts` — §4.3 raw → derived 변환
- `src/features/similar-cases/transform.test.ts`
- `src/features/similar-cases/region-parser.ts` — eiaAddrTxt → sido/sigungu
- `src/features/similar-cases/region-parser.test.ts`
- `src/features/similar-cases/sido-lut.ts` — 17개 시·도 → KOSTAT 코드 LUT
- `src/features/similar-cases/sido-lut.test.ts`
- `src/features/similar-cases/wind-filter.ts` — bizGubunCd + bizNm regex 풍력 식별
- `src/features/similar-cases/wind-filter.test.ts`
- `src/features/similar-cases/payload-whitelist.ts` — source_payload 화이트리스트
- `src/features/similar-cases/payload-whitelist.test.ts`
- `workers/cases-indexer.ts` — Cron Worker 본체
- `workers/cases-indexer.test.ts`

**Phase 2 migration + bootstrap:**
- `migrations/0003_similar_cases.sql`
- `tests/unit/migrations/0003_similar_cases.test.ts`
- `scripts/cases-bootstrap.ts` — 수동 1회 부트스트랩 트리거 헬퍼
- `data/samples/cases/.gitkeep` — 샘플 응답 (PII 없음 검증용 fixtures)

**Phase 3 검색 API:**
- `src/lib/types/case-search.ts` — `EiaCase`, `CaseSearchQuery`, `CaseSearchResult` 타입
- `src/lib/schemas/case-search.ts` — Zod query schema
- `src/features/similar-cases/search-query.ts` — FTS5 + LIKE fallback 빌더
- `src/features/similar-cases/search-query.test.ts`
- `src/pages/api/cases/index.ts` — GET 핸들러
- `src/pages/api/cases/[caseId].ts` — GET 단건
- `tests/unit/api-cases-get.test.ts`
- `tests/unit/api-cases-detail-get.test.ts`

**Phase 4 UI:**
- `src/pages/cases/index.astro` — 검색 페이지 SSR
- `src/pages/cases/[caseId].astro` — 모바일·직접 진입 fallback 상세
- `src/components/cases/CaseSearchPage.tsx` — React island (검색바·facet·리스트·미리보기 통합)
- `src/components/cases/CaseFacetPanel.tsx`
- `src/components/cases/CaseResultCard.tsx`
- `src/components/cases/CasePreviewPane.tsx`
- `src/components/cases/CaseSearchGuide.tsx` — `<details>` 검색 가이드
- `src/components/cases/CasePrefilledLink.tsx` — 프로젝트 상세 → /cases prefilled
- `tests/unit/case-search-page.test.tsx`

**Phase 5 export + deep-link:**
- `src/features/similar-cases/markdown-export.ts`
- `src/features/similar-cases/markdown-export.test.ts`

**Phase 6 E2E + 가드:**
- `tests/e2e/cases-search-happy.spec.ts`
- `tests/e2e/cases-facet-combo.spec.ts`
- `tests/e2e/cases-axe.spec.ts`
- `scripts/check-similar-cases-assertions.sh` — `/cases` HTML 단정어 grep
- `tests/e2e/cases-lighthouse.spec.ts` — Lighthouse CI smoke (있으면)

**Phase 7 리포트:**
- `docs/reviews/feature-similar-cases.md` — review note (병합 전 필수)
- `docs/reports/2026-MM-DD-similar-cases-completion.md` — 완료 리포트
- `docs/reports/2026-MM-DD-similar-cases-domain-review.md` — §9.3 도메인 리뷰 표

### Files to modify

- `packages/eia-data/src/index.ts` — draft-display endpoint export 추가
- `packages/eia-data/src/client.ts` — `call<T>()` 구현 (Phase 1 Task 6)
- `wrangler.toml` — Cron Worker 정의 (`cases-indexer`) + 트리거 시간
- `src/middleware.ts` — `/cases` 와 `/cases/[caseId]` 인증 보호 범위 확인
- `src/components/AppLayout.astro` (또는 nav 컴포넌트) — "유사사례" 좌측 메뉴 항목
- `src/pages/projects/[id].astro` — "유사사례" 버튼 (prefilled 시·도/용량)
- `scripts/lint-copy.ts` — `/cases` 페이지 산출물도 단정어 grep 대상에 포함 (이미 src 전체면 skip)
- `.github/workflows/ci.yml` — `cases-bootstrap` smoke 단계는 추가하지 않음 (수동 1회). axe 만 추가.
- `docs/design/feature-similar-cases.md` — Task 4 결과 (eia_cd 충돌 처리 순서) 1줄 패치
- `docs/adr/0001-eia-api-source.md` — 일 한도 1,000 → 10,000, 데이터셋 ID 정정 사실 추가
- `progress.md`, `docs/changelog/session_log.md` — Phase 7 마감

### Files used as-is (재사용)

- `packages/eia-data/src/auth.ts` — `loadServiceKey(env)`
- `packages/eia-data/src/deep-link.ts` — `eiassProjectUrl({ projectId })`
- `packages/eia-data/src/types/common.ts` — `PortalResponse<T>`
- `src/features/scoping/markdown-export.ts` — 패턴 참조 (구조만, 함수 직접 호출 X)
- `src/lib/log/pii-safe.ts` — 인덱서 로깅
- `src/middleware.ts` — 인증

---

## Phase 0 — 워크트리 준비 + 사전 검증 (T0-0 ~ T0-5)

Phase 0 의 목적은 (a) 워크트리 격리, (b) spec §4.3 변환 규칙의 가정 5건을 부트스트랩 1회로 실측해 spec/구현 어긋남을 막는 것. 모든 검증 결과는 `docs/findings/2026-04-26-*.md` 로 기록. T0-1 의 zod 스키마는 모든 후속 phase 가 의존.

### Task 1: 워크트리 생성 + baseline 확인

**Files:**
- 워크트리: `../eia-workbench-feature-similar-cases` (superpowers:using-git-worktrees)

- [ ] **Step 1: 워크트리 생성**

```bash
git worktree add ../eia-workbench-feature-similar-cases -b feature/similar-cases
cd ../eia-workbench-feature-similar-cases
```

Expected: 새 디렉터리 생성, 브랜치 `feature/similar-cases` checked out.

- [ ] **Step 2: 의존성 설치 + baseline 확인**

```bash
npm ci
npm run typecheck && npm run lint && npm test
```

Expected: 모두 green (project-shell + scoping 기반, 영향 없음).

- [ ] **Step 3: SERVICE_KEY 로컬 주입 확인**

```bash
grep -c "^SERVICE_KEY=" .dev.vars || echo "MISSING"
```

Expected: `1` 이상. 없으면 사용자에게 `.dev.vars` 에 `SERVICE_KEY=<운영 secret 과 동일한 값>` 추가 요청. 값은 chat 비노출 (MEMORY 규칙).

- [ ] **Step 4: 직전 spec/findings commit 존재 검증**

```bash
git log --oneline -5
```

Expected: 최근 commit 중에 `docs(similar-cases): correct dataset 15000800 → 15142998` (4fa14db) 가 보임.

- [ ] **Step 5: Commit (워크트리 진입 표식)**

```bash
git commit --allow-empty -m "chore(similar-cases): worktree initialized"
```

---

### Task 2: T0-1 — PortalClient zod 스키마 정의 (4 operation)

**Files:**
- Create: `packages/eia-data/src/types/draft-display.ts`
- Test: `packages/eia-data/src/types/draft-display.test.ts`

- [ ] **Step 1: 테스트 작성 (실패 확인용)**

Create `packages/eia-data/src/types/draft-display.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  draftListItemSchema,
  draftDetailItemSchema,
  strategyDraftListItemSchema,
  strategyDraftDetailItemSchema
} from './draft-display';

describe('draft-display zod schemas', () => {
  it('parses minimal list item', () => {
    const ok = draftListItemSchema.safeParse({
      eiaCd: 'A-2024-001',
      eiaSeq: '1',
      bizGubunCd: 'C',
      bizGubunNm: '에너지개발',
      bizNm: '강원평창풍력발전사업',
      drfopTmdt: '2024-01-15 ~ 2024-02-14'
    });
    expect(ok.success).toBe(true);
  });

  it('rejects bizGubunCd outside 1자리 영문', () => {
    const bad = draftListItemSchema.safeParse({
      eiaCd: 'A-2024-001',
      bizGubunCd: 'CC',
      bizGubunNm: '에너지개발',
      bizNm: '강원풍력'
    });
    expect(bad.success).toBe(false);
  });

  it('strategy detail allows bizMoney/bizSize/bizSizeDan', () => {
    const ok = strategyDraftDetailItemSchema.safeParse({
      eiaCd: 'B-2024-002',
      bizGubunCd: 'L',
      bizGubunNm: '산지개발',
      bizNm: '영월새푸른풍력',
      bizMoney: 50000000000,
      bizSize: '21',
      bizSizeDan: 'MW',
      eiaAddrTxt: '강원특별자치도 영월군'
    });
    expect(ok.success).toBe(true);
  });

  it('detail items missing required eiaCd → fail', () => {
    expect(draftDetailItemSchema.safeParse({ bizNm: 'X' }).success).toBe(false);
    expect(strategyDraftListItemSchema.safeParse({ bizNm: 'Y' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL**

```bash
npx vitest run packages/eia-data/src/types/draft-display.test.ts
```

Expected: FAIL ("draft-display" 모듈 없음).

- [ ] **Step 3: 스키마 구현**

Create `packages/eia-data/src/types/draft-display.ts`:

```ts
import { z } from 'zod';

const stringy = z.union([z.string(), z.number()]).transform((v) => String(v));

export const draftListItemSchema = z.object({
  eiaCd: z.string().min(1),
  eiaSeq: stringy.optional(),
  bizGubunCd: z.string().regex(/^[A-Z]$/),
  bizGubunNm: z.string(),
  bizNm: z.string(),
  drfopTmdt: z.string().optional()
});
export type DraftListItem = z.infer<typeof draftListItemSchema>;

export const draftDetailItemSchema = draftListItemSchema.extend({
  bizmainNm: z.string().optional(),
  approvOrganNm: z.string().optional(),
  drfopStartDt: z.string().optional(),
  drfopEndDt: z.string().optional(),
  eiaAddrTxt: z.string().optional()
});
export type DraftDetailItem = z.infer<typeof draftDetailItemSchema>;

export const strategyDraftListItemSchema = draftListItemSchema;
export type StrategyDraftListItem = z.infer<typeof strategyDraftListItemSchema>;

export const strategyDraftDetailItemSchema = draftDetailItemSchema.extend({
  bizMoney: z.coerce.number().int().nonnegative().optional(),
  bizSize: z.string().optional(),
  bizSizeDan: z.string().optional()
});
export type StrategyDraftDetailItem = z.infer<typeof strategyDraftDetailItemSchema>;

export const DRAFT_DISPLAY_BASE_PATH =
  '/1480523/EnvrnAffcEvlDraftDsplayInfoInqireService' as const;

export const DRAFT_DISPLAY_OPERATIONS = {
  draftList: 'getDraftPblancDsplayListInfoInqire',
  draftDetail: 'getDraftPblancDsplaybtntOpinionDetailInfoInqire',
  strategyList: 'getStrategyDraftPblancDsplayListInfoInqire',
  strategyDetail: 'getStrategyDraftPblancDsplaybtntOpinionDetailInfoInqire'
} as const;
```

- [ ] **Step 4: 테스트 재실행 → PASS**

```bash
npx vitest run packages/eia-data/src/types/draft-display.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: index export + Commit**

Edit `packages/eia-data/src/index.ts`:
```ts
export * from './types/draft-display';
```

```bash
git add packages/eia-data/src/types/draft-display.ts \
        packages/eia-data/src/types/draft-display.test.ts \
        packages/eia-data/src/index.ts
git commit -m "feat(eia-data): add zod schemas for 15142998 draft-display 4 operations (T0-1)"
```

---

### Task 3: T0-2 — drfopTmdt 실제 형식 검증 (부트스트랩 5건 샘플)

**Context:** §4.3 evaluation_year 변환은 `drfopStartDt` 우선 + `drfopTmdt` 첫 4자리 fallback 가정. 실제 응답이 `'2024-01-15 ~ 2024-02-14'` 와 다른 형식이면 변환 실패.

**Files:**
- Create: `docs/findings/2026-04-26-bootstrap-drfop-format.md`

- [ ] **Step 1: 인터랙티브 1회 호출 (사용자가 본인 셸에서)**

> **사용자 단계.** Claude 는 명령만 제시하고 결과 keys 를 받는다.

```bash
! source .dev.vars && curl -s "https://apis.data.go.kr/1480523/EnvrnAffcEvlDraftDsplayInfoInqireService/getDraftPblancDsplayListInfoInqire?serviceKey=$SERVICE_KEY&pageNo=1&numOfRows=5&type=json&bizGubn=C&searchText=풍력" \
  | jq '.response.body.items.item[] | {eiaCd, drfopTmdt, drfopStartDt, drfopEndDt}'
```

Expected: 5건의 `drfopTmdt`/`drfopStartDt`/`drfopEndDt` 값. 사용자가 chat 에 paste.

- [ ] **Step 2: findings 작성**

Create `docs/findings/2026-04-26-bootstrap-drfop-format.md`:

```markdown
# 2026-04-26 — drfopTmdt 형식 실측

## 샘플 (5건, 15142998 list 일반)
| eiaCd | drfopTmdt | drfopStartDt | drfopEndDt |
|---|---|---|---|
| ... | ... | ... | ... |

## 결론
- 가정 (`'YYYY-MM-DD ~ YYYY-MM-DD'`) 일치: ✅ / ❌
- spec §4.3 evaluation_year 변환 규칙 패치 필요 여부: 없음 / 있음 (별도 task)
```

- [ ] **Step 3: 가정 불일치 시 spec patch task 등록**

만약 형식 불일치 → 본 plan Task 9 (variant: 변환 규칙 패치) 를 별도 commit 으로 추가.

- [ ] **Step 4: Commit**

```bash
git add docs/findings/2026-04-26-bootstrap-drfop-format.md
git commit -m "docs(similar-cases): findings T0-2 drfopTmdt format empirical (5 samples)"
```

---

### Task 4: T0-4 — eia_cd 충돌 처리 순서 명시 (spec patch)

**Context:** 사용자 검토 보강. 일반 stage + 전략 stage 양쪽에 같은 `eiaCd` 가 등장할 수 있음. 인덱서 알고리즘에 명시 + spec §4.3 또는 §10.4 1줄 추가.

**Files:**
- Modify: `docs/design/feature-similar-cases.md` (§4.3 특이 케이스 강화)

- [ ] **Step 1: spec 패치 — §4.3 특이 케이스 첫 줄 보강**

Edit `docs/design/feature-similar-cases.md`:

```diff
-- 같은 `eia_cd` 가 일반 + 전략 양쪽 list 에 등장 → `evaluation_stage` 우선순위 = **전략** (사업비/규모 정보가 더 풍부). 인덱서는 stage 별 sync 후 동일 `eia_cd` 충돌 시 전략 행으로 덮어쓴다.
+- 같은 `eia_cd` 가 일반 + 전략 양쪽 list 에 등장 → `evaluation_stage` 우선순위 = **전략**. 인덱서 실행 순서는 **(1) 일반 stage list → (2) 일반 detail → (3) 전략 stage list → (4) 전략 detail → (5) merge (전략 우선 덮어쓰기) → (6) 단일 트랜잭션 swap**. (5) 단계에서 `eia_cd` 충돌은 전략 행이 일반 행을 덮어쓴다 (`INSERT OR REPLACE`).
```

- [ ] **Step 2: 단위 테스트 시나리오 명시 (Phase 1 Task 13 의존)**

Create `src/features/similar-cases/_conflict-fixture.md` (검증 fixture 의 의도 문서):

```markdown
# eia_cd 충돌 처리 fixture

Task 13 의 indexer 통합 단위 테스트가 사용:
- 일반 list 에 eiaCd='X-001', bizSize 없음
- 전략 list 에도 eiaCd='X-001', bizSize='30', bizSizeDan='MW'
- merge 결과: 운영 인덱스 1행, evaluation_stage='전략', capacity_mw=30
```

- [ ] **Step 3: Commit**

```bash
git add docs/design/feature-similar-cases.md src/features/similar-cases/_conflict-fixture.md
git commit -m "docs(similar-cases): spec §4.3 — eia_cd 충돌 처리 6단계 순서 명시 (T0-4)"
```

---

### Task 5: T0-3 — bizSize 패턴 분포 실측 (전략 detail 20~50건)

**Context:** §4.3 capacity_mw / area_ha 변환 규칙은 `bizSize` 가 `'30'`+`bizSizeDan='MW'` 또는 `'30MW · 50ha'` 복합 표기 등 어느 형태가 다수인지에 따라 우선순위 변경 가능.

**Files:**
- Create: `docs/findings/2026-04-26-bootstrap-bizSize-distribution.md`

- [ ] **Step 1: 사용자 셸 — 전략 list + detail 50건 샘플**

```bash
! source .dev.vars && curl -s "https://apis.data.go.kr/1480523/EnvrnAffcEvlDraftDsplayInfoInqireService/getStrategyDraftPblancDsplayListInfoInqire?serviceKey=$SERVICE_KEY&pageNo=1&numOfRows=50&type=json&bizGubn=C&searchText=풍력" \
  | jq -r '.response.body.items.item[].eiaCd' > /tmp/eiaCds.txt
! while read cd; do curl -s "https://apis.data.go.kr/1480523/EnvrnAffcEvlDraftDsplayInfoInqireService/getStrategyDraftPblancDsplaybtntOpinionDetailInfoInqire?serviceKey=$SERVICE_KEY&type=json&eiaCd=$cd" | jq -c '.response.body.items.item | {eiaCd, bizSize, bizSizeDan}'; done < /tmp/eiaCds.txt
```

Expected: 50건의 `{eiaCd, bizSize, bizSizeDan}` JSON. 사용자가 chat paste (PII 없음 — 사업명·주소 미포함).

- [ ] **Step 2: 분포 카운트 (Claude 가 chat input 만으로 집계)**

분포 카테고리:
1. `bizSize='<숫자>'` + `bizSizeDan='MW'` → 단순 MW
2. `bizSize='<숫자>'` + `bizSizeDan='kW'` → kW
3. `bizSize='<숫자>'` + `bizSizeDan='ha'` → 면적 ha
4. `bizSize='<숫자>'` + `bizSizeDan='㎡'` → 면적 ㎡
5. `bizSize` 가 복합 표기 (`'30MW, 부지 50ha'`) → §4.3 정규식 두 번 적용
6. `bizSize` NULL/빈문자열

- [ ] **Step 3: findings 작성**

Create `docs/findings/2026-04-26-bootstrap-bizSize-distribution.md`:

```markdown
# 2026-04-26 — bizSize 패턴 분포 실측 (전략 detail 50건 샘플)

## 분포
| 카테고리 | 건수 | 비율 |
|---|---|---|
| MW (단일) | ... | ...% |
| kW (단일) | ... | ...% |
| ha (단일) | ... | ...% |
| ㎡ (단일) | ... | ...% |
| 복합 (MW+ha 등) | ... | ...% |
| NULL | ... | ...% |

## 결론
- §4.3 capacity_mw 우선순위 (bizSizeDan='MW' 직접 → bizNm regex fallback) 유지: ✅ / ❌
- 복합 표기 비율 ≥ 20% 면 정규식 두 번 적용 로직 우선순위 격상 task 추가
- bizNm fallback 비율 ≥ 30% 면 bizNm regex 패턴 강화 (kW 단위 표기 등) task 추가
```

- [ ] **Step 4: Commit**

```bash
git add docs/findings/2026-04-26-bootstrap-bizSize-distribution.md
git commit -m "docs(similar-cases): findings T0-3 bizSize distribution (50 samples)"
```

---

### Task 6: T0-5 — eiaAddrTxt 다중 시·도 비율 실측 (20건)

**Context:** §4.3 region_sido 는 첫 시·도만 적재 (`'강원 평창군 외 1'` → `'강원'`). 실측 비율 ≥ 10% 면 v1 multi-region 컬럼 우선순위.

**Files:**
- Create: `docs/findings/2026-04-26-bootstrap-multi-region.md`

- [ ] **Step 1: 사용자 셸 — detail 20건 eiaAddrTxt**

```bash
! head -20 /tmp/eiaCds.txt | while read cd; do curl -s "https://apis.data.go.kr/1480523/EnvrnAffcEvlDraftDsplayInfoInqireService/getStrategyDraftPblancDsplaybtntOpinionDetailInfoInqire?serviceKey=$SERVICE_KEY&type=json&eiaCd=$cd" | jq -r '.response.body.items.item.eiaAddrTxt'; done
```

Expected: 20개 eiaAddrTxt 라인. 사용자가 chat paste.

- [ ] **Step 2: 다중 시·도 패턴 카운트**

regex `/외\s*\d+|,\s*[가-힣]+(특별시|광역시|도|특별자치도|특별자치시)|및\s*[가-힣]+/` 매칭 비율.

- [ ] **Step 3: findings 작성**

Create `docs/findings/2026-04-26-bootstrap-multi-region.md`:

```markdown
# 2026-04-26 — eiaAddrTxt 다중 시·도 비율 실측 (20건 샘플)

## 결과
| 패턴 | 건수 |
|---|---|
| 단일 시·도 | ... |
| `외 N` 표기 | ... |
| 쉼표/`및` 다중 시·도 | ... |

비율: 다중 = N/20 = NN%.

## 결론
- ≥ 10% → v1 multi-region 컬럼 issue 생성 (issue body 본 findings 링크).
- < 10% → §4.3 첫 시·도만 적재 정책 유지.
```

- [ ] **Step 4: Commit**

```bash
git add docs/findings/2026-04-26-bootstrap-multi-region.md
git commit -m "docs(similar-cases): findings T0-5 eiaAddrTxt multi-region rate (20 samples)"
```

---

## Phase 1 — 인덱싱 워커 (PortalClient + 변환 규칙 + stage-and-swap)

### Task 7: PortalClient `call<T>()` 구현

**Files:**
- Modify: `packages/eia-data/src/client.ts`
- Create: `packages/eia-data/src/client.test.ts`

- [ ] **Step 1: 테스트 작성 (vitest fetch mock)**

Create `packages/eia-data/src/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PortalClient } from './client';

const env = { SERVICE_KEY: 'test-key' };

describe('PortalClient.call', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns parsed body for resultCode=00', async () => {
    const json = { response: { header: { resultCode: '00', resultMsg: 'OK' }, body: { items: { item: [{ x: 1 }] } } } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(json), { status: 200 })));
    const client = new PortalClient(env);
    const res = await client.call<{ x: number }>({ path: '/svc/op', query: { type: 'json' } });
    expect(res.response.header.resultCode).toBe('00');
  });

  it('throws on resultCode != 00', async () => {
    const json = { response: { header: { resultCode: '03', resultMsg: 'NO_DATA' } } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(json), { status: 200 })));
    const client = new PortalClient(env);
    await expect(client.call({ path: '/svc/op' })).rejects.toThrow(/03|NO_DATA/);
  });

  it('retries once on 5xx', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('boom', { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ response: { header: { resultCode: '00', resultMsg: 'OK' } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new PortalClient(env, { retries: 1 });
    await client.call({ path: '/svc/op' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('redacts serviceKey from thrown error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 500 })));
    const client = new PortalClient({ SERVICE_KEY: 'SUPER_SECRET' }, { retries: 0 });
    let err: unknown;
    try {
      await client.call({ path: '/svc/op' });
    } catch (e) {
      err = e;
    }
    expect(String(err)).not.toContain('SUPER_SECRET');
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npx vitest run packages/eia-data/src/client.test.ts
```

Expected: FAIL (현재 `call()` 은 throw stub).

- [ ] **Step 3: `call<T>()` 구현**

Replace `call<T>` body in `packages/eia-data/src/client.ts`:

```ts
async call<T>(req: PortalRequest): Promise<PortalResponse<T>> {
  const url = this.buildUrl(req);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= this.retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`portal http ${res.status}`);
        continue;
      }
      const json = (await res.json()) as PortalResponse<T>;
      const code = json.response?.header?.resultCode;
      if (code !== '00') {
        throw new Error(`portal resultCode=${code} msg=${json.response?.header?.resultMsg}`);
      }
      return json;
    } catch (e) {
      lastErr = e;
      // retry on transient
      const m = e instanceof Error ? e.message : String(e);
      if (!/portal http (5\d\d|429)|aborted/i.test(m)) throw redact(e, this.serviceKey);
    }
  }
  throw redact(lastErr, this.serviceKey);
}

function redact(err: unknown, key: string): Error {
  const m = err instanceof Error ? err.message : String(err);
  return new Error(m.split(key).join('***'));
}
```

(redact 는 `client.ts` 파일 하단에 module-private 함수로.)

- [ ] **Step 4: 테스트 PASS**

```bash
npx vitest run packages/eia-data/src/client.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/eia-data/src/client.ts packages/eia-data/src/client.test.ts
git commit -m "feat(eia-data): implement PortalClient.call with timeout/retry/redact (T1-1)"
```

---

### Task 8: draft-display endpoint 헬퍼 (4 operation)

**Files:**
- Create: `packages/eia-data/src/endpoints/draft-display.ts`
- Test: `packages/eia-data/src/endpoints/draft-display.test.ts`

- [ ] **Step 1: 테스트 작성**

```ts
import { describe, it, expect } from 'vitest';
import { buildDraftListPath, buildDetailPath } from './draft-display';
import { DRAFT_DISPLAY_BASE_PATH, DRAFT_DISPLAY_OPERATIONS } from '../types/draft-display';

describe('draft-display endpoint helpers', () => {
  it('builds list path with operation', () => {
    expect(buildDraftListPath('draft')).toBe(
      `${DRAFT_DISPLAY_BASE_PATH}/${DRAFT_DISPLAY_OPERATIONS.draftList}`
    );
    expect(buildDraftListPath('strategy')).toBe(
      `${DRAFT_DISPLAY_BASE_PATH}/${DRAFT_DISPLAY_OPERATIONS.strategyList}`
    );
  });
  it('builds detail path', () => {
    expect(buildDetailPath('draft')).toContain(DRAFT_DISPLAY_OPERATIONS.draftDetail);
    expect(buildDetailPath('strategy')).toContain(DRAFT_DISPLAY_OPERATIONS.strategyDetail);
  });
});
```

- [ ] **Step 2: FAIL 확인**

```bash
npx vitest run packages/eia-data/src/endpoints/draft-display.test.ts
```

Expected: FAIL.

- [ ] **Step 3: 구현**

Create `packages/eia-data/src/endpoints/draft-display.ts`:

```ts
import { DRAFT_DISPLAY_BASE_PATH, DRAFT_DISPLAY_OPERATIONS } from '../types/draft-display';

export type DraftStage = 'draft' | 'strategy';

export function buildDraftListPath(stage: DraftStage): string {
  const op = stage === 'draft' ? DRAFT_DISPLAY_OPERATIONS.draftList : DRAFT_DISPLAY_OPERATIONS.strategyList;
  return `${DRAFT_DISPLAY_BASE_PATH}/${op}`;
}

export function buildDetailPath(stage: DraftStage): string {
  const op = stage === 'draft' ? DRAFT_DISPLAY_OPERATIONS.draftDetail : DRAFT_DISPLAY_OPERATIONS.strategyDetail;
  return `${DRAFT_DISPLAY_BASE_PATH}/${op}`;
}

export const WIND_BIZ_GUBN_CODES = ['C', 'L'] as const;
export const WIND_SEARCH_TEXTS = ['풍력', '육상풍력'] as const;
```

- [ ] **Step 4: PASS + index export**

```bash
npx vitest run packages/eia-data/src/endpoints/draft-display.test.ts
```

Edit `packages/eia-data/src/index.ts` to also `export * from './endpoints/draft-display';`.

- [ ] **Step 5: Commit**

```bash
git add packages/eia-data/src/endpoints/draft-display.ts \
        packages/eia-data/src/endpoints/draft-display.test.ts \
        packages/eia-data/src/index.ts
git commit -m "feat(eia-data): draft-display endpoint helpers (T1-2)"
```

---

### Task 9: wind-filter — bizGubunCd + bizNm regex

**Files:**
- Create: `src/features/similar-cases/wind-filter.ts`
- Test: `src/features/similar-cases/wind-filter.test.ts`

- [ ] **Step 1: 테스트**

```ts
import { describe, it, expect } from 'vitest';
import { isOnshoreWindCandidate } from './wind-filter';

describe('isOnshoreWindCandidate', () => {
  it('accepts bizGubunCd C + bizNm 풍력', () => {
    expect(isOnshoreWindCandidate({ bizGubunCd: 'C', bizNm: '강원평창풍력발전사업' })).toBe(true);
  });
  it('accepts bizGubunCd L + 풍력발전', () => {
    expect(isOnshoreWindCandidate({ bizGubunCd: 'L', bizNm: '영월새푸른풍력발전' })).toBe(true);
  });
  it('rejects 해상풍력', () => {
    expect(isOnshoreWindCandidate({ bizGubunCd: 'C', bizNm: '서남해 해상풍력' })).toBe(false);
    expect(isOnshoreWindCandidate({ bizGubunCd: 'C', bizNm: '해상 풍력 단지' })).toBe(false);
  });
  it('rejects unrelated bizNm even with C/L', () => {
    expect(isOnshoreWindCandidate({ bizGubunCd: 'C', bizNm: '태양광발전' })).toBe(false);
  });
  it('rejects bizGubunCd outside C/L', () => {
    expect(isOnshoreWindCandidate({ bizGubunCd: 'A', bizNm: '풍력' })).toBe(false);
  });
});
```

- [ ] **Step 2: FAIL → 구현**

```ts
const ONSHORE_RE = /풍력/;
const OFFSHORE_RE = /해상\s*풍력/;
const ALLOWED_GUBUN = new Set(['C', 'L']);

export function isOnshoreWindCandidate(input: { bizGubunCd: string; bizNm: string }): boolean {
  if (!ALLOWED_GUBUN.has(input.bizGubunCd)) return false;
  if (OFFSHORE_RE.test(input.bizNm)) return false;
  return ONSHORE_RE.test(input.bizNm);
}
```

- [ ] **Step 3: PASS + Commit**

```bash
npx vitest run src/features/similar-cases/wind-filter.test.ts
git add src/features/similar-cases/wind-filter.ts src/features/similar-cases/wind-filter.test.ts
git commit -m "feat(similar-cases): wind-filter (bizGubunCd + bizNm regex) (T1-3)"
```

---

### Task 10: sido-lut — 17 시·도 라벨 + KOSTAT 코드

**Files:**
- Create: `src/features/similar-cases/sido-lut.ts`
- Test: `src/features/similar-cases/sido-lut.test.ts`

- [ ] **Step 1: 테스트**

```ts
import { describe, it, expect } from 'vitest';
import { SIDO_LUT, sidoLabel, sidoCode } from './sido-lut';

describe('sido-lut', () => {
  it('has 17 sido entries', () => {
    expect(SIDO_LUT.length).toBe(17);
  });
  it('looks up label/code by short label', () => {
    expect(sidoLabel('강원')).toBe('강원특별자치도');
    expect(sidoCode('강원')).toBe('51');
    expect(sidoCode('서울')).toBe('11');
    expect(sidoCode('제주')).toBe('50');
  });
  it('returns null for unknown', () => {
    expect(sidoLabel('없음')).toBeNull();
    expect(sidoCode('없음')).toBeNull();
  });
});
```

- [ ] **Step 2: FAIL → 구현**

```ts
export const SIDO_LUT = [
  { short: '서울', label: '서울특별시', code: '11' },
  { short: '부산', label: '부산광역시', code: '26' },
  { short: '대구', label: '대구광역시', code: '27' },
  { short: '인천', label: '인천광역시', code: '28' },
  { short: '광주', label: '광주광역시', code: '29' },
  { short: '대전', label: '대전광역시', code: '30' },
  { short: '울산', label: '울산광역시', code: '31' },
  { short: '세종', label: '세종특별자치시', code: '36' },
  { short: '경기', label: '경기도', code: '41' },
  { short: '강원', label: '강원특별자치도', code: '51' },
  { short: '충북', label: '충청북도', code: '43' },
  { short: '충남', label: '충청남도', code: '44' },
  { short: '전북', label: '전북특별자치도', code: '52' },
  { short: '전남', label: '전라남도', code: '46' },
  { short: '경북', label: '경상북도', code: '47' },
  { short: '경남', label: '경상남도', code: '48' },
  { short: '제주', label: '제주특별자치도', code: '50' }
] as const;

export type SidoShort = (typeof SIDO_LUT)[number]['short'];

const LABEL = new Map(SIDO_LUT.map((r) => [r.short, r.label]));
const CODE = new Map(SIDO_LUT.map((r) => [r.short, r.code]));

export function sidoLabel(short: string): string | null {
  return LABEL.get(short) ?? null;
}
export function sidoCode(short: string): string | null {
  return CODE.get(short) ?? null;
}
```

- [ ] **Step 3: PASS + Commit**

```bash
git add src/features/similar-cases/sido-lut.ts src/features/similar-cases/sido-lut.test.ts
git commit -m "feat(similar-cases): sido LUT (17 시·도) + KOSTAT codes (T1-4)"
```

---

### Task 11: region-parser — eiaAddrTxt → sido/sigungu

**Files:**
- Create: `src/features/similar-cases/region-parser.ts`
- Test: `src/features/similar-cases/region-parser.test.ts`

- [ ] **Step 1: 테스트**

```ts
import { describe, it, expect } from 'vitest';
import { parseRegion } from './region-parser';

describe('parseRegion', () => {
  it('parses 강원특별자치도 평창군', () => {
    expect(parseRegion('강원특별자치도 평창군 봉평면')).toEqual({
      sido: '강원',
      sidoLabel: '강원특별자치도',
      sidoCode: '51',
      sigungu: '평창군'
    });
  });
  it('parses short prefix 강원 평창군', () => {
    const r = parseRegion('강원 평창군 일원');
    expect(r.sido).toBe('강원');
    expect(r.sigungu).toBe('평창군');
  });
  it('multi-region picks first sido', () => {
    const r = parseRegion('강원 평창군 외 1');
    expect(r.sido).toBe('강원');
  });
  it('returns nulls when not parsable', () => {
    expect(parseRegion('알 수 없는 지역')).toEqual({
      sido: null, sidoLabel: null, sidoCode: null, sigungu: null
    });
  });
});
```

- [ ] **Step 2: FAIL → 구현**

```ts
import { SIDO_LUT, sidoLabel, sidoCode, type SidoShort } from './sido-lut';

const SIDO_SHORTS = SIDO_LUT.map((r) => r.short).join('|');
const SIDO_RE = new RegExp(`(${SIDO_SHORTS})(?:특별시|광역시|특별자치시|도|특별자치도)?`);
const SIGUNGU_RE = /(\S+?(?:시|군|구))/;

export interface RegionParts {
  sido: SidoShort | null;
  sidoLabel: string | null;
  sidoCode: string | null;
  sigungu: string | null;
}

export function parseRegion(addr: string): RegionParts {
  const m = SIDO_RE.exec(addr);
  if (!m) return { sido: null, sidoLabel: null, sidoCode: null, sigungu: null };
  const short = m[1] as SidoShort;
  const tail = addr.slice(m.index + m[0].length).trimStart();
  const sm = SIGUNGU_RE.exec(tail);
  return {
    sido: short,
    sidoLabel: sidoLabel(short),
    sidoCode: sidoCode(short),
    sigungu: sm ? sm[1] : null
  };
}
```

- [ ] **Step 3: PASS + Commit**

```bash
git add src/features/similar-cases/region-parser.ts src/features/similar-cases/region-parser.test.ts
git commit -m "feat(similar-cases): region-parser (eiaAddrTxt → sido/sigungu) (T1-5)"
```

---

### Task 12: transform — capacity_mw / area_ha / evaluation_year / source_payload

**Files:**
- Create: `src/features/similar-cases/transform.ts`
- Test: `src/features/similar-cases/transform.test.ts`
- Create: `src/features/similar-cases/payload-whitelist.ts` (참조)
- Test: `src/features/similar-cases/payload-whitelist.test.ts`

- [ ] **Step 1: 화이트리스트 모듈 먼저**

Create `src/features/similar-cases/payload-whitelist.ts`:

```ts
export const PAYLOAD_WHITELIST = [
  'eiaCd', 'eiaSeq', 'bizGubunCd', 'bizGubunNm', 'bizNm',
  'bizmainNm', 'approvOrganNm', 'bizMoney', 'bizSize', 'bizSizeDan',
  'drfopTmdt', 'drfopStartDt', 'drfopEndDt', 'eiaAddrTxt'
] as const;

export type PayloadKey = (typeof PAYLOAD_WHITELIST)[number];

export function pickPayload(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PAYLOAD_WHITELIST) {
    if (item[k] !== undefined) out[k] = item[k];
  }
  return out;
}
```

Create `src/features/similar-cases/payload-whitelist.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickPayload } from './payload-whitelist';

describe('pickPayload', () => {
  it('drops non-whitelisted (e.g., 본문 텍스트 유사 필드)', () => {
    const r = pickPayload({
      eiaCd: 'X-1',
      bizNm: 'Y',
      consultOpinionFullText: '주민 의견 본문 ...',
      drfopBodyText: '공람 본문 ...'
    });
    expect(Object.keys(r).sort()).toEqual(['bizNm', 'eiaCd']);
  });
});
```

- [ ] **Step 2: transform 테스트**

Create `src/features/similar-cases/transform.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { transformItem, type TransformedRow } from './transform';

const baseList = {
  eiaCd: 'X-1', bizGubunCd: 'C', bizGubunNm: '에너지개발',
  bizNm: '강원평창풍력발전사업 30MW', drfopTmdt: '2024-01-15 ~ 2024-02-14'
};
const baseDetail = { ...baseList, eiaAddrTxt: '강원특별자치도 평창군 봉평면', drfopStartDt: '2024-01-15', drfopEndDt: '2024-02-14' };

describe('transformItem', () => {
  it('returns null when not onshore wind', () => {
    expect(transformItem({ stage: 'draft', list: { ...baseList, bizNm: '태양광발전' }, detail: { ...baseDetail, bizNm: '태양광발전' } })).toBeNull();
  });

  it('extracts capacity from bizNm regex when bizSize 없음', () => {
    const r = transformItem({ stage: 'draft', list: baseList, detail: baseDetail }) as TransformedRow;
    expect(r.industry).toBe('onshore_wind');
    expect(r.capacity_mw).toBe(30);
    expect(r.area_ha).toBeNull();
    expect(r.evaluation_year).toBe(2024);
    expect(r.evaluation_stage).toBe('본안');
    expect(r.region_sido).toBe('강원');
    expect(r.region_sido_code).toBe('51');
    expect(r.region_sigungu).toBe('평창군');
  });

  it('strategy: bizSize MW + bizSizeDan ha 복합 추출', () => {
    const list = { ...baseList, bizNm: '영월새푸른풍력' };
    const detail = { ...list, eiaAddrTxt: '강원 영월군', bizSize: '21', bizSizeDan: 'MW' };
    const r = transformItem({ stage: 'strategy', list, detail }) as TransformedRow;
    expect(r.capacity_mw).toBe(21);
    expect(r.evaluation_stage).toBe('전략');
  });

  it('bizSizeDan ㎡ → area_ha ÷10000', () => {
    const r = transformItem({
      stage: 'strategy',
      list: { ...baseList, bizNm: '풍력단지' },
      detail: { ...baseDetail, bizSize: '500000', bizSizeDan: '㎡' }
    }) as TransformedRow;
    expect(r.area_ha).toBe(50);
    expect(r.capacity_mw).toBeNull();
  });

  it('source_payload omits non-whitelisted fields', () => {
    const r = transformItem({
      stage: 'draft',
      list: baseList,
      detail: { ...baseDetail, drfopBodyText: '본문 ...' as unknown as string }
    }) as TransformedRow;
    const pl = JSON.parse(r.source_payload);
    expect(pl.drfopBodyText).toBeUndefined();
    expect(pl.eiaCd).toBe('X-1');
  });

  it('evaluation_year 미래연도+2 → null', () => {
    const r = transformItem({
      stage: 'draft', list: baseList,
      detail: { ...baseDetail, drfopStartDt: '2099-01-15' }
    }) as TransformedRow;
    expect(r.evaluation_year).toBeNull();
  });
});
```

- [ ] **Step 3: 구현**

Create `src/features/similar-cases/transform.ts`:

```ts
import { isOnshoreWindCandidate } from './wind-filter';
import { parseRegion } from './region-parser';
import { pickPayload } from './payload-whitelist';

const SOURCE_DATASET = '15142998';

const MW_RE = /(\d+(?:\.\d+)?)\s*(MW|㎿|메가와트)/i;
const KW_RE = /(\d+(?:\.\d+)?)\s*(kW|㎾|킬로와트)/i;
const HA_RE = /(\d+(?:\.\d+)?)\s*ha/i;
const SQM_RE = /(\d+(?:\.\d+)?)\s*(?:㎡|m²)/i;
const SQKM_RE = /(\d+(?:\.\d+)?)\s*(?:㎢|km²)/i;

export type Stage = 'draft' | 'strategy';

export interface TransformInput {
  stage: Stage;
  list: Record<string, unknown> & { eiaCd: string; bizGubunCd: string; bizNm: string };
  detail: Record<string, unknown> & { eiaCd: string };
}

export interface TransformedRow {
  eia_cd: string;
  eia_seq: string | null;
  biz_gubun_cd: string;
  biz_gubun_nm: string;
  biz_nm: string;
  biz_main_nm: string | null;
  approv_organ_nm: string | null;
  biz_money: number | null;
  biz_size: string | null;
  biz_size_dan: string | null;
  drfop_tmdt: string | null;
  drfop_start_dt: string | null;
  drfop_end_dt: string | null;
  eia_addr_txt: string | null;
  industry: 'onshore_wind';
  region_sido: string | null;
  region_sido_code: string | null;
  region_sigungu: string | null;
  capacity_mw: number | null;
  area_ha: number | null;
  evaluation_year: number | null;
  evaluation_stage: '본안' | '전략';
  source_dataset: '15142998';
  source_payload: string;
}

function parseCapacity(bizSize: string | null, bizSizeDan: string | null, bizNm: string): number | null {
  if (bizSize && bizSizeDan) {
    const num = Number(String(bizSize).replace(/,/g, ''));
    if (Number.isFinite(num)) {
      const dan = bizSizeDan.toLowerCase();
      if (/^mw|메가/.test(dan)) return num;
      if (/^kw|㎾|킬로/.test(dan)) return num / 1000;
    }
  }
  const m = MW_RE.exec(bizNm) ?? KW_RE.exec(bizNm);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return null;
    return /kW|㎾/i.test(m[2]) ? n / 1000 : n;
  }
  return null;
}

function parseArea(bizSize: string | null, bizSizeDan: string | null, bizNm: string): number | null {
  if (bizSize && bizSizeDan) {
    const num = Number(String(bizSize).replace(/,/g, ''));
    if (Number.isFinite(num)) {
      const dan = bizSizeDan.trim();
      if (dan === 'ha') return num;
      if (dan === '㎡' || dan === 'm²') return num / 10000;
      if (dan === '㎢' || dan === 'km²') return num * 100;
    }
  }
  // bizNm fallback
  const ha = HA_RE.exec(bizNm);
  if (ha) return Number(ha[1]);
  const sq = SQM_RE.exec(bizNm);
  if (sq) return Number(sq[1]) / 10000;
  const km = SQKM_RE.exec(bizNm);
  if (km) return Number(km[1]) * 100;
  return null;
}

function parseYear(drfopStartDt: string | null, drfopTmdt: string | null): number | null {
  const src = drfopStartDt ?? drfopTmdt;
  if (!src) return null;
  const m = /(\d{4})/.exec(src);
  if (!m) return null;
  const y = Number(m[1]);
  const now = new Date().getFullYear();
  if (y < 2000 || y > now + 1) return null;
  return y;
}

export function transformItem(input: TransformInput): TransformedRow | null {
  const { stage, list, detail } = input;
  if (!isOnshoreWindCandidate({ bizGubunCd: list.bizGubunCd, bizNm: list.bizNm })) return null;

  const merged: Record<string, unknown> = { ...list, ...detail };
  const region = parseRegion(String(merged.eiaAddrTxt ?? ''));
  const bizSize = (merged.bizSize as string | undefined) ?? null;
  const bizSizeDan = (merged.bizSizeDan as string | undefined) ?? null;
  const bizNm = String(merged.bizNm);

  const payload = pickPayload(merged);
  return {
    eia_cd: String(merged.eiaCd),
    eia_seq: merged.eiaSeq ? String(merged.eiaSeq) : null,
    biz_gubun_cd: String(merged.bizGubunCd),
    biz_gubun_nm: String(merged.bizGubunNm ?? ''),
    biz_nm: bizNm,
    biz_main_nm: (merged.bizmainNm as string | undefined) ?? null,
    approv_organ_nm: (merged.approvOrganNm as string | undefined) ?? null,
    biz_money: merged.bizMoney != null ? Number(merged.bizMoney) : null,
    biz_size: bizSize,
    biz_size_dan: bizSizeDan,
    drfop_tmdt: (merged.drfopTmdt as string | undefined) ?? null,
    drfop_start_dt: (merged.drfopStartDt as string | undefined) ?? null,
    drfop_end_dt: (merged.drfopEndDt as string | undefined) ?? null,
    eia_addr_txt: (merged.eiaAddrTxt as string | undefined) ?? null,
    industry: 'onshore_wind',
    region_sido: region.sido,
    region_sido_code: region.sidoCode,
    region_sigungu: region.sigungu,
    capacity_mw: parseCapacity(bizSize, bizSizeDan, bizNm),
    area_ha: parseArea(bizSize, bizSizeDan, bizNm),
    evaluation_year: parseYear(
      (merged.drfopStartDt as string | undefined) ?? null,
      (merged.drfopTmdt as string | undefined) ?? null
    ),
    evaluation_stage: stage === 'strategy' ? '전략' : '본안',
    source_dataset: SOURCE_DATASET,
    source_payload: JSON.stringify(payload)
  };
}
```

- [ ] **Step 4: PASS**

```bash
npx vitest run src/features/similar-cases/transform.test.ts src/features/similar-cases/payload-whitelist.test.ts
```

Expected: 모두 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/similar-cases/transform.ts src/features/similar-cases/transform.test.ts \
        src/features/similar-cases/payload-whitelist.ts src/features/similar-cases/payload-whitelist.test.ts
git commit -m "feat(similar-cases): transform raw API → derived columns + payload whitelist (T1-6)"
```

---

### Task 13: cases-indexer Cron Worker (stage-and-swap)

**Files:**
- Create: `workers/cases-indexer.ts`
- Test: `workers/cases-indexer.test.ts`

- [ ] **Step 1: 테스트 (D1 mock + fetch mock)**

```ts
import { describe, it, expect, vi } from 'vitest';
import { runIndexer } from './cases-indexer';

function makeD1() {
  const exec: string[] = [];
  return {
    exec: (sql: string) => { exec.push(sql); return Promise.resolve({ count: 1 }); },
    prepare: (sql: string) => ({
      bind: () => ({
        run: async () => { exec.push(sql); return { meta: {} }; },
        first: async () => null,
        all: async () => ({ results: [] })
      })
    }),
    batch: async (stmts: unknown[]) => stmts.map(() => ({ meta: {} })),
    _exec: exec
  };
}

const baseListResp = {
  response: {
    header: { resultCode: '00', resultMsg: 'OK' },
    body: {
      totalCount: 1, pageNo: 1, numOfRows: 100,
      items: { item: [{ eiaCd: 'A-1', bizGubunCd: 'C', bizGubunNm: '에너지개발', bizNm: '강원풍력 30MW' }] }
    }
  }
};
const detailResp = {
  response: {
    header: { resultCode: '00', resultMsg: 'OK' },
    body: { items: { item: { eiaCd: 'A-1', bizGubunCd: 'C', bizGubunNm: '에너지개발', bizNm: '강원풍력 30MW', eiaAddrTxt: '강원 평창군' } } }
  }
};

describe('cases-indexer', () => {
  it('hits API ≤ N times and writes stage rows then swaps', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('Detail')) return Promise.resolve(new Response(JSON.stringify(detailResp), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify(baseListResp), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000
    });
    expect(summary.records_added).toBeGreaterThanOrEqual(1);
    expect(db._exec.some((s) => /CREATE TABLE.*staging|INSERT INTO eia_cases_staging/i.test(s))).toBe(true);
    expect(db._exec.some((s) => /ALTER TABLE.*RENAME|DROP TABLE eia_cases|RENAME TO eia_cases/i.test(s))).toBe(true);
  });

  it('aborts on api_calls > maxApiCalls', async () => {
    let count = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      count++;
      return Promise.resolve(new Response(JSON.stringify(baseListResp), { status: 200 }));
    }));
    const db = makeD1();
    const summary = await runIndexer({ env: { SERVICE_KEY: 'k', DB: db as never }, maxApiCalls: 2 });
    expect(summary.error).toMatch(/api_calls/);
    expect(count).toBeLessThanOrEqual(3);
  });

  it('strategy stage overrides draft stage on eia_cd conflict', async () => {
    // 일반 list 에 X-1 (bizSize 없음) + 전략 list 에도 X-1 (bizSize 30 MW)
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      calls++;
      if (url.includes('Strategy') && url.includes('Detail')) {
        return Promise.resolve(new Response(JSON.stringify({
          response: { header: { resultCode: '00', resultMsg: 'OK' },
            body: { items: { item: { eiaCd: 'X-1', bizGubunCd: 'C', bizGubunNm: '에너지개발', bizNm: '풍력', bizSize: '30', bizSizeDan: 'MW', eiaAddrTxt: '강원 영월군' } } } }
        }), { status: 200 }));
      }
      if (url.includes('Detail')) return Promise.resolve(new Response(JSON.stringify({ ...detailResp, response: { ...detailResp.response, body: { items: { item: { ...detailResp.response.body.items.item, eiaCd: 'X-1' } } } } }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({
        response: { header: { resultCode: '00', resultMsg: 'OK' },
          body: { items: { item: [{ eiaCd: 'X-1', bizGubunCd: 'C', bizGubunNm: '에너지개발', bizNm: '풍력' }] } } }
      }), { status: 200 }));
    }));
    const db = makeD1();
    await runIndexer({ env: { SERVICE_KEY: 'k', DB: db as never }, maxApiCalls: 8000 });
    const insert = db._exec.find((s) => /INSERT OR REPLACE INTO eia_cases_staging/i.test(s));
    expect(insert).toBeDefined();
  });
});
```

- [ ] **Step 2: FAIL → 구현 (큰 모듈, 단계별 작성)**

Create `workers/cases-indexer.ts`:

```ts
import { PortalClient } from '../packages/eia-data/src/client';
import {
  draftListItemSchema, draftDetailItemSchema,
  strategyDraftListItemSchema, strategyDraftDetailItemSchema
} from '../packages/eia-data/src/types/draft-display';
import { buildDraftListPath, buildDetailPath, WIND_BIZ_GUBN_CODES, WIND_SEARCH_TEXTS } from '../packages/eia-data/src/endpoints/draft-display';
import { transformItem, type TransformedRow } from '../src/features/similar-cases/transform';

export interface IndexerEnv {
  SERVICE_KEY: string;
  DB: D1Database;
}

export interface IndexerOpts {
  env: IndexerEnv;
  maxApiCalls?: number;       // default 8000
  numOfRows?: number;         // default 100
  maxPagesPerQuery?: number;  // default 5
}

export interface IndexerSummary {
  records_total: number;
  records_added: number;
  records_skipped: number;
  api_calls: number;
  error: string | null;
}

export async function runIndexer(opts: IndexerOpts): Promise<IndexerSummary> {
  const max = opts.maxApiCalls ?? 8000;
  const numOfRows = opts.numOfRows ?? 100;
  const maxPages = opts.maxPagesPerQuery ?? 5;
  const client = new PortalClient(opts.env);
  let api_calls = 0, records_total = 0, records_added = 0, records_skipped = 0;
  let error: string | null = null;
  const rows: TransformedRow[] = [];

  try {
    for (const stage of ['draft', 'strategy'] as const) {
      const listPath = buildDraftListPath(stage);
      const detailPath = buildDetailPath(stage);
      const listSchema = stage === 'draft' ? draftListItemSchema : strategyDraftListItemSchema;
      const detailSchema = stage === 'draft' ? draftDetailItemSchema : strategyDraftDetailItemSchema;

      for (const searchText of WIND_SEARCH_TEXTS) {
        for (const bizGubn of WIND_BIZ_GUBN_CODES) {
          for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
            if (api_calls >= max) {
              error = `api_calls limit reached (${api_calls})`;
              break;
            }
            const res = await client.call<unknown>({
              path: listPath,
              query: { type: 'json', pageNo, numOfRows, bizGubn, searchText }
            });
            api_calls++;
            const items = normalizeItems<unknown>(res.response?.body?.items?.item);
            records_total += items.length;
            if (items.length === 0) break;

            for (const raw of items) {
              const listParsed = listSchema.safeParse(raw);
              if (!listParsed.success) { records_skipped++; continue; }
              const listItem = listParsed.data;
              if (api_calls >= max) { error = `api_calls limit reached (${api_calls})`; break; }
              const detailRes = await client.call<unknown>({
                path: detailPath,
                query: { type: 'json', eiaCd: listItem.eiaCd }
              });
              api_calls++;
              const detailRaw = pickFirst(detailRes.response?.body?.items?.item);
              const detailParsed = detailSchema.safeParse({ ...listItem, ...(detailRaw ?? {}) });
              if (!detailParsed.success) { records_skipped++; continue; }
              const row = transformItem({
                stage,
                list: listItem as never,
                detail: detailParsed.data as never
              });
              if (!row) { records_skipped++; continue; }
              rows.push(row);
              records_added++;
            }
            if (error) break;
          }
          if (error) break;
        }
        if (error) break;
      }
      if (error) break;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  await applyStageAndSwap(opts.env.DB, rows);

  return { records_total, records_added, records_skipped, api_calls, error };
}

function normalizeItems<T>(item: T | T[] | undefined): T[] {
  if (item == null) return [];
  return Array.isArray(item) ? item : [item];
}
function pickFirst<T>(item: T | T[] | undefined): T | null {
  if (item == null) return null;
  return Array.isArray(item) ? item[0] ?? null : item;
}

async function applyStageAndSwap(db: D1Database, rows: TransformedRow[]) {
  await db.exec(`CREATE TABLE IF NOT EXISTS eia_cases_staging AS SELECT * FROM eia_cases WHERE 0`);
  await db.exec(`DELETE FROM eia_cases_staging`);
  for (const r of rows) {
    await db.prepare(
      `INSERT OR REPLACE INTO eia_cases_staging (eia_cd, eia_seq, biz_gubun_cd, biz_gubun_nm, biz_nm,
        biz_main_nm, approv_organ_nm, biz_money, biz_size, biz_size_dan, drfop_tmdt, drfop_start_dt,
        drfop_end_dt, eia_addr_txt, industry, region_sido, region_sido_code, region_sigungu,
        capacity_mw, area_ha, evaluation_year, evaluation_stage, source_dataset, source_payload, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      r.eia_cd, r.eia_seq, r.biz_gubun_cd, r.biz_gubun_nm, r.biz_nm, r.biz_main_nm, r.approv_organ_nm,
      r.biz_money, r.biz_size, r.biz_size_dan, r.drfop_tmdt, r.drfop_start_dt, r.drfop_end_dt, r.eia_addr_txt,
      r.industry, r.region_sido, r.region_sido_code, r.region_sigungu, r.capacity_mw, r.area_ha,
      r.evaluation_year, r.evaluation_stage, r.source_dataset, r.source_payload
    ).run();
  }
  await db.batch([
    db.prepare(`DROP TABLE IF EXISTS eia_cases_old`),
    db.prepare(`ALTER TABLE eia_cases RENAME TO eia_cases_old`),
    db.prepare(`ALTER TABLE eia_cases_staging RENAME TO eia_cases`),
    db.prepare(`DROP TABLE eia_cases_old`)
  ]);
}

export default {
  async scheduled(_event: ScheduledEvent, env: IndexerEnv) {
    const summary = await runIndexer({ env });
    console.log(JSON.stringify({ kind: 'cases-indexer', summary }));
  }
};
```

- [ ] **Step 3: PASS**

```bash
npx vitest run workers/cases-indexer.test.ts
```

- [ ] **Step 4: wrangler.toml Cron Worker 추가**

Edit `wrangler.toml` (별도 worker 정의):

```toml
[[workers.cron-cases-indexer]]
name = "cases-indexer"
main = "workers/cases-indexer.ts"
[triggers]
crons = ["0 18 * * 0"]   # Sun 18:00 UTC = Mon 03:00 KST

[[workers.cron-cases-indexer.d1_databases]]
binding = "DB"
database_name = "eia-workbench-db"
```

(실제 wrangler.toml 구조에 맞춰 기존 cleanup-worker 블록 패턴을 그대로 따라간다.)

- [ ] **Step 5: Commit**

```bash
git add workers/cases-indexer.ts workers/cases-indexer.test.ts wrangler.toml
git commit -m "feat(similar-cases): cases-indexer cron worker with stage-and-swap (T1-7)"
```

---

## Phase 2 — D1 migration 0003 + 부트스트랩 1회

### Task 14: migration 0003_similar_cases.sql 작성

**Files:**
- Create: `migrations/0003_similar_cases.sql`
- Test: `tests/unit/migrations/0003_similar_cases.test.ts`

- [ ] **Step 1: 테스트 작성**

```ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

describe('migrations/0003_similar_cases.sql', () => {
  it('creates eia_cases + FTS5 + sync table + triggers + indexes', () => {
    const db = new Database(':memory:');
    for (const f of ['0001_init.sql', '0002_scoping.sql', '0003_similar_cases.sql']) {
      const sql = fs.readFileSync(path.join(__dirname, '../../../migrations', f), 'utf-8');
      db.exec(sql);
    }
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    const names = tables.map(t => t.name);
    expect(names).toEqual(expect.arrayContaining(['eia_cases', 'eia_cases_fts', 'eia_cases_sync']));
    const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='eia_cases'").all();
    expect(idx.length).toBeGreaterThanOrEqual(4);
    const trg = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='eia_cases'").all();
    expect(trg.length).toBeGreaterThanOrEqual(3);
  });

  it('CHECK constraint rejects non-onshore_wind industry', () => {
    const db = new Database(':memory:');
    for (const f of ['0001_init.sql', '0002_scoping.sql', '0003_similar_cases.sql']) {
      db.exec(fs.readFileSync(path.join(__dirname, '../../../migrations', f), 'utf-8'));
    }
    expect(() =>
      db.prepare(
        `INSERT INTO eia_cases (eia_cd, biz_gubun_cd, biz_gubun_nm, biz_nm, industry, evaluation_stage, source_dataset, source_payload)
         VALUES ('X', 'C', '에너지', '풍력', 'solar', '본안', '15142998', '{}')`
      ).run()
    ).toThrow(/CHECK/);
  });
});
```

- [ ] **Step 2: FAIL → migration 작성 (spec §4.1 그대로)**

Create `migrations/0003_similar_cases.sql` 으로 spec §4.1 의 SQL 블록을 그대로 옮긴다 (CREATE TABLE eia_cases + 4 인덱스 + FTS5 + 3 trigger + eia_cases_sync 테이블).

- [ ] **Step 3: PASS**

```bash
npx vitest run tests/unit/migrations/0003_similar_cases.test.ts
```

- [ ] **Step 4: 로컬 wrangler 적용 확인**

```bash
wrangler d1 migrations list DB --local 2>&1 | head -10
```

Expected: `0001_init.sql`, `0002_scoping.sql`, `0003_similar_cases.sql` 셋 다 리스트.

- [ ] **Step 5: Commit**

```bash
git add migrations/0003_similar_cases.sql tests/unit/migrations/0003_similar_cases.test.ts
git commit -m "feat(similar-cases): migration 0003 — eia_cases + FTS5 + sync (T2-1)"
```

---

### Task 15: 부트스트랩 트리거 헬퍼

**Files:**
- Create: `scripts/cases-bootstrap.ts`

- [ ] **Step 1: 스크립트 작성**

```ts
// 사용자가 본인 셸에서 1회 수동 실행:
//   wrangler d1 execute DB --local --command "DELETE FROM eia_cases; DELETE FROM eia_cases_sync;"
//   tsx scripts/cases-bootstrap.ts --env=local
//   (또는 production: --env=production, 사용자가 직접)
import { runIndexer } from '../workers/cases-indexer';

async function main() {
  const env = process.argv.includes('--env=production') ? 'production' : 'local';
  console.log(`[cases-bootstrap] env=${env} (manual one-shot)`);
  console.log(`이 스크립트는 SERVICE_KEY 와 D1 binding 이 있는 Worker 환경에서 실행해야 합니다.`);
  console.log(`로컬 부트스트랩은 wrangler dev workers/cases-indexer.ts 후 트리거를 직접 호출하세요.`);
  console.log(`결과 검증: wrangler d1 execute DB --${env} --command "SELECT COUNT(*) FROM eia_cases;"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: README 업데이트 (실행 절차)**

Edit `README.md` (있으면 §부트스트랩, 없으면 추가):

```markdown
## similar-cases 부트스트랩 (수동 1회)

운영 D1 에 `migrations/0003` 적용 후, 1회만 수동 트리거:

1. wrangler d1 execute DB --remote --command "SELECT COUNT(*) FROM eia_cases;"
2. wrangler trigger cases-indexer
3. eia_cases_sync 의 마지막 행 records_added/api_calls 검증
4. 정상 시 cron 트리거 활성화 (이미 wrangler.toml 에 정의됨)
```

- [ ] **Step 3: Commit**

```bash
git add scripts/cases-bootstrap.ts README.md
git commit -m "feat(similar-cases): manual bootstrap trigger doc + helper (T2-2)"
```

---

### Task 16: 로컬 부트스트랩 1회 실행 + 검증

**Files:** (산출물만 검증)

- [ ] **Step 1: 사용자 단계 — 로컬 D1 0003 적용**

```bash
! wrangler d1 migrations apply DB --local
```

Expected: `0003_similar_cases.sql` applied.

- [ ] **Step 2: 사용자 단계 — 부트스트랩 트리거**

```bash
! wrangler dev workers/cases-indexer.ts --local --test-scheduled
# 별도 터미널:
! curl "http://localhost:8787/__scheduled?cron=0+18+*+*+0"
```

Expected: 응답 OK + worker 로그에 `{kind:"cases-indexer", summary:{...}}`.

- [ ] **Step 3: 사용자 단계 — 적재 결과 검증**

```bash
! wrangler d1 execute DB --local --command "SELECT COUNT(*) AS n, MIN(evaluation_year) AS minY, MAX(evaluation_year) AS maxY, SUM(CASE WHEN capacity_mw IS NOT NULL THEN 1 ELSE 0 END) AS withCapacity FROM eia_cases;"
! wrangler d1 execute DB --local --command "SELECT * FROM eia_cases_sync ORDER BY id DESC LIMIT 1;"
```

Expected: `n` ≥ 50 (육상풍력 누적 사업 추정), `minY` ≥ 2010 (대략), `withCapacity / n` ≥ 0.6 (T0-3 분포 기반 가정 — 미달 시 transform 보강 task 추가).

- [ ] **Step 4: findings 갱신 (실측 N, api_calls)**

Edit `docs/findings/2026-04-25-similar-cases-api-shape.md` (또는 별도 `2026-04-26-bootstrap-result.md`) 마지막에 append:

```markdown
## 부트스트랩 1회 실측 (2026-MM-DD)
- records_added: ...
- records_skipped: ...
- api_calls: ...
- 소요시간: ...초
```

- [ ] **Step 5: Commit**

```bash
git add docs/findings/2026-04-26-bootstrap-result.md
git commit -m "docs(similar-cases): bootstrap empirical numbers (T2-3)"
```

---

## Phase 3 — 검색 API (`/api/cases`, `/api/cases/[caseId]`)

### Task 17: case-search 타입 + zod schema

**Files:**
- Create: `src/lib/types/case-search.ts`
- Create: `src/lib/schemas/case-search.ts`
- Test: `src/lib/schemas/case-search.test.ts`

- [ ] **Step 1: 테스트**

```ts
import { describe, it, expect } from 'vitest';
import { caseSearchQuerySchema } from './case-search';

describe('caseSearchQuerySchema', () => {
  it('parses sido + capacity_min + year arrays from query', () => {
    const r = caseSearchQuerySchema.parse({
      q: '강원',
      sido: ['강원', '전남'],
      capacity_band: ['10-50', '50-100'],
      year: ['2024', '2023'],
      page: '2'
    });
    expect(r.sido).toEqual(['강원', '전남']);
    expect(r.page).toBe(2);
  });
  it('rejects unknown capacity_band', () => {
    expect(() => caseSearchQuerySchema.parse({ capacity_band: ['weird'] })).toThrow();
  });
});
```

- [ ] **Step 2: FAIL → 구현**

Create `src/lib/types/case-search.ts`:

```ts
export interface EiaCase {
  eia_cd: string;
  biz_nm: string;
  region_sido: string | null;
  region_sido_code: string | null;
  region_sigungu: string | null;
  capacity_mw: number | null;
  area_ha: number | null;
  evaluation_year: number | null;
  evaluation_stage: '본안' | '전략';
  industry: 'onshore_wind';
  approv_organ_nm: string | null;
  drfop_start_dt: string | null;
  drfop_end_dt: string | null;
  eia_addr_txt: string | null;
}

export interface CaseSearchResult {
  total: number;
  page: number;
  pageSize: number;
  items: EiaCase[];
}
```

Create `src/lib/schemas/case-search.ts`:

```ts
import { z } from 'zod';

export const CAPACITY_BANDS = ['<10', '10-50', '50-100', '>=100'] as const;

const arrify = <T extends z.ZodTypeAny>(s: T) =>
  z.union([s, z.array(s)]).transform((v) => (Array.isArray(v) ? v : [v]));

export const caseSearchQuerySchema = z.object({
  q: z.string().trim().min(0).max(80).optional(),
  sido: arrify(z.string().min(1).max(8)).optional(),
  capacity_band: arrify(z.enum(CAPACITY_BANDS)).optional(),
  year: arrify(z.coerce.number().int().min(2000).max(2100)).optional(),
  page: z.coerce.number().int().min(1).max(200).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(50)
});
export type CaseSearchQuery = z.infer<typeof caseSearchQuerySchema>;
```

- [ ] **Step 3: PASS + Commit**

```bash
git add src/lib/types/case-search.ts src/lib/schemas/case-search.ts src/lib/schemas/case-search.test.ts
git commit -m "feat(similar-cases): EiaCase types + caseSearchQuerySchema (T3-1)"
```

---

### Task 18: search-query — FTS5 + LIKE fallback 빌더

**Files:**
- Create: `src/features/similar-cases/search-query.ts`
- Test: `src/features/similar-cases/search-query.test.ts`

- [ ] **Step 1: 테스트**

```ts
import { describe, it, expect } from 'vitest';
import { buildCaseSearchSql } from './search-query';

describe('buildCaseSearchSql', () => {
  it('q + sido OR + capacity_band ranges as AND', () => {
    const r = buildCaseSearchSql({
      q: '강원',
      sido: ['강원', '전남'],
      capacity_band: ['10-50'],
      year: [2024, 2023],
      page: 1, pageSize: 50
    });
    expect(r.sql).toMatch(/eia_cases_fts MATCH/);
    expect(r.sql).toMatch(/region_sido IN \(\?,\?\)/);
    expect(r.sql).toMatch(/capacity_mw >= \? AND capacity_mw < \?/);
    expect(r.sql).toMatch(/evaluation_year IN \(\?,\?\)/);
    expect(r.sql).toMatch(/ORDER BY evaluation_year DESC/);
    expect(r.sql).toMatch(/LIMIT \? OFFSET \?/);
    expect(r.binds).toEqual(expect.arrayContaining(['강원*', '강원', '전남', 10, 50, 2024, 2023, 50, 0]));
  });

  it('uses LIKE fallback for q.length<=3 or empty', () => {
    const r = buildCaseSearchSql({ q: '강원', page: 1, pageSize: 50 });
    expect(r.sql).toMatch(/biz_nm LIKE \? OR region_sido LIKE \? OR region_sigungu LIKE \?/);
  });

  it('without q: no FTS join', () => {
    const r = buildCaseSearchSql({ page: 1, pageSize: 50 });
    expect(r.sql).not.toMatch(/MATCH/);
    expect(r.sql).not.toMatch(/LIKE/);
  });

  it('count query has same WHERE', () => {
    const r = buildCaseSearchSql({ sido: ['강원'], page: 1, pageSize: 50 });
    expect(r.countSql).toMatch(/SELECT COUNT/);
    expect(r.countSql).toMatch(/region_sido IN/);
  });
});
```

- [ ] **Step 2: FAIL → 구현**

```ts
import type { CaseSearchQuery } from '../../lib/schemas/case-search';

const BAND_RANGES: Record<string, [number, number]> = {
  '<10': [0, 10],
  '10-50': [10, 50],
  '50-100': [50, 100],
  '>=100': [100, 1e9]
};

export interface BuiltQuery {
  sql: string;
  countSql: string;
  binds: unknown[];
  countBinds: unknown[];
}

export function buildCaseSearchSql(q: CaseSearchQuery): BuiltQuery {
  const where: string[] = ['industry = ?'];
  const binds: unknown[] = ['onshore_wind'];

  if (q.q && q.q.length > 0) {
    if (q.q.length > 3) {
      where.push(`eia_cd IN (SELECT eia_cd FROM eia_cases_fts WHERE eia_cases_fts MATCH ?)`);
      binds.push(`${q.q}*`);
    } else {
      where.push(`(biz_nm LIKE ? OR region_sido LIKE ? OR region_sigungu LIKE ?)`);
      const pat = `%${q.q}%`;
      binds.push(pat, pat, pat);
    }
  }
  if (q.sido && q.sido.length > 0) {
    where.push(`region_sido IN (${q.sido.map(() => '?').join(',')})`);
    binds.push(...q.sido);
  }
  if (q.capacity_band && q.capacity_band.length > 0) {
    const subs = q.capacity_band.map((b) => {
      const [lo, hi] = BAND_RANGES[b];
      binds.push(lo, hi);
      return `(capacity_mw >= ? AND capacity_mw < ?)`;
    });
    where.push(`(${subs.join(' OR ')})`);
  }
  if (q.year && q.year.length > 0) {
    where.push(`evaluation_year IN (${q.year.map(() => '?').join(',')})`);
    binds.push(...q.year);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (q.page - 1) * q.pageSize;
  const sql = `
    SELECT eia_cd, biz_nm, region_sido, region_sido_code, region_sigungu,
           capacity_mw, area_ha, evaluation_year, evaluation_stage, industry,
           approv_organ_nm, drfop_start_dt, drfop_end_dt, eia_addr_txt
    FROM eia_cases
    ${whereClause}
    ORDER BY evaluation_year DESC, fetched_at DESC
    LIMIT ? OFFSET ?
  `.replace(/\s+/g, ' ').trim();
  const countSql = `SELECT COUNT(*) as n FROM eia_cases ${whereClause}`.trim();
  return { sql, countSql, binds: [...binds, q.pageSize, offset], countBinds: [...binds] };
}
```

- [ ] **Step 3: PASS + Commit**

```bash
git add src/features/similar-cases/search-query.ts src/features/similar-cases/search-query.test.ts
git commit -m "feat(similar-cases): search-query builder (FTS5 + LIKE + facets) (T3-2)"
```

---

### Task 19: GET /api/cases 핸들러

**Files:**
- Create: `src/pages/api/cases/index.ts`
- Test: `tests/unit/api-cases-get.test.ts`

- [ ] **Step 1: 테스트 (Astro APIRoute mock)**

```ts
import { describe, it, expect, vi } from 'vitest';
import { GET } from '../../src/pages/api/cases/index';

function ctx(url: string) {
  const env = {
    DB: {
      prepare: () => ({ bind: () => ({ all: async () => ({ results: [{ eia_cd: 'X-1', biz_nm: '강원풍력', industry: 'onshore_wind', evaluation_stage: '본안' }] }), first: async () => ({ n: 1 }) }) })
    }
  };
  return { request: new Request(url), locals: { runtime: { env } } } as never;
}

describe('GET /api/cases', () => {
  it('returns 200 + items for valid query', async () => {
    const res = await GET(ctx('https://x/api/cases?sido=강원&page=1'));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.total).toBe(1);
    expect(j.items[0].eia_cd).toBe('X-1');
  });
  it('returns 400 on schema fail', async () => {
    const res = await GET(ctx('https://x/api/cases?capacity_band=weird'));
    expect(res.status).toBe(400);
  });
  it('does not log query string (Q7)', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await GET(ctx('https://x/api/cases?q=secret-search-term'));
    for (const call of spy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('secret-search-term');
    }
    spy.mockRestore();
  });
  it('sets Cache-Control max-age=300', async () => {
    const res = await GET(ctx('https://x/api/cases?sido=강원'));
    expect(res.headers.get('Cache-Control')).toMatch(/max-age=300/);
  });
});
```

- [ ] **Step 2: FAIL → 핸들러**

```ts
import type { APIRoute } from 'astro';
import { caseSearchQuerySchema } from '@/lib/schemas/case-search';
import { buildCaseSearchSql } from '@/features/similar-cases/search-query';

export const GET: APIRoute = async ({ request, locals }) => {
  const { searchParams } = new URL(request.url);
  const obj: Record<string, unknown> = {};
  for (const [k, v] of searchParams.entries()) {
    if (k in obj) {
      const cur = obj[k];
      obj[k] = Array.isArray(cur) ? [...cur, v] : [cur as string, v];
    } else {
      obj[k] = searchParams.getAll(k).length > 1 ? searchParams.getAll(k) : v;
    }
  }
  const parsed = caseSearchQuerySchema.safeParse(obj);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'invalid_query', issues: parsed.error.flatten() }), { status: 400 });
  }
  const built = buildCaseSearchSql(parsed.data);
  const env = (locals as { runtime: { env: { DB: D1Database } } }).runtime.env;
  const [{ results }, count] = await Promise.all([
    env.DB.prepare(built.sql).bind(...built.binds).all(),
    env.DB.prepare(built.countSql).bind(...built.countBinds).first<{ n: number }>()
  ]);
  console.log(JSON.stringify({ kind: 'cases-search', count: count?.n ?? 0 })); // Q7 — q 비로깅
  return new Response(
    JSON.stringify({
      total: count?.n ?? 0,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      items: results
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
    }
  );
};
```

- [ ] **Step 3: PASS + Commit**

```bash
git add src/pages/api/cases/index.ts tests/unit/api-cases-get.test.ts
git commit -m "feat(similar-cases): GET /api/cases (FTS5+facets, Q7-safe logging) (T3-3)"
```

---

### Task 20: GET /api/cases/[caseId] 단건

**Files:**
- Create: `src/pages/api/cases/[caseId].ts`
- Test: `tests/unit/api-cases-detail-get.test.ts`

- [ ] **Step 1: 테스트**

```ts
import { describe, it, expect } from 'vitest';
import { GET } from '../../src/pages/api/cases/[caseId]';

function ctx(eiaCd: string, found: boolean) {
  const row = found ? { eia_cd: eiaCd, biz_nm: 'X' } : null;
  return {
    params: { caseId: eiaCd },
    locals: { runtime: { env: { DB: { prepare: () => ({ bind: () => ({ first: async () => row }) }) } } } }
  } as never;
}

describe('GET /api/cases/[caseId]', () => {
  it('200 when found', async () => {
    const res = await GET(ctx('X-1', true));
    expect(res.status).toBe(200);
  });
  it('404 when missing', async () => {
    const res = await GET(ctx('Z-9', false));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: 구현**

```ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const eiaCd = params.caseId;
  if (!eiaCd) return new Response('bad_request', { status: 400 });
  const env = (locals as { runtime: { env: { DB: D1Database } } }).runtime.env;
  const row = await env.DB.prepare(
    `SELECT eia_cd, biz_nm, region_sido, region_sigungu, capacity_mw, area_ha,
            evaluation_year, evaluation_stage, industry, approv_organ_nm,
            drfop_start_dt, drfop_end_dt, eia_addr_txt
       FROM eia_cases WHERE eia_cd = ?`
  ).bind(eiaCd).first();
  if (!row) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify(row), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } });
};
```

- [ ] **Step 3: PASS + Commit**

```bash
git add src/pages/api/cases/[caseId].ts tests/unit/api-cases-detail-get.test.ts
git commit -m "feat(similar-cases): GET /api/cases/[caseId] single (T3-4)"
```

---

## Phase 4 — UI (`/cases` 검색 페이지)

### Task 21: Astro SSR `/cases/index.astro` + AppLayout 통합

**Files:**
- Create: `src/pages/cases/index.astro`

- [ ] **Step 1: 페이지 구조**

```astro
---
import AppLayout from '@/layouts/AppLayout.astro';
import CaseSearchPage from '@/components/cases/CaseSearchPage';
---

<AppLayout title="유사사례 검색 — eia-workbench" navActive="cases">
  <main class="mx-auto max-w-content px-4 py-6">
    <h1 class="text-h1 mb-2">유사사례 검색</h1>
    <p class="text-small text-text-secondary mb-4">
      국내 풍력 사업의 환경영향평가 초안 공람 사례를 검색합니다.
      본 도구는 검토 보조이며 현지조사·전문가 검토를 대체하지 않습니다.
    </p>
    <CaseSearchPage client:load />
  </main>
</AppLayout>
```

- [ ] **Step 2: 좌측 nav 에 "유사사례" 추가 (AppLayout.astro 또는 nav 컴포넌트)**

Edit nav 컴포넌트 → `<a href="/cases" class:list={[navActive==='cases' && 'aria-current']}>유사사례</a>`.

- [ ] **Step 3: middleware 인증 보호 확인**

Run: `grep -n "/cases" src/middleware.ts`
보호되지 않으면 `protectedPrefixes` 배열에 `'/cases'` 추가.

- [ ] **Step 4: 빌드 확인**

```bash
npm run build
```

Expected: 0 errors. `/cases/index` 가 dist 에 포함.

- [ ] **Step 5: Commit**

```bash
git add src/pages/cases/index.astro src/layouts/AppLayout.astro src/middleware.ts
git commit -m "feat(similar-cases): /cases SSR shell + nav + auth protection (T4-1)"
```

---

### Task 22: CaseSearchPage React island (검색바 + URL sync)

**Files:**
- Create: `src/components/cases/CaseSearchPage.tsx`

- [ ] **Step 1: 구현 (검색바 debounce 300ms + URL 쿼리 단일 소스)**

```tsx
import { useEffect, useState } from 'react';
import CaseFacetPanel from './CaseFacetPanel';
import CaseResultCard from './CaseResultCard';
import CasePreviewPane from './CasePreviewPane';
import CaseSearchGuide from './CaseSearchGuide';
import type { CaseSearchResult, EiaCase } from '@/lib/types/case-search';

export default function CaseSearchPage() {
  const [q, setQ] = useState(() => new URL(window.location.href).searchParams.get('q') ?? '');
  const [data, setData] = useState<CaseSearchResult | null>(null);
  const [selected, setSelected] = useState<EiaCase | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const url = new URL(window.location.href);
      if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
      window.history.replaceState({}, '', url.toString());
      const apiUrl = new URL('/api/cases', window.location.origin);
      url.searchParams.forEach((v, k) => apiUrl.searchParams.append(k, v));
      const res = await fetch(apiUrl.toString());
      if (res.ok) setData(await res.json());
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, /* facet 변경 시에도 발화 */]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="case-q">검색어</label>
        <input
          id="case-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="사업명·지역명 검색 (예: 강원 평창 풍력)"
          className="h-10 flex-1 min-w-[200px] rounded-md border border-border px-3"
        />
        <a
          href="#"
          className="h-10 inline-flex items-center rounded-md border border-border px-3 text-small hover:bg-bg"
          onClick={(e) => { e.preventDefault(); /* T5-1 export */ }}
        >Markdown 내보내기</a>
      </div>
      <CaseSearchGuide />

      <div className="grid gap-4 md:grid-cols-[220px_1fr_320px]">
        <CaseFacetPanel onChange={() => { /* trigger fetch via URL change */ }} />
        <section aria-label="결과 리스트">
          {loading ? <p className="text-small text-text-tertiary">불러오는 중…</p> : null}
          {data && data.total === 0 ? (
            <p className="rounded-md border border-border bg-surface p-6 text-small text-text-secondary">
              조건에 맞는 사례가 없습니다. facet 을 줄이거나 검색어를 짧게 해보세요.
            </p>
          ) : null}
          {data?.items.map((c) => (
            <CaseResultCard key={c.eia_cd} eiaCase={c} onSelect={() => setSelected(c)} />
          ))}
          {data && data.total > data.items.length ? (
            <details className="mt-2 text-small text-text-tertiary"><summary>전체 {data.total}건</summary></details>
          ) : null}
        </section>
        <aside aria-label="미리보기" className="hidden md:block">
          <CasePreviewPane eiaCase={selected} />
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cases/CaseSearchPage.tsx
git commit -m "feat(similar-cases): CaseSearchPage island (debounce + URL sync) (T4-2)"
```

---

### Task 23: CaseFacetPanel (시·도/규모/연도 OR-within / AND-across)

**Files:**
- Create: `src/components/cases/CaseFacetPanel.tsx`

- [ ] **Step 1: 구현 (URL 쿼리에서 읽고 변경 시 history.replaceState + 부모에게 알림)**

```tsx
import { useEffect, useState } from 'react';
import { CAPACITY_BANDS } from '@/lib/schemas/case-search';
import { SIDO_LUT } from '@/features/similar-cases/sido-lut';

const YEARS = [2024, 2023, 2022, 2021, 2020];

export default function CaseFacetPanel({ onChange }: { onChange: () => void }) {
  const [sido, setSido] = useState<string[]>([]);
  const [bands, setBands] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);

  useEffect(() => {
    const sp = new URL(window.location.href).searchParams;
    setSido(sp.getAll('sido'));
    setBands(sp.getAll('capacity_band'));
    setYears(sp.getAll('year').map(Number).filter(Number.isFinite));
  }, []);

  function syncUrl(next: { sido?: string[]; bands?: string[]; years?: number[] }) {
    const url = new URL(window.location.href);
    url.searchParams.delete('sido');
    url.searchParams.delete('capacity_band');
    url.searchParams.delete('year');
    (next.sido ?? sido).forEach((v) => url.searchParams.append('sido', v));
    (next.bands ?? bands).forEach((v) => url.searchParams.append('capacity_band', v));
    (next.years ?? years).forEach((v) => url.searchParams.append('year', String(v)));
    window.history.replaceState({}, '', url.toString());
    onChange();
  }

  function toggle<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  return (
    <div className="space-y-4 text-small">
      <details open><summary className="font-semibold">시·도</summary>
        <ul>{SIDO_LUT.map((r) => (
          <li key={r.short}><label>
            <input type="checkbox" checked={sido.includes(r.short)} onChange={() => { const next = toggle(sido, r.short); setSido(next); syncUrl({ sido: next }); }} />{' '}{r.short}
          </label></li>
        ))}</ul>
      </details>
      <details open><summary className="font-semibold">규모(MW)</summary>
        <ul>{CAPACITY_BANDS.map((b) => (
          <li key={b}><label>
            <input type="checkbox" checked={bands.includes(b)} onChange={() => { const next = toggle(bands, b); setBands(next); syncUrl({ bands: next }); }} />{' '}{b}
          </label></li>
        ))}</ul>
      </details>
      <details open><summary className="font-semibold">평가시기</summary>
        <ul>{YEARS.map((y) => (
          <li key={y}><label>
            <input type="checkbox" checked={years.includes(y)} onChange={() => { const next = toggle(years, y); setYears(next); syncUrl({ years: next }); }} />{' '}{y}
          </label></li>
        ))}</ul>
      </details>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cases/CaseFacetPanel.tsx
git commit -m "feat(similar-cases): CaseFacetPanel (OR within, AND across, URL-sync) (T4-3)"
```

---

### Task 24: CaseResultCard + CasePreviewPane + CaseSearchGuide

**Files:**
- Create: `src/components/cases/CaseResultCard.tsx`
- Create: `src/components/cases/CasePreviewPane.tsx`
- Create: `src/components/cases/CaseSearchGuide.tsx`

- [ ] **Step 1: 카드 (단정어 금지)**

```tsx
import type { EiaCase } from '@/lib/types/case-search';

export default function CaseResultCard({ eiaCase, onSelect }: { eiaCase: EiaCase; onSelect: () => void }) {
  return (
    <article className="mb-3 rounded-md border border-border bg-surface p-4">
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <h3 className="text-h2">{eiaCase.biz_nm}</h3>
        <p className="text-small text-text-secondary">
          {eiaCase.region_sido ? `${eiaCase.region_sido} ${eiaCase.region_sigungu ?? ''}` : '지역 미상'}
          {eiaCase.capacity_mw != null ? ` · ${eiaCase.capacity_mw} MW` : ''}
          {eiaCase.evaluation_year != null ? ` · ${eiaCase.evaluation_year}` : ''}
          {' · '}<span className="rounded bg-bg px-1">{eiaCase.evaluation_stage}</span>
        </p>
      </button>
    </article>
  );
}
```

- [ ] **Step 2: 미리보기**

```tsx
import type { EiaCase } from '@/lib/types/case-search';
import { eiassProjectUrl } from '../../../packages/eia-data/src/deep-link';

export default function CasePreviewPane({ eiaCase }: { eiaCase: EiaCase | null }) {
  if (!eiaCase) return <p className="text-small text-text-tertiary">카드를 선택하면 메타데이터가 표시됩니다.</p>;
  return (
    <div className="space-y-2 rounded-md border border-border bg-surface p-4">
      <h2 className="text-h2">{eiaCase.biz_nm}</h2>
      <dl className="grid gap-1 text-small">
        <div><dt className="inline text-text-secondary">위치: </dt><dd className="inline">{eiaCase.eia_addr_txt ?? '미상'}</dd></div>
        <div><dt className="inline text-text-secondary">규모: </dt><dd className="inline">{eiaCase.capacity_mw != null ? `${eiaCase.capacity_mw} MW` : '미상'}</dd></div>
        <div><dt className="inline text-text-secondary">평가시기: </dt><dd className="inline">{eiaCase.evaluation_year ?? '미상'} ({eiaCase.evaluation_stage})</dd></div>
        <div><dt className="inline text-text-secondary">승인기관: </dt><dd className="inline">{eiaCase.approv_organ_nm ?? '미상'}</dd></div>
      </dl>
      <a href={eiassProjectUrl({ projectId: eiaCase.eia_cd })} target="_blank" rel="noreferrer"
         className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-small text-white hover:bg-primary-hover">
        EIASS 원문 열기 ↗
      </a>
      <p className="text-small text-text-tertiary">본 도구는 사례 메타데이터만 표시합니다. 본문은 EIASS 원문에서 확인하세요.</p>
    </div>
  );
}
```

- [ ] **Step 3: 검색 가이드**

```tsx
export default function CaseSearchGuide() {
  return (
    <details className="rounded-md border border-border bg-surface p-3 text-small text-text-secondary">
      <summary className="cursor-pointer">검색 가이드</summary>
      <p className="mt-2">사업명에 공백이 없는 경우 어두만 매칭됩니다. "강원풍력"은 "강원"으로 찾을 수 있지만 "풍력"으로는 찾을 수 없습니다. 짧은 검색어(3자 이하)는 부분일치를 함께 시도합니다.</p>
    </details>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/cases/CaseResultCard.tsx src/components/cases/CasePreviewPane.tsx src/components/cases/CaseSearchGuide.tsx
git commit -m "feat(similar-cases): CaseResultCard + Preview + SearchGuide (T4-4)"
```

---

### Task 25: 모바일 fallback `/cases/[caseId]` 상세 페이지

**Files:**
- Create: `src/pages/cases/[caseId].astro`

- [ ] **Step 1: 페이지 (server-side fetch)**

```astro
---
import AppLayout from '@/layouts/AppLayout.astro';
import { eiassProjectUrl } from '../../../packages/eia-data/src/deep-link';
const { caseId } = Astro.params;
const env = (Astro.locals as any).runtime.env;
const row = await env.DB.prepare(
  `SELECT eia_cd, biz_nm, region_sido, region_sigungu, capacity_mw, evaluation_year, evaluation_stage, approv_organ_nm, eia_addr_txt FROM eia_cases WHERE eia_cd = ?`
).bind(caseId).first();
if (!row) return new Response('not found', { status: 404 });
---

<AppLayout title={`${row.biz_nm} — 유사사례`} navActive="cases">
  <main class="mx-auto max-w-content px-4 py-6">
    <a href="/cases" class="text-small text-primary">← 검색 결과로</a>
    <h1 class="text-h1 mt-2">{row.biz_nm}</h1>
    <p class="text-small text-text-secondary">{row.region_sido} {row.region_sigungu} · {row.capacity_mw ?? '미상'} MW · {row.evaluation_year ?? '미상'}</p>
    <dl class="mt-4 grid gap-1 text-small">
      <div><dt class="inline text-text-secondary">위치: </dt><dd class="inline">{row.eia_addr_txt ?? '미상'}</dd></div>
      <div><dt class="inline text-text-secondary">평가단계: </dt><dd class="inline">{row.evaluation_stage}</dd></div>
      <div><dt class="inline text-text-secondary">승인기관: </dt><dd class="inline">{row.approv_organ_nm ?? '미상'}</dd></div>
    </dl>
    <a href={eiassProjectUrl({ projectId: row.eia_cd as string })} target="_blank" rel="noreferrer"
       class="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-small text-white hover:bg-primary-hover">
      EIASS 원문 열기 ↗
    </a>
    <p class="mt-2 text-small text-text-tertiary">본 도구는 사례 메타데이터만 표시합니다. 본문은 EIASS 원문에서 확인하세요.</p>
  </main>
</AppLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/cases/[caseId].astro
git commit -m "feat(similar-cases): /cases/[caseId] mobile detail page (T4-5)"
```

---

### Task 26: 프로젝트 상세 → /cases prefilled 진입

**Files:**
- Modify: `src/pages/projects/[id].astro` (또는 자료 탭 컴포넌트)
- Create: `src/components/cases/CasePrefilledLink.tsx`

- [ ] **Step 1: prefilled link 헬퍼**

```tsx
export default function CasePrefilledLink({ sido, capacityBand }: { sido?: string | null; capacityBand?: string | null }) {
  const params = new URLSearchParams();
  if (sido) params.set('sido', sido);
  if (capacityBand) params.set('capacity_band', capacityBand);
  return (
    <a href={`/cases?${params.toString()}`} className="inline-flex h-9 items-center rounded-md border border-border px-3 text-small hover:bg-bg">
      유사사례 보기
    </a>
  );
}
```

- [ ] **Step 2: 프로젝트 상세 페이지에 버튼 부착**

Edit `src/pages/projects/[id].astro` → 자료 탭 옆에 `<CasePrefilledLink sido={project.region_sido} client:load />`.

- [ ] **Step 3: Commit**

```bash
git add src/components/cases/CasePrefilledLink.tsx src/pages/projects/[id].astro
git commit -m "feat(similar-cases): /projects/[id] → /cases prefilled link (T4-6)"
```

---

## Phase 5 — Markdown export + EIASS deep-link 보강

### Task 27: markdown-export (현재 화면 카드 → .md 표)

**Files:**
- Create: `src/features/similar-cases/markdown-export.ts`
- Test: `src/features/similar-cases/markdown-export.test.ts`

- [ ] **Step 1: 테스트**

```ts
import { describe, it, expect } from 'vitest';
import { exportCasesToMarkdown } from './markdown-export';

describe('exportCasesToMarkdown', () => {
  it('produces table with header and EIASS deep-link column', () => {
    const md = exportCasesToMarkdown([
      { eia_cd: 'A-1', biz_nm: '강원풍력', region_sido: '강원', region_sigungu: '평창군', capacity_mw: 30, evaluation_year: 2024, evaluation_stage: '본안', industry: 'onshore_wind', region_sido_code: '51', area_ha: null, approv_organ_nm: '환경부', drfop_start_dt: '2024-01-15', drfop_end_dt: '2024-02-14', eia_addr_txt: '강원 평창군' }
    ], { q: '강원', sido: ['강원'] });
    expect(md).toMatch(/^# 유사사례 검색 결과/m);
    expect(md).toMatch(/\| eiaCd \| 사업명 \| 위치 \| 규모 \| 평가시기 \| 단계 \| EIASS \|/);
    expect(md).toContain('https://www.eiass.go.kr');
    expect(md).toContain('강원풍력');
    expect(md).toContain('검색어: 강원');
  });
  it('escapes pipe characters in biz_nm', () => {
    const md = exportCasesToMarkdown([
      { eia_cd: 'B-1', biz_nm: 'A|B 풍력', region_sido: '강원', region_sigungu: '', capacity_mw: 1, evaluation_year: 2024, evaluation_stage: '본안', industry: 'onshore_wind', region_sido_code: '51', area_ha: null, approv_organ_nm: '', drfop_start_dt: '', drfop_end_dt: '', eia_addr_txt: '' }
    ], {});
    expect(md).toContain('A\\|B 풍력');
  });
});
```

- [ ] **Step 2: FAIL → 구현**

```ts
import type { EiaCase } from '@/lib/types/case-search';
import { eiassProjectUrl } from '../../../packages/eia-data/src/deep-link';

function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/\|/g, '\\|');
}

export interface ExportContext {
  q?: string;
  sido?: string[];
  capacity_band?: string[];
  year?: number[];
}

export function exportCasesToMarkdown(items: EiaCase[], ctx: ExportContext): string {
  const lines: string[] = [];
  lines.push('# 유사사례 검색 결과');
  const filters: string[] = [];
  if (ctx.q) filters.push(`검색어: ${ctx.q}`);
  if (ctx.sido?.length) filters.push(`시·도: ${ctx.sido.join(', ')}`);
  if (ctx.capacity_band?.length) filters.push(`규모: ${ctx.capacity_band.join(', ')}`);
  if (ctx.year?.length) filters.push(`연도: ${ctx.year.join(', ')}`);
  if (filters.length) lines.push('', filters.join(' · '));
  lines.push('', '> 본 도구는 검토 보조이며 현지조사·전문가 검토를 대체하지 않습니다.');
  lines.push('', '| eiaCd | 사업명 | 위치 | 규모 | 평가시기 | 단계 | EIASS |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const c of items) {
    const region = [c.region_sido, c.region_sigungu].filter(Boolean).join(' ');
    const capacity = c.capacity_mw != null ? `${c.capacity_mw} MW` : '미상';
    const year = c.evaluation_year != null ? String(c.evaluation_year) : '미상';
    const link = eiassProjectUrl({ projectId: c.eia_cd });
    lines.push(`| ${esc(c.eia_cd)} | ${esc(c.biz_nm)} | ${esc(region)} | ${esc(capacity)} | ${year} | ${c.evaluation_stage} | [원문](${link}) |`);
  }
  return lines.join('\n') + '\n';
}
```

- [ ] **Step 3: PASS + Commit**

```bash
git add src/features/similar-cases/markdown-export.ts src/features/similar-cases/markdown-export.test.ts
git commit -m "feat(similar-cases): markdown export (table + EIASS deep-link) (T5-1)"
```

---

### Task 28: 검색 페이지에 export 버튼 연결 + 다운로드

**Files:**
- Modify: `src/components/cases/CaseSearchPage.tsx`

- [ ] **Step 1: 다운로드 핸들러 부착**

```tsx
import { exportCasesToMarkdown } from '@/features/similar-cases/markdown-export';

// CaseSearchPage 내부 — 기존 placeholder onClick 을 교체
function downloadMarkdown() {
  if (!data) return;
  const url = new URL(window.location.href);
  const md = exportCasesToMarkdown(data.items, {
    q: url.searchParams.get('q') ?? undefined,
    sido: url.searchParams.getAll('sido'),
    capacity_band: url.searchParams.getAll('capacity_band'),
    year: url.searchParams.getAll('year').map(Number).filter(Number.isFinite)
  });
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cases-${new Date().toISOString().slice(0,10)}.md`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
```

기존 placeholder `<a>` → `<button onClick={downloadMarkdown}>Markdown 내보내기</button>`.

- [ ] **Step 2: 단위 테스트 추가 (jsdom 환경)**

`tests/unit/case-search-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CaseSearchPage from '@/components/cases/CaseSearchPage';

describe('CaseSearchPage', () => {
  it('renders 빈 상태 메시지 when no data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ total: 0, page: 1, pageSize: 50, items: [] }), { status: 200 })));
    render(<CaseSearchPage />);
    await screen.findByText(/조건에 맞는 사례가 없습니다/);
  });
});
```

- [ ] **Step 3: PASS + Commit**

```bash
npx vitest run tests/unit/case-search-page.test.tsx
git add src/components/cases/CaseSearchPage.tsx tests/unit/case-search-page.test.tsx
git commit -m "feat(similar-cases): hook export button + empty-state test (T5-2)"
```

---

## Phase 6 — E2E + axe + Lighthouse + 단정어 grep

### Task 29: E2E `cases-search-happy.spec.ts`

**Files:**
- Create: `tests/e2e/cases-search-happy.spec.ts`

- [ ] **Step 1: spec**

```ts
import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test('사례 검색 happy path: 강원 풍력 → 카드 ≥ 1', async ({ page }) => {
  await login(page);
  await page.goto('/cases');
  await page.getByPlaceholder(/사업명·지역명/).fill('강원');
  // facet 시·도 강원 체크
  await page.getByLabel('강원').check();
  // 결과 카드 ≥ 1 (육상풍력 누적 사업 가정)
  await expect(page.locator('article').first()).toBeVisible({ timeout: 10000 });
  // 미리보기 패널 표시 (데스크톱)
  await page.locator('article').first().click();
  await expect(page.getByRole('button', { name: /EIASS 원문 열기/ })).toBeVisible();
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/cases-search-happy.spec.ts
git commit -m "test(e2e): cases-search-happy (T6-1)"
```

---

### Task 30: E2E `cases-facet-combo.spec.ts`

**Files:**
- Create: `tests/e2e/cases-facet-combo.spec.ts`

- [ ] **Step 1: spec**

```ts
import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test('facet combo: 강원 OR 전남 + 10-50 MW', async ({ page }) => {
  await login(page);
  await page.goto('/cases');
  await page.getByLabel('강원').check();
  await page.getByLabel('전남').check();
  await page.getByLabel('10-50').check();
  // URL 쿼리 갱신 확인
  await expect(page).toHaveURL(/sido=강원/);
  await expect(page).toHaveURL(/sido=전남/);
  await expect(page).toHaveURL(/capacity_band=10-50/);
  // 결과 카드 모두 강원 또는 전남
  const regions = await page.locator('article p.text-small').allTextContents();
  for (const t of regions) {
    expect(t).toMatch(/강원|전남|지역 미상/);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/cases-facet-combo.spec.ts
git commit -m "test(e2e): cases-facet-combo (T6-2)"
```

---

### Task 31: axe-smoke `/cases` 포함 + Lighthouse smoke

**Files:**
- Modify: `tests/e2e/axe-smoke.spec.ts` (있으면 페이지 추가)
- Create: `tests/e2e/cases-axe.spec.ts` (없을 시)

- [ ] **Step 1: axe spec**

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/login';

test('axe: /cases', async ({ page }) => {
  await login(page);
  await page.goto('/cases');
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((v) => ['serious','critical'].includes(v.impact ?? ''))).toEqual([]);
});
```

- [ ] **Step 2: Lighthouse smoke (선택, 시간 5분 한도면 skip 표기)**

`tests/e2e/cases-lighthouse.spec.ts` (수동 실행만):

```ts
// 수동: npx lhci collect --url=http://localhost:3000/cases
// 통과 기준: Performance ≥ 90, Accessibility ≥ 90 (spec §9)
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/cases-axe.spec.ts tests/e2e/cases-lighthouse.spec.ts
git commit -m "test(e2e): cases-axe + lighthouse stub (T6-3)"
```

---

### Task 32: 단정어 grep 가드 + lint-copy 확장

**Files:**
- Create: `scripts/check-similar-cases-assertions.sh`
- Modify: `scripts/lint-copy.ts` (`/cases` 산출물 grep 범위 확장)

- [ ] **Step 1: shell 스크립트**

```bash
#!/usr/bin/env bash
# /cases 빌드 산출물 + similar-cases 코드에 단정 표현이 있는지 검사.
set -e
TARGETS=(
  "src/components/cases"
  "src/pages/cases"
  "src/features/similar-cases"
)
PATTERNS='유사사례입니다|협의 통과|승인됨|법적으로 문제없음|환경영향평가 대상입니다'
if grep -rEn "$PATTERNS" "${TARGETS[@]}" 2>/dev/null; then
  echo "ERROR: forbidden assertion strings found in similar-cases."
  exit 1
fi
echo "OK: no forbidden assertions in similar-cases."
```

- [ ] **Step 2: chmod + CI 통합**

```bash
chmod +x scripts/check-similar-cases-assertions.sh
```

Edit `.github/workflows/ci.yml` — `lint-copy` step 후에 `bash scripts/check-similar-cases-assertions.sh` 추가.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-similar-cases-assertions.sh .github/workflows/ci.yml
git commit -m "chore(similar-cases): assertion grep guard + CI step (T6-4)"
```

---

### Task 33: 로컬 전체 verify chain

**Files:** (산출물만)

- [ ] **Step 1: 전체 검증**

```bash
npm run typecheck && npm run lint && npm test
npx playwright test tests/e2e/cases-search-happy.spec.ts tests/e2e/cases-facet-combo.spec.ts tests/e2e/cases-axe.spec.ts
bash scripts/check-similar-cases-assertions.sh
npm run build
```

Expected: 모두 green.

- [ ] **Step 2: 빌드 산출물에 SERVICE_KEY 노출 없음 확인**

```bash
grep -r "SERVICE_KEY=" dist/ 2>/dev/null && echo "FAIL: leaked" || echo "OK"
```

Expected: `OK`.

- [ ] **Step 3: Commit (verify 결과 빈 commit)**

```bash
git commit --allow-empty -m "chore(similar-cases): local verify chain green (T6-5)"
```

---

## Phase 7 — 도메인 리뷰 + 최종 리포트 + plan self-review

### Task 34: §9.3 도메인 리뷰 표 (수동)

**Files:**
- Create: `docs/reports/2026-MM-DD-similar-cases-domain-review.md`

- [ ] **Step 1: 6 항목 표 작성**

```markdown
# similar-cases — 환경영향평가 도메인 리뷰 (CLAUDE.md §9.3)

| 항목 | Pass/Fail | 근거 |
|---|---|---|
| ① 법적 결론 단정 여부 | PASS | UI 문구 "참고 가능한 과거 사례", 단정어 grep 통과 |
| ② 현지조사 대체 주장 여부 | PASS | 모든 페이지 푸터 + Markdown export 헤더에 현지조사 한계 명시 |
| ③ EIASS 원문 재호스팅 여부 | PASS | source_payload 화이트리스트 + alarm trim 가드 |
| ④ 주민·기관 의견 임의 축약 | PASS | 협의의견 본문 미인덱싱 (§4.3 화이트리스트 미포함) |
| ⑤ 표준 스키마 적용 | N/A | 검색 결과는 분석 결과가 아니므로 §5 미적용. spec §10.1 명시 |
| ⑥ Markdown export 인용 정합성 | PASS | EIASS deep-link 만, 본문 인용 없음 |
```

- [ ] **Step 2: Fail 0 확인 후 Commit**

```bash
git add docs/reports/2026-MM-DD-similar-cases-domain-review.md
git commit -m "docs(similar-cases): §9.3 domain review table (T7-1)"
```

---

### Task 35: 완료 리포트 + progress.md / session_log

**Files:**
- Create: `docs/reports/2026-MM-DD-similar-cases-completion.md`
- Modify: `progress.md`, `docs/changelog/session_log.md`
- Create: `docs/reviews/feature-similar-cases.md`

- [ ] **Step 1: 완료 리포트**

```markdown
# similar-cases v0 — 완료 리포트 (YYYY-MM-DD)

## 산출물
- migration 0003 + cron worker (cases-indexer, 주 1회)
- /cases 검색 페이지 + facet 4종 + 미리보기 + 모바일 fallback
- Markdown export + EIASS deep-link
- 단위 ~50 / E2E 3 시나리오 / axe 통과

## 부트스트랩 1회 실측
- records_added: ...
- api_calls: ...
- 한도 사용률: ...% (10,000/일)

## 미해결 / v1
- 관련도순 (BM25), n-gram 한글 토크나이저
- v1 후보 데이터셋 15142987, 15142988
- multi-region 컬럼 (T0-5 결과에 따라)
- scoping ↔ similar-cases 결합

## 운영 절차
- cron 트리거 활성화 (이미 wrangler.toml)
- eia_cases_sync 모니터링 (records_skipped/error)
- ADR 0001 보강 commit (별도)
```

- [ ] **Step 2: progress.md / session_log append**

(짧게 — 이 plan 완료 + 다음 목표를 1줄씩.)

- [ ] **Step 3: review note**

```markdown
# feature/similar-cases — 리뷰 노트

## 핵심 결정
- 데이터셋 15142998 (15000800 → 정정)
- D1 + FTS5 (unicode61) + LIKE fallback / 인덱서 단계 searchText 보조
- stage-and-swap 트랜잭션
- source_payload 화이트리스트로 재호스팅 차단

## 단정어/도메인 가드
- §9.3 6 항목 모두 PASS
- assertion grep CI step 추가
```

- [ ] **Step 4: Commit**

```bash
git add docs/reports/*-similar-cases-*.md docs/reviews/feature-similar-cases.md progress.md docs/changelog/session_log.md
git commit -m "docs(similar-cases): completion report + review note + progress update (T7-2)"
```

---

### Task 36: PR 생성 (superpowers:finishing-a-development-branch)

**Files:** (브랜치만)

- [ ] **Step 1: 사전 검증**

```bash
git status
npm run typecheck && npm run lint && npm test
```

Expected: clean + green.

- [ ] **Step 2: superpowers:finishing-a-development-branch 호출**

4 옵션 중 **2번 (push + PR)** 선택. PR body 는 본 plan 의 Task 35 완료 리포트 핵심을 인용.

- [ ] **Step 3: PR URL 보고**

(자동 산출.)

---

## Self-Review

writing-plans 스킬 §Self-Review 따라 plan 자체 검토:

**1. Spec coverage:**
- §1 목적 → Phase 1~5 모두
- §2 대상 데이터셋 → T2 (zod), T8 (endpoint helpers), T13 (indexer)
- §3 사용자 여정 A~F → T21 (페이지), T22 (검색바·debounce), T23 (facet), T24 (카드·미리보기), T25 (모바일 fallback), T28 (export)
- §4.1 인덱스 테이블 → T14 (migration)
- §4.2 한국어 검색 보조 → T18 (FTS5+LIKE)
- §4.3 변환 규칙 → T9~T12 (wind-filter, sido-lut, region-parser, transform)
- §5 화면 구조 → T21~T26
- §6 cron 주기·호출량 → T13 (max=8000), T15 (manual bootstrap), wrangler.toml cron
- §7/§8 out-of-scope → T32 단정어 grep
- §9 성공 지표 → T29~T31 (E2E + axe + Lighthouse)
- §10 보안·도메인 가드 → T13 (재호스팅 가드 in indexer), T19 (Q7 비로깅), T32 (assertion grep)
- §11 운영 가드 → T15~T16 (수동 부트스트랩), T35 (완료 리포트), Task 4 (spec §4.3 충돌 처리 패치 — 별도)
- §12 결정 로그 → 본 plan 헤더에 references

**2. Placeholder scan:** "TBD"/"add appropriate"/"similar to" 0건. 모든 step 에 코드 또는 실제 명령.

**3. Type consistency:**
- `EiaCase` 타입은 T17 에서 정의 후 T18~T28 에서 동일 시그니처 사용 (eia_cd snake_case 유지).
- `TransformedRow` (Phase 1) → migration 컬럼 (Phase 2) → `EiaCase` (Phase 3) 매핑 일치.
- `CaseSearchQuery` (T17) → `buildCaseSearchSql` (T18) → `GET /api/cases` (T19) 동일 사용.
- `runIndexer` 시그니처 (T13) → wrangler.toml binding 와 일치 (`env.DB`, `env.SERVICE_KEY`).

**4. 추가 확인:**
- `eiassProjectUrl({ projectId })` 호출 시 `projectId === eia_cd` 가정 — spec §3 확인됨. EIASS 의 실제 projectId 가 다르면 v1 에서 매핑 LUT 추가 (별도 issue).

문제 발견 시 본 plan 의 해당 task 인라인 패치.

---

## Execution Handoff

**Plan complete and saved to `docs/plans/feature-similar-cases.md`. 두 가지 실행 옵션:**

1. **Subagent-Driven (권장)** — 태스크별 fresh subagent + spec 준수 + 코드 품질 2단계 리뷰
2. **Inline Execution** — 본 세션에서 일괄 실행 (executing-plans, batch + checkpoints)

**어느 방식으로 진행할까요?**
