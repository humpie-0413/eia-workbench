# feature/project-shell — CI a11y Fix Implementation Plan

> **브랜치:** 동일 `feature/project-shell` 위에 fix 커밋 추가. 별도 브랜치 금지. PR #1이 자동 갱신됨.
> **트리거:** PR #1 CI에서 `axe-smoke` 3개 테스트 중 login + list 실패. detail은 통과.
> **목적:** 진짜 a11y 버그 수정 + 재발 방지 가드 + 로컬 E2E 실행 경로 확립.

## 0. 배경 (3줄)

- login 페이지가 `AppLayout`을 우회해 `<main>` 랜드마크가 아예 없고(form 전체가 `<body>`에 직결), h1·p·label이 어떤 landmark에도 속하지 않음 → `landmark-one-main` + `region` 위반.
- AppLayout을 쓰는 list·detail 모두 `PilotWarningBanner`(`role="status"`, 랜드마크 아님)가 `<header>/<main>` 바깥에 위치해 `region` 위반 잠재. list는 실제로 잡혔고 detail은 우연히 통과(landmark 분포 차이 혹은 가설 1 관련 타이밍).
- 로컬에서 E2E가 "통과"한 것처럼 보고된 원인은 **가설 1 — 실제로 로컬 실행이 이루어지지 않았음**. `.dev.vars`·D1 로컬 마이그레이션·Playwright chromium 설치가 세팅되지 않은 상태에서 unit/typecheck/lint만 돌고 "E2E 4 specs green"이 리뷰 노트에 잘못 기록됨.

## 1. 전제 조건 검증 — fix 코드 이전에 블로킹

**가설 1 확정/반증이 fix보다 우선순위 높음.** 첫 번째 실패의 근본원인이 "로컬 실행 부재"라면, fix만 하고 재발방지를 건너뛰면 다음 기능에서 같은 사고가 반복된다.

### 커밋 a — `chore(e2e): add local e2e prerequisite check script + README section`

**변경 파일:**

| 파일 | 성격 | 한 줄 요약 |
|---|---|---|
| `scripts/check-e2e-prereqs.sh` | 신규 | `.dev.vars` 존재·필수 키, `.wrangler/state/v3/d1` 마이그레이션 적용 여부, Playwright chromium 설치 여부를 확인하고 누락이면 실행 가능한 설치/설정 명령을 stdout으로 출력. |
| `README.md` | 수정 | "## 로컬에서 E2E 돌리기" 5줄 섹션 추가 (`bash scripts/check-e2e-prereqs.sh` → 수정 지시 따르기 → `npm run test:e2e`). |
| `docs/eia-workbench-setup-manual.md` | 선택(필요 시) | 같은 내용 상세 버전 링크만 추가. |

**스크립트가 확인할 체크리스트:**

