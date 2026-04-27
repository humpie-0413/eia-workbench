# feature/similar-cases — P1 detail API 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영 중인 `eia_cases` 테이블의 `evaluation_stage='unknown'` / `region_sido=NULL` 결손을 data.go.kr 15142987 Ing detail API 통합 (`getDscssSttusDscssIngDetailInfoInqire`) + biz_nm regex 기반 region fallback 으로 해소한다.

**Architecture:** Vertical modular 5 신규 파일 + 6 수정 파일. TDD RED → GREEN, Phase 단위 commit. detail 호출 실패는 retry 1 + list-only fallback (graceful degradation). region 매칭은 광역시 우선 → 시·군·구 LUT first match. PII (CCM 담당자) 호출 자체 회피 (Opinion detail 미사용).

**Tech Stack:** TypeScript strict, Vitest, Cloudflare Workers + D1, Zod schema, biz_nm regex (한글 어두/어말 경계 lookbehind), JSON LUT.

**Spec:** `docs/design/feature-similar-cases.md` §2 / §4.3 / §4.4 / §6 / §10.4 / §11 / §12.1 (P1 patch).

**Worktree:** `feature/cases-detail-api-integration` (using-git-worktrees skill 활성). `../eia-workbench-cases-detail/`.

**Pre-existing failures (CLAUDE.md §10.1 자동 격리):**
- `better-sqlite3` native build 실패는 본 작업과 import 관계 없으므로 격리. typecheck / 관련 vitest 만 PASS 면 검증 OK.
- 본 작업이 변경한 파일에 한정한 typecheck / 관련 test 가 PASS 면 검증 OK 로 간주.

**Phase 통과 기준 (모든 Phase 공통)**:
- ✅ `npm test -- src/features/similar-cases workers/cases-indexer` 관련 테스트 그린
- ✅ `npm run typecheck` 그린 (better-sqlite3 격리 후)
- ✅ `npm run lint` 그린
- ✅ 단정 표현 grep (`/협의 통과|승인됨|법적으로 문제없음/`) 0 결과 (CLAUDE.md §9.2)

**handover doc 신설 위치**: `docs/handover/2026-04-26-cases-detail-deployed.md` (Phase 5b 작성).

---

## File Structure

### 신규 5 파일 (Vertical modular)

| Path | 책임 | 의존성 |
|------|------|--------|
| `data/region/sigungu-lut.json` | 시·군·구 어근 → sido/sidoCode/sigungu LUT 데이터 (6 entry minimum) | — |
| `src/features/similar-cases/sigungu-parser.ts` | `bizNm` regex 토큰 추출 + 광역시 우선 + LUT first match | `sido-lut.ts`, `sigungu-lut.json` |
| `src/features/similar-cases/sigungu-parser.test.ts` | sigungu-parser unit tests (TDD) | `sigungu-parser.ts` |
| `src/features/similar-cases/evaluation-stage-mapper.ts` | Ing detail items[] sort + stateNm 패턴 매핑 | — |
| `src/features/similar-cases/evaluation-stage-mapper.test.ts` | mapper unit tests (TDD) | `evaluation-stage-mapper.ts` |

### 수정 6 파일

| Path | 변경 내용 |
|------|----------|
| `packages/eia-data/src/types/discussion.ts` | Ing detail item zod (`dscssIngDetailItemSchema`) + envelope schema + `ingDetail` operation |
| `packages/eia-data/src/endpoints/discussion.ts` | `buildDscssIngDetailPath()` 추가 |
| `src/features/similar-cases/transform.ts` | `DscssTransformInput` 에 `detailItems?: DscssIngDetailItem[]` 추가, region/stage 통합 |
| `src/features/similar-cases/transform.test.ts` | Ing detail merge / empty fallback 케이스 추가 |
| `src/features/similar-cases/payload-whitelist.ts` | Ing detail 필드 (`stateNm, resReplyDt, applyDt`) + region 매칭 결과 (`matched_token, matched_sido, matched_sigungu`) 화이트리스트 확장 |
| `src/features/similar-cases/payload-whitelist.test.ts` | 새 화이트리스트 항목 + PII (`ccilMemEmail, ccilMemNm`) 제외 검증 케이스 추가 |
| `workers/cases-indexer.ts` | Ing detail fetch (retry 1 + list-only fallback), 카운터 (`detail_called/success/retry/failed/region_matched/region_unmatched`) |
| `workers/cases-indexer.test.ts` | Ing detail success / retry / fallback / empty items 케이스 추가 |

### Migration

**불요** (확인됨). `migrations/0004_relax_cases_constraints.sql` 의 CHECK 가 이미 `evaluation_stage IN ('본안','전략','unknown')` 허용. region_sido/sigungu/sidoCode 모두 nullable.

---

## Phase 0 — TDD RED (테스트 먼저)

### Task 0.1: Worktree 생성 + 작업 브랜치

**Files:**
- Create: `../eia-workbench-cases-detail/` (worktree)

- [ ] **Step 1: Worktree 생성**

```bash
cd C:/0_project/eia-workbench
git worktree add ../eia-workbench-cases-detail -b feature/cases-detail-api-integration
cd ../eia-workbench-cases-detail
```

Expected: `Preparing worktree... HEAD is now at <sha> ...` + `Switched to a new branch 'feature/cases-detail-api-integration'`.

- [ ] **Step 2: 의존성 설치 (사전 결함 격리 확인)**

Run: `npm ci`
Expected: 정상 설치 또는 better-sqlite3 빌드 경고 (격리 대상, §10.1).

`npm test 2>&1 | head -100` 으로 baseline failure 캡처:
```
better-sqlite3 관련 실패 N건 → 본 작업과 import 관계 없음, 격리.
src/features/similar-cases/* 관련 PASS 갯수 N건 → 본 작업의 검증 baseline.
```

- [ ] **Step 3: Commit 없음 (worktree setup)**

Plan 안에서 worktree 자체는 commit 안 함. Phase 0 step 부터 commit 시작.

---

### Task 0.2: sigungu-parser RED test

**Files:**
- Create: `src/features/similar-cases/sigungu-parser.test.ts`

- [ ] **Step 1: RED test 작성**

```typescript
// src/features/similar-cases/sigungu-parser.test.ts
import { describe, it, expect } from 'vitest';
import { deriveRegionFromBizNm } from './sigungu-parser';

describe('deriveRegionFromBizNm', () => {
  it('returns null result when no region token', () => {
    const r = deriveRegionFromBizNm('영양풍력단지'.replace('영양', '연천')); // '연천풍력단지' (LUT 미등록)
    expect(r.matched_sido).toBeNull();
    expect(r.matched_sigungu).toBeNull();
    expect(r.matched_token).toBeNull();
  });

  it('matches sigungu LUT entry from bizNm 어근', () => {
    const r = deriveRegionFromBizNm('영양풍력발전단지');
    expect(r.matched_sido).toBe('경상북도');
    expect(r.matched_sigungu).toBe('영양군');
    expect(r.matched_token).toBe('영양');
    expect(r.sidoCode).toBe('47');
  });

  it('matches with explicit 군 suffix in bizNm', () => {
    const r = deriveRegionFromBizNm('의성군 황학산 풍력');
    expect(r.matched_sigungu).toBe('의성군');
    expect(r.matched_sido).toBe('경상북도');
  });

  it('광역시 우선 — 광역시 토큰이 시·군·구 LUT 보다 우선', () => {
    const r = deriveRegionFromBizNm('서울특별시 강서구 풍력 영양 시범');
    expect(r.matched_sido).toBe('서울');
    expect(r.matched_sigungu).toBeNull();
    expect(r.matched_token).toBe('서울');
  });

  it('어두/어말 경계 — "광주광역시" 의 "광주" 만 광역시 매치', () => {
    const r = deriveRegionFromBizNm('광주광역시 풍력 시범');
    expect(r.matched_sido).toBe('광주');
  });

  it('multiple sigungu tokens — first match only', () => {
    const r = deriveRegionFromBizNm('의성 청송 풍력');
    expect(r.matched_token).toBe('의성');
    expect(r.matched_sigungu).toBe('의성군');
  });

  it('LUT 미등록 토큰은 무시, 다음 토큰 시도', () => {
    const r = deriveRegionFromBizNm('연천 영양 풍력'); // 연천 미등록 → 영양 LUT 매치
    expect(r.matched_token).toBe('영양');
  });
});
```

