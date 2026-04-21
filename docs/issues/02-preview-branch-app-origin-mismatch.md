# [deploy] Preview branch APP_ORIGIN mismatch 차단

**작성일:** 2026-04-22
**우선순위:** P1 (preview 배포 활성화 전 반드시 해결)
**영향 범위:** 미래의 git-integrated preview 배포, CSRF 미들웨어

## 배경

이번 배포 세션(`docs/plans/deploy-v0-wrangler-env-fix.md`)에서 `wrangler.toml` 구조를 다음과 같이 확정:

```toml
[vars]
APP_ORIGIN = "http://localhost:3000"      # 로컬 dev 기본값

[env.production.vars]
APP_ORIGIN = "https://eia-workbench-v0.pages.dev"
```

Cloudflare 의 branch 선택 규칙:
- `--branch=main` → `[env.production.*]` 선택
- 다른 브랜치 (preview) → top-level `[vars]` 로 폴백

**결과:** 미래에 git-integrated preview 배포를 켜면 preview URL(예: `https://abc123.eia-workbench-v0.pages.dev`) 에서 실행 시 `env.APP_ORIGIN = "http://localhost:3000"` 이 되고, middleware 의 Origin-match CSRF 체크가 모든 state-changing POST 요청을 403 으로 거부한다.

## 현재 상태

- v0 은 Direct Upload (`wrangler pages deploy dist --branch=main`) 만 사용.
- Git 연동 preview 배포는 비활성화 상태 → 블로커는 아님.
- 가드: `scripts/check-wrangler-prod-vars.sh` 는 `[env.production.vars]` 만 검증. preview 는 무검증.

## 선택지 분석

| 옵션 | 가능성 | 효과 |
|---|---|---|
| A. `[env.preview.vars]` 와일드카드 origin | ❌ | Cloudflare 스펙이 literal string 만 허용, 와일드카드 불가 |
| B. middleware 가 `*.eia-workbench-v0.pages.dev` 오리진 허용 | ✅ | 코드 변경 필요, 테스트 확장, preview 용으로는 안전 허용 |
| C. Git-integrated preview 영구 비활성화 | ✅ | 가장 간단, v0 정책과 일치 (`CLAUDE.md §9.5` 자동 배포 금지) |
| D. preview 를 별도 Pages 프로젝트로 분리 | ⚠️ | D1/R2 데이터 분리 부담 큼 |

## 권장

- **v0:** C (현상 유지) + 이 이슈를 열어둠.
- **v1:** B 구현. `src/middleware.ts` 의 Origin 허용 로직을 `url.hostname.endsWith('.eia-workbench-v0.pages.dev') || url.origin === env.APP_ORIGIN` 패턴으로 확장. 테스트 추가.

## 수용 기준

**Option C 선택 시:**
- Cloudflare Pages 프로젝트 Settings → Git 연동 비활성화 상태 유지 확인
- `CLAUDE.md §9.5` 에 해당 정책 명문화
- `docs/plans/deploy-v0.md` 에 "preview 비활성" 정책 노트 추가

**Option B 선택 시(v1):**
- `src/middleware.ts` origin 허용 확장 + unit 테스트
- `tests/e2e/csrf-preview.spec.ts` 추가 (실제 preview URL 시뮬레이션)
- README 에 preview 배포 runbook 추가

## 관련 파일

- `wrangler.toml:19-21, 37-39` (현재 [vars] / [env.production.vars])
- `src/middleware.ts` (Origin 체크 지점)
- `docs/plans/deploy-v0-wrangler-env-fix.md §9.1` (follow-up 등록 지점)