1. `.dev.vars` 파일 존재 여부
2. `.dev.vars` 내 필수 키 존재: `APP_PASSWORD`, `JWT_SECRET`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`
3. 로컬 D1 마이그레이션 적용 여부(`.wrangler/state/v3/d1` 디렉터리 + `0001_init.sql` 적용 흔적)
4. Playwright chromium 설치: `npx playwright install --dry-run chromium` 출력 파싱
5. `E2E_APP_PASSWORD` 환경 변수가 `.dev.vars`의 `APP_PASSWORD`와 일치하는지(또는 동일한 기본값을 쓰는지)
6. Turnstile 테스트키(항상 통과 `1x00000000000000000000AA`) 사용 시 경고 문구

**검증:** 스크립트 자체 단위 테스트 없음(bash 유틸성). 대신 **로컬에서 한 번 실행 → 출력 확인** + CI에서는 호출하지 않음(`.dev.vars` 없음 전제).

### 커밋 b — **[USER ACTION, 코드 변경 없음]** 로컬 E2E 실행 + 결과 보고

**사용자 실행 명령:**
```bash
bash scripts/check-e2e-prereqs.sh        # 필요 시 설치/설정 지시 따르기
npm run test:e2e -- tests/e2e/axe-smoke.spec.ts
```

**사용자가 보고할 내용:**
- 3개 테스트 각각의 pass/fail 상태
- 실패 시 axe violations (rule id + target selectors)
- 예상: **CI와 동일한 위반이 재현**되어 가설 1이 확정되어야 함

**분기:**
- **확정**: Step 3 fix 커밋(c부터)으로 진행.
- **반증**(로컬은 통과, CI만 실패): 환경 차이 가설로 분기 — Step 3 전에 별도 조사 단계 추가 필요. fix 착수 금지.

> 이 단계를 건너뛰면 같은 사고가 다음 기능에서 반복됨. 블로킹이다.

## 2. 결정 대기 — PilotWarningBanner 배치

**현재:** `AppLayout.astro:18`에서 `<PilotWarningBanner role="status">`가 `<header>/<main>` 바깥 `<body>` 직속. `role="status"`는 live region이며 landmark가 아님 → region 위반의 **근원**. v0 정책상 배너 자체는 유지(사용자 결정 3).

### Option A — 배너를 `<header>` 내부로 이동

**구현:** AppLayout `<header>`를 `flex-col`로 바꾸고 그 안 최상단에 배너, 하단에 기존 상단 바(`<a>` + 로그아웃 `<form>`).

| 항목 | 평가 |
|---|---|
| 랜드마크 수 | 변화 없음(배너가 banner 랜드마크로 흡수) |
| 시각 영향 | **중간~큼**. `<header>`에 `border-b` 유지, 배너에도 `border-b` → 이중선 또는 한쪽 제거 필요. `<header>`의 `flex items-center justify-between`을 `flex-col`로 바꾸면 상단 바 배치도 재정렬됨. 총 헤더 높이 ≈ 배너(약 42px) + 상단 바(약 52px) = 94px. 현재 ≈ 배너 42px + 헤더 52px = 94px로 총합은 동일. 단, 하나의 landmark 안에 밀집 |
| CSS 리스크 | `<header>` 내부 구조가 바뀌어 기존 `px-6 py-3 border-b` 유지 + 내부에 inner rows 필요. 중첩 padding 관리. |
| 접근성 흐름 | 스크린리더가 "banner → main" 순서로 읽음. 배너 문구가 상단 바 앞에 먼저 읽혀 맥락 전달 자연스러움. |

### Option B — 배너를 `<aside aria-label="시스템 알림">`으로 감싸서 현재 위치 유지 ★추천★

**구현:** `AppLayout.astro`에서 `<PilotWarningBanner />`만 `<aside aria-label="시스템 알림">...</aside>`로 감쌈(배너 자체 수정 없음). AuthLayout에서도 동일 래퍼 사용.

| 항목 | 평가 |
|---|---|
| 랜드마크 수 | **+1** (aside = complementary landmark). 총 landmark: complementary(aside), banner(header), main, region(toast). |
| 시각 영향 | **0**. `<aside>`는 기본 스타일 없음 — 기존 배너의 `px-6 py-3 border-b bg-warning-bg` 그대로 유지. |
| CSS 리스크 | 0(wrapper만 추가). Tailwind `[role="status"]` 직접 선택자 없음(Grep 확인됨). |
| 접근성 흐름 | 스크린리더 랜드마크 목록에 "시스템 알림" aside 1개 추가. Skip link 사용 시 대상 +1(현재 skip link 없음). 배너가 complementary landmark로 분류되어 의미적으로 "부가 정보" 신호 전달. |

### 추천

**Option B**. 기준(사용자 결정 3 — 시각 디자인 최소 흔듬)에 정확히 부합. Option A는 header 내부 레이아웃 리그레션 위험 중간. **최종 결정은 사용자**.

## 3. 작업 순서 (커밋 단위)

> 커밋 a·b는 §1에 기술. 여기서는 c부터.

### 커밋 c — `fix(a11y): wrap login page in semantic landmarks (new AuthLayout)`

**변경 파일:**

| 파일 | 성격 | 한 줄 요약 |
|---|---|---|
| `src/layouts/AuthLayout.astro` | 신규 | 비로그인 페이지용 레이아웃. `<html lang="ko">` → `<body>` → (`<aside>` with PilotWarningBanner per Option B OR `<header>` with banner per Option A) → `<main>` wrapping `<slot />`. Toast 없음(로그인 전). Turnstile script slot용 `<slot name="head" />` 헤드 훅 제공. |
| `src/pages/login.astro` | 수정 | 현재 `<html>/<body>` 직접 작성 → `<AuthLayout title="로그인 · eia-workbench">`로 감싸기. Turnstile script는 `<Fragment slot="head">`로 head에 주입. 기존 form 마크업의 Tailwind 클래스·시각 동작 100% 유지. |

**결과 구조 (Option B 채택 가정):**
```
<html><body>
  <aside aria-label="시스템 알림"><PilotWarningBanner /></aside>
  <main class="grid min-h-[calc(100vh-...)] place-items-center bg-bg">
    <form>... 기존 내용 ...</form>
  </main>