- [ ] **Step 2: Run test, verify RED**

Run: `npx vitest run src/features/similar-cases/sigungu-parser.test.ts`
Expected: FAIL with "Cannot find module './sigungu-parser'".

---

### Task 0.3: evaluation-stage-mapper RED test

**Files:**
- Create: `src/features/similar-cases/evaluation-stage-mapper.test.ts`

- [ ] **Step 1: RED test 작성**

```typescript
// src/features/similar-cases/evaluation-stage-mapper.test.ts
import { describe, it, expect } from 'vitest';
import { mapEvaluationStage } from './evaluation-stage-mapper';

describe('mapEvaluationStage', () => {
  it('빈 items 배열 → unknown', () => {
    expect(mapEvaluationStage([])).toBe('unknown');
  });

  it('undefined → unknown (defensive)', () => {
    expect(mapEvaluationStage(undefined)).toBe('unknown');
  });

  it('stateNm "전략환경영향평가" → 전략', () => {
    expect(mapEvaluationStage([{ stateNm: '전략환경영향평가', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }])).toBe('전략');
  });

  it('stateNm "1차 협의" → 본안', () => {
    expect(mapEvaluationStage([{ stateNm: '1차 협의', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }])).toBe('본안');
  });

  it('stateNm "변경협의" → 본안', () => {
    expect(mapEvaluationStage([{ stateNm: '변경협의', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }])).toBe('본안');
  });

  it('stateNm "협의" (정확 일치) → 본안', () => {
    expect(mapEvaluationStage([{ stateNm: '협의', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }])).toBe('본안');
  });

  it('stateNm "소규모환경영향평가" → unknown', () => {
    expect(mapEvaluationStage([{ stateNm: '소규모환경영향평가', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }])).toBe('unknown');
  });

  it('정렬 — resReplyDt DESC 우선, items[0] 기준 매핑', () => {
    const result = mapEvaluationStage([
      { stateNm: '소규모', resReplyDt: '2024-01-01', applyDt: '2024-01-01' },
      { stateNm: '전략', resReplyDt: '2025-06-01', applyDt: '2024-01-01' }
    ]);
    expect(result).toBe('전략'); // resReplyDt 2025-06-01 가 더 최신 → first
  });

  it('정렬 — resReplyDt 동일 시 applyDt DESC fallback', () => {
    const result = mapEvaluationStage([
      { stateNm: '소규모', resReplyDt: '2024-01-01', applyDt: '2024-01-01' },
      { stateNm: '협의', resReplyDt: '2024-01-01', applyDt: '2025-06-01' }
    ]);
    expect(result).toBe('본안');
  });

  it('정렬 — 둘 다 동일 시 API order (배열 순서) 첫째', () => {
    const result = mapEvaluationStage([
      { stateNm: '협의', resReplyDt: '2024-01-01', applyDt: '2024-01-01' },
      { stateNm: '전략', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }
    ]);
    expect(result).toBe('본안');
  });
});
```

- [ ] **Step 2: Run test, verify RED**

Run: `npx vitest run src/features/similar-cases/evaluation-stage-mapper.test.ts`
Expected: FAIL with "Cannot find module './evaluation-stage-mapper'".

---

### Task 0.4: payload-whitelist 확장 RED test

**Files:**
- Modify: `src/features/similar-cases/payload-whitelist.test.ts`

- [ ] **Step 1: 기존 test 파일에 추가 케이스**

`payload-whitelist.test.ts` 의 끝부분에 추가:

```typescript
describe('payload-whitelist — Ing detail 확장 (P1)', () => {
  it('Ing detail 필드 (stateNm/resReplyDt/applyDt) 화이트리스트 통과', () => {
    const out = pickPayload({
      eiaCd: 'X-1',
      stateNm: '1차 협의',
      resReplyDt: '2024-01-01',
      applyDt: '2024-01-01',
      bizNm: '영양풍력'
    });
    expect(out.stateNm).toBe('1차 협의');
    expect(out.resReplyDt).toBe('2024-01-01');
    expect(out.applyDt).toBe('2024-01-01');
  });

  it('region 매칭 결과 (matched_token/matched_sido/matched_sigungu) 화이트리스트 통과', () => {
    const out = pickPayload({
      eiaCd: 'X-1',
      bizNm: '영양풍력',
      matched_token: '영양',
      matched_sido: '경상북도',
      matched_sigungu: '영양군'
    });
    expect(out.matched_token).toBe('영양');
    expect(out.matched_sido).toBe('경상북도');
    expect(out.matched_sigungu).toBe('영양군');
  });

  it('PII 필드 (ccilMemEmail/ccilMemNm) 화이트리스트 미통과 (BLOCKING)', () => {
    const out = pickPayload({
      eiaCd: 'X-1',
      bizNm: '영양풍력',
      ccilMemEmail: 'leak@example.com',
      ccilMemNm: '홍길동'
    });
    expect(out.ccilMemEmail).toBeUndefined();
    expect(out.ccilMemNm).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test, verify RED**

Run: `npx vitest run src/features/similar-cases/payload-whitelist.test.ts`
Expected: 새 3 케이스 FAIL — `stateNm` 등이 화이트리스트에 없어 omit.

---

### Task 0.5: transform.ts Ing detail merge RED test

**Files:**
- Modify: `src/features/similar-cases/transform.test.ts`

- [ ] **Step 1: 기존 transformDscssItem describe 에 추가 케이스**

`describe('transformDscssItem (15142987 list-only)', () => { ... })` 안에 추가:

```typescript
  it('P1 — Ing detail merge: stateNm "1차 협의" → 본안 + region 영양 LUT 매치', () => {
    const r = transformDscssItem({
      list: { eiaCd: 'DG2009L001', bizNm: '영양풍력발전단지 건설사업' },
      detailItems: [{ stateNm: '1차 협의', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }]
    }) as TransformedRow;
    expect(r.evaluation_stage).toBe('본안');
    expect(r.region_sido).toBe('경상북도');
    expect(r.region_sido_code).toBe('47');
    expect(r.region_sigungu).toBe('영양군');
    const pl = JSON.parse(r.source_payload);
    expect(pl.stateNm).toBe('1차 협의');
    expect(pl.matched_token).toBe('영양');
  });

  it('P1 — detailItems empty → list-only fallback (stage unknown, region from bizNm)', () => {
    const r = transformDscssItem({
      list: { eiaCd: 'DG2018C001', bizNm: '풍백 풍력발전단지 조성사업' }, // LUT 미등록 토큰
      detailItems: []
    }) as TransformedRow;
    expect(r.evaluation_stage).toBe('unknown');
    expect(r.region_sido).toBeNull();
    expect(r.region_sigungu).toBeNull();
  });

  it('P1 — detailItems undefined (call 실패 fallback) → unknown + region 시도', () => {
    const r = transformDscssItem({
      list: { eiaCd: 'GW2025C001', bizNm: '양양 내현풍력발전단지' },
      detailItems: undefined
    }) as TransformedRow;
    expect(r.evaluation_stage).toBe('unknown');
    expect(r.region_sido).toBe('강원도');
    expect(r.region_sigungu).toBe('양양군');
  });

  it('P1 — Ing detail "전략환경영향평가" → 전략', () => {
    const r = transformDscssItem({
      list: { eiaCd: 'X-1', bizNm: '강릉풍력' },
      detailItems: [{ stateNm: '전략환경영향평가', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }]
    }) as TransformedRow;
    expect(r.evaluation_stage).toBe('전략');
  });
