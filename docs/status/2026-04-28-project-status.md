# Project Status Snapshot — 2026-04-28

**Date:** 2026-04-28
**Repository:** `eia-workbench` (main HEAD `338c1df`)
**Pages production:** https://eia-workbench-v0.pages.dev (deploy `79b5d022`)
**Purpose:** 프로젝트 전체 진행도 + 의도한 방향성 검증을 한 눈에 확인. 다음 세션
시작 시 정독 doc.

---

## 1. 제품 정체성 (Product Identity)

환경영향평가사·평가대행사가 **육상풍력** 사업의 환경영향평가 보고서·스코핑·협의
대응을 작성·검수할 때, 보고서 작성 시간 절감을 목표로 하는 B2B SaaS.

핵심 원칙 (CLAUDE.md §2):
- **검토 보조** — 현지조사·전문가 검토 대체 아님. 모든 결과에 "사람 확인 필요" 표시.
- **무료 인프라 우선** — Cloudflare 무료 등급 (Pages + D1 + Workers + R2 + KV).
  서버측 LLM API (Anthropic / OpenAI / Google) 미사용. LLM 필요 영역은 "Claude
  수동 분석용 프롬프트 생성기" 로 대체.
- **법적 단정 표현 금지** — UI/문서/테스트 어디에도 "협의 통과" / "승인됨" 등
  단정 금지. 항상 "가능성" / "확인 필요" 로.
- **EIASS 원문 재호스팅 금지** — 메타데이터만 D1 인덱싱, 본문은 EIASS 공식 페이지로
  deep-link.
- **PII 미적재** — `ccilMemEmail` / `ccilMemNm` (CCM 담당자) 화이트리스트 차단.

**v0 운영 모드 (2026-04-22 ~)**: 파일럿 운영. 단일 `APP_PASSWORD` 인증, 조직별
격리 없음, 인증된 모든 사용자에게 동일 데이터 노출.

**대상 업종 1개**: `onshore_wind`. 다른 업종 (해상풍력 / 태양광 / 도로 등) 은 v2.

출처: `docs/design/feature-similar-cases.md` §1-§2 / `CLAUDE.md` §1-§9.

---

## 2. 주요 기능 영역 (Feature Areas)

| # | 영역 | 상태 | 검증 가능 결과 | 한계 / 우선순위 |
|---|---|---|---|---|
| 1 | Auth + Session | 운영 | `APP_PASSWORD` + Turnstile 로그인, JWT HS256 세션, KV 저장 | 단일 사용자 모드 (조직별 격리 미구현, v1+) |
| 2 | Project workspace + Scoping | 운영 | `/projects/[id]` CRUD, scoping form 5 rule pack (onshore_wind), `scoping_runs` D1 적재 | rule pack 1 업종만 (해상풍력 등 v2) |
| 3 | Similar cases v0 (list 인덱싱) | 운영 | `/cases` 페이지 + FTS5 검색 + 4 facet, 풍력 10건 적재 | facet 시·도 단순 (광역시 자치구 분리 미구현, P3) |
| 4 | Similar cases P1 (detail 통합) | 운영 | Ing detail 호출 → `evaluation_stage` 매핑 + region_sido 6/10 채움 | sido fallback 미구현 4/10 NULL (P3 §3(a)), stateNm 확장 2건 unknown (P3 §3(b)) |
| 5 | CasePreviewPane (카드 클릭 미리보기) | 운영 | `formatLocation` helper, 카드 ↔ 패널 데이터 일관성 | 모바일 subtitle leading " · " cosmetic (P3 §3(d)) |
| 6 | EIASS deep-link | 운영 | `eiassProjectUrl(eiaCd)` → `/biz/base/info/searchListNew.do?...` 외부 링크 | EIASS 사이트 라우팅 변경 시 재검증 필요 |
| 7 | Markdown export | 운영 | 검색 결과 → `.md` 다운로드, disclaimer + region + EIASS 링크 포함 | 페이지네이션 미고려 (현재 10건이라 N/A) |
| 8 | 모바일 fallback page (`/cases/[eiaCd]`) | 운영 | <768px 카드 클릭 시 SSR 상세 페이지 | subtitle cosmetic (P3 §3(d) — Issue 1건 등록 권장) |

**미구현 / 후보**:
- v1 후보: 다른 EIA 데이터셋 (15142988 협의완료, 본안 confirmed) / 한글 trigram
  토크나이저 / scoping ↔ similar-cases 결합 facet / 관련도순 BM25 정렬.
- v2 후보: 다른 업종 (해상풍력 등) / 보고서 draft-checker / 의견 응답 도우미 /
  multi-tenancy.

