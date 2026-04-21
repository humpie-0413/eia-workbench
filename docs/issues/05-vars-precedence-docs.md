# [docs] `wrangler.toml [vars]` vs Pages dashboard env var precedence 문서화

**작성일:** 2026-04-22
**우선순위:** P2 (재발 방지, 신규 기여자·미래의 본인)
**영향 범위:** 문서, 배포 runbook

## 배경

2026-04-22 배포 세션에서 다음 함정에 걸림:

1. `docs/plans/deploy-v0.md §4.A` 의 "Cloudflare 대시보드에서 `APP_ORIGIN`, `TURNSTILE_SITE_KEY` 를 추가" 단계 실행 시도.
2. 대시보드가 다음 메시지로 거부:
   > "Environment variables for this project are being managed through wrangler.toml. Only Secrets (encrypted variables) can be managed via the Dashboard."
3. 원인: `wrangler.toml` 에 `[vars]` 블록이 존재하는 순간 대시보드의 plain var 편집이 잠긴다. 대시보드는 Secrets 만 편집 가능.
4. 결과: Phase 4.A 가 무반영 상태로 Phase 5 로 진행됨 → 프로덕션에 `APP_ORIGIN = "http://localhost:3000"` 이 leak.

근본 수정은 `docs/plans/deploy-v0-wrangler-env-fix.md` 에서 `[env.production.vars]` 로 해결됨.

## 제안

`docs/deploy/env-var-precedence.md` 신규 작성. 다음 3개 규칙을 그림+표로 설명:

### 규칙 1: source-of-truth lockout

`wrangler.toml` 에 `[vars]` 존재 → 대시보드 plain var 편집 불가. Secrets 만 편집 가능. 이 상태는 wrangler.toml 라인 1개만 있어도 적용됨 → 복구는 wrangler.toml 에서 해당 블록 제거.

### 규칙 2: environment scope (`--branch`)

```
wrangler pages deploy dist --branch=<X>
```

- `<X>` = project's production branch (이 프로젝트는 `main`) → `[env.production.*]` 적용
- `<X>` = 다른 값 → top-level `[vars]` / `[[d1_databases]]` / `[[r2_buckets]]` 적용

### 규칙 3: 비상속 키 (non-inheritable keys)

Cloudflare 공식 목록: `vars`, `d1_databases`, `r2_buckets`, `kv_namespaces`, `services`, `queues`, `durable_objects`, `ai`, `analytics_engine_datasets`.

**규칙:** 환경별로 이 중 **하나**를 오버라이드하면, **전부** 재선언해야 한다. 예: `[env.production.vars]` 만 추가하면서 `[[env.production.d1_databases]]` 는 생략 → 프로덕션이 DB 바인딩 없이 배포됨.

### 체크리스트 (배포 전)

- [ ] `[vars]` 가 `wrangler.toml` 에 있는가? → 대시보드는 쓰지 말 것
- [ ] 환경별 오버라이드 있는가? → 비상속 키 모두 재선언했는가
- [ ] `scripts/check-wrangler-prod-vars.sh` 통과하는가

## 관련 파일

- 원인 조사: `docs/plans/deploy-v0-wrangler-env-fix.md §4` Cloudflare docs 인용
- 검증 스크립트: `scripts/check-wrangler-prod-vars.sh`
- 설정 예시: `wrangler.toml:19-39`

## 수용 기준

- `docs/deploy/env-var-precedence.md` 신규
- `README.md` 또는 `CLAUDE.md §9` 에 cross-link
- 체크리스트가 `docs/plans/deploy-v0.md §4` 머리말에 삽입되어 반복 사용 가능
