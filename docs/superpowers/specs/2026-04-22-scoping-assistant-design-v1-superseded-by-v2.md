# feature/scoping-assistant — 설계문서 (v1 draft)

> Office Hours (2026-04-22) + Brainstorming 반영 최종안.
> 다음 단계: writing-plans → `docs/plans/feature-scoping-assistant.md` (2–5분 태스크 분해).
> 구현 착수 전 `/autoplan` + CLAUDE.md §9.3 도메인 리뷰 필수.

## §0. Office Hours 답변 요약 + 미검증 가정

**Office Hours 날짜**: 2026-04-22
**답변자**: 프로젝트 오너 (솔로 파일럿, 외부 평가사 미확보)
**Brainstorming 출처**: 이 spec 본문은 오너 답변 11건(Q1–Q11) + 추가 결정 3건(규칙팩 축소, 색 토큰, 고정 배너) + 저장 직전 짚기 2건 (onUndefined 시맨틱 명시, rule 정확성 인식론적 근거) 을 반영한 최종안.

### 확정 사항 (코드 검증)

| ID | 사항 | 근거 |
|----|------|------|
| Q6 | 자동 주입값 (industry / region codes / capacity_mw) D1 에 저장됨 | `migrations/0001_init.sql` + `src/pages/api/projects/index.ts:44-57` |
| Q10 | `data/rules/scoping/` 미존재 → 신규 생성 | `ls data/rules/` = README.md 만 |
| Q11 | 탭 라우팅 = 별도 페이지 `/projects/[id]/scoping` | Astro 라우팅 친화 + SSR + 북마크 + `/projects/[id]/<feature>` 일관성 |

### 확정 사항 (오너 결정)

| ID | 사항 | 방향 |
|----|------|------|
| Q2 | "5분" 정량 목표 삭제 | 비정량 목표 "매뉴얼 없이 export 도달" |
| Q8 | rule PR 거버넌스 | (a) §9.3 체크리스트 의무 + (b) 결과 카드 `rule_pack_version` 표시. (c) UI 신고 버튼은 v1 |
| Q9 | refLink 깨짐 대응 | v0 허용 + README 문구 명시. 링크 체커 자동화는 follow-up issue |
| Q12 | DSL vs json-logic-js | plan 단계 결정. onUndefined 시맨틱 지원 여부 비교 필수 |

### 미검증 가정 (파일럿 고객 확보 시 재검증)

Q-series = Office Hours 응답 기반. A-series = post-OH 발견 가정 (발견 시점 순).

| ID | 가정 | 변경 시 영향 |
|----|------|------|
| Q1 | 용도 = "내부 리뷰 회의용 체크리스트" | Export 필드 구조, 결과 카드 우선순위 재설계 |
| Q3 | Export 포맷 = CSV + Markdown 둘 다 | PDF/공유 URL 요구 시 v1 신규 개발 |
| Q5 | v0 규칙 4건 (용량 3 + 산지전용 1). 보호구역 6건 v1 | 규칙 확장 + 입력 필드 재추가 + GIS 연동 |
| Q7 | UI 라벨 = "대상 가능성 / 검토 필요 / 비대상 가능성 / 판단 보류" | DESIGN.md 토큰 변경, E2E 어서션 수정 |
| **A1** | **v0 규칙 4건이 작성 시점 공개 법령 요약과 일치** | **plan T1 에서 법령 원문 1차 대조 + writing-plans 승인 전 검증 필수. 불일치 발견 시 규칙 수정 또는 제외.** |

### 변경 관리

5건 미검증 가정 전부 다음 위치에 중복 표기:

- 이 spec 본문 §0 + §11 해당 셀
- `src/features/scoping/README.md` (구현 시 생성)
- `DESIGN.md` 의 UI 라벨 섹션 (Q7)

가정 변경 시 spec 갱신 + 관련 테스트 회귀 + CHANGELOG/session_log 필수.

---

## §1. 목적

환경영향평가 프로젝트의 **입지·규모 기반 사전 검토 보조**. 프로젝트 메타(업종, 시/도·시/군/구, 용량 MW) 자동 주입 + 추가 입력(v0: 산지전용 면적, 자유 메모) 을 받아, **규칙팩 (YAML)** 이 각 규정별로 4단계 결과 배지(대상 가능성/검토 필요/비대상 가능성/판단 보류) 를 제시. 근거·가정·한계·`needsHumanReview: true` 표준 스키마, CSV/Markdown export, **Claude 수동 분석 프롬프트 생성기** (클립보드 복사) 를 제공.