```

- [ ] **Step 2: Run test, verify RED**

Run: `npx vitest run src/features/similar-cases/transform.test.ts`
Expected: 새 4 케이스 FAIL — `DscssTransformInput` 에 `detailItems` 가 없고 region/stage 매핑 미구현.

---

### Task 0.6: cases-indexer Ing detail RED test

**Files:**
- Modify: `workers/cases-indexer.test.ts`

- [ ] **Step 1: 기존 test 파일 확인 후 새 describe 추가**

기존 mock 패턴 (`vi.stubGlobal('fetch', ...)` + `makeD1()`) 그대로 활용. URL 패턴으로 list / ingDetail 응답을 분기:

```typescript
// describe('cases-indexer (15142987 discussion list)') 아래에 새 describe 추가
describe('runIndexer — P1 Ing detail integration', () => {
  function listResp(items: Array<Record<string, unknown>>) {
    return {
      response: {
        header: { resultCode: '00', resultMsg: 'OK' },
        body: { totalCount: items.length, pageNo: 1, numOfRows: 100, items: { item: items } }
      }
    };
  }
  function ingDetailResp(items: Array<Record<string, unknown>>) {
    return {
      response: {
        header: { resultCode: '00', resultMsg: 'OK' },
        body: items.length === 0
          ? { totalCount: 0, items: '' }
          : { totalCount: items.length, items: { item: items } }
      }
    };
  }
  function urlIs(url: string, op: 'list' | 'ingDetail'): boolean {
    if (op === 'list') return /getDscssBsnsListInfoInqire/.test(url);
    return /getDscssSttusDscssIngDetailInfoInqire/.test(url);
  }

  it('Ing detail success → detail_called/success/region_matched 카운트', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const body = urlIs(url, 'list')
        ? listResp([{ eiaCd: 'DG2009L001', bizNm: '영양풍력발전단지', eiaSeq: 1 }])
        : ingDetailResp([{ stateNm: '1차 협의', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }]);
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }));
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000,
      maxPagesPerQuery: 1
    });
    expect(summary.detail_called).toBe(1);
    expect(summary.detail_success).toBe(1);
    expect(summary.region_matched).toBe(1);
  });

  it('Ing detail HTTP fail 1회 → retry → success', async () => {
    let detailAttempt = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (urlIs(url, 'list')) {
        return Promise.resolve(new Response(JSON.stringify(listResp([{ eiaCd: 'X-1', bizNm: '영양풍력' }])), { status: 200 }));
      }
      detailAttempt++;
      if (detailAttempt === 1) {
        return Promise.resolve(new Response('boom', { status: 500 }));
      }
      return Promise.resolve(new Response(JSON.stringify(ingDetailResp([{ stateNm: '협의', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }])), { status: 200 }));
    }));
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000,
      maxPagesPerQuery: 1
    });
    expect(summary.detail_retry).toBe(1);
    expect(summary.detail_success).toBe(1);
  });

  it('Ing detail 모두 fail (retry 후도) → list-only fallback (no error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (urlIs(url, 'list')) {
        return Promise.resolve(new Response(JSON.stringify(listResp([{ eiaCd: 'X-1', bizNm: '영양풍력' }])), { status: 200 }));
      }
      return Promise.resolve(new Response('boom', { status: 500 }));
    }));
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000,
      maxPagesPerQuery: 1
    });
    expect(summary.detail_failed).toBe(1);
    expect(summary.error).toBeNull();
    expect(summary.records_added).toBe(1); // list-only fallback 적재
  });

  it('Ing detail empty items (totalCount=0) → list-only fallback (정상 흐름)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const body = urlIs(url, 'list')
        ? listResp([{ eiaCd: 'X-1', bizNm: '영양풍력' }])
        : ingDetailResp([]);
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }));
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000,
      maxPagesPerQuery: 1
    });
    expect(summary.detail_called).toBe(1);
    expect(summary.detail_success).toBe(1); // empty items 도 success 로 카운트 (정상 흐름)
    expect(summary.records_added).toBe(1);
  });
});
```

> **참고**: 기존 test 의 `makeD1()` / `vi.stubGlobal('fetch', ...)` 헬퍼를 그대로 활용. `client` 주입은 Phase 3 task 3.1 step 4 에서 별도로 추가하지만, 본 RED test 는 fetch mock 만으로 충분.

- [ ] **Step 2: Run test, verify RED**

Run: `npx vitest run workers/cases-indexer.test.ts`
Expected: 새 4 케이스 FAIL — `summary.detail_*` / `region_matched` 필드가 IndexerSummary 에 없어 `expect(summary.detail_called).toBe(1)` 실패.

---

### Task 0.7: Phase 0 commit (RED)

- [ ] **Step 0: RED test 사유 검증 (commit 전)**

```bash
npx vitest run src/features/similar-cases/sigungu-parser.test.ts src/features/similar-cases/evaluation-stage-mapper.test.ts src/features/similar-cases/payload-whitelist.test.ts src/features/similar-cases/transform.test.ts workers/cases-indexer.test.ts 2>&1 | tail -80
```

**모든 fail 이 다음 두 패턴 중 하나임을 확인:**

1. **Module not found** (sigungu-parser / evaluation-stage-mapper 신규 파일)
   - `Failed to resolve import "./sigungu-parser"` 또는
   - `Cannot find module './evaluation-stage-mapper'`

2. **Assertion failure** (transform / payload-whitelist / cases-indexer 기존 파일에 새 케이스 추가)
   - `expected undefined to be '본안'` (mapper 미구현)
   - `expected undefined to be '경상북도'` (region-parser 미구현)
   - `expected undefined to be 1` (`detail_called` 카운터 미존재)
   - `expected '1차 협의' to be undefined` 의 역 — payload 화이트리스트 미확장

**다음 사유는 Phase 0 commit 거부 + 사용자 보고:**

- TypeScript compile error (`TS2305` / `TS2307`) → import 경로 오타 가능 (예: `./sigungu-parser` 대신 `../sigungu-parser`).
- Parse / Syntax error (`SyntaxError`) → test 코드 자체 결함.
- Test runner config error (vitest.config.ts) → infra 결함.
- 기존 케이스 (Phase 0 이전부터 GREEN 이던 것) 가 fail → regression. RED test 가 기존 코드 깨뜨림. 격리 후 재작성.

> **stop gate**: 위 거부 사유 발견 시 commit 하지 말고 사용자 보고 + RED test 재작성 후 step 0 부터 재실행.

- [ ] **Step 1: Stage RED test files**

```bash
git add src/features/similar-cases/sigungu-parser.test.ts
git add src/features/similar-cases/evaluation-stage-mapper.test.ts
git add src/features/similar-cases/payload-whitelist.test.ts
git add src/features/similar-cases/transform.test.ts
git add workers/cases-indexer.test.ts
```

- [ ] **Step 2: Commit (test only)**

```bash
git commit -m "$(cat <<'EOF'
test(cases): add RED tests for P1 Ing detail integration

- sigungu-parser: 광역시 우선 + LUT first match + 어두/어말 경계 (7 case)
- evaluation-stage-mapper: stateNm 5단계 + 정렬 후 first (10 case)
- payload-whitelist: Ing detail 필드 + region 매칭 결과 + PII 제외 (3 case)
- transform: Ing detail merge / empty fallback / 전략 매핑 (4 case)
- cases-indexer: detail success / retry / fallback / empty items (4 case)

Phase 0 RED: spec docs/design/feature-similar-cases.md §11.1.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit success. `npm test` baseline failure 재확인.

---

## Phase 1 — sigungu-lut + sigungu-parser GREEN

### Task 1.1: sigungu-lut.json 작성

**Files:**
- Create: `data/region/sigungu-lut.json`

- [ ] **Step 1: 디렉터리 생성 + LUT JSON 작성**

```bash
mkdir -p data/region
```

Write `data/region/sigungu-lut.json`:

