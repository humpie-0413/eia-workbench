# deploy-v0 CSS fix — production /login 스타일 누락 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (또는 이번은 범위가 작아 Claude 인라인 실행도 허용). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로덕션 `/login` 이 unstyled 로 렌더되는 문제를 고친다. CSS 를 Astro 빌드 그래프에 정식 편입시키고, 같은 실수가 다시 일어나지 않도록 post-build verification 을 CI 에 박는다.

**Scope:** 본 fix 는 CSS 자산 문제만 해결한다. `wrangler pages dev` 기반 prod-like E2E, CLAUDE.md §9 업데이트 등은 별도 후속 이슈.

**Tech Stack:** Astro 5 + `@astrojs/tailwind`(applyBaseStyles=false) + Tailwind 3.4 + Cloudflare Pages.

---

## 1. Evidence (Phase 1 — Root Cause Investigation)

### 관측
- 프로덕션 `GET /login` → HTTP 200 + HTML body 정상, 하지만 `<link rel="stylesheet" href="/src/styles/global.css">` 가 dev-only 경로로 박힌 채 렌더됨.
- 해당 경로로 `curl -I` → `302` (auth middleware 의 catch-all 리다이렉트). CSS 파일이 프로덕션에 존재하지 않음.
- 로컬 `dist/_astro/` 에 `*.css` 0건, `*.js` 8건만 존재. 즉 빌드 산출물에 CSS 가 아예 없음.

```
$ find dist -name "*.css"
(empty)

$ find dist -name "*.js" | wc -l
8     # react islands + SSR bundle
```

### 근인
`src/layouts/AuthLayout.astro:13` + `src/layouts/AppLayout.astro:15` 가 CSS 를 아래 방식으로 참조한다:

```astro
<link rel="stylesheet" href="/src/styles/global.css" />
```

이는 dev server (`astro dev`) 전용 경로다. Vite 빌드 그래프는 HTML 안의 static `<link>` 를 소스 import 로 인식하지 않으므로, `@tailwind base/components/utilities` 가 들어있는 `src/styles/global.css` 가 빌드에서 처리되지 않고 dist 에 산출되지 않는다. `astro.config.mjs` 의 `tailwind({ applyBaseStyles: false })` 로 자동 주입도 꺼져 있어, CSS 가 빌드에 포함되려면 **Astro layout frontmatter 에서 명시 import** 해야 한다.

### 기각된 가설 (반증 포함)

| 가설 | 결론 | 근거 |
|---|---|---|
| Turnstile sitekey 가 client bundle 에 빌드 시점 치환 안 됨 | 기각 | `src/pages/login.astro:46` 은 `data-sitekey={env.TURNSTILE_SITE_KEY}` 로 **SSR 시점에** `Astro.locals.runtime.env` 에서 읽어 HTML attribute 로 박는다. 클라이언트 번들 무관. Phase 4.2 에서 주입된 dashboard var 가 그대로 전달됨. |
| login 페이지가 client island 를 로드하는데 그 island 가 누락 | 기각 | `login.astro` 는 일반 `<form method="post">` + `<script is:inline>` Turnstile loader. react island 없음. `dist/_astro/` 에 없는 게 정상. |
| `PUBLIC_` prefix 누락 | 기각 | 위 `env.*` 는 `import.meta.env.*` 가 아니므로 PUBLIC prefix 규칙 적용 안 됨. |

### 이 fix 가 손대지 말아야 할 것
- `astro.config.mjs` 의 `applyBaseStyles: false` — 유지. 명시 import 로 커버된다. 설정 변경은 최소 diff 원칙 위반.
- Turnstile 관련 어떤 것도 — 위에서 기각됨.
- CSP, middleware — 무관.

---

## 2. File Structure (변경 대상)

**Modify:**
- `src/layouts/AuthLayout.astro:1-21` — frontmatter 에 CSS import 추가, head 의 `<link>` 제거
- `src/layouts/AppLayout.astro:1-34` — 동일
- `.github/workflows/ci.yml:55` — build step 다음에 verify-build step 추가

**Create:**
- `scripts/check-build-css.sh` — dist 산출물에 CSS 가 있고 Tailwind preflight + global.css tokens 가 둘 다 실재하는지 검증