**완료 시점 (v0 범위)**: 평가사가 매뉴얼 없이 스코핑 페이지에 들어가, 프로젝트별로 **내부 리뷰 회의용 체크리스트 초안**을 생성·export 할 수 있다. ※ 용도 가정 (Q1) — 파일럿 고객 확보 후 재검증.

---

## §2. 스코프 밖

v0 에서 하지 않는 것:

- LLM 자동 판정 (CLAUDE.md §2-2)
- GIS 자동 조회 + 보호구역 6건 규칙 (Q5 → v1)
- 법령 원문 DB 동기화 (refLink 만, 본문 재호스팅 금지 §2-4)
- 다른 업종 (육상풍력 외)
- 보고서 초안 생성 (feature/draft-checker)
- 주민 의견 처리 (feature/opinion-response)
- PDF export, 공유 URL (Q3 → v1 수요 기반)
- UI "이 규칙 부정확해요" 신고 버튼 (Q8 → v1)
- 법령 refLink 체커 자동화 (Q9 → follow-up issue)

---

## §3. 핵심 사용자 여정

| 단계 | 행동 | 결과 | 라우트/엔드포인트 |
|------|------|------|---|
| A | 프로젝트 상세 → "스코핑" 탭 클릭 | `/projects/[id]/scoping` 네비게이트 | SSR 페이지 |
| B | 자동 주입값 확인 + 사용자 입력 (forest_conversion_ha, notes) | 입력 폼 | 폼 내부 state |
| C | "검토 실행" 클릭 | 규칙 엔진 실행 → run 저장 → 결과 카드 표시 | `POST /api/projects/[id]/scoping` |
| D | 결과 카드 스크롤 + 배지 확인 | 4단계 결과, basis/assumptions/limits/rule_pack_version | 페이지 state |
| E | Export (CSV or MD) 또는 Claude 프롬프트 복사 | 파일 다운로드 또는 클립보드 카피 | 클라이언트 로직 |
| F | 좌측 run history 에서 과거 run 로드 | 해당 run 상태로 복원 | `GET /api/projects/[id]/scoping/runs/[runId]` |

---

## §4. 데이터 모델 (`migrations/0002_scoping.sql`)

```sql
CREATE TABLE scoping_runs (
  id                 TEXT PRIMARY KEY,           -- nanoid(12)
  project_id         TEXT NOT NULL REFERENCES projects(id),
  rule_pack_version  TEXT NOT NULL,              -- 'onshore_wind/v1.2026-04-22'
  input_json         TEXT NOT NULL,              -- 사용자 추가 입력 복원용
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
//   industry, site_region_code, site_sub_region_code, capacity_mw

// 사용자 입력 (v0):
export const scopingInputSchema = z.object({
  forest_conversion_ha: z.number().min(0).max(10000).optional(),
  notes: z.string().max(1000).optional(),
});

// 엔진 입력 EvalInput (§8 evaluate 함수 인자):
//   EvalInput = 자동 주입값 (industry, site_region_code, site_sub_region_code, capacity_mw)
//             + scopingInputSchema 의 forest_conversion_ha
//   notes 는 EvalInput 에 포함하지 않음 (DB 저장만).

// 의미론 (§7 규칙 팩과 일치):
// - forest_conversion_ha 미입력 → forest-conversion 규칙의 onUndefined 시맨틱에 따라 'unknown' 처리
// - capacity_mw 미입력 (프로젝트 생성 시 optional) → 용량 3규칙 모두 onUndefined: 'unknown'
// - notes 는 저장만. 엔진 입력으로 쓰지 않음.

// v1 로 미룬 필드 (Q5 가정에 따른 근거 주석만):
// site_area_ha, protected_zone.{natural_park, eco_landscape, wildlife_protection,
// water_source, cultural_heritage, military_zone}, nearest_residence_km, max_elevation_m
```

---

## §6. 표준 결과 스키마

`src/lib/types/analysis-result.ts` (신규):