```json
{
  "영양": { "sido": "경상북도", "sidoCode": "47", "sigungu": "영양군" },
  "강릉": { "sido": "강원도",   "sidoCode": "51", "sigungu": "강릉시" },
  "의성": { "sido": "경상북도", "sidoCode": "47", "sigungu": "의성군" },
  "청송": { "sido": "경상북도", "sidoCode": "47", "sigungu": "청송군" },
  "삼척": { "sido": "강원도",   "sidoCode": "51", "sigungu": "삼척시" },
  "양양": { "sido": "강원도",   "sidoCode": "51", "sigungu": "양양군" }
}
```

> **주의**: `sidoCode` 는 `src/features/similar-cases/sido-lut.ts` 의 KOSTAT 코드 (강원 51, 경북 47) 와 일치 확인 후 확정. 강원도는 2023-06 이후 `'51'` (강원특별자치도). 경상북도는 `'47'`.

- [ ] **Step 1.5: KOSTAT 통계청 공식 코드 사전 검증**

KOSIS / 행정안전부 행정구역 코드 (2자리 시·도) 공식 출처 확인:

- **강원특별자치도**: 2023-06-11 출범 후 코드 `'51'` (이전 강원도 `'42'`).
  - 출처: 행정안전부 "강원특별자치도 설치 등에 관한 특별법" 시행, 통계청 행정구역코드 5단계.
  - URL 참조: https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1B040A3 (통계청 KOSIS 행정구역별)
- **경상북도**: `'47'` (불변).
- **전북특별자치도**: 2024-01-18 출범 후 코드 `'52'` (이전 전북 `'45'`). 본 P1 LUT 6 entry 에는 무관하지만 future entry 추가 시 주의.

> **검증 방법** (사용자가 의심 시): https://www.code.go.kr/ 또는 https://kostat.go.kr 의 통계분류포털 → 행정구역분류 → 시도 (2자리) 다운로드 후 비교.

- [ ] **Step 2: 기존 sido-lut.ts 와 일치 확인**

```bash
grep -E "(강원|경북)" src/features/similar-cases/sido-lut.ts
```

Expected:
```
{ short: '강원', label: '강원특별자치도', code: '51' },
{ short: '경북', label: '경상북도', code: '47' },
```

→ `sigungu-lut.json` 의 `sidoCode` 가 `sido-lut.ts` (Step 1.5 KOSTAT 출처와도 일치 확인 완료) 와 일치. 미일치 시 `sido-lut.ts` 자체에 사전 결함 가능 (별도 hotfix issue 분리, §10.1).

---

### Task 1.2: sigungu-parser.ts 구현

**Files:**
- Create: `src/features/similar-cases/sigungu-parser.ts`

- [ ] **Step 1: 구현**

```typescript
// src/features/similar-cases/sigungu-parser.ts
import lut from '../../../data/region/sigungu-lut.json';
import { sidoLabel, sidoCode } from './sido-lut';

const METRO = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종'] as const;
type MetroShort = (typeof METRO)[number];

// 한글 어두/어말 경계 lookbehind/lookahead — '광역시'·'자치구' 잡음 분해 차단
const SIGUNGU_TOKEN = /(?<![가-힣])(\S+?(?:시|군|구))(?![가-힣])/g;

export interface RegionResult {
  matched_sido: string | null;     // sido label (e.g. '경상북도', '서울')
  sidoCode: string | null;          // KOSTAT 2자리
  matched_sigungu: string | null;   // sigungu label (e.g. '영양군')
  matched_token: string | null;     // 매칭에 사용된 원 토큰
}

const NULL_RESULT: RegionResult = {
  matched_sido: null,
  sidoCode: null,
  matched_sigungu: null,
  matched_token: null
};

export function deriveRegionFromBizNm(bizNm: string): RegionResult {
  // 1. 광역시 토큰 우선
  for (const metro of METRO) {
    if (bizNm.includes(metro)) {
      return {
        matched_sido: metro,
        sidoCode: sidoCode(metro),
        matched_sigungu: null,
        matched_token: metro
      };
    }
  }
  // 2. 시·군·구 LUT 첫 매치 (suffix 포함된 토큰)
  const tokens = [...bizNm.matchAll(SIGUNGU_TOKEN)].map((m) => m[1] ?? '');
  const lutMap = lut as Record<string, { sido: string; sidoCode: string; sigungu: string }>;
  for (const token of tokens) {
    const stem = token.replace(/(시|군|구)$/, '');
    const entry = lutMap[stem];
    if (entry) {
      return {
        matched_sido: entry.sido,
        sidoCode: entry.sidoCode,
        matched_sigungu: entry.sigungu,
        matched_token: token
      };
    }
  }
  // 2.5. (P1 보강) LUT 어근 substring 매치 — suffix 없는 어근만 있는 bizNm 대응
  //      운영 풍력 10건 모두 어근 only ('영양풍력', '강릉 안인풍력' 등). spec §4.4.4 step 2.5.
  for (const stem of Object.keys(lutMap)) {
    if (bizNm.includes(stem)) {
      const entry = lutMap[stem]!;
      return {
        matched_sido: entry.sido,
        sidoCode: entry.sidoCode,
        matched_sigungu: entry.sigungu,
        matched_token: stem // 어근 그대로 (suffix 없음)
      };
    }
  }
  // 3. 매칭 실패
  return NULL_RESULT;
}
```

- [ ] **Step 2: tsconfig — JSON import 허용 확인**

```bash
grep resolveJsonModule tsconfig.json
```

If 미설정 → `tsconfig.json` 의 `compilerOptions` 에 `"resolveJsonModule": true` 추가 (이미 있을 가능성 큼; 미설정 시 에러로 알게 됨).

- [ ] **Step 3: Run test, verify GREEN**

Run: `npx vitest run src/features/similar-cases/sigungu-parser.test.ts`
Expected: PASS (8 케이스 — 어근-only 운영 데이터 패턴 RED 포함).

- [ ] **Step 4: typecheck**

Run: `npm run typecheck`
Expected: 본 작업 변경 파일 관련 에러 0건 (better-sqlite3 격리 외).

- [ ] **Step 5: Commit**

```bash
git add data/region/sigungu-lut.json src/features/similar-cases/sigungu-parser.ts
git commit -m "$(cat <<'EOF'
feat(cases): add sigungu LUT + bizNm region parser with substring fallback (P1)

- data/region/sigungu-lut.json: 6 entry (영양/강릉/의성/청송/삼척/양양)
- sigungu-parser.ts: 광역시 우선 + LUT suffix match + 어근 substring fallback
- 운영 풍력 10건 모두 어근 only 패턴 (cases-2026-04-26.md) 대응
- sidoCode sido-lut.ts (강원 51, 경북 47) 와 일치 확인

spec §4.4 / Phase 1 GREEN.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Ing detail zod + evaluation-stage-mapper + transform GREEN

### Task 2.1: Ing detail zod schema + endpoint

**Files:**
- Modify: `packages/eia-data/src/types/discussion.ts`
- Modify: `packages/eia-data/src/endpoints/discussion.ts`

- [ ] **Step 1: types/discussion.ts 확장**

`packages/eia-data/src/types/discussion.ts` 의 끝에 추가:

```typescript
// === Ing detail (15142987) — eiaCd 기반 ===
// 응답 envelope: response.body.items.item (single | array). totalCount=0 시 items 없음.
export const dscssIngDetailItemSchema = z.object({
  stateNm: z.string(),
  resReplyDt: z.string().optional(),
  applyDt: z.string().optional()
});
export type DscssIngDetailItem = z.infer<typeof dscssIngDetailItemSchema>;

// envelope (data.go.kr 공통 패턴)
export const dscssIngDetailEnvelopeSchema = z.object({
  response: z.object({
    header: z.object({
      resultCode: z.string(),
      resultMsg: z.string()
    }),
    body: z.object({
      items: z
        .union([
          z.object({ item: z.union([z.array(z.unknown()), z.unknown()]) }),
          z.string() // empty body 가 빈 string 으로 오는 케이스 (totalCount=0)
        ])
        .optional(),
      totalCount: z.union([z.string(), z.number()]).optional()
    })
  })
});
```

`DSCSS_STATUS_OPERATIONS` 갱신:

```typescript
export const DSCSS_STATUS_OPERATIONS = {
  list: 'getDscssBsnsListInfoInqire',
  ingDetail: 'getDscssSttusDscssIngDetailInfoInqire'
} as const;
```

- [ ] **Step 2: endpoints/discussion.ts 확장**

`packages/eia-data/src/endpoints/discussion.ts` 의 끝에 추가:

```typescript
export function buildDscssIngDetailPath(): string {
  return `${DSCSS_STATUS_BASE_PATH}/${DSCSS_STATUS_OPERATIONS.ingDetail}`;
}
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: 본 변경 관련 에러 0건.