---

## 3. 기술 스택 + 인프라

| 레이어 | 선택 | 비고 |
|---|---|---|
| 언어 | TypeScript strict | `any` 금지 (CLAUDE.md §5) |
| Frontend | Astro 5 + React islands | 정적 우선, 인터랙션 컴포넌트만 island |
| Backend | Astro server endpoints (Pages Functions) | `src/pages/api/*` |
| Worker | Cloudflare Workers | `workers/cases-indexer.ts` (cron 미설정 P2) |
| Database | Cloudflare D1 (`DB` binding, name `eia-workbench-v0`) | migration 0001~0004 적용 |
| Session | Cloudflare KV (`SESSION` binding) | JWT 페어링 |
| Storage | Cloudflare R2 (`UPLOADS` binding, name `eia-workbench-v0-uploads`) | scoping/cases 미사용, 향후 업로드 기능용 |
| Captcha | Cloudflare Turnstile | 로그인 봇 차단 |
| Test (unit) | Vitest 2.1.x | 320+ tests PASS |
| Test (E2E) | Playwright | `tests/e2e/cases-*.spec.ts`, axe accessibility |
| Lint/Format | ESLint 9 + Prettier 3 | `npm run lint` / `format` |
| Build | Astro build → Cloudflare adapter | `dist/_worker.js` ~63 KB |
| 배포 | Cloudflare Pages (auto on `main` push) | latest `79b5d022` |

**Secrets** (운영 Pages, `wrangler pages secret put` 으로 주입):
- `APP_PASSWORD` — 파일럿 로그인
- `JWT_SECRET` — HS256
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile
- `SERVICE_KEY` — data.go.kr 일반 인증키 (cases-indexer)

**무료 등급 사용량 (현 시점)**:
- D1: ~127 KB (10건 적재) / 5 GB 한도 → 0.0025% 사용
- Pages: 빌드 1회 / 3000회 한도 → 무리 없음
- Workers: 인덱서 수동 트리거 / 100K req/일 한도 → 무리 없음
- 일 호출 (data.go.kr): ~170 / 10,000 → 1.7%

---

## 4. 데이터 흐름 (similar-cases 기준)

```
[data.go.kr 15142987 환경영향평가 협의현황]
     │
     │  (1) cases-indexer worker 주 1회 호출 (현재 사용자 수동 trigger)
     │      - getDscssBsnsListInfoInqire (list, searchText='풍력' 페이지네이션)
     │      - 풍력 후보 → getDscssSttusDscssIngDetailInfoInqire (Ing detail, eiaCd 단건)
     │
     ▼
[transform.ts] list+detail merge
     │  - bizNm regex → industry='onshore_wind' (해상풍력 제외)
     │  - bizNm token → sigungu LUT 매칭 → region_sido/sigungu/sido_code
     │  - Ing detail items[].stateNm → evaluation_stage ('본안'/'전략'/'unknown')
     │  - source_payload 화이트리스트 (재호스팅 + PII 차단)
     │
     ▼
[D1 eia_cases 테이블 (staging swap)]
     │  - migration 0003 + 0004 적용
     │  - FTS5 가상 테이블 동기화 트리거
     │
     ▼
[/cases 페이지 (Astro SSR + React island)]
     │  - GET /api/cases?q=...&sido=...&capacity=...&year=...
     │  - SQL: FTS5 MATCH (prefix) → LIKE fallback → facet AND/OR
     │  - 결과 → CaseResultCard (카드) + CasePreviewPane (미리보기, formatLocation)
     │
     ▼
[사용자]
     - 카드 클릭 → 미리보기 (데스크톱) / 모바일 [caseId].astro 페이지
     - "EIASS 원문 열기" → eiassProjectUrl(eiaCd) 외부 링크
     - "Markdown 내보내기" → 클라이언트 빌드 .md 다운로드 (서버 호출 없음)
```

**일 호출 한도 가드**: 부트스트랩 1회 = list ~80-100 + Ing detail ~10 + retry ≤1
≈ ≤170 호출. 10K/일 한도 대비 1.7%. N≤500 까지 안전 마진.

**쿼리 보존 0**: 사용자 검색어/facet/클릭 이력은 서버 미저장 (Q7, §10.2 PII-safe
logging 만 INFO 레벨로 익명화 카운터).

---

## 5. 누적 운영 결과 (현 시점)