```ts
export interface StandardAnalysisResult {
  result: 'likely_applicable' | 'needs_check' | 'likely_not_applicable' | 'unknown';
  basis: Array<{ id: string; title: string; refLink?: string }>;
  assumptions: string[];
  limits: string[];
  needsHumanReview: true;  // 리터럴 true — 도메인상 항상 true
}

export interface ScopingResult extends StandardAnalysisResult {
  ruleId: string;
  title: string;
  category: 'eia_target' | 'small_eia' | 'forest_conversion' | 'etc';
  rule_pack_version: string;  // Q8-b: 결과 카드 표시 의무
}
```

UI 라벨 매핑 (Q7, DESIGN.md 토큰 예정):

| code enum | UI 라벨 | 색 토큰 |
|-----------|---------|--------|
| `likely_applicable` | 대상 가능성 | `scoping-badge-applicable` (진한 주황) |
| `needs_check` | 검토 필요 | `scoping-badge-check` (노랑) |
| `likely_not_applicable` | 비대상 가능성 | `scoping-badge-not-applicable` (회색) |
| `unknown` | 판단 보류 | `scoping-badge-unknown` (연한 주황 + ? 아이콘) |

---

## §7. 규칙 팩 (`data/rules/scoping/onshore_wind.v1.yaml`)

```yaml
version: onshore_wind/v1.2026-04-22
industry: onshore_wind
source_note: |
  v0 규칙 4건 (용량 3 + 산지전용 1). 보호구역·GIS 기반 규칙은 Q5 가정에 따라 v1.
  규칙 추가/수정 PR 은 CLAUDE.md §9.3 도메인 리뷰 체크리스트 통과 필수 (Q8-a).
  법령 refLink 는 작성 시점(2026-04-22) 확인. 링크 변경 대응은 follow-up issue.
  onUndefined 시맨틱은 DSL 6연산자 (==, !=, >, >=, <, <=, and, or) 로 직접 표현 불가 →
  엔진의 "규칙 평가 전 onUndefined 래퍼 레이어" 가 처리. plan 단계 M-D 결정 시
  self-DSL 확장 vs json-logic-js 커스텀 오퍼레이터 지원 여부 비교 필수.

rules:
  - id: eia-target-capacity-10mw
    title: 환경영향평가 대상사업 가능성 (용량 기반)
    category: eia_target
    appliesIf: { input.capacity_mw: { '>=': 10 } }
    onUndefined: unknown        # capacity_mw 미입력 시 판단 보류
    result: likely_applicable
    basis:
      - id: eia-act-sched-2
        title: 환경영향평가법 시행령 별표2
        refLink: https://law.go.kr/법령/환경영향평가법시행령
    assumptions: ['사용자 입력 capacity_mw 는 정격 기준']
    limits: ['단일 사업장 기준. 인접 사업장 누적 용량 미반영.']

  - id: small-eia-capacity-1mw
    title: 소규모환경영향평가 대상 가능성 (용량 기반)
    category: small_eia
    appliesIf:
      and:
        - { input.capacity_mw: { '>=': 1 } }
        - { input.capacity_mw: { '<': 10 } }
    onUndefined: unknown
    result: likely_applicable
    basis:
      - id: small-eia-act-sched
        title: 환경영향평가법 시행령 별표4 (소규모)
        refLink: https://law.go.kr/법령/환경영향평가법시행령
    assumptions: ['사용자 입력 capacity_mw 는 정격 기준']
    limits: ['인접 사업장·누적 용량 미반영. 지역별 조례 임계 변화는 별도 확인 필요.']

  - id: small-eia-capacity-0.1mw
    title: 간이평가 경계 검토 필요 (0.1MW ≤ 용량 < 1MW)
    category: small_eia
    appliesIf:
      and:
        - { input.capacity_mw: { '>=': 0.1 } }
        - { input.capacity_mw: { '<': 1 } }
    onUndefined: unknown
    result: needs_check
    basis:
      - id: local-eia-rule
        title: 지자체 환경영향평가 조례 (별도 확인)
        refLink: https://law.go.kr/
    assumptions: ['광역자치단체 조례에 1MW 이하 별도 절차가 있을 가능성']
    limits: ['조례는 자치단체별 상이. 본 결과는 "확인 필요" 에 한함, 대상 여부 단정 아님.']

  - id: forest-conversion-above-1ha
    title: 산지전용 허가 검토 필요 (전용 면적 > 1ha)
    category: forest_conversion
    appliesIf: { input.forest_conversion_ha: { '>': 1 } }
    onUndefined: unknown        # 미입력 시 "판단 보류", Q1 체크리스트 가정 일치
    result: needs_check
    basis:
      - id: forest-act-sched
        title: 산지관리법 시행령
        refLink: https://law.go.kr/법령/산지관리법시행령
    assumptions: ['사용자 입력 산지전용 면적은 사업 전체 기준']
    limits: ['보전산지 여부는 별도 확인 필요. 본 결과는 "검토 필요" 에 한함.']

# v1 후보 (코드 X, 주석 전용):
# - protected-natural-park, protected-eco-landscape, protected-wildlife,
#   protected-water-source, protected-cultural-heritage, protected-military
# - elevation-max-above-Xm, residence-distance-below-Xkm
# 조건: GIS 연동 또는 사용자 입력 신뢰성 보강 필요
```