---

### Task 2.2: evaluation-stage-mapper.ts 구현

**Files:**
- Create: `src/features/similar-cases/evaluation-stage-mapper.ts`

- [ ] **Step 1: 구현**

```typescript
// src/features/similar-cases/evaluation-stage-mapper.ts
import type { DscssIngDetailItem } from '../../../packages/eia-data/src/types/discussion';

export type EvaluationStage = '본안' | '전략' | 'unknown';

function compareDescStr(a?: string, b?: string): number {
  if (a && b) return b.localeCompare(a);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function sortItems(items: DscssIngDetailItem[]): DscssIngDetailItem[] {
  // resReplyDt DESC → applyDt DESC → API order (stable)
  return [...items]
    .map((item, idx) => ({ item, idx }))
    .sort((x, y) => {
      const c1 = compareDescStr(x.item.resReplyDt, y.item.resReplyDt);
      if (c1 !== 0) return c1;
      const c2 = compareDescStr(x.item.applyDt, y.item.applyDt);
      if (c2 !== 0) return c2;
      return x.idx - y.idx;
    })
    .map((w) => w.item);
}

function classify(stateNm: string): EvaluationStage {
  if (stateNm.includes('전략')) return '전략';
  if (stateNm.includes('본안') || stateNm === '협의' || stateNm.includes('변경협의')) return '본안';
  return 'unknown';
}

export function mapEvaluationStage(items: DscssIngDetailItem[] | undefined): EvaluationStage {
  if (!items || items.length === 0) return 'unknown';
  const sorted = sortItems(items);
  const first = sorted[0];
  if (!first) return 'unknown';
  return classify(first.stateNm);
}
```

- [ ] **Step 2: Run test, verify GREEN**

Run: `npx vitest run src/features/similar-cases/evaluation-stage-mapper.test.ts`
Expected: PASS (10 케이스).

- [ ] **Step 3: typecheck + lint**

```bash
npm run typecheck
npm run lint
```

Expected: 본 작업 관련 에러 0건.

---

### Task 2.3: payload-whitelist.ts 확장

**Files:**
- Modify: `src/features/similar-cases/payload-whitelist.ts`

- [ ] **Step 1: PAYLOAD_WHITELIST 확장**

```typescript
// src/features/similar-cases/payload-whitelist.ts
export const PAYLOAD_WHITELIST = [
  'eiaCd',
  'eiaSeq',
  'bizGubunCd',
  'bizGubunNm',
  'bizNm',
  'bizmainNm',
  'approvOrganNm',
  'bizMoney',
  'bizSize',
  'bizSizeDan',
  'drfopTmdt',
  'drfopStartDt',
  'drfopEndDt',
  'eiaAddrTxt',
  // 15142987 (discussion) list 응답 추가 필드
  'ccilOrganNm',
  'stepChangeDt',
  // P1: Ing detail 필드 (2026-04-26)
  'stateNm',
  'resReplyDt',
  'applyDt',
  // P1: region 매칭 결과 (2026-04-26)
  'matched_token',
  'matched_sido',
  'matched_sigungu'
] as const;
// PII (ccilMemEmail, ccilMemNm) 의도적으로 제외 — §10.4 재호스팅 가드.

export type PayloadKey = (typeof PAYLOAD_WHITELIST)[number];

export function pickPayload(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PAYLOAD_WHITELIST) {
    if (item[k] !== undefined) out[k] = item[k];
  }
  return out;
}
```

- [ ] **Step 2: Run test, verify GREEN**

Run: `npx vitest run src/features/similar-cases/payload-whitelist.test.ts`
Expected: PASS (전체 — 새 3 케이스 + 기존).

---

### Task 2.4: transform.ts Ing detail merge

**Files:**
- Modify: `src/features/similar-cases/transform.ts`

- [ ] **Step 1: import + interface 확장**

`transform.ts` 상단 import 에 추가:

```typescript
import { deriveRegionFromBizNm } from './sigungu-parser';
import { mapEvaluationStage } from './evaluation-stage-mapper';
import type { DscssIngDetailItem } from '../../../packages/eia-data/src/types/discussion';
```

`DscssTransformInput` 확장:

```typescript
export interface DscssTransformInput {
  list: Record<string, unknown> & { eiaCd: string; bizNm: string };
  // P1: Ing detail items (sorted by indexer or unsorted, mapper 가 sort).
  // undefined = call 실패 또는 미호출 (list-only fallback).
  detailItems?: DscssIngDetailItem[];
}
```

- [ ] **Step 2: transformDscssItem 본문 갱신**

```typescript
export function transformDscssItem(input: DscssTransformInput): TransformedRow | null {
  const { list, detailItems } = input;
  if (!isOnshoreWindCandidate({ bizNm: list.bizNm })) return null;
  const pk = list.eiaCd;
  if (!pk) return null;
  const seqRaw = list.eiaSeq;
  const bizNm = String(list.bizNm);

  // P1: region from bizNm
  const region = deriveRegionFromBizNm(bizNm);
  // P1: stage from Ing detail items
  const stage = mapEvaluationStage(detailItems);

  // detail items 상위 3건 (정렬 후) 만 payload 화이트리스트 후보로
  const detailHead = (detailItems ?? []).slice(0, 3);

  // payload merge: list + detailHead 화이트리스트 + region 매칭 결과
  const payloadSource: Record<string, unknown> = {
    ...(list as Record<string, unknown>),
    matched_token: region.matched_token,
    matched_sido: region.matched_sido,
    matched_sigungu: region.matched_sigungu
  };
  // detail 의 상위 1건 (mapping 근거) 만 payload 에 포함 (3건 모두 포함은 over-storage)
  if (detailHead[0]) {
    payloadSource.stateNm = detailHead[0].stateNm;
    payloadSource.resReplyDt = detailHead[0].resReplyDt;
    payloadSource.applyDt = detailHead[0].applyDt;
  }
  const payload = pickPayload(payloadSource);

  return {
    eia_cd: pk,
    eia_seq: seqRaw != null ? String(seqRaw) : null,
    biz_gubun_cd: '',
    biz_gubun_nm: '',
    biz_nm: bizNm,
    biz_main_nm: null,
    approv_organ_nm: (list.ccilOrganNm as string | undefined) ?? null,
    biz_money: null,
    biz_size: null,
    biz_size_dan: null,
    drfop_tmdt: null,
    drfop_start_dt: null,
    drfop_end_dt: null,
    eia_addr_txt: null,
    industry: 'onshore_wind',
    region_sido: region.matched_sido,
    region_sido_code: region.sidoCode,
    region_sigungu: region.matched_sigungu,
    capacity_mw: parseCapacity(null, null, bizNm),
    area_ha: parseArea(null, null, bizNm),
    evaluation_year: parseYear(null, (list.stepChangeDt as string | undefined) ?? null),
    evaluation_stage: stage,
    source_dataset: SOURCE_DATASET_DSCSS,
    source_payload: JSON.stringify(payload)
  };
}
```

- [ ] **Step 3: Run test, verify GREEN**

Run: `npx vitest run src/features/similar-cases/transform.test.ts`
Expected: PASS (전체 — 새 4 케이스 + 기존 list-only 케이스).

> **주의**: 기존 list-only 케이스 (`evaluation_stage='unknown', region_sido=null`) 가 그대로 통과해야 함 (`detailItems` 미전달 시 mapper 가 'unknown' 반환, region parser 가 LUT 미매칭 시 null 반환).

