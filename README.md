# eia-workbench

환경영향평가사·평가대행사를 위한 보고서 작성·검수·의견 대응 워크스페이스(B2B SaaS MVP).

공공포털(EIASS)의 복제가 아닌, 실무 시간을 절감하는 검수 보조 도구를 목표로 한다.

## 시작

- 운영 원칙·절차는 `CLAUDE.md`
- 현재 상태·다음 작업은 `progress.md`
- 전체 실행 매뉴얼은 `docs/eia-workbench-setup-manual.md`
- Claude Code 운용 프롬프트는 `prompts/gs_sp/`

## 원칙 (요약)

1. 바로 코딩하지 않는다. 상담 → 문서화 → 계획 → 리뷰 → 워크트리 → 구현 → 검증 → 기록.
2. 운영 서버에서 유료 LLM API를 상시 호출하지 않는다.
3. 법적 결론·승인 가능성 단정·현지조사 대체 표현을 UI/문서에 쓰지 않는다.
4. EIASS 원문을 재호스팅하지 않는다.

## 로컬에서 E2E 돌리기

CI에서 잡히는 axe-playwright A11y 위반을 로컬에서 재현·검증하려면, E2E 전제조건을 먼저 점검하세요. `.dev.vars`·로컬 D1·Playwright 크로미움·E2E 비밀번호·Turnstile 테스트 키 5항목을 확인하고, 누락 시 고쳐 쓸 명령을 그대로 출력합니다.

```bash
bash scripts/check-e2e-prereqs.sh   # 전제조건 점검 (FAIL 있으면 비0 종료)
npx wrangler d1 migrations apply DB --local   # 로컬 D1 스키마 (최초 1회)
npx playwright install --with-deps chromium   # Playwright 크로미움 (최초 1회)
export E2E_APP_PASSWORD="$(grep '^APP_PASSWORD=' .dev.vars | cut -d= -f2-)"
npm run test:e2e -- tests/e2e/axe-smoke.spec.ts   # 포커스 실행
npm run test:e2e                                   # 전체 6 스펙
```

`npm run test:e2e`는 `playwright.config.ts`의 webServer 설정으로 `npm run dev`를 자동 기동합니다. 머지 직전에는 반드시 CI 로그가 아니라 로컬에서 한 번 더 돌려 axe 위반을 직접 눈으로 확인하세요.