**onUndefined 시맨틱**: 각 규칙의 `appliesIf` 참조 입력이 `undefined` 일 때의 동작을 `onUndefined: 'unknown' | 'skip' | 'false'` 중 하나로 명시. DSL 6연산자로는 직접 표현 불가 → 엔진이 규칙 평가 전에 onUndefined 를 해석하는 래퍼 레이어로 처리. 구체 구현 선택은 plan M-D (Q12) 에서 self-DSL 확장 vs json-logic-js 비교 시 반드시 포함.

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
- onUndefined 래퍼가 각 규칙 평가 전에 참조 입력 undefined 여부 확인. undefined 시 해당 규칙의 `onUndefined` 값 대로 바로 결과 반환, `appliesIf` 평가 건너뜀
- Vitest 단위 테스트: 4규칙 × 경계값(정확히 threshold, threshold±1, undefined) + 카테고리 분포 + `rule_pack_version` 주입 확인 ≈ 20 케이스
- 분기 커버리지 ≥95% 의무 (CI gate)

---

## §9. 엔드포인트

| 경로 | 메서드 | 용도 |
|------|--------|------|
| `/projects/[id]/scoping` | GET | Astro SSR 페이지 (탭 대신 별도 페이지, Q11) |
| `/api/projects/[id]/scoping` | POST | input 검증 → engine 실행 → scoping_runs insert → 201 + ScopingResult[] |
| `/api/projects/[id]/scoping` | GET | 최신 run 반환 (없으면 `{ runs: [] }`) |
| `/api/projects/[id]/scoping/runs` | GET | run 리스트 (created_at desc, 최근 20) |
| `/api/projects/[id]/scoping/runs/[runId]` | GET | 특정 run 상세 |
| `/api/projects/[id]/scoping/runs/[runId]` | DELETE | soft-delete (history) |

기존 middleware(Origin 검사, CSP, 인증, PII-safe logger) 자동 적용. 프로젝트 쉘과 동일 게이트.

---

## §10. UI

### 페이지 `/projects/[id]/scoping`

- 상단 네비: ← 프로젝트로 돌아가기 + 프로젝트명·지역·용량 배지
- 레이아웃: 좌 30% 입력 폼 + 우 70% 결과 영역 (모바일: 수직 스택)

### 입력 폼 (좌)

- **자동 주입값** (read-only 배지): 업종, 지역, 용량 MW
- **사용자 입력**:
  - 산지전용 면적 (ha) — number, optional. helper: "미입력 시 '판단 보류'"
  - 메모 — textarea, optional, ≤1000
- **"검토 실행"** CTA (disabled 조건 없음 — 자동 주입만으로도 실행 가능, onUndefined 래퍼가 처리)

### 결과 영역 (우)

- **최상단 고정 배너** (Q1 운영 결과):

  > "스코핑 결과는 **내부 검토용 초안**입니다. 현지조사·전문가 판정·공식 행정절차를 대체하지 않습니다."

- **결과 카드 리스트**: 각 카드는
  - 헤더: 결과 배지 + title
  - 본문: category 배지, basis (링크), assumptions (글머리), limits (글머리)
  - 하단: `needsHumanReview` 아이콘 + "전문가 확인 필요" + **rule_pack_version 텍스트** (Q8-b)
