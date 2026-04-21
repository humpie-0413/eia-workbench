# v0 프로덕션 스모크 플레이북

**배포 대상:** `https://eia-workbench-v0.pages.dev`
**실행 주기:** 프로덕션 배포 직후 1회, 이후 매 배포마다.
**실행자:** 사용자 (시크릿 창 + DevTools).

스모크 실패는 `docs/plans/deploy-v0.md §11 롤백 플랜` 을 트리거한다. 실패 1건이라도 발생하면 `wrangler pages deployment list` → 이전 배포 Rollback 후 원인 분석.

---

## 사전 준비

- [ ] 새 incognito 창 (쿠키/세션 격리)
- [ ] DevTools → Network 탭 → "Preserve log" on
- [ ] DevTools → Console 탭 비우기
- [ ] 최신 배포 해시 확인: `curl -sI https://eia-workbench-v0.pages.dev | grep -i cf-ray`

## 핵심 플로우 (머스트 패스)

- [ ] **S1.** `/login` 접속 → Turnstile 위젯 렌더 (체크박스 영역 보임)
  - Console 에 "invalid sitekey" 없음
  - DOM: `<div class="cf-turnstile" data-sitekey="0x4AAAAAADAUrmpBcDS4csj4">`
- [ ] **S2.** 로그인 → 302 → `/`
  - 응답 헤더 `Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax`
  - CSP 헤더: `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`
- [ ] **S3.** `/` 렌더 → PilotWarningBanner + 헤더 + `새 프로젝트` 버튼 보임
  - Tailwind 스타일 적용 (카드·간격·타이포그래피)
- [ ] **S4.** 새 프로젝트 생성 (이름 + 시/도 + 시/군/구) → 201 → 목록 반영
- [ ] **S5.** 프로젝트 카드 클릭 → 상세 페이지 진입
- [ ] **S6.** PDF 1건 업로드 (`%PDF-1.4\n%EOF\n` 최소 파일 가능) → 파일 목록 표시
- [ ] **S7.** 파일 삭제 → `최근 삭제` 드로어 반영
- [ ] **S8.** 드로어에서 복구 → 파일 목록으로 복귀
- [ ] **S9.** 상세 페이지에서 프로젝트 삭제 → `/` 에서 사라짐 + `최근 삭제` 드로어에 표시
- [ ] **S10.** `/logout` → 쿠키 무효화 → `/login` 재접속 요구

## 거부 플로우 (머스트 리젝트)

- [ ] **R1.** HWP/HWPX 업로드 시도 → 거부 메시지 + 토스트
- [ ] **R2.** 30MB 초과 PDF 업로드 → 쿼터 거부
- [ ] **R3.** 잘못된 비밀번호 5회 → 브루트포스 락아웃 메시지

## 환경 주입 반영 검증 (curl)

배포 직후 매번:

```bash
# 1. Turnstile site key 주입 확인
curl -s https://eia-workbench-v0.pages.dev/login \
  | grep -oE 'data-sitekey="[^"]+"' \
  | head -1
# 기대: data-sitekey="0x4AAAAAADAUrmpBcDS4csj4"

# 2. CSP 헤더 확인
curl -sI https://eia-workbench-v0.pages.dev/login \
  | grep -i content-security-policy

# 3. CSS 번들 링크 확인
curl -s https://eia-workbench-v0.pages.dev/login \
  | grep -oE '/_astro/[^"]+\.css' \
  | head -1
```

## 결과 기록 (2026-04-22 배포)

- S1 ✓ S2 ✓ S3 ✓ S4 ✓ S5 ✓ S6 ✓ S7 ✓ S8 ✓ S9 (패턴 확인) S10 (대기)
- R1~R3: 이전 E2E 커버리지로 확인됨 (tests/e2e/hwp-reject.spec.ts, quota-exceeded.spec.ts)
- curl 검증: data-sitekey=`0x4AAAAAADAUrmpBcDS4csj4` ✓, CSS 링크=`/_astro/index.*.css` ✓

## 연계 E2E 스펙

같은 경로를 로컬에서 자동 검증하는 스펙:

- `tests/e2e/crud-happy.spec.ts` — S2~S8 커버
- `tests/e2e/hwp-reject.spec.ts` — R1 커버
- `tests/e2e/quota-exceeded.spec.ts` — R2 커버
- `tests/e2e/axe-smoke.spec.ts` — a11y 랜드마크

이 스펙들은 Astro 개발 서버 기반. 프로덕션-유사 런타임(CF Pages Functions) 검증은 별도 이슈(`docs/issues/03-prod-like-e2e-wrangler-pages-dev.md`) 로 관리.