| 항목 | 값 | 비고 |
|---|---|---|
| 적재 풍력 사례 | 10건 | 모두 onshore_wind |
| evaluation_stage 분포 | 본안 8 / unknown 2 | unknown 2 = 양양 내현 + 삼척 천봉 |
| region_sido 매칭률 | 60% (6/10) | NULL 4 = 강원풍력(리파워링)/풍백/현종산/흘리 |
| evaluation_stage NOT NULL | 100% (10/10) | unknown 도 valid CHECK |
| detail call 성공률 | 100% (10/10) | retry 0회, fail 0건 |
| PII grep | 0건 | `ccilMemEmail`/`ccilMemNm` 화이트리스트 차단 |
| 단정 표현 grep | 0건 | `assertion-grep.sh` clean |
| Vitest tests | 320+ PASS | regression 0 |
| 사전 결함 격리 | 1건 | better-sqlite3 (§10.1) |

**P1 DoD 임계** (spec §11.2):
- evaluation_stage NOT NULL: ≥ 100% → **PASS** (10/10)
- region_sido NULL 비율: ≤ 50% → **PASS** (40%, 4/10)
- detail call 성공률: ≥ 80% → **PASS** (100%)
- PII grep: 0건 → **PASS**

**운영 URL 동작 확인 (사용자 직접, 2026-04-26 + 2026-04-27 + 2026-04-28)**:
- `/cases` 검색 페이지 렌더링 + 인트로 disclaimer 노출
- 검색어 "풍력" → 10건 카드 결과 + facet 시·도 강원 3 / 경북 3 / 결합 6
- 카드 클릭 → 미리보기 패널 region 표시 (P3 fix 후)
- EIASS deep-link 클릭 → 외부 이동 정상
- Markdown export → `docs/cases-2026-04-26.md` 산출물 보존

---

## 6. 의도한 방향성 vs 현재 상태 (Direction Check)

### Q1. 사용자에게 가장 중요한 가치는 무엇인가?

**의도**: "환경영향평가 보고서 작성·검수 시간 절감".