- **우측 상단 툴바**:
  - `Export ▾` → CSV / Markdown 선택
  - `Claude 분석 프롬프트 복사` → 현재 입력 + 결과를 포함한 markdown 블록을 클립보드로 (수동 LLM 호출, CLAUDE.md §2-2)

### 좌측 하단 run history

- 최근 10건, 클릭 시 해당 run 로드
- 각 항목: 생성 시각 · 결과 요약 배지 개수 (`3 대상 · 1 검토`)

### DESIGN.md 갱신 (v0 구현 시)

- 신규 색 토큰: `scoping-badge-applicable` (진한 주황), `scoping-badge-check` (노랑), `scoping-badge-not-applicable` (회색), `scoping-badge-unknown` (연한 주황)
- UI 라벨 주석: "이 용어는 2026-04-22 Q7 가정, 파일럿 피드백으로 변경 가능" (Q7)

### 기존 DisabledTab 교체

- `src/pages/projects/[id].astro:62` 의 `<DisabledTab label="스코핑" ... />` 를 일반 `<a>` 링크 (`href={/projects/[id]/scoping}`) 로 교체. role="tab" 유지, `aria-disabled` 제거.

---

## §11. 도메인 리뷰 매핑 (CLAUDE.md §9.3)

| # | 위험 | 본 기능 발생 가능성 | 방지책 |
|---|------|-------------------|--------|
| ① | 법적 결론 단정 | 중간 (결과 UI 카피 + rule pack yaml) | `lint-copy.ts` 확장: yaml 규칙팩/UI 카피에 "대상입니다/승인/통과/합격" grep → build 실패. result enum `likely_` prefix 로 타입 레벨 단정 방지. |
| ② | 현지조사 대체 | 중간 (결과가 "검토 결과" 처럼 읽힐 위험) | UI 결과 최상단 고정 배너 (§10). 모든 ScopingResult.limits 가 비어있지 않음 회귀 테스트. |
| ③ | EIASS 원문 재호스팅 | 낮음 | rule pack basis 에 `refLink` 만. 100자 초과 basis.title 차단 yaml lint. |
| ④ | 주민·기관 의견 왜곡 | 해당 없음 | — |
| ⑤ | 결과 객체 표준 스키마 | 중간 (본 기능이 해당 스키마 첫 적용) | `StandardAnalysisResult` 타입 강제. Zod 출력 스키마도 의무화. `needsHumanReview: true` 리터럴. |
| **⑥** | **rule pack 부정확 (인식론적 리스크)** | **중간** | 근거: (a) 규칙 자체의 법령 해석은 단순 수치 기반 (별표) 이지만, (b) 작성자(Claude + 오너) 가 법령 원문 1차 대조를 안 한 상태, (c) 법령 개정/해석 변경 추적 루틴 없음 (Q9 가정과 연동). 즉 v0 규칙 4건은 **"작성 시점 공개 법령 요약 기준"** 이라는 전제 기반이며, 정확도 보장 아님. 방어선: ①rule PR §9.3 체크리스트 의무 (Q8-a), ②결과 카드 `rule_pack_version` 표시 (Q8-b), ③사용자 피드백 채널 = GitHub Issues (v0), UI 신고 버튼 (v1, Q8-c), ④**§0 A1 가정으로 plan T1 에 법령 원문 1차 대조 step 강제**. |

---

## §12. 보안·가드

- 유료 LLM 키 참조 회귀: 기존 CI grep (ANTHROPIC/OPENAI/GOOGLE) 유지
- Rate-limit: 프로젝트당 run 생성 분당 10회 (D1 count 기반)
- 로깅: 기존 `src/lib/logger.ts` 준수, input_json/output_json 은 로그에 쓰지 않음
- README 문구 (v0 구현 시): "법령 링크는 2026-04-22 확인 기준. 변경 시 GitHub Issue 환영" (Q9)
- Follow-up issue 등록 예정: `docs/issues/09-scoping-link-checker.md` (링크 체커 자동화)

---

## §13. 테스트

**단위 (Vitest)**:

- engine: 4규칙 × 경계값 (정확히 threshold / 경계 ±1 / undefined / 카테고리 enum) ≈ 20 케이스, 분기 커버리지 ≥95%
- onUndefined 래퍼: 각 규칙별 참조 입력 undefined → 해당 규칙의 `onUndefined` 값대로 결과 반환 테스트
- DSL 파서 (plan M-D 최종 결정 구현): 6연산자 + onUndefined 래핑 분기 전체 커버리지
- 표준 스키마 Zod validator
- `lint-copy.ts` 확장: yaml 단정어 검출 회귀

**E2E (Playwright)**:

- `scoping-happy`: capacity_mw=5 + forest_conversion_ha=2 → "대상 가능성 (소규모)" + "검토 필요 (산지)" 2카드 + **고정 배너** + **rule_pack_version 텍스트** DOM 존재 어서션
- `scoping-copy-prompt`: 클립보드 복사 → 기대 텍스트 존재
- `scoping-history`: run 생성 2회 → history 2건 → 과거 run 로드

**접근성**:

- axe-smoke 에 `/projects/[id]/scoping` 포함
- tablist/page landmarks 검증 (CLAUDE.md §6.1 규칙 준수)

---

## §14. 성공 지표 (v0 출시 기준)

- 평가사가 **매뉴얼 없이 export 까지 도달 가능** (Q2 비정량 목표)
- 결과 UI/데이터 어디에도 단정 표현 없음 (`lint-copy.ts` 확장 통과)
- 모든 ScopingResult 에 `basis`, `assumptions`, `limits`, `needsHumanReview: true`, `rule_pack_version` 존재
- Vitest 분기 커버리지 ≥95%, E2E 3건 green, axe-smoke green, `/design-review` 통과
- 유료 LLM 키 참조 0건 (CI grep 통과)
- 고정 배너 + 규칙 버전 표시 회귀 어서션 green
- Lighthouse 성능·접근성 각 ≥ 90 (`/projects/[id]/scoping`)

---

## §15. 리스크 & 미정 사항

### 리스크

- **rule pack 정확성 = 중간 (인식론적)** → 방어선: §11 ⑥ + `needsHumanReview: true` 리터럴 + A1 가정의 plan T1 검증
- **DSL 설계 복잡도** → onUndefined 시맨틱이 DSL 확장을 요구. 단순 6연산자로 부족. plan M-D 결정 시 self-DSL 확장 vs json-logic-js 비교의 핵심 기준

### 미정 (plan 단계 결정)

| ID | 항목 | 결정 위임 |
|----|------|-----------|
| M-A | run history 최대 건수 | plan |
| M-B | Claude 수동 분석 프롬프트 템플릿 | `prompts/scoping-manual.md` 별도 작성, plan 에 step 포함 |
| M-C | UI 카드 색 hex (DESIGN.md 토큰) | plan |
| M-D | DSL vs json-logic-js (onUndefined 지원 비교 포함) | plan |

### Follow-up issue 후보

- `docs/issues/09`: 링크 체커 자동화 (cron or CI 주1회)
- `docs/issues/10`: 보호구역 6건 + GIS 연동 (v1 규칙 확장)
- `docs/issues/11`: 사용자 UI 신고 버튼 (v1)
- `docs/issues/12`: PDF export (v1 수요 따라)

---

## §16. 다음 단계 (writing-plans 주의사항)

1. **plan T1 초반에 "v0 규칙 4건의 법령 원문 1차 대조" step 명시 (A1 해결)**. 불일치 발견 시 규칙 수정 또는 제외. writing-plans 승인 전 검증 필수.
2. **DSL vs json-logic-js 결정 시 onUndefined 시맨틱 지원 여부 비교** 필수 (M-D, Q12). 비교 표를 plan 에 포함.
3. **migration `0002_scoping.sql` 호환성 사전 검증** — 현재 migration runner (`src/lib/migrations/*` 또는 `wrangler d1 migrations apply`) 와 호환되는지 plan 태스크 1–2 에서 확인. 호환 문제 발견 시 migration 단계 재설계.
4. 기존 `workers/cron-cleanup.ts` 에 `scoping_runs` 30일 하드삭제 쿼리 추가 (4-line scope, 안전 가드 복사).
5. `lint-copy.ts` 확장 (yaml 단정어) + axe-smoke 페이지 포함 + E2E 3건 spec 모두 plan 태스크로 분리.
