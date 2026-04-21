# [deploy] cleanup worker 로컬 실행 검증 루틴 추가

**작성일:** 2026-04-22
**우선순위:** P1 (이번 세션에서 실제 배포 실패를 로컬로 미리 포착 못 함)
**영향 범위:** CI, 로컬 개발, `workers/cleanup.wrangler.toml`

## 배경

2026-04-22 Phase 6.1 배포 시 다음 실패 발생:

```
X [ERROR] The entry-point file at "workers\cron-cleanup.ts" was not found.
```

추가로 Windows wrangler 3.114.17 에서 libuv 크래시:
```
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)
```

### 근인

`workers/cleanup.wrangler.toml` 의 `main = "workers/cron-cleanup.ts"`. Cloudflare 문서 규칙: `main` 은 config 파일의 디렉터리 기준 상대경로. config 가 `workers/` 에 있으므로 `"workers/"` prefix 를 붙이면 `workers/workers/cron-cleanup.ts` 를 찾는다.

### 왜 미리 못 잡았나

- `4f8f792 chore(deploy): wire production D1/R2 bindings for v0` 에서 cleanup.wrangler.toml 이 추가됨
- 이 커밋 이후 어떤 단계에서도 "cleanup worker 를 로컬에서 실행·빌드 검증" 이 없었음
- CI 도 cleanup 전용 검증 step 없음 (기존 `npx wrangler d1 migrations apply DB --local` 은 main wrangler.toml 기반)

## 제안

### A. 로컬 드라이런 step 추가

`scripts/check-cleanup-worker.sh` 신규:
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

CONFIG="workers/cleanup.wrangler.toml"
[ -f "$CONFIG" ] || { echo "FAIL: $CONFIG missing" >&2; exit 1; }

# wrangler dry-run: parse config, resolve main, bundle — but skip upload.
if ! npx wrangler deploy --config "$CONFIG" --dry-run 2>&1 | tee /tmp/cleanup-dryrun.log; then
  echo "FAIL: cleanup worker dry-run failed. See /tmp/cleanup-dryrun.log" >&2
  exit 1
fi

grep -qE 'bundle size' /tmp/cleanup-dryrun.log \
  || { echo "FAIL: dry-run did not produce bundle size output — entry-point resolution likely failed" >&2; exit 1; }

echo "OK: cleanup worker dry-run succeeded."
```

### B. CI 에 추가

`.github/workflows/ci.yml`:
```yaml
      - name: verify cleanup worker bundles
        run: bash scripts/check-cleanup-worker.sh
```

기존 verify 단계 옆에 나란히. CI 실패 시 즉시 롤백.

### C. wrangler.toml main 경로 규칙 문서화

`CLAUDE.md §9` 또는 README 에 1줄:
> `wrangler.toml` 의 `main` 필드는 **config 파일 위치 기준 상대경로**. repo root 가 아님. 서브디렉터리에 있는 config(`workers/*.toml`) 는 절대 `workers/` prefix 를 쓰지 말 것.

## 수용 기준

- `scripts/check-cleanup-worker.sh` 신규 (+실행 권한)
- `.github/workflows/ci.yml` verify job 에 step 추가
- 의도적 회귀 테스트: `main` 경로를 일시적으로 잘못 돌려보면 CI FAIL
- 복구 후 그린
- `CLAUDE.md` 또는 README 에 `main` 경로 규칙 명문화

## 관련

- 이번 세션 fix commit: `workers/cleanup.wrangler.toml` main 경로 수정
- `docs/plans/deploy-v0.md §6.1` 배포 전 체크리스트에 이 스크립트 호출 추가 권장
