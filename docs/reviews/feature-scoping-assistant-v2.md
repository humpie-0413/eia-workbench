# Review note — feature/scoping-assistant-v2

> 병합 전 리뷰 노트. `/autoplan` 3중 리뷰 (CEO/Design/Eng) 요약 + CLAUDE.md §9.3 환경영향평가 도메인 리뷰 Pass/Fail 표 + 알려진 한계 + 후속 작업.

- **브랜치**: `feature/scoping-assistant`
- **커밋 체인**: `7a68395 → 14f9cfe → b7923e2 → bc90c3c → 94a6b0a → 0b555dc → 2777232 → f4b19cb → e48433f → f4f3db5` (10 commits)
- **변경 범위**: 54 files, +3,253 / −52
- **기반 문서**:
  - spec v2: `docs/superpowers/specs/2026-04-23-scoping-assistant-design-v2.md`
  - plan v2: `docs/plans/feature-scoping-assistant-v2.md`
  - audit findings: `docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md` §8 (PASS 2026-04-23)
  - issue #13: `docs/issues/13-spec-law-audit-mandatory.md`

---

## §A. `/autoplan` 3중 리뷰 (CEO / Design / Eng)

### ① CEO 관점 — 제품 가치·시장 적합성

**Pass 요점**

- **실무시간 절감 타깃과 정렬**. 평가사가 내부 리뷰용 스코핑 체크리스트 초안을 매뉴얼 없이 export 까지 도달 가능 (spec §14 성공 지표). 공공 포털 단순 복제가 아닌 B2B SaaS MVP 방향 유지 (CLAUDE.md §1).
- **CLAUDE.md §2-2 위반 없음**. 유료 LLM API 상시 호출 0건. Claude 수동 분석은 클립보드 복사 방식 (`src/features/scoping/prompt-generator.ts` + `prompts/scoping-manual.md`). CI grep 이 `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`GOOGLE_API_KEY` 회귀 차단.
- **법적 결론 단정 회피**. UI 고정 배너 ("내부 검토용 초안…") + result enum `likely_*` prefix + `needsHumanReview: true` 리터럴. `lint-copy.ts` 가 YAML 단정어까지 grep (Phase 6 f4b19cb).
- **향후 상용화 경로 유지**. rule pack v2 의 `rule_pack_audit` 메타 필드 + `scripts/verify-rule-pack-audit.mjs` CI step → 규칙 수정 PR 이 법령 원문 대조 없이는 머지 불가 (issue #13 trip-wire 로 상시 방어).

**Concerns / follow-up**

- `capacity_mw` optional 유지 (Q6-v2): 초기 검토 단계에서 용량 미확정 빈번 가정. 파일럿 피드백 후 필수화 전환 검토 필요.
- v2 는 육상풍력 단독 (Q1-v2). 2번째 업종 (태양광·해상풍력) 확장은 v3 분기 — 법령 재감사 + spec v3 작성 병행.
- 프로젝트당 run history 최대 10건 (spec §10) — 감사 트레이스 필요 고객 발생 시 관리 UI 분리 고려.

### ② Design 관점 — UI/UX·접근성

**Pass 요점**

- **이모지·그라데이션·일러스트 없음** (CLAUDE.md §9.1 §7 규칙 준수). 색 토큰은 DESIGN.md §2.1 5종 (`scoping-badge-applicable/check/not-applicable/unknown/skipped`) — 모두 WCAG AA 4.5:1 이상 확인.
- **섹션 분리 + accordion 패턴 (Q7=c)**. 발동 rule 은 상단 카드, skip rule 은 `<section aria-label="스킵된 규칙">` 안 `<details>/<summary>` 기본 접힘. 사용자가 감사 필요 시 펼침.
- **단위 토글 오류 방지 (Q3-v2=c)**. `AreaInput` 에 `㎡` / `ha` selector 제공, 내부 저장은 항상 ㎡ 정규화 (`normalizeAreaToSqm`, round-trip identity 테스트).
- **a11y landmark**. axe-smoke 4경로 (login/list/detail/scoping) 모두 `moderate+` severity 위반 0건. `<section aria-label>` / `<complementary aria-label="스코핑 한계 고지">` / `<details>` 로 semantic 구조 유지. Keyboard nav 가능 (details/summary 네이티브).
- **결과 카드 정보 밀도**. 결과 배지 + title + category + basis(citation_url 외부링크) + assumptions + limits + `needsHumanReview` + `rule_pack_version` — 모든 필드가 감사·리뷰 시 추적 가능.

**Concerns / follow-up**

- `/design-review` 는 FULL-AUTO 모드에서 대화형 브라우저 세션이 필요해 **미실행** (사용자 액션). Merge 전 또는 로컬 staging 에 대해 `/design-review http://localhost:3000/projects/<id>/scoping` 수동 실행 권장 (CLAUDE.md §9.4). 자동 수정 한도 10건 이하 유지.
- 결과 카드가 많을 때(5 rules 전체 발동 + skip) 스크롤 길어짐. 파일럿 피드백 후 sticky header 또는 mini-nav 검토.
- run history 는 좌측 사이드바에 flat 리스트. 필터/검색 미구현 (v0 범위 외).

