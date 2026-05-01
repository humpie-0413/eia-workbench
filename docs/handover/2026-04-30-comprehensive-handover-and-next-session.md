# Handover (Comprehensive) — 2026-04-30 누적 + 다음 세션 진입점

**작성일:** 2026-05-01 (작업 기간 기준일 2026-04-30)
**범위:** 2026-04-29 ~ 2026-05-01 누적 작업, 발견 사실, 다음 세션 작업 후보, 운영 지침
**용도:** 다음 채팅 세션 (Claude Web 또는 Claude CLI) 의 단일 진입점. Project Knowledge 첨부 후보.
**전제 문서:** 본 문서 정독 후 (10-15분), 필요 시 §8 표의 이전 인계 doc 5종으로 drill-down.

---

## §1 — 프로젝트 정체성 + 현재 운영 상태 (스냅샷)

### 1.1 정체성 (CLAUDE.md §1-§2)

환경영향평가사·평가대행사가 **육상풍력** 사업의 평가서·스코핑·협의 대응을 작성·검수할 때
보고서 작성 시간 절감을 목표로 하는 B2B SaaS MVP. 공공포털 복제 아님.

핵심 원칙 6가지:
1. **검토 보조** — 현지조사·전문가 대체 아님. 모든 결과에 "사람 확인 필요" 표시.
2. **무료 인프라 우선** — Cloudflare Pages + D1 + Workers + R2 + KV (무료 등급).
3. **서버측 LLM API 미사용** — Anthropic / OpenAI / Google API 키 환경변수 도입 거절.
4. **법적 단정 표현 금지** — UI/문서/테스트 어디에도 "협의 통과" / "승인됨" 금지.
5. **EIASS 원문 재호스팅 금지** — 메타데이터만 D1, 본문은 deep-link.
6. **PII 미적재** — `ccilMemEmail` / `ccilMemNm` 화이트리스트 차단.

**v0 운영 모드 (2026-04-22 ~)**: 단일 `APP_PASSWORD`, 조직별 격리 없음, 인증된 모든
사용자에게 동일 데이터.

**대상 업종 1개**: `onshore_wind`. 다른 업종은 v2.

### 1.2 현재 운영 상태

| 항목 | 값 | 비고 |
|---|---|---|
| Repository main HEAD | `226c7d8` | 2026-05-01 (mobile subtitle fix) |
| Pages 운영 URL | https://eia-workbench-v0.pages.dev | latest deploy `22aeb513` |
| D1 적재 풍력 사례 | 10건 (모두 onshore_wind) | `eia_cases` |
| evaluation_stage 분포 | 본안 8 / unknown 2 | unknown 2 = WJ2020A001 / GW2025C001 (P3 §3(b) 영구 한계 재정의) |
| region_sido 매칭률 | **70% (7/10)** | 09de8c8 sido fallback 후, 09de8c8 commit 메시지 인용 |
| evaluation_stage NOT NULL | 100% (10/10) | unknown 도 valid CHECK |
| detail call 성공률 | 100% (10/10) | retry 0회, fail 0건 |
| Vitest tests | 352+ PASS | 09de8c8 / 185f7a2 / 226c7d8 누적 신규 테스트 포함 |
| 사전 결함 격리 (CLAUDE.md §10.1) | 2건 | better-sqlite3 module / prettier drift (별도 hotfix scope) |
| PII grep | 0건 | clean |
| 단정 표현 grep | 0건 | clean |

### 1.3 Cloudflare 무료 등급 사용량

| 레이어 | 사용량 | 한도 | 사용률 |
|---|---|---|---|
| D1 | ~127 KB | 5 GB | 0.0025% |
| Pages 빌드 | ~10회/주 | 3000회/월 | < 1% |
| Workers req | cron 1회/주 + 인덱서 수동 | 100K/일 | < 1% |
| data.go.kr | ~170 호출/주 | 10,000/일 | 1.7% |

전 레이어 < 5%. N≤500 풍력 사례까지 안전 마진. v1 신규 데이터셋 추가 시 재검토.

### 1.4 단일 진입점 인계 doc 인덱스 (정독 우선순위)

