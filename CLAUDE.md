# CLAUDE.md — eia-workbench 고정 규칙

## 1. 프로젝트 목적
환경영향평가사·평가대행사를 위한 보고서 작성·검수·의견 대응 워크스페이스.
공공포털 복제가 아닌 실무시간 절감 B2B SaaS MVP.

## 2. 절대 원칙
1. 요청받으면 먼저 질문·가정·계획을 제시한다. 계획서(`docs/plans/*.md`) 없이 코드를 수정하지 않는다.
2. 운영 서버에서 유료 LLM API를 상시 호출하지 않는다. LLM이 필요한 곳은 "Claude 수동 분석용 프롬프트 생성기"로 대체한다.
3. 법적 결론·승인 가능성 단정·현지조사 대체 표현을 UI/문서에 쓰지 않는다.
   항상 "검토 보조", "사람 확인 필요", "근거/가정/한계"를 함께 표시한다.
4. EIASS 원문을 재호스팅하거나 대량 복제·재판매하지 않는다. 공식 링크(deep link)와 사용자 업로드 문서만 다룬다.
5. MVP 범위 밖 기능을 임의로 추가하지 않는다. 욕심이 생기면 `docs/plans/`에 새 계획서를 먼저 쓴다.

## 3. 기술 스택 (MVP 기준)
- 언어/런타임: TypeScript strict, Node.js 18+
- 프런트엔드: **Astro 5 + React islands** (정적 우선, 인터랙션 필요 컴포넌트만 island)
- 대상 업종 1개: **육상풍력**
- 배포: Cloudflare Pages + Workers + D1 + R2 + Turnstile (무료 구간)
- 환경영향평가 공공 데이터: **data.go.kr** (KEI 제공 OpenAPI 20종). 인증키 `SERVICE_KEY` (Cloudflare Secret). 상세: `docs/adr/0001-eia-api-source.md`
- 문서·규칙 데이터: `/data/rules`, `/data/templates` (JSON/YAML)
- 셸: Git Bash (Windows) 기본. WSL2 허용. PowerShell/cmd 전용 명령은 쓰지 않는다.

## 4. 디렉터리 규칙
- `docs/` — 기획·계획·리뷰·변경기록. 구현 결정은 여기에 먼저 기록.
- `prompts/` — Claude 운용 프롬프트. 역할별/기능별로 분리.
- `src/features/<feature-name>/` — 기능별 코드. 기능끼리 직접 참조 금지, `src/lib/` 또는 `src/shared/` 경유.
- `data/samples/private/` — 민감 샘플. Git·Claude 모두 무시(.gitignore, .claudeignore).
- `tests/` — 기능명과 동일한 하위 폴더.

## 5. 코딩 스타일
- TypeScript strict on. `any` 금지(불가피하면 주석과 함께 `// TODO`).
- 파일명/폴더명: kebab-case. 컴포넌트명: PascalCase. 함수/변수: camelCase.
- 한 PR/브랜치 = 한 기능. 한 커밋 = 한 논리 변경. 커밋 메시지는 Conventional Commits.
- 모든 LLM/분석 결과 객체는 `{result, basis, assumptions, limits, needsHumanReview:boolean}` 형태로 표준화한다.

## 6. 금지 사항
- 유료 API·유료 DB·유료 큐·유료 벡터스토어 도입 (§2-2 위반).
- 법령·가이드라인 원문의 자동 요약으로 사용자에게 "결론"을 제공하는 UI.
- 주민 의견·기관 의견의 임의 축약·삭제·왜곡.
- `data/samples/private/`, `.env`, 업로드 파일을 Claude 컨텍스트·커밋에 포함시키는 행위.

## 7. 실행·검증 명령 (초기 값, 스캐폴딩 후 실제 값으로 갱신)
- 설치: `npm ci`
- 개발 서버: `npm run dev`
- 타입체크: `npm run typecheck`
- 린트/포맷: `npm run lint` / `npm run format`
- 테스트: `npm test`
- 빌드: `npm run build`

## 8. Claude Code 운용
- 계획/조사는 Plan mode, 구현은 Edit mode(제안→수동 승인). Auto-Accept는 기본 off.
- 세션 시작 시 항상 `CLAUDE.md`, `progress.md`, 관련 `docs/plans/*.md`를 먼저 읽게 한다.
- 기능별 브랜치/워크트리: `feature/<name>`. 병합 전 `docs/reviews/`에 리뷰 노트 1개 이상.
- 세션 종료 시 반드시 `progress.md`와 `docs/changelog/session_log.md`를 갱신한다.

## 9. gstack + Superpowers 운용 규칙 (eia-workbench 특화)