**CSS import 경로 결정: 상대경로 `../styles/global.css`.**
- tsconfig.json 의 `"paths": { "@/*": ["src/*"] }` 는 존재하고, Astro+Vite 가 이미 AppLayout 의 `@/components/*` 를 빌드 시 resolve 하고 있어 `@/` 도 작동 가능.
- 그러나 본 fix 는 alias resolver (`vite-tsconfig-paths` 암묵 활성) 의존을 도입하지 않는 상대경로 채택. `src/layouts/` → `../styles/` 한 단계 up 으로 안정적이고, src/ 하위 구조 변경에도 두 디렉토리가 함께 이동할 가능성이 큼.

**No change:**
- `src/styles/global.css` — 내용 그대로
- `astro.config.mjs`, `tailwind.config.ts` — 그대로
- `src/pages/login.astro` — 그대로 (Turnstile SSR 경로 무사)

---

## 3. Tasks

### Task 1: 빌드 산출물 검증 스크립트 작성 (먼저 실패시키기)

**Files:**
- Create: `scripts/check-build-css.sh`

- [ ] **Step 1: 검증 스크립트 작성**

```bash
#!/usr/bin/env bash
# Verify that `npm run build` emitted a CSS bundle with both Tailwind
# preflight and the project's global.css tokens. Run after `astro build`.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

DIST_ASTRO="dist/_astro"

if [ ! -d "$DIST_ASTRO" ]; then
  echo "FAIL: $DIST_ASTRO missing. Did you run 'npm run build'?" >&2
  exit 1
fi

shopt -s nullglob
css_files=("$DIST_ASTRO"/*.css)

if [ "${#css_files[@]}" -eq 0 ]; then
  echo "FAIL: no CSS file in $DIST_ASTRO. Global stylesheet not wired into the build graph." >&2
  echo "      Check that layouts import '../styles/global.css' in the frontmatter." >&2
  exit 1
fi

# Two independent signals must appear in the same CSS bundle:
#   Signal 1 (Tailwind preflight compiled): 'box-sizing:border-box' OR '--tw-' var family.
#   Signal 2 (global.css tokens reached graph): '--c-bg' or '--c-primary' CSS vars declared in src/styles/global.css :root.
# Both missing would mean empty CSS. Only one missing indicates a partial wiring bug.
preflight_found=0
tokens_found=0
preflight_file=""
tokens_file=""

for f in "${css_files[@]}"; do
  if [ "$preflight_found" -eq 0 ] && grep -qE 'box-sizing:[[:space:]]*border-box|--tw-' "$f"; then
    preflight_found=1
    preflight_file="$f"
  fi
  if [ "$tokens_found" -eq 0 ] && grep -qE -- '--c-bg|--c-primary' "$f"; then
    tokens_found=1
    tokens_file="$f"
  fi
done

if [ "$preflight_found" -eq 0 ]; then
  echo "FAIL: no Tailwind preflight in emitted CSS." >&2
  echo "      Expected 'box-sizing:border-box' or '--tw-*' somewhere in $DIST_ASTRO/*.css." >&2
  echo "      Symptom: @tailwind base; directive did not run. Check that global.css is imported." >&2
  exit 1
fi

if [ "$tokens_found" -eq 0 ]; then
  echo "FAIL: global.css project tokens (--c-bg / --c-primary) missing from emitted CSS." >&2
  echo "      Symptom: src/styles/global.css is not in the build graph." >&2
  echo "      Fix: ensure the frontmatter imports '../styles/global.css'." >&2
  exit 1
fi

echo "OK: ${#css_files[@]} CSS file(s); preflight in $(basename "$preflight_file"); tokens in $(basename "$tokens_file")."
```

- [ ] **Step 2: 현재 빌드 결과로 실행 — 실패 확인**

현재 `dist/_astro/*.css` 가 0개인 상태에서 스크립트가 정확히 실패하는지 확인.

```
bash scripts/check-build-css.sh
```

기대 출력:
```
FAIL: no CSS file in dist/_astro. Global stylesheet not wired into the build graph.
      Check that layouts import '@/styles/global.css' in the frontmatter.
```
exit code 1.

- [ ] **Step 3: 스크립트 커밋 (별도 커밋 없이 Task 4 와 병합) — 여기선 스테이징만**

```
git add scripts/check-build-css.sh
```

---

### Task 2: AuthLayout CSS import 교체

**Files:**
- Modify: `src/layouts/AuthLayout.astro:1-21`

- [ ] **Step 1: frontmatter 에 CSS import 추가 + head 의 `<link>` 제거**

Before (`:1-21`):
```astro
---
interface Props {
  title: string;
}
const { title } = Astro.props;
---

<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <link rel="stylesheet" href="/src/styles/global.css" />
    <slot name="head" />
  </head>
  ...
```

