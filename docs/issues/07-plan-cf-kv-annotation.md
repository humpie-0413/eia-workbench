# [docs] `docs/plans/deploy-v0.md` §3.3 `_cf_KV` 주석 수정

**작성일:** 2026-04-22
**우선순위:** P3 (문서 정확성, 영향 없음)
**영향 범위:** 계획 문서 1곳

## 배경

`docs/plans/deploy-v0.md §3.3` (D1 스키마 검증 step) 의 현재 텍스트:

```
기대: `d1_migrations`, `login_attempts`, `projects`, `uploads` (총 4개).
스키마가 `AUTOINCREMENT` 를 쓰면 `sqlite_sequence` 가 추가되어 총 5개.
`_cf_KV` 는 D1 에 존재하지 않음 (Workers KV 내부 테이블이며 본 프로젝트는 KV 미사용).
```

**실제:** `_cf_KV` 는 D1 v2 기본 테이블이다 (Cloudflare 메타/KV 폴리필). `wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master"` 실행 시 `_cf_KV` 는 **거의 항상 나타난다** (D1 인스턴스 기준). 본 프로젝트가 Workers KV 를 쓰지 않는 것과 무관.

현재 주석은 "존재하지 않음" 이라고 단정 → 프로덕션에서 실제 쿼리 결과에 `_cf_KV` 가 보이면 reviewer 가 "의도치 않은 테이블" 로 오해할 위험.

## 제안 수정

§3.3 기대값을 다음과 같이 갱신:

```
기대 테이블:
  - 애플리케이션: d1_migrations, login_attempts, projects, uploads (4개)
  - D1 내부: _cf_KV (Cloudflare 메타, 자동 생성. 무시)
  - AUTOINCREMENT 사용 시: sqlite_sequence (자동 생성)
  최대 6개까지 정상.

검증 기준: 애플리케이션 테이블 4개가 모두 포함되었는가.
```

## 추가: §5.2 `--commit-dirty=true` flag 언급

§5.2 배포 커맨드는 현재:
```
npx wrangler pages deploy dist --project-name eia-workbench-v0 --branch main --commit-hash=$(git rev-parse HEAD)
```

로컬 working tree 가 dirty (예: `public/.build-version` 이 gitignored 이지만 존재) 인 상태에서 `--commit-hash` 를 명시하면 wrangler 가 "dirty tree, are you sure?" 프롬프트를 띄울 수 있다. 배제 방법:

```
... --commit-hash=$(git rev-parse HEAD) --commit-dirty=true
```

또는 `--commit-hash` 생략. CI 에서는 dirty 가 없어 무관, 로컬 수동 배포 시만 필요.

## 추가: Phase 5.4 범위 명확화

§5.4 "Turnstile 도메인 제한" 은 **사이트 봇 차단 scope** 이지 CSRF/로그인 경로와 무관. 이 세션 중 일부에서 "hostname 이 CSRF 에 영향" 이라는 혼동이 있었음. 주석 1줄 추가:

```
§5.4 주의: Turnstile hostname 은 위젯의 bot-challenge scope 제한이다.
  CSRF origin check(`env.APP_ORIGIN`) 와는 독립.
  로그인 실패 원인 디버깅 시 이 둘을 구분할 것.
```

## 수용 기준

- `docs/plans/deploy-v0.md §3.3` 기대 테이블 목록 갱신
- `docs/plans/deploy-v0.md §5.2` `--commit-dirty=true` flag 노트 추가
- `docs/plans/deploy-v0.md §5.4` Turnstile hostname scope 주석 추가
- 별도 commit: `docs(plan): fixup deploy-v0 post-ship annotations`

## 관련

- 이 fixup 은 `docs/plans/deploy-v0-wrangler-env-fix.md §9` follow-up #4 에서 등록됨.