### 9.1 흐름 고정
1. `/office-hours` 로 설계 문서 생성.
2. Superpowers 의 `brainstorming` 이 자동 활성되도록 둔다. 끊지 말 것.
3. `writing-plans` 로 계획서 작성. 2–5분 단위 태스크로 분해되어야 함.
4. `/autoplan` 으로 CEO·Design·Eng 삼중 리뷰. 그 직후 본 파일의 §9.3 "환경영향평가 도메인 리뷰"를 수동 실행.
5. `using-git-worktrees` 가 자동으로 `../eia-workbench-<feature>` 워크트리를 만들게 둔다.
6. `subagent-driven-development` 로 태스크별 서브에이전트 구현.
7. `/design-review <local-url>` 로 UI 슬롭 제거. 이 프로젝트에서는 이모지·그라데이션·일러스트풍 일러스트·과도한 색 금지.
8. `/review` → `/qa` → `/ship` → `/checkpoint` 순으로 마감.

### 9.2 무조건 지키는 가드
- 운영 코드에 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` 같은 유료 LLM 키 환경변수 참조를 추가하면 **거절**. Superpowers가 TDD로 붙이려 해도 막는다.
- UI 문자열·에러 메시지·테스트 assertion에 "환경영향평가 대상입니다", "협의 통과", "승인됨", "법적으로 문제없음" 같은 **단정 표현 금지**. 항상 "가능성", "확인 필요", "전문가 검토 필요"로.
- EIASS 원문을 DB/스토리지/테스트 픽스처에 재호스팅하지 않는다. 공식 링크와 사용자가 업로드한 자기 문서만 다룬다.
- `/design-review` 의 자동 수정 한도는 **10건 이하**. 그 이상이면 수동 승인.

### 9.3 환경영향평가 도메인 리뷰 (4번째 리뷰)
`/autoplan` 직후 다음 프롬프트를 붙여 수동 실행한다:
> "방금 나온 plan을 환경영향평가 실무 관점에서 재검토하라. ① 법적 결론 단정 여부 ② 현지조사 대체 주장 여부 ③ EIASS 원문 재호스팅 여부 ④ 주민·기관 의견의 임의 축약/왜곡 여부 ⑤ 결과 객체에 `{result, basis, assumptions, limits, needsHumanReview}` 표준 스키마 포함 여부. 각 항목 Pass/Fail과 근거를 표로. Fail이 1개라도 있으면 plan을 수정한 diff를 제시하라."

### 9.4 `/design-review` 대상 URL
MVP에서는 로컬 개발 서버(예: `http://localhost:3000`). 배포 후에도 **공개 스테이징 URL을 `/design-review`에 전달한다**. 운영 URL에는 직접 붙이지 않는다(고객 데이터 오염 방지).

### 9.5 `/ship` 의 작동 범위
이 프로젝트에서 `/ship` 은 **PR 생성까지만** 허용. 자동 배포는 막는다. Cloudflare Pages 배포는 수동 승인 후 별도 커맨드로.

## 10. 검증·의사결정 운영 규칙

### 10.1 사전 결함 (pre-existing failure) 자동 제외

새 작업의 검증 기준 ("npm test PASS, typecheck PASS") 에서 다음은 **자동 제외**한다:

- baseline (현재 main HEAD 이전 commit) 에서도 동일하게 발생하는 실패
- 본 작업 diff 와 import / dependency 관계가 없는 파일의 실패
- 외부 의존성 설치 (`npm install`) 만으로 해결되는 환경 문제

격리 판정 절차:
1. 본 작업이 변경한 파일에 한정한 typecheck / 관련 test 가 PASS 면 검증 OK 로 간주.
2. 사전 결함은 본 작업의 commit / PR 흐름에 끼우지 않고, 별도 issue 로만 기록.
3. 사전 결함 정리는 **별도 hotfix PR** 로 처리한다 (현재 작업과 동일 commit/PR 에 합치지 말 것).

이 규칙 적용 사실은 PR/commit 메시지 또는 사용자 보고에 1줄로 명시 ("사전 결함 N건 격리, 별도 issue").

### 10.2 블로킹 시 디폴트 액션

작업 진행 중 의사결정이 필요할 때, "선택지 N개 중 무엇?" 형태로 사용자에게 묻지 말 것. 다음 형식으로 자체 처리한다:

1. 가장 안전하고 reversible 한 디폴트 액션을 즉시 실행.
2. 결과를 사용자에게 보고 (commit hash, 파일 변경 수, 검증 결과).
3. 사용자가 "다른 방향" 으로 가고 싶으면 그때 redirect.

선택지를 나열해 사용자 결정을 받아야 하는 경우는 **다음 셋만**:

- 코드 일부 영구 삭제 (revert 어려움 — git history 도 잃는 force-push 등)
- 운영 데이터 영구 변경 (D1 `DROP`, R2 객체 삭제, 프로덕션 D1 `DELETE` 등)
- 사용자 자격증명·secret 다루는 작업 (`SERVICE_KEY` 노출/회전 등)

이 셋 외에는 무조건 디폴트 액션 + 사후 보고.
