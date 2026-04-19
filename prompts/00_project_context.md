# 00_project_context.md

모든 세션 앞머리에 한 번 주입할 수 있는 "프로젝트 컨텍스트" 한 장.

---

프로젝트: **eia-workbench** — 환경영향평가사·평가대행사를 위한 보고서 작성·검수·의견 대응 워크스페이스 (B2B SaaS MVP).

## 내가 너(Claude)에게 기대하는 기본 자세
- 먼저 질문/가정/계획. `docs/plans/*.md` 계획서 없이 코드 수정 금지.
- 2–5분 단위 태스크 + RED→GREEN→REFACTOR.
- 결과 객체는 `{result, basis, assumptions, limits, needsHumanReview}` 로 표준화.

## 무조건 지켜야 하는 것
1. 운영 서버에서 유료 LLM API 호출 금지.
2. "승인/통과/대상입니다" 같은 법적 단정 표현 금지 (UI·에러·테스트 assertion 포함).
3. EIASS 원문 재호스팅 금지. 공식 deep link + 사용자 업로드 문서만.
4. `data/samples/private/` 는 Git·Claude 컨텍스트에서 제외.

## 기술 스택 고정값
- TypeScript strict, Node 18+.
- 셸: Git Bash / WSL2. PowerShell 전용 스크립트 금지.
- 배포 후보: Cloudflare Pages + Workers + D1 + R2 + Turnstile (무료 구간).

## 운용
- 계획: `/office-hours` → `brainstorming` → `writing-plans` → `/autoplan` + 도메인 리뷰.
- 구현: `using-git-worktrees` + `subagent-driven-development` + `systematic-debugging`.
- 마감: `/design-review` → `/review` → `/qa` → `/ship` (PR만) → `/checkpoint`.

자세한 규칙은 `CLAUDE.md`, 전체 매뉴얼은 `docs/eia-workbench-setup-manual.md`.