- [ ] **Step 4: 단정 표현 grep 통과 확인**

```bash
grep -rE "협의 통과|승인됨|법적으로 문제없음|환경영향평가 대상입니다" src/features/similar-cases/ packages/eia-data/src/
```

Expected: 0 결과.

---

### Task 2.5: Phase 2 commit

- [ ] **Step 1: Stage Phase 2 변경 파일**

```bash
git add packages/eia-data/src/types/discussion.ts
git add packages/eia-data/src/endpoints/discussion.ts
git add src/features/similar-cases/evaluation-stage-mapper.ts
git add src/features/similar-cases/payload-whitelist.ts
git add src/features/similar-cases/transform.ts
```

- [ ] **Step 2: Commit (feat)**

```bash
git commit -m "$(cat <<'EOF'
feat(cases): integrate Ing detail + evaluation-stage-mapper into transform (P1)

- types/discussion.ts: dscssIngDetailItemSchema + envelope (response.body.items.item union)
- endpoints/discussion.ts: buildDscssIngDetailPath
- evaluation-stage-mapper.ts: stateNm 5단계 매핑 + 정렬 후 first
- payload-whitelist.ts: stateNm/resReplyDt/applyDt + matched_* 추가, PII (ccilMemEmail/ccilMemNm) 제외
- transform.ts: DscssTransformInput.detailItems 추가, region/stage 통합

spec §2 / §4.3 / §4.4 / §10.4 / Phase 2 GREEN.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — cases-indexer Ing detail call

### Task 3.1: cases-indexer.ts Ing detail fetch + retry

**Files:**
- Modify: `workers/cases-indexer.ts`

- [ ] **Step 1: import 확장 + 카운터 인터페이스**

`cases-indexer.ts` 상단 import 에 추가:

```typescript
import {
  buildDscssListPath,
  buildDscssIngDetailPath,
  WIND_SEARCH_TEXTS
} from '../packages/eia-data/src/endpoints/discussion';
import {
  dscssBsnsListItemSchema,
  dscssIngDetailItemSchema,
  type DscssIngDetailItem
} from '../packages/eia-data/src/types/discussion';
```

`IndexerSummary` 확장:

```typescript
export interface IndexerSummary {
  records_total: number;
  records_added: number;
  records_skipped: number;
  api_calls: number;
  error: string | null;
  skip_reasons: SkipReasons;
  // P1: detail 카운터
  detail_called: number;
  detail_success: number;
  detail_retry: number;
  detail_failed: number;
  region_matched: number;
  region_unmatched: number;
}
```

- [ ] **Step 2: Ing detail fetch helper 추가**

`runIndexer` 함수 위에 helper 추가:

```typescript
const MAX_DETAIL_FAIL_LOGS = 5;

async function fetchIngDetail(
  client: PortalClient,
  eiaCd: string
): Promise<DscssIngDetailItem[] | undefined> {
  const path = buildDscssIngDetailPath();
  const res = await client.call<unknown>({
    path,
    query: { type: 'json', eiaCd, numOfRows: 100, pageNo: 1 }
  });
  const r = res as { response?: { header?: { resultCode?: string }; body?: { items?: unknown; totalCount?: unknown } } };
  if (r?.response?.header?.resultCode !== '00') {
    throw new Error(`detail header non-OK: ${r?.response?.header?.resultCode}`);
  }
  const itemsField = r?.response?.body?.items;
  // empty body: items='' (string) or { item: undefined }
  if (!itemsField || typeof itemsField === 'string') return [];
  const item = (itemsField as { item?: unknown }).item;
  const arr = Array.isArray(item) ? item : item != null ? [item] : [];
  // zod safeParse — 파싱 실패한 항목 skip (전체 fail 아님)
  const parsed: DscssIngDetailItem[] = [];
  for (const it of arr) {
    const p = dscssIngDetailItemSchema.safeParse(it);
    if (p.success) parsed.push(p.data);
  }
  return parsed;
}

async function fetchIngDetailWithRetry(
  client: PortalClient,
  eiaCd: string,
  counter: { retry: number; failed: number }
): Promise<DscssIngDetailItem[] | undefined> {
  try {
    return await fetchIngDetail(client, eiaCd);
  } catch (e1) {
    counter.retry++;
    try {
      return await fetchIngDetail(client, eiaCd);
    } catch (e2) {
      counter.failed++;
      return undefined; // list-only fallback
    }
  }
}
```

- [ ] **Step 3: runIndexer 본문 — detail call 통합**

기존 `runIndexer` 의 `transformDscssItem({ list: listItem as never })` 호출 부분 (line 118 근처) 을 다음으로 교체:

```typescript
          // P1: list 통과 → Ing detail call (retry 1) → transform
          let detailItems: DscssIngDetailItem[] | undefined;
          if (api_calls < max) {
            detail_called++;
            const counter = { retry: 0, failed: 0 };
            detailItems = await fetchIngDetailWithRetry(client, listItem.eiaCd, counter);
            api_calls += 1 + counter.retry; // 본 호출 + retry
            detail_retry += counter.retry;
            if (detailItems !== undefined) detail_success++;
            else detail_failed += counter.failed;
          }

          const row = transformDscssItem({ list: listItem as never, detailItems });
          if (!row) {
            records_skipped++;
            skip_reasons.transform_null++;
            continue;
          }
          if (row.region_sido) region_matched++;
          else region_unmatched++;
          rows.push(row);
          records_added++;
```

`runIndexer` 의 카운터 변수 선언 부분 (let api_calls 근처) 에 추가:

```typescript
  let detail_called = 0;
  let detail_success = 0;
  let detail_retry = 0;
  let detail_failed = 0;
  let region_matched = 0;
  let region_unmatched = 0;
```

함수 return 객체에 카운터 추가:

```typescript
  return {
    records_total,
    records_added,
    records_skipped,
    api_calls,
    error,
    skip_reasons,
    detail_called,
    detail_success,
    detail_retry,
    detail_failed,
    region_matched,
    region_unmatched
  };
```

- [ ] **Step 4: scheduled handler 의 console.log 갱신**

```typescript
export default {
  async scheduled(_event: ScheduledEvent, env: IndexerEnv): Promise<void> {
    const summary = await runIndexer({ env });
    console.log(JSON.stringify({ kind: 'cases-indexer', summary }));
    console.log(JSON.stringify({
      kind: 'cases-indexer-counters',
      detail_called: summary.detail_called,
      detail_success: summary.detail_success,
      detail_retry: summary.detail_retry,
      detail_failed: summary.detail_failed,
      region_matched: summary.region_matched,
      region_unmatched: summary.region_unmatched
    }));
  }
};
```

---

### Task 3.2: cases-indexer.test.ts GREEN

**Files:**
- Modify: `workers/cases-indexer.test.ts` (Phase 0 RED test 들이 GREEN 으로 전환)

- [ ] **Step 1: Run test, verify GREEN**

Run: `npx vitest run workers/cases-indexer.test.ts`
Expected: PASS (전체 — Phase 0 RED 4 케이스 + 기존 5 케이스).

> **주의**: Phase 0 RED test 가 `vi.stubGlobal('fetch', ...)` URL 분기 패턴을 사용. Phase 3 의 `fetchIngDetail` 가 같은 fetch 호출을 통해 응답받는 구조이므로 helper 추가 불필요.

- [ ] **Step 2: 단정 표현 grep**

```bash
grep -rE "협의 통과|승인됨|법적으로 문제없음" workers/
```

Expected: 0 결과.

---

### Task 3.3: Phase 3 commit

- [ ] **Step 1: Stage**

```bash
git add workers/cases-indexer.ts workers/cases-indexer.test.ts
```

- [ ] **Step 2: Commit (feat)**

```bash
git commit -m "$(cat <<'EOF'
feat(cases-indexer): add Ing detail fetch with retry + list-only fallback (P1)

