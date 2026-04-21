# [dev-env] `.dev.vars.example` 템플릿 제공

**작성일:** 2026-04-22
**우선순위:** P2 (신규 기여자 온보딩 마찰)
**영향 범위:** README, 로컬 개발 경험

## 배경

현재 `.dev.vars` 는 `.gitignore` 에 포함되어 커밋되지 않는다. 신규 기여자가 로컬 개발 시작 시 필요한 키 목록·형식·테스트값을 재구성할 출처:
- `.github/workflows/ci.yml` 의 `.dev.vars` seed step
- `docs/plans/deploy-v0.md §1` 시크릿 분류표
- `src/middleware.ts` 의 `env.APP_ORIGIN`, `env.JWT_SECRET` 참조

온보딩 시 이 3곳을 직접 뒤져야 함. 값 오타·누락 시 증상이 silent (login 실패 외 에러 없음).

## 제안

`.dev.vars.example` 를 커밋:

```
# Local dev overrides for `wrangler pages dev` / Astro dev server.
# Copy to `.dev.vars` and fill in actual values.
# `.dev.vars` is gitignored — never commit real values.

# 로그인 비밀번호. 로컬 개발용 임의값.
APP_PASSWORD=change-me-long-random

# JWT 서명 키. 32+ 바이트 랜덤. 운영과 다른 값 사용.
JWT_SECRET=ci-local-throwaway-secret-not-used-in-prod

# Turnstile — Cloudflare 공식 always-pass 테스트 키 (운영값 아님).
# https://developers.cloudflare.com/turnstile/troubleshooting/testing/
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

### `.gitignore` 조정

현재:
```
.env
.env.*
!.env.example
```

추가 또는 변경 필요? `.dev.vars` 는 `.env.*` 패턴에 걸리지 않으므로 별도 라인:
```
.dev.vars
!.dev.vars.example
```

### README 업데이트

"로컬 개발 시작" 섹션에 1줄 추가:
```
cp .dev.vars.example .dev.vars  # 후 본인 값으로 편집
```

## 수용 기준

- `.dev.vars.example` 커밋됨
- `.gitignore` 에 `.dev.vars.example` 허용 exception 추가
- README "로컬 개발" 섹션에 절차 명시
- `npm run dev` 가 `.dev.vars.example` 를 `.dev.vars` 로 복사한 상태에서 바로 로그인 가능

## 주의

- 이 파일은 **항상 always-pass 테스트 키**만 포함한다. 운영 Turnstile site key(`0x4AAAAAADAUrmpBcDS4csj4`) 는 넣지 않는다 (혼동 방지).
- 값 전부 Cloudflare 공식 공개값 또는 throwaway.
