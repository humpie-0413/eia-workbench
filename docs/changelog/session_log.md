# session_log.md

각 세션 종료 시 한 항목씩 위쪽에 추가. 형식:

```
## YYYY-MM-DD — <짧은 요약>
- 완료: ...
- 다음: ...
```

---

## 2026-04-24 — feature/scoping-assistant-v2 Phase 7 완료 (FULL-AUTO)
- **완료**: Phase 7 E2E T24-T28 — scoping-happy-v2 (2 triggered + 3 skipped + rule pack version DOM 검증, skip_reason 문구는 엔진 실제 동작인 `condition_not_met` 로 수정), scoping-unit-toggle-v2 (ha 입력 POST body `site_area_m2=8000` + `site_area_input_unit='ha'` 정규화 `page.waitForRequest` 로 검증), scoping-accordion-v2 (`<details>` `open` 속성 토글 + 문구 가시성), scoping-copy-prompt (clipboard API `grantPermissions` + 7개 섹션 문자열 검증), scoping-history (실행 기록 등록 + 재로드 후 rule-pack-version 유지), axe-smoke 에 `/projects/[id]/scoping` 4번째 경로 추가. 기존 crud-happy / hwp-reject 에 axe-smoke 패턴의 hydration 재시도 (`expect(async () => { openButton.click(); await expect(nameInput).toBeVisible(...) }).toPass(...)`) 적용. crud-happy 업로드 assertion 을 `page.waitForRequest` 기반 hydration-safe 패턴으로 재작성 (UploadDropzone client:load 가 setInputFiles 보다 먼저 hydration 완료되지 않으면 onChange 가 attach 되지 않아 POST 자체가 안 나가는 근인 수정 — 이중 업로드 위험 없음, React 는 hydration 직전 이벤트를 replay 하지 않음). ephemeral toast assertion 은 영구 DB state 인 `cell` assertion 으로 대체. 로컬 12/12 E2E 녹색 2연속 (23s). commit 1: Phase 7 (pending).
- **다음**: Phase 8 (T29-T33) — `/design-review` 실행, `/autoplan` 3중 리뷰 + §9.3 도메인 리뷰 표, 최종 verify chain, review note + progress.md + session_log, 4-option 마감 프롬프트. 최종 리포트 2건 (`docs/reports/2026-04-23-scoping-assistant-mvp-completion.md`, `docs/reports/2026-04-23-user-actions-required.md`) 작성.