본 문서가 **단일 진입점** (#1). 필요 시 #2-#7 drill-down.

| # | 파일 | 역할 |
|---|---|---|
| 1 | `docs/handover/2026-04-30-comprehensive-handover-and-next-session.md` (**본 문서**) | 누적 + 다음 세션 |
| 2 | `docs/status/2026-04-28-project-status.md` | 4/28 시점 정적 스냅샷 (275줄) |
| 3 | `docs/handover/2026-04-30-statenm-mapping-investigated.md` | P3 §3(b) 가짜 작업 판명 조사 |
| 4 | `docs/handover/2026-04-28-p3-region-fix-deployed.md` | P3 region-fix + 한계 정의 |
| 5 | `docs/handover/2026-04-27-cases-detail-deployed.md` | P1 detail 통합 |
| 6 | `docs/handover/2026-04-26-similar-cases-deployed.md` | v0 deploy 결과 |
| 7 | `docs/handover/2026-04-25-similar-cases-handover.md` | v0 시작 |

---

## §2 — 4/29 ~ 5/1 작업 누적

### 2.1 Commit 결과 표 (시간순)

| # | Hash | 일자 | 종류 | 변경 라인 (대략) | 결과 |
|---|---|---|---|---|---|
| 1 | `09de8c8` | 4/29 | feat | +200 / -50 (sigungu-parser/sido-lut/test) | sido-only fallback chain → region 60→70% (강원풍력 1건 해소) |
| 2 | `185f7a2` | 4/30 | feat | LUT 6→19 entry, +81 (sigungu-lut.test 신규) | landmark 매칭 후보 확장 (운영 부트스트랩 미실행, §5 (a) 참조) |
| 3 | `af38d3c` | 4/30 | fix | wrangler.toml 1줄 (`0` → `SUN`) | Cloudflare cron API 호환성 |
| 4 | `254dd14` | 4/30 | chore | wrangler 3.114.17 → 4.86.0 (lockfile 1084줄) | cron 등록 API 호환 |
| 5 | `70c55ec` | 4/30 | docs | +173 (handover doc) | stateNm 매핑 가짜 작업 조사 결과 기록 |
| 6 | `226c7d8` | 5/1 | fix | `[caseId].astro` 3줄 + format-location.test 추가 | 모바일 subtitle leading " · " (cosmetic, P3 §3(d)) |

**누적 영향 영역:**
- `data/region/sigungu-lut.json` (LUT 확장)
- `src/features/similar-cases/sigungu-parser.ts` (sido fallback)
- `src/features/similar-cases/sido-lut.ts` (legacyLabel 컬럼)
- `src/pages/cases/[caseId].astro` (모바일 subtitle)
- `workers/cases-indexer.wrangler.toml` (cron syntax SUN)
- `package.json` / `package-lock.json` (wrangler 4)
- `docs/design/feature-similar-cases.md` (sido fallback spec patch)
- 신규 doc 1건 (`2026-04-30-statenm-mapping-investigated.md`)
- 테스트 +200줄 (`sigungu-parser`/`sido-lut`/`format-location` test)

### 2.2 작업 흐름 요약

- **4/29 오후**: 4/28 status §7 우선순위 #2 (sido fallback) 처리. `09de8c8` PR #13 merge.
  region 매칭률 6/10 → 7/10. landmark NULL 3건 잔존 (풍백/현종산/흘리).
- **4/30 오전**: 우선순위 #1 (LUT 19 entry 확장) 처리. `185f7a2` PR #14 merge. 운영
  부트스트랩 미실행 (cron 비활성).
- **4/30 오후 (early)**: cron trigger 활성화 시도. `wrangler deploy` 시 cron syntax
  reject. wrangler 3.114.17 (cron 6필드 syntax) → 4.86.0 (5필드 + 요일 이름)
  upgrade 후 `0 18 * * 0` → `0 18 * * SUN` 으로 patch (`af38d3c`, `254dd14`).
- **4/30 오후 (late)**: P3 §3(b) stateNm 매핑 확장 작업 진입. Phase 0 분석 후
  **가짜 작업 판명** — Ing detail API 영구 빈 응답이 root cause. 코드 변경 없이
  worktree 종료, handover doc (`70c55ec`) 만 commit.
- **5/1 오전**: P3 §3(d) 모바일 subtitle cosmetic fix. `formatLocation` helper 재사용으로
  1줄 patch (`226c7d8`).

---

## §3 — 발견된 새 사실

### 3.1 LUT 19 entry 확장 — 운영 부트스트랩 미실행

`data/region/sigungu-lut.json` 6→19. 영덕·울진·제주 등 풍력 후보 시·군 추가.
**현재 운영 D1 의 region 매칭률은 70% (7/10) 그대로** (cron 비활성, 부트스트랩 미실행).
다음 부트스트랩 trigger 시 풍백/현종산/흘리 포함 추가 매칭 후보 검증 필요.

### 3.2 Cron syntax 호환성 (Cloudflare Workers Cron)

- wrangler 3.114.17 + `0 18 * * 0`: cron API reject (`invalid cron string`).
- wrangler 4.86.0 + `0 18 * * SUN`: 등록 성공.
- 결론: Cloudflare 측은 **요일 숫자 (0)** 를 reject 하고 **요일 이름 (SUN)** 만 허용.

### 3.3 Wrangler 3.x → 4.x 호환성 검증

- breaking change 없음 (기존 `wrangler deploy` / `dev` / `d1` 명령 그대로 작동).
- lockfile 1084줄 변경 (deps tree 정리, peer 충돌 없음).
- `npm run typecheck` / `lint` / `test` 회귀 0.

### 3.4 stateNm 매핑 = 가짜 작업 판명 (4/28 status §7 #3 폐기)

운영 D1 의 unknown 2건 (`WJ2020A001 삼척 천봉`, `GW2025C001 양양 내현`) 은
mapper classify 결함이 아닌 **data.go.kr Ing detail API 의 영구 빈 응답**:

- 두 사업 모두 직접 API 재조회 시 `totalCount=0`, `items=[]`
- `transform.ts:213` `if (detailHead[0])` 가드로 stateNm payload 자체 미적재
- mapper 에 어떤 패턴 추가해도 효과 0

**진짜 해결**: 다른 데이터셋 (15142988 협의완료) 통합 또는 UI 라벨 변경 (cosmetic).

상세: `docs/handover/2026-04-30-statenm-mapping-investigated.md`.

### 3.5 API XML 응답 (type=json 무시) — 부수 발견

stateNm 조사 중 발견. `getDscssSttusDscssIngDetailInfoInqire` 는 `_type=json` 쿼리
파라미터 무시하고 XML 디폴트 응답하는 케이스 존재. portal-client 의 강제 JSON
주입이 데이터셋별로 동작 안 할 수 있음. P3 후보 이슈 (운영 영향은 현재 0건).

### 3.6 formatLocation helper 모바일 적용

`src/pages/cases/[caseId].astro:32-35` subtitle 의 leading separator 문제 해소.
helper 단일 진입점 (이미 import 되어 있었음, 재사용). `region_sido` NULL 3건의
" · 미상 MW · 미상" 노출 정리. 신규 unit test 추가 (helper 신규 case 검증).

---

## §4 — 운영 인프라 상태 (현재)

### 4.1 Cloudflare 자원 상태

| 자원 | 상태 | 비고 |
|---|---|---|
| Pages (eia-workbench-v0) | 운영 | latest deploy `22aeb513`, main push 트리거 자동 빌드 |
| D1 (`eia-workbench-v0`, binding `DB`) | 운영 | migration 0001-0004 적용, 10 records |
| Worker (`eia-workbench-cleanup`) | 운영 | cron `0 18 * * *` (03:00 KST) |
| Worker (`eia-workbench-cases-indexer`) | **신규 활성** | cron `0 18 * * SUN` (월요일 03:00 KST), 다음 trigger 5/3 18:00 UTC |
| KV (SESSION binding) | 운영 | JWT 페어링 |
| R2 (`eia-workbench-v0-uploads`) | 운영 | scoping/cases 미사용 |
| Turnstile | 운영 | 로그인 봇 차단 |

### 4.2 Secret 상태 (운영 + 로컬 정합)

운영 Pages secret 4개 + 로컬 `.dev.vars` 4개 키 이름 일치 (값은 다름):

- `APP_PASSWORD` — 파일럿 로그인
- `JWT_SECRET` — HS256
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile
- `SERVICE_KEY` — data.go.kr 인증키

**값은 chat·log·doc 어디에도 출력 금지** (CLAUDE.md §6 + memory `feedback_secrets_output.md`).

### 4.3 Cron 자동화 (cases-indexer)

- 이전: 수동 trigger 만 (cron 등록 실패, status §3.4 한계).
- 현재: `0 18 * * SUN` (월 03:00 KST) — wrangler 4 + SUN 키워드 fix 후 활성.
- 다음 자동 실행: **2026-05-03 18:00 UTC (월요일 03:00 KST)**
- 결과 모니터링: `eia_cases_sync` 테이블 (단, INSERT 누락 한계 존재 — §5 (e) 참조).

---

## §5 — P3 한계 트래킹 (현재 상태 갱신)

### 4/28 status §7 의 P3 4건 → 갱신

| 번호 | 작업 | 4/28 상태 | 5/1 상태 |
|---|---|---|---|
| (a) | sido fallback (P3 §3(a)) | 🔴 4건 NULL | 🟡 부분 (강원풍력 1건 해소, landmark 3건 잔존) |
| (b) | stateNm 매핑 (P3 §3(b)) | 🟡 mapper 확장으로 해결 가정 | **🔴 재정의 — 영구 한계** (Ing detail API 빈 응답) |
| (c) | CasePreviewPane region (P3 §3(c)) | 🔴 미상 표시 | ✅ 해소 (4/28 PR #11+#12) |
| (d) | 모바일 subtitle (P3 §3(d)) | 🔴 leading 공백 | ✅ 해소 (5/1 `226c7d8`) |

### 신규 P3 후보 (다음 세션 우선순위 후보)

| 후보 | 규모 | 가치 | 비고 |
|---|---|---|---|
| (a-잔존) landmark LUT 확장 (풍백/현종산/흘리) | 1-2h | 🟢 중 (region 70→100%) | 시·군 외 landmark 명사 매핑 |
| (b-재정의) 다른 데이터셋 (15142988) 인덱싱 | 6-8h | 🟢 큼 | 본안 confirmed 사례 + unknown 2건 해결 포함 |
| (e) eia_cases_sync 행 INSERT 누락 | 1-2h | 🟡 중 | 4/26 한계 §3.5 잔존 (모니터링 차단) |
| (f) approv_organ_nm 컬럼명 정정 | 30min | 🟢 작음 | 4/26 한계 §3.3 (cosmetic, schema-clarity) |
| (g) API XML 응답 처리 | 1h | 🟢 작음 | §3.5, 운영 영향 현재 0건 |
| (h) Cron 즉시 trigger 미제공 | (외부 한계) | — | Cloudflare API 한계, 우회 불가 |

---

## §6 — 다음 세션 작업 후보 (우선순위)

### #1 — landmark LUT 추가 (P3 §3(a) 마감)

| 항목 | 값 |
|---|---|
| 예상 시간 | 1-2h |
| 가치 | 🟢 중 (region 매칭 70→100%, landmark 3건 NULL 해소) |
| 리스크 | 🟢 작음 (LUT JSON 추가 + parser 1줄 추가 가능성) |
| 주의점 | landmark = 시·군 외 명사 (풍백/현종산/흘리). 매핑 정확성 검증 필수 (한 landmark 가 여러 시·군 걸쳐있을 수 있음 — multi-region 컬럼 도입 결정 필요할 수도). |
| 권장 | 다음 세션 첫 작업. 빠른 가치, 부트스트랩 1회 검증 가능. |

### #2 — 다른 데이터셋 (15142988 협의완료) 인덱싱 (P3 §3(b) 진짜 해결)

| 항목 | 값 |
|---|---|
| 예상 시간 | 6-8h |
| 가치 | 🟢 큼 (본안 confirmed 사례 풍부도 + unknown 2건 해결 + v1 패턴 확장 검증) |
| 리스크 | 🟡 중 (신규 zod 스키마 + filter 검증 + transform 분기) |
| 주의점 | 데이터셋 ID 변경 시 컬럼명·라벨·문구 3종 동시 점검 (4/26 트러블슈팅 §8.5 패턴). 부트스트랩 1회 실측 필수. |
| 권장 | #1 마감 후. v1 진입 결정. |

### #3 — 신규 feature (draft-checker / opinion-response 등)

| 항목 | 값 |
|---|---|
| 예상 시간 | 8-12h |
| 가치 | 🟢 큼 (새 사용자 가치 영역) |
| 리스크 | 🔴 큼 (spec/plan/UI/test 신규, gstack 전체 흐름 1회) |
| 주의점 | `/office-hours` → brainstorming → writing-plans → autoplan → 도메인 리뷰 → subagent-driven-development → /design-review → /review → /qa → /ship → /checkpoint. CLAUDE.md §9.1 흐름 고정. |
| 권장 | 사용자 결정 (이번 주 사용자 피드백 / 운영 부담 / 학습 욕구 중 어느 축이 우선?). |

### #4 — spec 확장 (해상풍력, 태양광 등 다른 업종)

| 항목 | 값 |
|---|---|
| 예상 시간 | spec 만 4-6h, 구현은 별도 |
| 가치 | 🟡 중 (v2 scope) |
| 리스크 | 🟡 중 (rule pack 신규 작성, 도메인 리서치 필요) |
| 주의점 | CLAUDE.md §3 "대상 업종 1개" 원칙 → v2 결정 시 별도 plan. |
| 권장 | 보류 — v0 파일럿 안정화 우선. |

---

## §7 — 운영 지침 (영구) — 9 규칙

세션 시작 시 사용자가 항상 적용하는 운영 패턴:

### 7.1 모델 추천 먼저 명시

새 작업 시작 시 사용자가 **Opus 4.7 / Sonnet 4.6 추천 + 이유** 한 줄 명시. 예:
- 작은 cosmetic fix → Sonnet (빠름, 비용 ↓)
- 도메인 결정 / 깊은 분석 / spec 작성 → Opus
- 검증 / 회귀 검사 → Sonnet

### 7.2 단일 프롬프트 (1 코드블록, 바로 복붙)

세션 시작 메시지는 1 코드블록으로 작성. 사용자가 부분 복사 없이 1번에 붙여넣을 수 있게.

### 7.3 잘게 쪼갠 단계 + 사용자 게이트

작업을 Phase 0 (분석) / Phase 1 (구현) / Phase 2 (검증) 로 분리. Phase 경계마다
사용자 보고 + 게이트 (계속 / redirect / abort).

### 7.4 3-터미널 패턴 (1-1, 2-1, 2-2)

| 터미널 | 용도 |
|---|---|
| 1-1 | main worktree (`C:/0_project/eia-workbench-handover`) — 검증 / typecheck / npm test |
| 2-1 | feature worktree #1 (작업 #1, 예: feature/landmark-lut) |
| 2-2 | feature worktree #2 (작업 #2, 별도 분리, 병렬 진행 시) |

### 7.5 다중 worktree (작업별 분리)

```bash
# 새 작업 시
git worktree add ../eia-workbench-<feature> -b feature/<name>

# 작업 종료 후
git worktree remove ../eia-workbench-<feature>
```

이번 세션에서 사용한 worktree:
- `../eia-workbench-statenm-expand` — 가짜 작업 판명, commit 없이 종료
- `../eia-workbench-mobile-subtitle` — `226c7d8` merge 후 정리
- `../eia-workbench-handover` — 본 doc 작성용 (현재)

### 7.6 메인 push 사용자 직접 (스톱게이트 #1)

Claude 는 commit 까지. `git push origin main` 은 **사용자가 직접** 실행
(memory `feedback_push_authorization.md`).

### 7.7 미루기 금지 (확정 후 다음 스텝)

작업 결정이 모호할 때 사용자에게 "선택지 A/B/C 중?" 묻지 말고, 가장 안전·reversible
한 디폴트를 즉시 실행 후 사후 보고 (CLAUDE.md §10.2).

### 7.8 PII 마스킹 (secret/email/이름)

- 환경변수 값, API 응답의 `ccilMemEmail`/`ccilMemNm`, 사용자 식별 정보 모두 chat·log·doc 노출 금지.
- 명령 출력 시 키 값 발견되면 즉시 `<MASKED>` 로 치환 후 사용자에게 보고.

### 7.9 터미널 명명 (1-1, 2-1, 2-2)

병렬 작업 시 터미널 번호로 사용자 instruction 명확화. 예: "1-1 에서 npm test, 2-1 에서 worktree 작업".

### 7.10 (NEW) Ctx 관리 양쪽 적용

- **Claude CLI**: 60% `/compact` 자발 보고, 80% 강제, 85% 사용자 보고 (스톱게이트).
- **Claude Web**: 대화 길이 100메시지 초과 시 새 chat 분기 권장. 본 doc 같은
  단일 진입점 doc 으로 인계.

---

## §8 — Skill / Worktree / 사용자 게이트 패턴

### 8.1 활성 Skills (세션 시작 시 자동 로드)

| Skill | 용도 |
|---|---|
| `superpowers:using-superpowers` | 모든 skill 진입점 |
| `superpowers:brainstorming` | 새 기능 진입 시 자동 |
| `superpowers:writing-plans` | `/office-hours` 후 계획서 작성 |
| `superpowers:executing-plans` | plan 실행 시 |
| `superpowers:subagent-driven-development` | task 분해 실행 |
| `superpowers:using-git-worktrees` | feature 브랜치 = 별도 worktree |
| `superpowers:systematic-debugging` | 근인 우선 디버깅 (4/30 stateNm 가짜 작업 판명에 사용) |
| `superpowers:test-driven-development` | TDD 강제 (RED → GREEN → REFACTOR) |
| `superpowers:finishing-a-development-branch` | PR/머지 마감 절차 |
| `superpowers:verification-before-completion` | 완료 전 검증 |

### 8.2 Worktree 패턴 (W1=main, W2/W3=feature)

```
C:/0_project/
├── eia-workbench-handover/         (W1, main, 검증/typecheck)
├── eia-workbench-<feature-1>/      (W2, feature/<name>)
└── eia-workbench-<feature-2>/      (W3, 병렬 작업 시)
```

W1 은 main 검증 전용. 코드 수정은 W2/W3 에서만.

### 8.3 Phase 0/1/2 패턴

- **Phase 0 — 분석** (~30분): 가설 + 코드 경로 + 운영 데이터 확인 + 사용자 게이트.
- **Phase 1 — 구현** (~1-3h): TDD RED → GREEN → REFACTOR. 사용자 게이트.
- **Phase 2 — 검증** (~30분): typecheck / lint / test / assertion-grep / build.
  사용자 게이트 → main merge 결정.

### 8.4 사용자 게이트 시점

- Phase 0 종료 후 (구현 진입 결정)
- Phase 1 RED 완료 후 (예상 GREEN 경로 확인)
- Phase 1 GREEN 완료 후 (REFACTOR 진입 결정)
- Phase 2 종료 후 (PR / merge 결정)
- Ctx 75% / 85% 도달 시 (강제)
- 5회 연속 명령 실패 시 (skip 결정)

---

## §9 — Ctx 부담 / 세션 분기 가이드

### 9.1 Ctx % vs 행동 매트릭스

| Ctx % | Claude 행동 |
|---|---|
| < 60% | 정상 작업 |
| 60-75% | 작업 이어가되 다음 Phase 경계에서 `/compact` 자발 실행 |
| 75-80% | 즉시 `/compact` (사용자 통지 없이) + 결과 1줄 보고 |
| 80-85% | 강제 `/compact` + 사용자 통지 |
| > 85% | **스톱게이트** — 진행 1줄 요약 후 사용자 결정 대기 |

### 9.2 새 chat 분기 시점 결정

다음 trigger 1개 이상 만족 시 새 chat 분기 권장:

- 큰 doc 작성 완료 후 (본 세션 같은 case)
- 큰 작업 (> 1h, > 5 commit) 시작 전
- 디버깅 깊이 5 turn 이상 (root cause 미확정)
- 사용자 명시 요청 ("새 chat 으로 가자")
- Ctx 65% 도달 + 다음 Phase 시작 동시 (예방적 분기)
- `/compact` 자체 효과 없음 (이미 컨텍스트 빡빡)

### 9.3 분기 시 인계 절차

1. 본 doc 같은 단일 진입점 doc 작성 (current state + next action).
2. 새 chat 시작 시 §10 메시지 템플릿 복붙.
3. 새 chat 의 첫 응답에서 doc 1개만 정독 (drill-down 은 필요시).

---

## §10 — 새 채팅 인수인계 메시지 템플릿

다음 세션 시작 시 아래 코드블록 1번에 복붙:

```
[새 세션 — eia-workbench / <작업명>]

## 모델 — <Opus 4.7 max | Sonnet 4.6> (사용자 결정)

<선택 이유 한 줄>

## 컨텍스트 복원

다음 1개 doc 정독 (10-15분):
- docs/handover/2026-04-30-comprehensive-handover-and-next-session.md (단일 진입점)

필요 시 drill-down (선택):
- docs/status/2026-04-28-project-status.md (4/28 시점 정적 스냅샷)
- docs/handover/2026-04-30-statenm-mapping-investigated.md (P3 §3(b) 가짜 작업)
- docs/handover/2026-04-28-p3-region-fix-deployed.md (P3 region-fix)
- docs/handover/2026-04-27-cases-detail-deployed.md (P1 detail 통합)
- docs/handover/2026-04-26-similar-cases-deployed.md (v0 deploy)
- docs/handover/2026-04-25-similar-cases-handover.md (v0 시작)

CLAUDE.md §10.1 사전 결함, §10.2 디폴트 액션, §6 main push 게이트 모두 준수.
Ctx 60% 자발적 /compact 보고, 80% 강제, 85% 사용자 보고.

## 현재 main 상태

- HEAD: 226c7d8 (mobile subtitle fix, 5/1)
- 운영 D1: eia_cases 10건 (풍력)
- 운영 URL: https://eia-workbench-v0.pages.dev/cases (latest 22aeb513)
- region 매칭률 70% (7/10)
- evaluation_stage: 본안 8 / unknown 2 (영구 한계)
- cron: 0 18 * * SUN (월 03:00 KST), 다음 자동 trigger 5/3 18:00 UTC

## 활성 Skills

writing-plans, brainstorming, systematic-debugging, subagent-driven-development,
using-git-worktrees, finishing-a-development-branch

## 작업 — <작업명>

### 목적

<1-2줄>

### 작업 path 후보

<우선순위 #1, #2 등>

### 분량 추정

<예상 시간 + 변경 라인>

### Phase 분해

- Phase 0 — 분석 (~30분)
- Phase 1 — 구현 (~1-3h)
- Phase 2 — 검증 + 마감 (~30분)

각 Phase 종료 시 사용자 게이트.

### 첫 액션

<Claude 가 받자마자 할 첫 명령>
```

---

## §11 — 자주 쓰는 명령 (참조)

```bash
# 검증 chain (커밋 전 필수)
npm run typecheck && npm run lint && npm test
bash scripts/assertion-grep.sh
bash scripts/check-similar-cases-assertions.sh
npm run build
grep -r "SERVICE_KEY=" dist/ || echo "OK (no leak)"

# D1 운영 query (사용자 수동, --remote)
wrangler d1 execute DB --remote --command "SELECT COUNT(*), SUM(CASE WHEN region_sido IS NOT NULL THEN 1 ELSE 0 END) FROM eia_cases"
wrangler d1 execute DB --remote --command "SELECT evaluation_stage, COUNT(*) FROM eia_cases GROUP BY evaluation_stage"

# 인덱서 수동 trigger (cron 외)
cd C:/0_project/eia-workbench-handover
wrangler dev --config workers/cases-indexer.wrangler.toml --local
# 별도 터미널: curl http://localhost:8787/__scheduled

# Worktree
git worktree add ../eia-workbench-<feature> -b feature/<name>
git worktree remove ../eia-workbench-<feature>

# PR 생성 (사용자 push 후)
gh pr create --base main --head feature/<name> --title "..." --body-file docs/reviews/<name>.md
gh pr checks <NUMBER> --watch
```

---

**끝.** 본 문서가 다음 세션의 단일 진입점. 작업 시작 시 §6 우선순위에서 #1 또는 #2 선택
권장. 새 chat 분기 시 §10 템플릿 사용.
