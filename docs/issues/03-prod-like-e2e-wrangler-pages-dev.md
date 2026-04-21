# [e2e] Prod-like E2E via `wrangler pages dev`

**작성일:** 2026-04-22
**우선순위:** P1 (CSP/미들웨어 회귀를 로컬에서 포착하지 못한 사례 1건 이상 누적)
**영향 범위:** CI, 테스트 인프라, 배포 전 검증 신뢰도

## 배경

현재 E2E 스위트(`tests/e2e/*.spec.ts`)는 Astro dev 서버(`npm run dev`) 에서 실행된다. 프로덕션은 Cloudflare Pages Functions 런타임(`@astrojs/cloudflare` 어댑터 + miniflare 바인딩) 이다. 두 환경은 런타임 동작이 다르다:

- `env.APP_ORIGIN`, `env.TURNSTILE_*` 바인딩 주입 경로
- CSP 헤더 추가 방식 (Astro middleware vs. CF _headers)
- `runtime.env` 객체의 키 set
- D1/R2 바인딩 접근 방식 (local sqlite vs. miniflare R2)

이번 배포 세션에서 두 차례 "로컬 그린, 프로덕션 레드" 사례가 발생했다:
- CSS 번들 누락 (dev-only `<link>` 경로)
- `env.APP_ORIGIN = "http://localhost:3000"` 프로덕션 leak

## 제안

`wrangler pages dev dist --d1=DB --r2=UPLOADS` 런타임에서 실행되는 smoke 서브셋 E2E 를 CI 에 추가.

### 스크립트 스켈레톤

```bash
# scripts/run-prod-like-e2e.sh
set -euo pipefail
npm run build
npx wrangler pages dev dist \
  --d1=DB \
  --r2=UPLOADS \
  --port=8788 \
  --proxy=8787 &
WRANGLER_PID=$!
trap "kill $WRANGLER_PID" EXIT
# wait for ready
until curl -sf http://localhost:8788/login > /dev/null; do sleep 1; done
PORT=8788 npx playwright test --grep "@prod-like"
```

### 최소 커버리지

- S1 (login 페이지 렌더 + Turnstile sitekey 주입)
- S2 (로그인 302)
- S3 (/ 스타일 적용)
- S4 (새 프로젝트 POST 201)

= `tests/e2e/prod-like-smoke.spec.ts` 에 `@prod-like` 태그

## 수용 기준

- `tests/e2e/prod-like-smoke.spec.ts` 신규
- `scripts/run-prod-like-e2e.sh` 신규
- `.github/workflows/ci.yml` 에 새 job `verify-prod-like` 추가 (기존 verify 와 병렬)
- 로컬 `bash scripts/run-prod-like-e2e.sh` 로 동일 결과 재현 가능
- 시간 예산: CI 런 총 시간 +3분 이내

## 관련

- `@astrojs/cloudflare` 어댑터 docs: https://docs.astro.build/en/guides/integrations-guide/cloudflare/
- `wrangler pages dev` docs: https://developers.cloudflare.com/pages/functions/local-development/
- 이전 flake 분석: `docs/changelog/session_log.md` 2026-04-21 항목 CI fix commits k/l/m