### ③ Engineering 관점 — 구현·유지보수성·성능

**Pass 요점**

- **순수 함수 엔진 + YAML rule pack + Zod**. `src/features/scoping/engine.ts` 는 외부 I/O 없음, deterministic. 25+ 단위 테스트 (`engine.test.ts` 260 line) 분기 커버리지 ≥95%.
- **self-DSL 확장 채택** (M-D 결정, `src/features/scoping/dsl-decision.md`). v1 의 6 연산자 + v2 의 `one_of`/`gte_by_zone` 2 연산자. json-logic-js 기각 근거 문서화.
- **Cloudflare Pages 무료 구간 유지**. D1 `scoping_runs` 테이블 1개 + 기존 Cron cleanup 확장. R2 사용 안 함 (입력·결과 JSON 만 D1 저장, spec §4). 유료 벡터스토어 없음.
- **마이그레이션 + cron 가드**. `migrations/0002_scoping.sql` 호환 확인 (migration-0002-shape 테스트), `workers/cron-cleanup.ts` 확장 시 `CRON_HARD_DELETE_ROW_CEILING=1000` 동일 가드, 에러 격리 유지 (cron-cleanup.test.ts).
- **보안**. 기존 middleware (Origin 검사, CSP, 인증, PII-safe logger) 자동 적용. Rate-limit 프로젝트당 분당 10회. `input_json`/`output_json` 은 로그에 쓰지 않음 (spec §12).
- **회귀 trip-wire**. `scripts/verify-rule-pack-audit.mjs` + CI step 이 `audit_verdict=PASS` + `findings_doc` 존재 + `source_pdfs` 디스크 존재 검증. 법령 재감사 없이는 YAML 수정 PR 블록.
- **테스트 통과율**. 193/193 unit + 12/12 E2E 로컬 2연속 안정 (Phase 7 commit f4f3db5).

**Concerns / follow-up**

- 입력 `EvalInput` 의 `notes` 는 의도적으로 엔진 input 에서 제외되고 DB 저장만 (spec §5). 향후 "메모로 GIS 좌표 힌트" 같은 확장 시 타입 재설계 필요.
- `engine.ts` 의 `equals` 연산자 false 는 `condition_not_met` skip_reason 으로 귀결 — 이 동작이 사용자에게 직관적인지 파일럿 확인 필요 (v1 spec plan 문구는 `zone_mismatch` 였고 plan T24 초안도 같음; 엔진 실제 동작은 `condition_not_met`, Phase 7 E2E 에서 교정).
- scoping run 이 삭제될 때 R2 객체가 없어 cascade 가 필요 없으나, 향후 PDF attachment 추가 시 upload 와 동일한 soft-delete + cron 2-phase 구조 필요.

---

## §B. CLAUDE.md §9.3 환경영향평가 도메인 리뷰 (6-item)

`/autoplan` 직후 수동 실행이 규정 (CLAUDE.md §9.3). 6-item 중 ⑥은 issue #13 에서 신규 추가.