## 2026-04-24 — feature/scoping-assistant-v2 Phase 6 완료 (FULL-AUTO)
- **완료**: Phase 6 T21-T23 — workers/cron-cleanup.ts 에 scoping_runs 30일 하드삭제 추가 (3번째 COUNT 병렬화 + CEILING 1000 total 확장 + 에러 격리 유지), scripts/assertion-grep.sh 에 `data/rules/**/*.yaml` 스캔 브랜치 (prompt-generator.ts / markdown-export.test.ts 는 의도적 guardrail 문자열로 예외), scripts/verify-rule-pack-audit.mjs (issue #13 trip-wire: audit_verdict=PASS + findings_doc + source_pdfs 디스크 존재 검증) + CI step + `npm run verify:rule-pack-audit`. 193/193 test (6 신규). commit 1: `f4b19cb`.
- **다음**: Phase 7 (E2E + reports T24-T33) — 5 E2E spec 작성 (happy/unit-toggle/accordion/copy-prompt+history), axe-smoke 경로 확장, `/design-review` 실행, 도메인 리뷰 (§9.3), 최종 verify + review note, PR 생성.

## 2026-04-24 — feature/scoping-assistant-v2 Phase 5 완료 (FULL-AUTO)
- **완료**: Phase 5 UI T14-T20 — `/projects/[id]/scoping` SSR (AppLayout + 탭 + 법적 한계 고지 aside), ScopingForm + AreaInput + ScopingResults(발동은 노출, 스킵은 `<details>` 아코디언) + RunHistoryList (CustomEvent `scoping:run` / `scoping:load-run` 기반 cross-island 상태), prompt-generator.ts (Claude 수동 분석 M-B 템플릿 + CLAUDE.md §2 단정 금지 문구) + prompts/scoping-manual.md, csv-export.ts (RFC 4180 + CRLF + pipe 다값) + markdown-export.ts (법적 한계 고지 + 발동/스킵 섹션), DESIGN.md §2.1 5종 배지 토큰 (WCAG AA ≥ 4.5:1). 188/188 test (12 신규), typecheck 0, lint clean. commit 2: `94a6b0a` (배지 토큰) + `0b555dc` (UI/export/prompt).
- **다음**: Phase 6 (Cron + lint + build verify T21-T23) — workers/cron-cleanup.ts 에 scoping_runs 30일 하드삭제 확장 + CEILING 1000 guard, lint-copy.ts 로 YAML 단정 표현 grep, scripts/verify-rule-pack-audit.ts + CI step.

## 2026-04-24 — feature/scoping-assistant-v2 Phase 1~4 완료 (FULL-AUTO)
- **완료**: plan v2 기반 자율 실행 Phase 1 (DSL decision doc + js-yaml T2), Phase 2 (units/zone/analysis-result/scoping schema + migration 0002 T3-T7), Phase 3 (rule-pack-loader + engine 6 operators + onshore_wind.v2.yaml 5 rules T8-T10), Phase 4 (POST/GET /api/projects/[id]/scoping + runs list + [runId] detail/soft-delete T11-T13). 테스트 그린: engine 케이스 + api-scoping 8 케이스 (memDb mock). commit 4 (`bc90c3c`): Phase 4 API 엔드포인트.
- **다음**: Phase 5 (UI T14-T20: Astro SSR + ScopingForm + AreaInput + ScopingResults + RunHistoryList + CSV/Markdown export + Claude prompt generator + DESIGN.md badge tokens) 착수.

## 2026-04-22/23 — feature/scoping-assistant T1 법령 감사 FAIL → A안 채택 (세션 정리)
- **완료**: 이전 세션에서 Office Hours + brainstorming + writing-plans 로 `docs/superpowers/specs/2026-04-22-scoping-assistant-design.md` + `docs/plans/feature-scoping-assistant.md` (v1, 26 task) 작성. 본 세션에서 FULL-AUTO DELEGATION 실행 중 Phase 2 T1 (법령 원문 대조) 에서 STOP GATE 발동 — spec §7 rule pack 의 4개 규칙 **모두** 법령 원문과 불일치. CRITICAL 2 (`capacity_mw>=10` 실제 100 MW, citation `별표2` 실제 `별표3`) + HIGH 2 (소규모 EIA 축이 면적·용도지역인데 발전용량으로 작성, `forest_conversion_ha>1` 실제 `>0.066 ha=660㎡`). 사용자가 A안(입력 스키마·rule pack 재설계) 채택. 산출물 5건 준비: `docs/findings/2026-04-22-scoping-rule-pack-legal-audit.md` (감사 리포트), `docs/office-hours/2026-04-23-scoping-assistant-v2-redesign.md` (Q1~Q10 설계 질문), `data/rules/scoping/reference/{README,MANIFEST}.md` (PDF 로컬 배치 정책, 재호스팅 금지), `.gitignore` 에 `data/rules/scoping/reference/*.pdf` 추가, `docs/issues/13-spec-law-audit-mandatory.md` (CLAUDE.md §9.3 ⑥ 항목 추가 제안). v1 산출물 (spec + plan) 은 본 WIP commit 에 그대로 포함, v2 작성 시 `-superseded-by-v2` suffix 로 rename 예정. push 금지 (CLAUDE.md §9.5 + 사용자 정책, 사용자가 `git show --stat` 확인 후 판단).
- **배운 것**:
  1. **법령 숫자는 원문 대조 없이 spec 에 박지 말 것.** 2차 자료 조사조차 없이 "그럴 것 같다" 로 작성된 4개 규칙이 모두 틀렸음.
  2. **Office Hours 의 "미검증 가정 §0" 이 실제로 재앙 방지 방어선으로 작동.** spec §0 + §16 경고 + plan T1 BLOCKING task 가 3중 방어선을 형성했고, plan T1 이 실제 차단.
  3. **Claude 와 사용자 양쪽 다 "그럴 것 같다" 로 지어내는 경향 있음.** CLAUDE.md §9.3 에 ⑥ "법령 숫자 원문 대조 여부" 항목을 추가해 체크포인트 명문화 필요 (issue 13).
- **다음**: 사용자가 (a) 법제처 별표 PDF 3개 수동 다운로드 → `data/rules/scoping/reference/` 배치, (b) OH v2 Q1~Q10 답변. 완료 시 Claude 가 PDF 기반 T1 재감사 → spec v2 + plan v2 작성 → FULL-AUTO DELEGATION 재개.

## 2026-04-22 — v0 Cloudflare 배포 완료 + CSS/env fix 2건 + 후속 이슈 7건
- 완료: Phase 0~8 전체. `https://eia-workbench-v0.pages.dev` 프로덕션. 두 건의 post-ship 수정 — `79a8a7b` CSS fix (layout frontmatter import + `scripts/check-build-css.sh` 2-signal CI verify), `0bfd35c` wrangler env fix (`[env.production.vars]` + 비상속 바인딩 재선언 + `scripts/check-wrangler-prod-vars.sh` 5-signal CI verify). Cleanup worker 별도 배포(cron `0 18 * * *`). 프로덕션 시크릿 창 스모크: 로그인 302 → 프로젝트 CRUD → 업/삭/복 → 드로어 전부 통과. Turnstile hostname `eia-workbench-v0.pages.dev` 단일 허용 적용 후에도 로그인 통과. systematic-debugging 으로 "대시보드 UI env 주입이 잠기는 이유" 근인 확정 (wrangler.toml `[vars]` 가 소스 오브 트루스로 고정되면 대시보드 plain var 편집 lockout). 계획 문서 fixup: §3.3 `_cf_KV` 주석 정정, §5.2 `--commit-dirty=true` 명시, §5.4 Turnstile hostname scope ≠ CSRF 경고, §4.A 변경 사유 주석. 스모크 플레이북 `docs/deploy/v0-smoke-playbook.md`, 후속 이슈 7건 `docs/issues/01-07.md` 작성.
- 다음: `docs/issues/01-07` 7건을 GitHub Issues 로 올림 (P1: `02 preview APP_ORIGIN`, `03 prod-like E2E` 먼저). 이후 `feature/design-system` 오피스 아워 또는 housekeeping #40/#41 처리.

## 2026-04-21 PM — PR #1 CI green + merged

완료: a11y fix 3커밋 + CI infra 3커밋 → verify green → merge
변경: AuthLayout 신규, PilotWarningBanner 이동, axe-smoke 강화, `.dev.vars` seed workflow, `upload-artifact` on failure, CI trigger scope 축소
다음: worktree 정리, 이슈화, `/checkpoint`

## 2026-04-21 AM — feature/project-shell shipped

완료: T1~T32 (32/34), PR #1 머지 (14d0958)
변경: 84 files, 19356 additions (Astro 5 scaffold, D1 스키마, 인증, 업로드, 프로젝트 CRUD, Cron cleanup, E2E 6종, axe smoke 3종)
다음: CI 실패 발견 → 같은 날 PM 세션에서 해결

## 2026-04-21 — PR #1 CI 인프라 fix commits k + l + m (.dev.vars seed + trigger cleanup + artifact upload)
- 완료: 로컬 E2E 녹색인데 CI 는 계속 레드였던 근인 확정 → CI 에 `.dev.vars` 가 없어 Astro dev 서버가 `APP_PASSWORD` / `TURNSTILE_*` / `JWT_SECRET` 없이 기동, 로그인 페이지가 `data-sitekey=""` 로 렌더되어 Turnstile 토큰 미생성, 모든 E2E 로그인이 조용히 실패. 해결 3 커밋: `f270da8` `fix(ci): seed .dev.vars for E2E before running tests` — Cloudflare 공식 always-pass Turnstile 테스트키 + throwaway `JWT_SECRET` 으로 `.dev.vars` 를 e2e 직전에 시드. `33c75fd` `ci: one run per commit` — `on: [push, pull_request]` 가 PR 브랜치당 2 런을 독립 VM 에서 병렬 실행해 같은 커밋에 녹색/적색이 섞이는 flake 시그널을 `push: branches:[main]` + `pull_request` 로 교체. `abc9955` `ci: upload Playwright report on E2E failure` — `actions/upload-artifact@v4` `if: failure()` 로 `playwright-report/` + `test-results/` 를 7일 보관 아티팩트로. admin-only step logs (`/actions/jobs/{id}/logs` 403) 우회. 3 커밋 푸시 후 CI `verify | completed | success` 단일 런 그린. PR #1 mergeable=true, head=abc9955.
- 관찰된 CI flake: 33c75fd 단일 런이 한 번 레드 → abc9955 에서 동일 코드가 그린. 추정 원인: Astro dev 콜드부트 + Playwright chromium 첫 기동 + `.dev.vars` 로드 타이밍 경합. artifact upload 가 들어갔으므로 재발 시 `playwright-report/` 다운로드로 즉시 근인 확인 가능.
- 다음: 사용자 수동 머지 (CLAUDE.md §9.5: PR 까지만, 자동 배포 금지) → Housekeeping #40(kostat) / #41(route hardening) / cron R2/D1 원자성 / owner_id v1 / HWP v0.5 이슈화 → Cloudflare Pages + `workers/cleanup.wrangler.toml` 수동 배포.

## 2026-04-21 — PR #1 CI fix commits i + j (CSP + DisabledTab a11y + primary contrast)
- 완료: 로컬 E2E 재현으로 CI 실패의 진짜 근인 2개 확정 — (1) `script-src 'self'` 이 Turnstile 외부 `api.js` 와 Astro island 인라인 부트스트랩을 동시 차단, (2) `DisabledTab` 의 `<span>` 래퍼 + role 없는 `<button>` 이 `aria-required-children` 을 위반 + `text-primary #1F6FEB` 가 WCAG AA 4.21:1 로 미달. 해결: commit `7233a7b` — middleware CSP `'unsafe-inline' https://challenges.cloudflare.com` + `frame-src` 허용, 공용 `loginViaUi` 헬퍼로 Turnstile 토큰 주입 대기 후 submit, axe-smoke 에 island hydration 재시도 루프, crud/hwp 테스트 strict-mode locator 정리. commit `61185f1` — DisabledTab 을 flat `<button role="tab" aria-selected="false" aria-disabled="true" title={tooltip}>` 로 평탄화, `--c-primary` `#1456C5` (6.17:1) + `--c-primary-hover` `#0E3E8C`. 로컬 `npm run test:e2e` 6/6 그린. `docs/design/feature-project-shell.md` §10.4.1 에 `'unsafe-inline'` 트레이드오프 + nonce CSP v1 마이그레이션 목표 기록, progress.md 리스크에 CSP + 내부 semantics 패턴 2건 추가.
- 다음: CI 그린 확인 → `/checkpoint` → 사용자 수동 머지 → 수동 배포.

## 2026-04-20 — feature/project-shell 구현 완료 + 최종 리뷰
- 완료: `subagent-driven-development`로 T1–T28 (+ Housekeeping #39 eslint globals) 전체 구현. 워크트리 `../eia-workbench-feature-project-shell`, 40 커밋(+1 P2 fix), 104/104 유닛 테스트, typecheck/lint/prettier/assertion-grep clean. 최종 리뷰(Opus, id `a4176f43bee12289c`)가 P2 한 건 지적 → `POST /api/projects/[id]/uploads` 201 응답에서 `r2_key` 제거 + 누출 방지 테스트 추가. `docs/reviews/feature-project-shell.md` 리뷰 노트 작성.
- 다음: PR 생성(CLAUDE.md §9.5: `/ship` PR-only, 자동 배포 금지). 병합 후 Housekeeping #40(kostat) / #41(route hardening) / cron R2/D1 원자성 / owner_id v1 / HWP v0.5 이슈화.

## 2026-04-20 — feature/project-shell Implementation Plan 커밋
- 완료: `writing-plans` 스킬로 `docs/plans/feature-project-shell.md` 작성·커밋(`b07e467`, 28 TDD tasks / 3916 lines). 파일 구조 맵 + T1–T28(스캐폴드→auth→KOSTAT→projects/uploads API→UI→Cron→E2E→CI) + 자체 리뷰 체크리스트 + 실행 핸드오프.
- 다음: `/autoplan` 삼중 리뷰 → §9.3 도메인 리뷰 수동 → 승인 시 워크트리 `../eia-workbench-feature-project-shell` 생성 → `subagent-driven-development` 구현.

## 2026-04-20 — feature/project-shell Office Hours 확정
- 완료: Q&A 6세트(auth / 업로드 / 입지 / HWP / 테스트 / 마무리 UX 3건) + 보안 리뷰 12건. `docs/design/feature-project-shell.md` v1 확정 (§10 보안 설계, §11 도메인 위험 갱신). `progress.md` 갱신. HWP 지원은 v0.5 `feature/hwp-ingest` + `ADR-0002`로 분리 결정.
- 다음: `writing-plans`로 `docs/plans/feature-project-shell.md` 작성 → `/autoplan` 삼중 리뷰 + 도메인 리뷰 → 워크트리 생성 → 구현.

## 2026-04-19 — 결정 반영 + 설계문서 초안
- 완료: 프로젝트명/업종/프런트엔드/환경 결정 반영 (`CLAUDE.md §3`, ADR-0001). `DESIGN.md` v0 초안, `docs/design/feature-project-shell.md` Office Hours 사전 초안, `data/samples/public/README.md` 샘플 조달 가이드, 하위 README 3종. `progress.md` 갱신.
- 다음: `/office-hours` 실행 → 설계문서 Q&A → `writing-plans` → `/autoplan` + 도메인 리뷰.

## 2026-04-19 — repo scaffold
- 완료: 디렉터리 구조, .gitignore/.claudeignore, CLAUDE.md v0, progress.md, DESIGN.md 초안, .vscode 설정, prompts/gs_sp/*.md 프롬프트 팩, docs/00_project_brief.md, 첫 커밋 `d9529f6`.
- 다음: 6개 열린 결정 (프로젝트명·업종·프런트·OS·DESIGN·공개샘플) 답변 받기.