After:
```astro
---
import '../styles/global.css';

interface Props {
  title: string;
}
const { title } = Astro.props;
---

<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <slot name="head" />
  </head>
  ...
```

변경 diff 요점:
- 라인 2 위에 `import '../styles/global.css';` 추가 (상대경로, alias resolver 의존 없음)
- 라인 13 `<link rel="stylesheet" ...>` 삭제

---

### Task 3: AppLayout CSS import 교체

**Files:**
- Modify: `src/layouts/AppLayout.astro:1-34`

- [ ] **Step 1: frontmatter 에 CSS import 추가 + head 의 `<link>` 제거**

Before (`:1-16` 부분):
```astro
---
import PilotWarningBanner from '@/components/PilotWarningBanner.astro';
import Toast from '@/components/Toast';
interface Props {
  title: string;
}
const { title } = Astro.props;
---

<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <link rel="stylesheet" href="/src/styles/global.css" />
  </head>
  ...
```

After:
```astro
---
import '../styles/global.css';
import PilotWarningBanner from '@/components/PilotWarningBanner.astro';
import Toast from '@/components/Toast';
interface Props {
  title: string;
}
const { title } = Astro.props;
---

<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  ...
```

변경 diff 요점:
- 라인 2 위에 `import '../styles/global.css';` 추가 (기존 component import 들 위에)
- 라인 15 `<link rel="stylesheet" ...>` 삭제

---

### Task 4: 재빌드 + 검증 스크립트 그린 전환

- [ ] **Step 1: 클린 빌드**

```
rm -rf dist
npm run build
```

- [ ] **Step 2: dist/_astro/ 내용 확인**

```
ls dist/_astro/
```

기대: `*.css` 파일 1개 이상이 보인다. 예: `index.<hash>.css` 또는 유사.

- [ ] **Step 3: 검증 스크립트 green 확인**

```
bash scripts/check-build-css.sh
```

기대 출력:
```
OK: 1 CSS file(s) in dist/_astro with Tailwind utilities.
```
exit code 0.

- [ ] **Step 4: 빌드 후 HTML 에 CSS `<link>` 자동 삽입 확인**

SSR 결과물 안에 Astro 가 주입한 CSS 태그가 존재하는지 확인:

```
grep -rE '<link[^>]*rel="stylesheet"[^>]*_astro/[^"]*\.css' dist/_worker.js | head -3
```

기대: dist/_worker.js 안의 어딘가에서 `_astro/*.css` 를 참조하는 link 태그 템플릿이 보인다 (Astro 가 SSR 시점에 삽입). 없으면 다음 커밋 전에 가설 재검토.

---

### Task 5: CI 워크플로에 verify step 편입

**Files:**
- Modify: `.github/workflows/ci.yml:55`

- [ ] **Step 1: build step 다음에 verify step 추가**

Before (`:55`):
```yaml
      - run: npm run build
```

After:
```yaml
      - run: npm run build
      - name: verify build output has CSS
        run: bash scripts/check-build-css.sh
```

- [ ] **Step 2: 스크립트가 실행 권한을 가지는지 (Unix 한정, Windows 에서 생성 후 CI 에서 실행될 때)**

`bash scripts/check-build-css.sh` 형태로 명시 호출하므로 exec bit 불필요. 별도 chmod 없음.

---

### Task 6: 로컬 전체 검증

- [ ] **Step 1: 유닛 테스트 + 타입체크 + 린트**

```
npm run typecheck
npm run lint
npm test
```

기대: 전부 green. Layout 변경이 기존 테스트에 영향 없음을 확인.

- [ ] **Step 2: 빌드 + CSS verify 재확인**

```
npm run build && bash scripts/check-build-css.sh
```

기대: "OK: ..." 라인.

- [ ] **Step 3: 스테이징 + 커밋 + 푸시 명령 준비**

커밋 단위: 1개. 변경 4파일 (AuthLayout, AppLayout, scripts/check-build-css.sh 신규, ci.yml).

```
git add src/layouts/AuthLayout.astro src/layouts/AppLayout.astro \
        scripts/check-build-css.sh .github/workflows/ci.yml
git status --short    # 정확히 이 4개만 스테이징됐는지 확인
git commit -m "fix(deploy): wire global.css into build graph + CI guard

AuthLayout 과 AppLayout 이 /src/styles/global.css 를 dev-only 경로의
<link> 로 참조하고 있어, 프로덕션 빌드에 CSS 가 전혀 산출되지 않았다.
frontmatter 에서 명시 import 로 교체한다.

post-build verification (scripts/check-build-css.sh) 을 CI 의 build
step 뒤에 추가해 같은 회귀를 차단한다."
```