- fetchIngDetail: response.body.items union (string | object) + zod per-item safeParse
- fetchIngDetailWithRetry: 1회 retry → 실패 시 undefined (list-only fallback)
- 카운터: detail_called/success/retry/failed/region_matched/region_unmatched
- IndexerOpts.client 주입 (테스트 mock 용)
- scheduled handler: 카운터 console.log 별도 출력

spec §10.4 detail 호출 정책 / Phase 3 GREEN.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.4: 전체 GREEN 확인

- [ ] **Step 1: 전체 관련 테스트**

```bash
npx vitest run src/features/similar-cases/ workers/cases-indexer.test.ts
```

Expected: 전체 PASS.

- [ ] **Step 2: typecheck + lint**

```bash
npm run typecheck
npm run lint
```

Expected: 본 작업 관련 에러 0건. (better-sqlite3 격리 외)

- [ ] **Step 3: 사전 결함 격리 확인**

```bash
npm test 2>&1 | grep -E "FAIL|PASS" | tail -30
```

Phase 0 step 2 의 baseline 과 비교 — 본 작업이 변경한 파일과 import 관계 없는 실패는 격리.

---

## Phase 4 — 운영 D1 staging swap (사용자 트리거)

### Task 4.1: wrangler dev + curl 트리거

**Files:** (코드 수정 없음, 사용자 검증 명령 묶음)

- [ ] **Step 1: 사용자 트리거 명령 — 1번 터미널 wrangler dev (worktree 내부)**

> **이 step 은 사용자가 직접 실행. Claude 는 명령만 제시.**
> **반드시 feature 브랜치 worktree 디렉터리 안에서 실행** — main merge 전에 P1 코드를 staging swap 으로 운영 D1 검증한 후, 통과하면 사용자가 main merge 진행. main 디렉터리 (`C:/0_project/eia-workbench`) 에서 실행하면 list-only 코드가 그대로 돌아 P1 검증 의미 없음.

```bash
# 1번 터미널 (반드시 worktree 디렉터리)
cd C:/0_project/eia-workbench-cases-detail
git branch --show-current  # 'feature/cases-detail-api-integration' 확인
npx wrangler dev --config workers/cases-indexer.wrangler.toml --remote --test-scheduled
```

Expected:
- `git branch --show-current` 출력: `feature/cases-detail-api-integration`.
- `Listening at http://127.0.0.1:8787`. `--remote` 로 운영 D1 / SERVICE_KEY secret 연결.

> **stop gate**: branch 출력이 `main` 또는 다른 브랜치면 즉시 멈추고 worktree 경로 재확인.

- [ ] **Step 2: 사용자 트리거 명령 — 2번 터미널 curl**

> **이 step 은 사용자가 직접 실행. Claude 는 명령만 제시.**

```bash
# 2번 터미널 (별도)
curl 'http://127.0.0.1:8787/__scheduled?cron=0+18+*+*+0'
```

Expected: 200 OK 또는 빈 응답 (scheduled handler 실행됨).

- [ ] **Step 3: 사용자 — 1번 터미널 summary 로그 캡처**

1번 터미널의 wrangler dev 출력에서 다음 로그 발견:

```
{"kind":"cases-indexer","summary":{"records_total":N,"records_added":M,"records_skipped":K,"api_calls":X,"error":null,"skip_reasons":{...},"detail_called":D,"detail_success":S,"detail_retry":R,"detail_failed":F,"region_matched":RM,"region_unmatched":RU}}
{"kind":"cases-indexer-counters","detail_called":D,...}
```

값을 plan 의 Phase 5b handover doc 작성용 메모로 기록.

- [ ] **Step 4: Claude 에게 결과 보고**

사용자가 summary 로그 (records_added / detail_* / region_*) 를 Claude 에게 전달 → Claude 가 §11.2 P1 DoD 검토:
- detail call 성공률 = `detail_success / detail_called` ≥ 80%?
- region_matched / records_added ≥ 50%?
- records_added > 0 (적재 정상)?

---

### Task 4.2: §11.3 DoD SQL 5건 통과 확인

- [ ] **Step 0: D1 binding / database_name 사전 확인**

> **이 step 은 사용자가 직접 실행하거나 Claude 가 worktree 안에서 실행.**

```bash
# worktree 내부
cd C:/0_project/eia-workbench-cases-detail
grep -A 3 'd1_databases' workers/cases-indexer.wrangler.toml
```

Expected (2026-04-26 시점):
```
[[d1_databases]]
binding = "DB"
database_name = "eia-workbench-v0"
database_id = "afca9a24-7725-4530-8c49-e3d001bd24d8"
```

→ **`wrangler d1 execute` 의 첫 인자는 `database_name`** (즉 `eia-workbench-v0`). binding `DB` 는 워커 코드 내부 참조용.

> **stop gate**: `database_name` 이 `eia-workbench-v0` 가 아니면 즉시 멈추고 사용자 확인. SQL 명령의 인자도 실측 값으로 갱신 후 진행.

- [ ] **Step 1: 사용자 — DoD SQL 실행 (운영 D1)**

> **이 step 은 사용자가 직접 실행. Claude 는 SQL 만 제시.**

```bash
npx wrangler d1 execute eia-workbench-v0 --remote --command="
SELECT evaluation_stage, COUNT(*) AS n FROM eia_cases GROUP BY evaluation_stage;
"
```

```bash
npx wrangler d1 execute eia-workbench-v0 --remote --command="
SELECT region_sido, COUNT(*) AS n FROM eia_cases GROUP BY region_sido ORDER BY n DESC;
"
```

```bash
npx wrangler d1 execute eia-workbench-v0 --remote --command="
SELECT
  SUM(CASE WHEN evaluation_stage = 'unknown' THEN 1 ELSE 0 END) AS stage_unknown,
  SUM(CASE WHEN region_sido IS NULL THEN 1 ELSE 0 END) AS sido_null,
  COUNT(*) AS total
FROM eia_cases;
"
```

```bash
# PII 검증 (BLOCKING — > 0 결과 시 즉시 stop)
npx wrangler d1 execute eia-workbench-v0 --remote --command="
SELECT COUNT(*) FROM eia_cases WHERE source_payload LIKE '%ccilMemEmail%' OR source_payload LIKE '%ccilMemNm%';
"
```

```bash
npx wrangler d1 execute eia-workbench-v0 --remote --command="
SELECT eia_cd, biz_nm, region_sido, region_sigungu, evaluation_stage FROM eia_cases LIMIT 10;
"
```

- [ ] **Step 2: 사용자 → Claude 결과 전달**

5개 query 결과를 Claude 에게 전달.
Claude 가 §11.2 임계 검토:
- region_sido NULL 비율 ≤ 50%?
- PII grep COUNT = 0?
- 스팟 체크 10건 — 영양/강릉/의성/청송/삼척/양양 매칭 확인?

- [ ] **Step 3: 미달 분기**

- 모두 통과 → Phase 5a 진입.
- region_sido 50% 미달 → spec §11.5 재인덱싱 트리거 절차 진입 (별도 commit, 본 plan 종료 후 hotfix).
- PII grep > 0 → 인덱서 즉시 stop + staging 폐기 + spec patch 재논의 (BLOCKING).

> **Phase 4 는 commit 없음**. 사용자 트리거 + DoD 통과 확인만.

---

## Phase 5a — 운영 검증 (UI 4건 + console.log 카운터, 미커밋)

### Task 5a.1: UI 검증 4건

**Files:** (코드 수정 없음, 사용자 brower 검증)

- [ ] **Step 1: 사용자 — `/cases` 첫 진입 검증**

> **이 step 은 사용자가 직접 실행.**

운영 URL (예: `https://eia-workbench.pages.dev/cases`) 또는 로컬 dev (`npm run dev` 후 `http://localhost:4321/cases`) 진입.

검증:
1. 카드 리스트에 region 라벨 표시 (예: `'경상북도 영양군'`).
2. 시·도 facet '강원도' 체크 → 강릉/삼척/양양 사례만 노출.
3. 카드 → EIASS deep-link 클릭 → 새 탭 정상 이동.
4. evaluation_stage 배지 (`'본안'`/`'전략'`/`'unknown'`) 카드 우상단 표시.