| # | 항목 | Pass / Fail | 근거 |
|---|------|------------|------|
| ① | 법적 결론 단정 여부 | **PASS** | UI 모든 result enum `likely_applicable / needs_check / likely_not_applicable / unknown / skipped` (spec §6). UI 라벨 "대상 가능성 / 검토 필요 / 비대상 가능성 / 판단 보류 / 해당 없음" 모두 가능성 표현. 고정 배너 `<complementary aria-label="스코핑 한계 고지">` ("내부 검토용 초안…"). `scripts/assertion-grep.sh` 가 TypeScript + YAML 단정어 grep — build 실패 trip-wire (commit f4b19cb). E2E scoping-happy-v2 + axe-smoke 에서 고정 배너 어서션 green. |
| ② | 현지조사 대체 주장 여부 | **PASS** | 모든 `ScopingResult.limits` 비어있지 않음 (rule pack 5 rules 전체 ≥1 limit). rule 4 limit: "용도지역 경계 중첩 시 가장 보전 등급 높은 지역 기준 판정. 복합 지역은 전문가 검토 필요." rule 5 limit: "보전산지(공익용/임업용) 여부는 별도 확인 필요. 본 결과는 '검토 필요' 수준." 모든 ScopingResult 에 `needsHumanReview: true` 리터럴 강제 (타입 시스템). |
| ③ | EIASS 원문 재호스팅 여부 | **PASS** | rule pack basis 는 `citation_url` (공식 law.go.kr 링크) 만. 법제처 PDF 3개는 `data/rules/scoping/reference/` 로컬 전용, `.gitignore` 에 `*.pdf` 포함 (v1 rename 시 확인). `data/rules/scoping/reference/README.md` + `MANIFEST.md` 가 재호스팅 금지 정책 명문화. R2 업로드·배포 번들 포함 0건. |
| ④ | 주민·기관 의견 임의 축약/왜곡 여부 | **N/A** | 본 기능은 rule pack 기반 정량 검토. 주민·기관 의견 처리는 별도 feature (`feature/opinion-response`, v1+) scope. 본 PR 에서 의견 데이터 handling 0건. |
| ⑤ | 결과 객체 표준 스키마 포함 여부 | **PASS** | `src/lib/types/analysis-result.ts` `StandardAnalysisResult` 에 `result / basis / assumptions / limits / needsHumanReview: true` 리터럴 강제. `ScopingResult extends StandardAnalysisResult` 로 `ruleId / title / category / rule_pack_version / triggered / skip_reason?` 확장. Zod `scopingInputSchema` (`src/lib/schemas/scoping.ts`) 가 엔진 입력 검증. 54 files 전체가 이 스키마만 사용 (type grep 통과). |
| ⑥ | 법령 숫자 원문 대조 여부 (issue #13 신규) | **PASS** | T1 BLOCKING 감사는 2026-04-23 PASS. `docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md` §8 "2026-04-23 재감사 결과" 에 별표3/별표4/산지관리법 별표4 PDF 기반 5 rules 1:1 대조 표. rule pack v2 는 `rule_pack_audit` 메타 (`audit_verdict: PASS`, `audit_date: 2026-04-23`, `source_pdfs: [3개 PDF 상대경로]`) 를 YAML 최상단에 기록. `scripts/verify-rule-pack-audit.mjs` + CI step 이 (a) `audit_verdict=PASS`, (b) `findings_doc` 존재, (c) `source_pdfs` 디스크 존재 3가지를 build 마다 검증. 법령 개정·rule 추가 PR 은 이 gate 를 통과해야 머지. |

**결론**: 6/6 PASS. §9.3 규정 3중 방어선 (code grep + 결과 schema + findings doc + runtime trip-wire) 모두 작동.

---

## §C. 알려진 한계 (`limits` → spec §15 + OH v2 가정)

- `Q1-v2`: onshore_wind 단독. 육상 태양광·해상풍력 요청 시 v3 spec 분기 (법령 재감사 필수).
- `Q3-v2`: ㎡/ha 이중 단위 입력 UX — 파일럿 피드백 시 단일 단위로 재도입 여지.
- `Q6-v2`: `capacity_mw` optional. 초기 검토 단계 미확정 케이스 빈번 가정 — 필수화 요구 시 rule 1 UX 재설계.
- `Q7-v2`: accordion 기본 접힘 — 회색 카드 전개 등 대체 UX 검토.
- `C1`: 산지관리법 시행규칙 별표4 미수령 — 시행령 660㎡ 일반 기준으로 MVP 충분, 시행규칙 수령 시 rule 5 보강.
- 엔진 `equals` false → `condition_not_met`: 사용자 직관 테스트 필요 (`zone_mismatch` 예상 가능).
- run history 필터/검색 미구현 (v0 범위 외).
- PDF export, 공유 URL, UI "규칙 부정확" 신고 버튼 (v3).

---

## §D. 후속 작업 (follow-up issues)

| ID | 항목 | 우선순위 |
|----|------|---------|
| 09 | 법령 refLink 체커 자동화 (cron or CI 주1회) | P2 |
| 10 | 도시지역 rule 추가 (녹지 1만㎡ / 도시 6만㎡) | P2 |
| 11 | 산지관리법 시행규칙 별표4 수령 + 풍력 세부 rule | P3 |
| 12 | 보호구역 GIS 연동 | P3 |

Phase 7 의 E2E hydration race 발견 경험 반영:

- 13 (신규 제안): `DataAttribute` 기반 client island hydration signal 표준화 — UploadDropzone 등 `client:load` 컴포넌트에 `data-hydrated="true"` 를 `useEffect` 로 부여 → Playwright 에서 `waitFor` 가능. 현재 Phase 7 는 `page.waitForRequest` 로 우회하나 패턴 표준화 필요.

---

## §E. 머지 체크리스트 (USER 액션)

- [ ] PR 생성 (CLAUDE.md §9.5: PR 까지만 허용, 자동 배포 금지).
- [ ] `/design-review http://localhost:3000/projects/<id>/scoping` 수동 실행 + 최대 10건 자동 수정 한도 이내 확인.
- [ ] CI verify chain green: `typecheck + lint + test + test:e2e + verify:rule-pack-audit + build`.
- [ ] `docs/reports/2026-04-23-scoping-assistant-mvp-completion.md` + `docs/reports/2026-04-23-user-actions-required.md` 검토.
- [ ] 수동 머지 (사용자 정책 + `feedback_push_authorization.md` 메모리: push/merge 는 USER 전용).
- [ ] 프로덕션 D1 migration `0002_scoping.sql` 수동 적용 (`wrangler d1 migrations apply DB --remote`).
- [ ] 프로덕션 스모크 (프로젝트 생성 → `/scoping` 접근 → 5 rules 1 run 실행 → history 1건 확인).