</body></html>
```
`<main>` 1개 확보 + form content가 main 내부 → landmark-one-main, region 둘 다 해결.

### 커밋 d — `fix(a11y): move PilotWarningBanner into proper landmark`

**변경 파일:**

| 파일 | 성격 | 한 줄 요약 |
|---|---|---|
| `src/layouts/AppLayout.astro` | 수정 | Option A: `<header>` 내부 최상단으로 배너 이동 / Option B: `<aside aria-label="시스템 알림">` wrapper 추가. |
| `src/layouts/AuthLayout.astro` | 수정 | 동일한 배너 배치를 AuthLayout에도 적용(일관성). |

> 커밋 c에서 AuthLayout 초기 생성 시 이미 Option B 구조로 만들었다면, 이 커밋은 AppLayout만 대칭 적용하는 작은 커밋.

### 커밋 e — `fix(a11y): ensure list and detail pages have correct landmark hierarchy`

**변경 파일:**

| 파일 | 성격 | 한 줄 요약 |
|---|---|---|
| `src/pages/index.astro` | 수정 | `<section class="mb-6 flex...">`(h1 포함)을 의미적으로 `<header class="mb-6 flex...">` 또는 `<section aria-labelledby="page-title">` + `<h1 id="page-title">`로 바꿔 **h1의 소속 명확화**. 시각 클래스는 동일 유지. |
| `src/pages/projects/[id].astro` | 수정 | 기존 `<nav>`는 유지(이미 landmark). 페이지 내부 `<header class="mb-6">`(h1 포함)은 `<main>` 내부에 있으므로 landmark는 아님 — 변경 없음. 다만 **탭 `role="tablist"`**에 `aria-label="뷰 전환"` 추가(현재 라벨 없음, minor 위반 잠재). |

### 커밋 f — `test(unit): add static landmark check`

**변경 파일:**

| 파일 | 성격 | 한 줄 요약 |
|---|---|---|
| `src/lib/check-landmarks.ts` | 신규 | `src/pages/**/*.astro` 소스 파일을 읽어 **① 페이지가 레이아웃 컴포넌트(`AppLayout` 또는 `AuthLayout`)를 import하고 사용하는가 ② 또는 파일 자체에 `<main>` 또는 `role="main"` 리터럴이 존재하는가**를 정적 스캔. 예외(`src/pages/api/**`, `.post-handler.ts` 등)는 whitelist. 레이아웃 파일은 `<main>` 리터럴이 존재해야 함. 위반 시 `CheckResult = { file, reason }[]` 리턴. |
| `tests/unit/check-landmarks.test.ts` | 신규 | 현재 페이지 트리에 대해 위반 0건 단언. AuthLayout/AppLayout 두 레이아웃 파일이 실제로 `<main>` 포함하는지도 단언. 일부러 레이아웃 미사용 `tmp-page.astro`를 fs.mock으로 만들어 **위반 감지되는지** 양성 테스트 포함. |

**목적:** 빌드 타임(`npm test`)에 같은 사고를 잡는다. CI에서 단위 테스트는 매 푸시 돌기 때문에 a11y 회귀를 E2E보다 먼저 발견.

### 커밋 g — `test(e2e): harden axe-smoke (networkidle + includedImpacts + detailedReport)`

**변경 파일:**

| 파일 | 성격 | 한 줄 요약 |
|---|---|---|
| `tests/e2e/axe-smoke.spec.ts` | 수정 | ① 각 테스트에 `await page.waitForLoadState('networkidle')` 추가 — 페이지 완전 로드 후 스캔. ② `checkA11y(page, undefined, { axeOptions: { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa'] } }, includedImpacts: ['minor','moderate','serious','critical'], detailedReport: true, detailedReportOptions: { html: true } })`로 옵션 명시. ③ `checkA11y` 전에 **login 테스트에서 Turnstile iframe을 `axeOptions.exclude = [['iframe[src*="challenges.cloudflare.com"]']]`로 명시 제외**(cross-origin이라 어차피 스캔 불가, 의도 명문화). |

**이 커밋은 a11y fix가 모두 통과한 다음에만 추가**. fix 커밋과 섞지 않음. 강화 후 재푸시로 CI 재검증.

### 커밋 h — `docs(design): add a11y landmark requirements to DESIGN.md`

**변경 파일:**

| 파일 | 성격 | 한 줄 요약 |
|---|---|---|
| `DESIGN.md` | 수정 | 기존 `## 6. 접근성` 바로 뒤에 `## 6.1 Landmark Requirements (필수)` 하위 섹션 추가. 사용자가 제시한 본문 블록 + 이번 진단에서 확인된 패턴(`PilotWarningBanner`·`AuthLayout` vs `AppLayout` 이원화) 명문화. 검증 경로: `src/lib/check-landmarks.ts` · `tests/e2e/axe-smoke.spec.ts` · `/design-review` 게이트. |

**추가되는 본문 요약:**
- 모든 페이지 라우트는 정확히 1개의 `<main>` 또는 `role="main"` 포함
- 모든 콘텐츠는 `<header>/<main>/<footer>/<nav>/<aside>` 중 하나에 속함
- `<h1>`은 `<main>` 내부
- 비로그인 페이지도 예외 없음 — `AuthLayout` 사용
- `role="status"`·`role="alert"` 요소는 landmark wrapper(예: `<aside aria-label="...">`) 안에 배치
- 검증: 유닛(`check-landmarks.ts`) + E2E(`axe-smoke.spec.ts` moderate↑ 0건) + `/design-review` AI slop 항목

## 4. 디자인 영향 평가

**목표: 시각적 변화 0.**

| 페이지 | 변화 | 현재 → 변경 후 |
|---|---|---|
| `/login` (AuthLayout 적용) | **매우 경미**. `<form>`이 `<main>` 안으로 들어가지만 `<main>` 자체에 `grid min-h-screen place-items-center` 클래스를 옮기면 시각 동일. body 배경색은 그대로 `bg-bg`. | 시각 = 현재와 동일 |
| `/` (list) | 0. `<section>` → `<header>`(태그만 교체, Tailwind 클래스 동일) 또는 `aria-labelledby` 추가. | 시각 = 현재와 동일 |
| `/projects/[id]` | 0. `role="tablist"`에 aria-label 추가만. | 시각 = 현재와 동일 |
| 배너 (Option B 채택 시) | 0. `<aside>` wrapper는 기본 스타일 없음. | 시각 = 현재와 동일 |
| 배너 (Option A 채택 시) | **중간**. header 내부 2행 구조 + border 중복 정리. | header 높이 동일 유지 목표, 내부 정렬 재구성 필요 |

**Tailwind 적용 확인 포인트:**
- `<main>` 태그에 `grid` · `min-h-screen` 등 유틸리티 클래스가 문제없이 적용되는가 → 적용됨(브라우저 기본 스타일 없음).
- `<aside>` 태그에 기본 display 없음 → wrapper로 사용 시 wrapper는 투명.
- `<header>` 태그에 `flex` 적용 → 이미 AppLayout에서 적용 중.

## 5. 리스크

| # | 리스크 | 감지 방법 | 완화 |
|---|---|---|---|
| 1 | 기존 CSS selector가 `body > div`, `.banner`, `[role="status"]` 같은 구조 의존적 셀렉터를 써서 깨질 가능성 | `grep` 사전 스캔 — 이미 확인, **0건** | 없음 필요 |
| 2 | Tailwind arbitrary-variant(`[role="status"]:...`) 가 있으면 wrapper 추가 시 spec 변경 | Grep 확인 — **0건** | 없음 필요 |
| 3 | Astro의 `<slot name="head" />` 주입이 `<script is:inline>` Turnstile에 SRI 영향 | Turnstile 스크립트는 기존에도 SRI 없음(CSP + is:inline 보완). 이동만으로 무결성 동일 | 없음 필요 |
| 4 | `<main>` 중첩(Layout + 페이지 모두 `<main>`) — `landmark-one-main` 위반 재발 | check-landmarks.ts가 페이지 파일에 직접 `<main>` 리터럴을 발견하면 경고(레이아웃이 제공하므로 페이지는 쓰지 말 것) | 정적 테스트로 커버 |
| 5 | 커밋 e의 `<section>` → `<header>` 교체로 `<header>` 랜드마크가 **`<main>` 내부**라서 landmark 아님에도 사용자가 landmark로 기대 | 문서화(커밋 h의 DESIGN.md §6.1) + 테스트 단언 | 의미 혼동 방지 |
| 6 | axe-smoke 강화(커밋 g)로 기존에 통과하던 detail 페이지가 새 규칙에 걸릴 가능성 | 커밋 g를 모든 fix 후 **마지막에** 적용. 실패하면 즉시 별도 fix 커밋 | 순서 엄수 |
| 7 | AuthLayout 신규 생성 시 Turnstile 광원(challenges.cloudflare.com) 허용이 CSP와 충돌 | 현재 CSP에 이미 `script-src 'self' https://challenges.cloudflare.com` 포함 | 확인만, 수정 불필요 |

## 6. 검증

**각 fix 커밋(c·d·e) 직후 즉시:**
```bash
npm run test:e2e -- tests/e2e/axe-smoke.spec.ts
```
해당 페이지의 axe 위반이 0이 되는지 확인. 다른 페이지는 연쇄 리그레션 감시.

**커밋 f 직후:**
```bash
npm test -- --run check-landmarks
```

**커밋 g 직후:**
```bash
npm run test:e2e                              # 6 specs 전체
```

**커밋 h 직후:** 문서 변경만 — typecheck/lint/format 통과하면 OK.

**최종(h 끝난 후) 푸시 전 전체 재실행:**
```bash
bash scripts/assertion-grep.sh
npm run typecheck
npm run lint
npm test -- --run          # unit 104+f·추가 케이스
npm run test:e2e           # E2E 6 specs
npm run build
```

**푸시 후:** GitHub Actions 자동 재실행. 사용자가 6/6 통과 확인 → 다음 단계(Step 7 PR 본문 갱신 + Step 8 progress.md 갱신 + /checkpoint).

## 7. Out of Scope

이번 fix PR에서 **하지 않음**:
- 디자인 시스템 전반 a11y audit(컴포넌트별 label/focus/contrast 종합 점검)
- Housekeeping #40 (kostat empty-string subCode + blind cast 제거) — 별도 `fix/kostat-hardening` 브랜치
- Housekeeping #41 (route GET/DELETE/PATCH try/catch 일관화) — 별도 `fix/route-hardening` 브랜치
- axe-smoke 외 다른 a11y 도구(pa11y·Lighthouse a11y 점수·WAVE) 도입
- Skip link, 포커스 인디케이터 상세 토큰, 스크린리더 전용 유틸(`sr-only` 정책) 등 랜드마크 외 a11y 항목
- `role="tablist"`의 완전한 WAI-ARIA Tabs pattern 구현(현재 aria-selected만, Arrow 키 네비게이션·tabpanel id 연결 등은 별도)

---

## 승인 요청

1. **Option A vs Option B** — 위 §2 참고. 추천 Option B.
2. **플랜 전체 승인** — 수정 원하시면 지점 번호(예: "커밋 f에서 check-landmarks 제외")로 알려주시면 반영.
3. **플랜 파일 경로** — `docs/plans/feature-project-shell-ci-fix.md`로 생성했습니다. `plans/` 최상위로 이동 원하시면 지시.

승인 받으면 Step 4로 넘어가 커밋 a부터 실행합니다.