- [ ] **Step 2: 사용자 → Claude 검증 결과 전달**

각 항목 PASS/FAIL 보고.

- [ ] **Step 3: console.log 카운터 재검토**

Phase 4 Task 4.1 step 3 의 카운터 값과 §11.2 임계 재대조.

> **Phase 5a 는 commit 없음**. 검증만.

---

## Phase 5b — handover doc 작성 + commit

### Task 5b.1: handover doc 작성

**Files:**
- Create: `docs/handover/2026-04-26-cases-detail-deployed.md` (실 작성 시점 날짜로 변경 가능)

- [ ] **Step 1: handover doc 신설**

```markdown
# 2026-04-26 — cases detail integration deployed (P1)

> 본 도구는 검토 보조이며 현지조사·전문가 검토를 대체하지 않습니다.

## 0. 요약

- 2026-04-26 list-only 운영 후 P1 patch 로 Ing detail (`getDscssSttusDscssIngDetailInfoInqire`) 통합 완료.
- evaluation_stage 매핑 (stateNm 패턴) + region_sido fallback (biz_nm regex + sigungu LUT) 도입.
- detail 호출 실패 시 retry 1 + list-only fallback (graceful degradation).
- Opinion detail endpoint 미사용 (PII 회피).

## 1. 배포 결과 (Phase 4-5a 실측)

| 카운터 | 값 |
|---|---|
| records_total | (Phase 4 step 3 기록) |
| records_added | ... |
| records_skipped | ... |
| api_calls | ... |
| detail_called | ... |
| detail_success | ... |
| detail_retry | ... |
| detail_failed | ... |
| region_matched | ... |
| region_unmatched | ... |

## 2. DoD 통과 결과 (§11.2)

| 임계 | 측정값 | PASS/FAIL |
|---|---|---|
| evaluation_stage CHECK | 모두 valid | PASS |
| detail call 성공률 ≥ 80% | ... | ... |
| region_sido NULL ≤ 50% | ... | ... |
| PII grep = 0 | 0 | PASS |
| detail_called ≥ onshore × 0.9 | ... | ... |

## 3. UI 검증 (§11.4)

| 검증 | 결과 |
|---|---|
| `/cases` region 라벨 표시 | PASS/FAIL |
| 시·도 facet '강원도' → 강릉/삼척/양양 | PASS/FAIL |
| EIASS deep-link 새 탭 이동 | PASS/FAIL |
| evaluation_stage 배지 표시 | PASS/FAIL |

## 4. 알려진 한계

- region 매칭 LUT 6 entry 만 import — 19 entry 목표 (50% 커버) 까지 추가 필요.
- LUT 미매칭 행은 region_sido NULL → 시·도 facet 검색 시 미노출.
- detail 호출 실패 시 list-only fallback 으로 evaluation_stage='unknown' 유지.

## 5. 다음 작업 후보

- 19 entry LUT import (§11.5 재인덱싱 절차).
- 다른 EIA 데이터셋 (`15142988` 본안 공람 등) 인덱싱 (v1).
- 트라이그램 한글 토크나이저 (`tokenize='trigram'`) 평가 (v1).

## 6. 참조

- spec: `docs/design/feature-similar-cases.md` §2 / §4.3 / §4.4 / §10.4 / §11 / §12.1
- plan: `docs/plans/feature-similar-cases-p1.md`
- migration: `migrations/0004_relax_cases_constraints.sql` (P1 에서 변경 없음)
- 이전 handover: `docs/handover/2026-04-26-similar-cases-deployed.md` (list-only 단계)
```

> **Phase 4-5a 의 실측 카운터** 자리에 사용자가 보고한 값으로 채움.

- [ ] **Step 2: Stage + commit**

```bash
git add docs/handover/2026-04-26-cases-detail-deployed.md
git commit -m "$(cat <<'EOF'
docs(handover): cases detail integration deployed (P1)

- Phase 4 staging swap 결과 카운터 기록
- §11.2 DoD 통과 요약 (evaluation_stage / region / PII / detail call rate)
- §11.4 UI 검증 4건 결과 표
- 알려진 한계 (LUT 6 entry only) + 다음 작업 후보 (19 entry / 다른 데이터셋)

spec §11 P1 detail 통합 배포 절차 / Phase 5b 종료.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

> **Push 는 사용자가 직접 실행** (MEMORY.md feedback_push_authorization).

---

## 종료 검증

### 최종 체크리스트

- [ ] Phase 0~5b 모든 task 완료.
- [ ] `npm test -- src/features/similar-cases workers/cases-indexer` 그린.
- [ ] `npm run typecheck` / `npm run lint` 그린 (better-sqlite3 격리 외).
- [ ] 단정 표현 grep 0 결과.
- [ ] PII grep (`ccilMemEmail` / `ccilMemNm`) D1 = 0.
- [ ] §11.2 DoD 임계 모두 PASS.
- [ ] handover doc commit 완료.
- [ ] worktree 정리 (`git worktree remove ../eia-workbench-cases-detail` 사용자 판단).

### Push 게이트

본 plan 의 모든 commit 은 `feature/cases-detail-api-integration` 브랜치에 누적됨. push / PR 생성은 사용자가 직접 실행 (MEMORY: main 브랜치 push 는 사용자가 실행). Claude 는 commit 까지만.

---

## 부록 A — 사용자 검증 명령 묶음 (Phase 4/5a copy-paste 용)

```bash
# Phase 4 Task 4.1 — 트리거
cd C:/0_project/eia-workbench-cases-detail
# 1번 터미널
npx wrangler dev --config workers/cases-indexer.wrangler.toml --remote --test-scheduled

# 2번 터미널
curl 'http://127.0.0.1:8787/__scheduled?cron=0+18+*+*+0'

# Phase 4 Task 4.2 — DoD SQL (5건)
npx wrangler d1 execute eia-workbench-v0 --remote --command="SELECT evaluation_stage, COUNT(*) AS n FROM eia_cases GROUP BY evaluation_stage;"
npx wrangler d1 execute eia-workbench-v0 --remote --command="SELECT region_sido, COUNT(*) AS n FROM eia_cases GROUP BY region_sido ORDER BY n DESC;"
npx wrangler d1 execute eia-workbench-v0 --remote --command="SELECT SUM(CASE WHEN evaluation_stage = 'unknown' THEN 1 ELSE 0 END) AS stage_unknown, SUM(CASE WHEN region_sido IS NULL THEN 1 ELSE 0 END) AS sido_null, COUNT(*) AS total FROM eia_cases;"
npx wrangler d1 execute eia-workbench-v0 --remote --command="SELECT COUNT(*) FROM eia_cases WHERE source_payload LIKE '%ccilMemEmail%' OR source_payload LIKE '%ccilMemNm%';"
npx wrangler d1 execute eia-workbench-v0 --remote --command="SELECT eia_cd, biz_nm, region_sido, region_sigungu, evaluation_stage FROM eia_cases LIMIT 10;"

# Phase 5a Task 5a.1 — UI
# 브라우저로 운영 URL `/cases` 진입 후 §11.4 4건 수동 검증
```

---

## 부록 B — Commit 메시지 컨벤션 요약

| Phase | prefix | 예시 |
|---|---|---|
| 0 (RED) | `test(cases)` | `test(cases): add RED tests for P1 Ing detail integration` |
| 1 (LUT + parser) | `feat(cases)` | `feat(cases): add sigungu LUT + bizNm region parser (P1)` |
| 2 (transform) | `feat(cases)` | `feat(cases): integrate Ing detail + evaluation-stage-mapper into transform (P1)` |
| 3 (indexer) | `feat(cases-indexer)` | `feat(cases-indexer): add Ing detail fetch with retry + list-only fallback (P1)` |
| 4 (no commit) | — | — |
| 5a (no commit) | — | — |
| 5b (handover) | `docs(handover)` | `docs(handover): cases detail integration deployed (P1)` |

각 commit 끝에 `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` 포함.
