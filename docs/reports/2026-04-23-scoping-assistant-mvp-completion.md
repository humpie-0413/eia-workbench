# scoping-assistant v2 MVP 완료 리포트

**작성일**: 2026-04-24
**브랜치**: `feature/scoping-assistant`
**대상 업종**: 육상풍력 (onshore_wind) — v0 범위
**범위**: 환경영향평가 프로젝트의 스코핑 보조 기능 v2 (입력 폼 + 5 rule pack + 결과 UI + export + Claude 수동 프롬프트)

---

## §A. 산출물 요약

### 커밋 체인 (10)

| # | SHA | 범위 |
|---|-----|------|
| 1 | `7a68395` | Phase 1 — DSL 확장 결정 (`dsl-decision.md`, M-D self-DSL) + js-yaml 의존성 |
| 2 | `14f9cfe` | Phase 2 — migration 0002 + units/zone/types + Zod schema |
| 3 | `b7923e2` | Phase 3 — rule pack YAML v2 + loader + engine |
| 4 | `bc90c3c` | Phase 4 — POST/GET scoping + runs list + runId endpoints |
| 5 | `94a6b0a` | Phase 5 — scoping 결과 5종 badge 토큰 + WCAG AA 대비 (DESIGN.md §2.1) |
| 6 | `0b555dc` | Phase 5 — UI 입력/결과/히스토리 + 내보내기 + Claude 프롬프트 생성기 |
| 7 | `2777232` | Phase 5 session_log 항목 |
| 8 | `f4b19cb` | Phase 6 — cron scoping_runs 확장 + YAML 단정어 grep + rule pack audit trip-wire |
| 9 | `e48433f` | Phase 6 session_log 항목 |
| 10 | `f4f3db5` | Phase 7 — E2E 5 specs + axe scoping + crud-happy hydration fix |

### 파일 변경량

- 54 files, +3,253 / −52
- 신규 파일 43건: feature 코드 18, 스키마/타입 3, rule pack 1, API 4, UI 컴포넌트 4, script 2, 테스트 11

### 주요 산출물 디렉터리

```
data/rules/scoping/
  onshore_wind.v2.yaml                  — 5 rules + rule_pack_audit 메타
  reference/                            — 법제처 PDF 3개 (.gitignore)
docs/
  findings/2026-04-22-…audit.md §8      — PASS 2026-04-23
  reviews/feature-scoping-assistant-v2.md — /autoplan 3리뷰 + §9.3 6/6 PASS
  superpowers/specs/2026-04-23-…-v2.md  — spec v2 (528 line)
  plans/feature-scoping-assistant-v2.md — plan v2 (1556 line, 33 task)
migrations/0002_scoping.sql             — scoping_runs 테이블
prompts/scoping-manual.md               — Claude 수동 분석 템플릿 M-B
scripts/verify-rule-pack-audit.mjs      — issue #13 trip-wire
src/features/scoping/                   — engine, loader, units, zone, export, prompt-generator
src/components/scoping/                 — ScopingForm/Results/AreaInput/RunHistoryList
src/lib/{types,schemas}                 — StandardAnalysisResult + Zod
src/pages/{api/,}projects/[id]/scoping  — SSR 페이지 + 4 엔드포인트
tests/e2e/scoping-*.spec.ts             — 5 specs
tests/unit/api-scoping.test.ts          — 8 API 케이스
workers/cron-cleanup.ts                 — scoping_runs 30일 하드삭제 확장
```

---

## §B. 검증 결과 (로컬, 2026-04-24)

| Gate | 결과 | 비고 |
|------|------|------|
| `npm run typecheck` | 0 errors / 0 warnings / 0 hints | 101 Astro files |
| `npm run lint` | clean | ESLint + Prettier 모두 pass |
| `npm test` | 193/193 passed | 33 test files, 2.24s |
| `npm run verify:rule-pack-audit` | 1/1 rule pack(s) PASS | issue #13 trip-wire |
| `npm run build` | Complete | 495ms Vite + 3.06s server |
| `npm run test:e2e` | 12/12 passed (2연속) | 6 workers, 22–23s |

### E2E 12 테스트 (breakdown)