**현재**: 두 축 운영 중.
- **Scoping** (§2 영역 #2): rule pack 5종 onshore_wind 자동 체크리스트.
- **Similar cases** (§2 영역 #3-7): 사례 검색 + facet + 미리보기 + Markdown export.

**평가**: ✅ 방향성 일치. 두 축 모두 평가서 작성 시 즉시 시간 절감 효과. v0 파일럿
범위로 충분.

### Q2. 법령 준수 + 데이터 윤리

**의도**: 법적 단정 금지 / EIASS 재호스팅 금지 / PII 미적재 / 의견 임의 축약 없음.

**현재 가드 (모두 active)**:
- `assertion-grep.sh` 전역 단정 표현 차단 → 0 결과
- `check-similar-cases-assertions.sh` feature 전용 5종 차단 → 0 결과
- `source_payload` 화이트리스트 → PII / 본문 텍스트 미적재
- EIASS deep-link 만, 본문 미저장
- 도메인 리뷰 6 항목 (CLAUDE.md §9.3) 모든 PR 통과

**평가**: ✅ 방향성 일치. 가드가 코드 레벨에서 enforce 됨.

### Q3. 무료 인프라 운영 가능성

**의도**: Cloudflare 무료 등급 + 서버 LLM 미사용 + 외부 API 한도 내.

**현재 사용량**:
- D1: 0.0025% (10건 / 5 GB 한도)
- Pages 빌드: 1회/일 미만 / 3000회 한도
- Worker req: 인덱서 주 1회 미만 / 100K/일 한도
- data.go.kr: 1.7% (~170 / 10,000)

**평가**: ✅ 방향성 일치. 한도 대비 모든 레이어 < 5% 사용. 풍력 N≤500 까지
무리 없음. v1 에서 데이터셋 추가 시 재검토 필요.

### Q4. 확장 가능성

**의도**: 다른 EIA 데이터셋 + 다른 업종 + 신규 feature 영역 추가 가능.

**현재**: 패턴 검증 완료.
- 데이터셋 1개 (15142987) + 업종 1개 (onshore_wind) + feature 영역 8개
- 데이터셋 2번 교체 (15000800 → 15142998 → 15142987) — 교체 비용 측정됨
- transform.ts 의 stage-and-swap 인덱싱 패턴 → 신규 데이터셋 동일 패턴 적용 가능

**평가**: ✅ 방향성 일치. 첫 번째 데이터셋·업종으로 패턴 검증됨. 확장 시 동일
패턴 반복 가능. 신규 feature (draft-checker / opinion-response) 도 동일 디렉터리
구조 (`src/features/<name>/`) 로 격리 추가 가능.

---

## 7. 다음 권장 작업 (우선순위 + 시간 + 가치 + 리스크)

| 순위 | 작업 | 예상 시간 | 가치 | 리스크 |
|---|---|---|---|---|
| 1 | LUT 19 entry 확장 (`data/region/sigungu-lut.json` 6→19) | 2-3h | 🟢 큼 (region 60→90%) | 🟢 작음 (KOSTAT 코드 검증만) |
| 2 | sido fallback (`bizNm` 어근 substring → sidoCode) | 1h | 🟡 중 (4건 NULL 해소) | 🟢 작음 (regex 1줄 추가) |
| 3 | stateNm 매핑 확장 (`'본안협의'` substring + LIST fallback) | 1h | 🟡 중 (2건 unknown 해소) | 🟢 작음 (mapper 1 함수) |
| 4 | 모바일 subtitle cosmetic (`[caseId].astro:32-35`) | 30min | 🟢 작음 (cosmetic) | 🟢 작음 (1줄 patch) |
| 5 | 다른 EIA 데이터셋 (15142988 협의완료) 통합 | 6-8h | 🟢 큼 (본안 confirmed 사례 풍부도) | 🟡 중 (신규 zod 스키마 + filter 검증) |
| 6 | 신규 feature (draft-checker / opinion-response 등) | 8-12h | 🟢 큼 (새 사용자 가치 영역) | 🔴 큼 (spec/plan/UI/test 신규) |

**다음 세션 권장**:
- **빠른 가치**: #1 LUT 확장 (2-3h) — region 매칭률 즉시 60→90%, 사용자 즉시 체감.
- **확장 검증**: #5 신규 데이터셋 (6-8h) — v1 기반 다지기, 패턴 반복 검증.
- **새 영역 시작**: #6 신규 feature (8-12h) — 평가서 작성 → draft-checker 자연스러운
  다음 단계.

세 가지 모두 가치 있음. 사용자가 "이번 주 사용자 피드백 / 운영 부담 / 학습
욕구" 중 어느 축이 우선인지에 따라 결정 권장.

---

## 8. 핵심 파일 인덱스 (이전 handover 와 중복, 빠른 참조용)

### 8.1 spec / 계획
- `docs/design/feature-similar-cases.md` — similar-cases 전체 spec (P1 patches 포함)
- `docs/handover/2026-04-25-similar-cases-handover.md` — v0 시작
- `docs/handover/2026-04-26-similar-cases-deployed.md` — v0 deploy 결과
- `docs/handover/2026-04-27-cases-detail-deployed.md` — P1 detail 통합
- `docs/handover/2026-04-28-p3-region-fix-deployed.md` — P3 region-fix (이번 세션)

### 8.2 코드 (similar-cases)
- `src/features/similar-cases/transform.ts` — list+detail merge → eia_cases 행
- `src/features/similar-cases/sigungu-parser.ts` — biz_nm → sigungu/sido
- `src/features/similar-cases/evaluation-stage-mapper.ts` — stateNm → 본안/전략/unknown
- `src/features/similar-cases/format-location.ts` — region_sido/sigungu → 라벨 (P3)
- `src/features/similar-cases/markdown-export.ts` — MD 다운로드
- `src/features/similar-cases/search-query.ts` — FTS5 + LIKE + facet

### 8.3 UI (similar-cases)
- `src/pages/cases/index.astro` — `/cases` SSR shell
- `src/pages/cases/[caseId].astro` — 모바일 fallback 페이지
- `src/components/cases/CaseSearchPage.tsx` — React island
- `src/components/cases/CaseResultCard.tsx` — 카드
- `src/components/cases/CasePreviewPane.tsx` — 데스크톱 미리보기
- `src/components/cases/CaseFacetPanel.tsx` — facet 패널

### 8.4 인프라
- `migrations/0001_init.sql` ~ `0004_relax_cases_constraints.sql`
- `workers/cases-indexer.ts` + `workers/cases-indexer.wrangler.toml` (cron 미설정)
- `workers/cleanup.wrangler.toml` (cleanup worker, cron 03:00 KST 활성)
- `scripts/cases-bootstrap.ts` (수동 부트스트랩)

### 8.5 가드
- `scripts/assertion-grep.sh` — 단정 표현 차단
- `scripts/check-similar-cases-assertions.sh` — feature 전용 5종 차단
- `.github/workflows/ci.yml` — typecheck + lint + test + assertion-grep + build + E2E

---

**끝.** 본 문서는 프로젝트의 정적 스냅샷. 다음 세션 시작 시 정독 후 §7 표를
참고해 우선순위 #1 결정 → 작업 시작.