- [ ] **Step 4: push (USER)**

`git push origin main` 은 Claude 가 직접 실행하지 못한다 (repo 훅). 사용자가 수동 실행 후 CI green 보고.

---

### Task 7: 재배포 + 프로덕션 검증 (USER)

- [ ] **Step 1: 재배포**

```
npx wrangler pages deploy dist --project-name eia-workbench-v0 --branch main --commit-hash=$(git rev-parse HEAD)
```

참고: `wrangler.toml` 값과 bindings 는 그대로. 이번 재배포는 새 `dist/_astro/*.css` 포함.

- [ ] **Step 2: 프로덕션 URL CSS 확인**

```
curl -s https://eia-workbench-v0.pages.dev/login | grep -oE '_astro/[a-zA-Z0-9._-]+\.css'
```

기대: `_astro/xxxx.css` 한 줄 이상 (Astro 가 자동 삽입). 이전에 나오던 `/src/styles/global.css` 가 **더 이상 안 나오는** 것도 확인.

추가로 실제 CSS asset 이 200 으로 응답하는지:

```
curl -I https://eia-workbench-v0.pages.dev/_astro/<파일명>.css
```

기대: `HTTP/1.1 200 OK` + `content-type: text/css`.

- [ ] **Step 3: 브라우저에서 스타일 적용 확인**

`/login` 접속 → 배경 회색 (`--c-bg`), 카드 테두리, Pretendard 폰트, 패스워드 입력창 스타일, `로그인` 버튼 파란 primary 색 확인. DevTools → Elements → `<link rel="stylesheet">` 태그가 `_astro/<hash>.css` 를 가리키는지 확인.

- [ ] **Step 4: 로그인 → `/` → 대시보드 스타일 확인**

AppLayout 이 감싼 페이지도 스타일 적용됨을 확인.

---

### Task 8: progress.md + session_log.md 업데이트 (Phase 8 에 통합)

- [ ] Phase 8 에서 통합 커밋. 이번 fix 단독 커밋은 Task 6 에 이미 들어감. Phase 8 에서 deploy 전체 회고 + 이 fix 의 회고 ("layout CSS import 누락" 패턴) 를 남긴다.

---

## 4. Self-Review

- **Spec coverage**: Evidence §1 의 근인 (dev-path `<link>`) 을 Task 2+3 가 직접 고친다. 회귀 방지 (§1 "같은 실수 다시 안 일어나도록") 는 Task 1 + 5 가 커버.
- **Placeholder scan**: 완료. 전 Task 가 exact paths + 실행 가능 커맨드 + 기대 출력을 가진다.
- **Type consistency**: Layout 의 CSS import 경로 `../styles/global.css` 는 상대경로. tsconfig `@/*` alias 가 존재하지만 외부 resolver (`vite-tsconfig-paths` 암묵 활성) 의존을 회피하기 위해 상대경로 채택. AppLayout 내부에 `@/components/*` (JS) 와 `../styles/*` (CSS) 가 혼재하는 것은 의도된 trade-off (다른 자산 종류, 다른 resolver 경로).
- **변경 범위 최소성**: 3 파일 수정 + 1 파일 신규. `astro.config.mjs` 나 tailwind config 는 건드리지 않음. `applyBaseStyles: false` 정책 유지.

---

## 5. Follow-up issues (이번 fix 범위 밖, 별도 GitHub 이슈 필요)

1. **`wrangler pages dev` 기반 prod-like smoke E2E** — 현재 E2E 는 `astro dev` 로 도는데, 빌드 산출물 단계 회귀 (이번 CSS 문제) 를 못 잡는다. `dist` 를 `wrangler pages dev` 에 올려 1~2개 핵심 라우트 smoke.
2. **CI 에 smoke step 편입** — 위 spec 이 준비되면 CI 에도 편입.
3. **CLAUDE.md §9 업데이트** — "로컬 E2E 그린" 기준에 "빌드 산출물 실검증 (npm run build → dist 스모크)" 를 명문화.
4. **Phase 8 와 별개로 plan 문서 오류 2건 (`_cf_KV`, `--commit-dirty=true`) 도 수정** — 이미 Phase 8 task 에 queue 돼 있음.

---

## 6. Execution handoff

승인 후 Claude 인라인으로 Task 1 ~ 6 진행, Task 6 Step 4 및 Task 7 전체는 USER.