| # | Spec | 범위 |
|---|------|------|
| 1 | axe-smoke | login page a11y |
| 2 | axe-smoke | project list a11y |
| 3 | axe-smoke | project detail a11y |
| 4 | axe-smoke | **scoping page a11y (신규)** |
| 5 | crud-happy | login → create → upload PDF → delete → restore (**hydration-safe 재작성**) |
| 6 | hwp-reject | dropzone HWP 거부 + Hancom 안내 |
| 7 | quota-exceeded | >30MB 파일 거부 |
| 8 | **scoping-happy-v2** | 2 triggered + 3 skipped + rule pack version DOM |
| 9 | **scoping-unit-toggle-v2** | ha 입력 POST body ㎡ 정규화 |
| 10 | **scoping-accordion-v2** | `<details>` open 토글 |
| 11 | **scoping-copy-prompt** | clipboard 7개 섹션 |
| 12 | **scoping-history** | 실행 기록 등록 + 재로드 |

---

## §C. `/autoplan` 3리뷰 요약 (`docs/reviews/feature-scoping-assistant-v2.md` §A 참조)

- **CEO (제품)**: 실무시간 절감 타깃 정렬. 유료 LLM 회귀 없음 (grep 방어). 법적 단정 회피 (`likely_*` enum + 고정 배너). 법령 재감사 BLOCKING 유지.
- **Design (UX/a11y)**: 이모지·그라데이션·일러스트 없음. 5 색 토큰 WCAG AA ≥4.5:1. 섹션 분리 + accordion (`<section>/<details>`) 패턴. axe-smoke 4 경로 0 위반. `/design-review` 는 USER 수동 실행 필요.
- **Eng (구현)**: 순수 함수 엔진 + YAML + Zod. self-DSL 확장 (`one_of`/`gte_by_zone`). D1 전용 (R2 미사용). Cron 30일 하드삭제 + CEILING=1000 가드. PII-safe logger 준수.

---

## §D. CLAUDE.md §9.3 환경영향평가 도메인 리뷰

| # | 항목 | 결과 |
|---|------|------|
| ① | 법적 결론 단정 여부 | **PASS** — `likely_*` enum + 고정 배너 + `lint-copy.ts` YAML 확장 (f4b19cb) |
| ② | 현지조사 대체 주장 여부 | **PASS** — 모든 `limits` 비어있지 않음, `needsHumanReview: true` 리터럴 타입 강제 |
| ③ | EIASS 원문 재호스팅 여부 | **PASS** — `citation_url` 만, PDF 로컬 전용 `.gitignore` |
| ④ | 주민·기관 의견 왜곡 여부 | **N/A** — 본 기능 범위 밖 |
| ⑤ | 결과 객체 표준 스키마 | **PASS** — `StandardAnalysisResult` 강제 + Zod |
| ⑥ | 법령 숫자 원문 대조 | **PASS** — T1 재감사 (2026-04-23) + `rule_pack_audit` 메타 + CI trip-wire |

**결론**: 6/6 PASS. 상세 근거는 review note §B.

---

## §E. 알려진 한계 (파일럿 이후 재검토 대상)

- **엔진 `equals` false → `condition_not_met`**: skip_reason 라벨이 "해당 임계값에 도달하지 않았습니다." 로 표시. 사용자 직관은 `zone_mismatch` 예상 가능 — UX 개선 여지.
- **단일 업종**: 육상풍력 only. 태양광·해상풍력은 v3 법령 재감사 필수.
- **`capacity_mw` optional 유지**: 초기 검토 단계 빈번 미확정 — 필수화 요구 시 rule 1 UX 재설계.
- **미구현 (v0 범위 외)**: PDF export, 공유 URL, run history 필터·검색, UI "규칙 부정확" 신고 버튼, GIS 보호구역 연동.

---

## §F. 후속 이슈 후보

| ID | 항목 | 우선 |
|----|------|------|
| 09 | 법령 refLink 체커 자동화 (cron or CI 주1회) | P2 |
| 10 | 도시지역 rule (녹지 1만㎡ / 도시 6만㎡) | P2 |
| 11 | 산지관리법 시행규칙 별표4 수령 + 풍력 세부 rule | P3 |
| 12 | 보호구역 GIS 연동 | P3 |
| 13 | client:load hydration signal 표준화 (Phase 7 경험) | P3 |

---

## §G. 다음 단계

USER 액션 목록은 `docs/reports/2026-04-23-user-actions-required.md` 참조. 요약:

1. PR 생성 (`gh pr create`) — CLAUDE.md §9.5 PR-only.
2. `/design-review` 로컬 URL 수동 실행 (자동 수정 10건 한도).
3. 머지 후 프로덕션 D1 `0002_scoping.sql` 적용.
4. 프로덕션 스모크 (프로젝트 → `/scoping` → 5 rules run → history 1건).
