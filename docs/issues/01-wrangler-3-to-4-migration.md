# [deploy] wrangler 3.x → 4.x 마이그레이션

**작성일:** 2026-04-22
**우선순위:** P2 (운영 블로커 아님, major 버전 drift 축적 방지)
**영향 범위:** Pages deploy, Workers deploy, CI, `wrangler.toml` 문법

## 배경

`docs/plans/deploy-v0.md` 배포 세션에서 로컬 `wrangler 3.114.17` 로 핀 고정. 4.84.0 업그레이드 알림이 반복 표시됐으나 major 버전이라 breaking change 가능성을 고려해 v0 배포는 3.x 로 진행. 배포 완료 후 마이그레이션 이슈로 분리하기로 합의.

## 현재 상태

- `package.json`: `wrangler@^3.114.17` (or pinned exact)
- `wrangler.toml`: `compatibility_date = "2024-09-23"`
- CI: `npx wrangler` 호출 경로 — `npx wrangler d1 migrations apply DB --local`

## 조사 대상 (4.x breaking changes)

1. `wrangler pages deploy` flag 이름/동작 변화
2. `wrangler d1` 서브커맨드 출력 포맷 (CI parser 영향)
3. Secret 관리 명령(`wrangler pages secret put`) 인증 흐름
4. `compatibility_date` 기대값 변경 여부
5. `nodejs_compat` flag 의미 변화
6. `wrangler.toml` 의 `[[env.production.*]]` 호환성

## 제안 작업

- [ ] `npm i wrangler@^4 --save-dev` 후 로컬 동작 확인
- [ ] `npx wrangler --version` / `npx wrangler deploy --dry-run` 출력 diff
- [ ] `scripts/check-wrangler-prod-vars.sh` 영향 없음 확인 (grep 기반이라 무관)
- [ ] `scripts/check-build-css.sh` 동일
- [ ] CI 워크플로(`.github/workflows/ci.yml`) 의 wrangler 호출 step 재검증
- [ ] 프로덕션 테스트 배포 (feature 브랜치 → preview) 후 health-check
- [ ] `compatibility_date` 필요 시 상향 (breaking 없는 최신 날짜)
- [ ] PR 본문에 upgrade 노트 + rollback 플랜

## 수용 기준

- CI `verify` 그린
- `wrangler pages deploy` 출력이 기존과 동일한 production URL 로 배포
- `check-build-css.sh`, `check-wrangler-prod-vars.sh` 그대로 통과
- 배포 후 스모크 플레이북(`docs/deploy/v0-smoke-playbook.md`) S1~S10 통과

## 롤백

문제 발생 시 `package.json` 에서 `wrangler@3.114.17` 로 revert + `rm -rf node_modules && npm ci`.
