# [deploy] byte-identical deploy 회귀 방지 + 배포 후 curl 검증 step

**작성일:** 2026-04-22
**우선순위:** P2 (silent fail 패턴, 현재 정상 동작 중이지만 회귀 시 조용함)
**영향 범위:** 배포 runbook, verify 스크립트

## 배경

### 함정 1: byte-identical skip

`wrangler pages deploy dist` 는 이전 배포와 `dist/` 내용이 byte-identical 이면 업로드를 스킵하고 "No files to upload" 를 리턴한다. 이 동작 자체는 효율 최적화이지만, 다음 시나리오에서 silent fail 을 유발:

- `wrangler.toml` 의 `[env.production.vars]` 만 수정 → `dist/` 는 동일 → 배포 스킵 → 새 env 값 미반영
- 이번 세션은 CSS fix(`79a8a7b`) 와 wrangler env fix(`0bfd35c`) 가 다른 커밋이어서 우연히 `dist/` 가 달라 스킵 트리거 안 됨.

### 함정 2: 배포 후 실제 env 반영 무검증

Pages 대시보드 UI, wrangler.toml, `wrangler pages secret put` 세 경로가 각각 서로 다른 lockout 동작을 가진다 (`docs/issues/05-vars-precedence-docs.md` 참고). "배포 성공" ≠ "새 env 값 반영". 반영 여부는 **실제 라이브 URL 에 렌더된 값**으로만 확인 가능.

## 제안

### 파트 A — byte-difference 강제

`public/.build-version` 자동 생성 (매 빌드마다 timestamp + git SHA):

```bash
# scripts/stamp-build-version.sh
set -euo pipefail
git_sha=$(git rev-parse --short HEAD 2>/dev/null || echo "nogit")
ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
mkdir -p public
echo "{\"build\":\"$git_sha\",\"ts\":\"$ts\"}" > public/.build-version
```

`package.json` 의 `build` 스크립트에 prepend:
```json
"build": "bash scripts/stamp-build-version.sh && astro build"
```

`.gitignore` 추가: `public/.build-version`

**효과:** 매 빌드마다 `public/.build-version` 바이트가 달라져 `dist/.build-version` 이 달라짐 → `wrangler pages deploy` 가 반드시 업로드.

### 파트 B — 배포 후 curl 검증

`scripts/check-deploy-reflection.sh`:

```bash
set -euo pipefail
URL="${1:-https://eia-workbench-v0.pages.dev}"

# 1. Turnstile site key 반영
sitekey=$(curl -sf "$URL/login" | grep -oE 'data-sitekey="[^"]+"' | head -1 || true)
if [ -z "$sitekey" ] || [ "$sitekey" = 'data-sitekey=""' ]; then
  echo "FAIL: Turnstile data-sitekey not rendered at $URL/login" >&2
  exit 1
fi
expected='data-sitekey="0x4AAAAAADAUrmpBcDS4csj4"'
if [ "$sitekey" != "$expected" ]; then
  echo "FAIL: sitekey mismatch. got=$sitekey expected=$expected" >&2
  exit 1
fi

# 2. CSS 번들 링크 반영
css=$(curl -sf "$URL/login" | grep -oE '/_astro/[^"]+\.css' | head -1 || true)
if [ -z "$css" ]; then
  echo "FAIL: CSS bundle link missing at $URL/login" >&2
  exit 1
fi

# 3. 배포 stamp 반영 (byte-difference 확인)
build=$(curl -sf "$URL/.build-version" || true)
if [ -z "$build" ]; then
  echo "WARN: .build-version not served (static asset routing missing)" >&2
fi

echo "OK: $URL — sitekey OK, css=$css, build=$build"
```

배포 runbook 에 추가:
```
wrangler pages deploy ...
sleep 30  # 전파 대기
bash scripts/check-deploy-reflection.sh https://eia-workbench-v0.pages.dev
```

## 수용 기준

- `public/.build-version` 자동 생성 + `.gitignore` 적용
- `scripts/check-deploy-reflection.sh` 신규
- `docs/plans/deploy-v0.md §5.3` 에 이 step 삽입
- 다음 배포 시 runbook 대로 실행 → OK
- 의도적 회귀 테스트: wrangler.toml env 값만 바꾸고 배포 → 반영 검증 FAIL 이 포착 (스크립트 작동 증명)

## 관련

- `docs/issues/05-vars-precedence-docs.md` (precedence 규칙)
- `scripts/check-wrangler-prod-vars.sh` (배포 **전** 검증)
- 이번 세션 commit `0bfd35c` (env fix) 이후 사용자가 수동으로 `curl grep cf-turnstile` 실행한 것을 스크립트화
