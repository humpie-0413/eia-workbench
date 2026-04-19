# eia-workbench 프로젝트 시작·운영 매뉴얼

**버전:** v1.0
**작성일:** 2026-04-20
**대상 독자:** 혼자 Claude Max + Claude Code 로 환경영향평가 실무지원 SaaS(MVP)를 구축하려는 운영자
**전제 문서:**
- `eia_free_first_project_overview_final.md` — 프로젝트 개요·전략
- `eia_claude_prompt_workflow_document.md` — 작업 워크플로 & 프롬프트 팩

이 문서는 위 두 전제 문서를 기준으로, **실제 개발을 시작하고 끝까지 끌고 가는 데 필요한 모든 것**을 한 곳에 모은 실행 매뉴얼이다. 크게 네 파트로 구성된다.

- **Part 1.** 프로젝트 정의·환경 준비·저장소 초기화
- **Part 2.** 고정 문서 (`CLAUDE.md`, `progress.md`) 초안
- **Part 3.** G-Stack + Superpowers 결합 실전 운영
- **Part 4.** 열린 결정 사항과 다음 액션

> 기본 원칙(지침): 바로 코딩하지 않는다. 먼저 상담 → 문서화 → 계획 → 리뷰 → 워크트리 → 구현 → 검증 → 기록.

---

# Part 1. 프로젝트 정의와 환경 준비

## 1.1 프로젝트 정체성 (한 줄 요약)

> **eia-workbench** — 환경영향평가사·평가대행사를 위한 **보고서 작성·검수·의견 대응 워크스페이스(B2B SaaS MVP)**.

- "환경영향평가 챗봇"이 아니다. 공공포털(EIASS)의 복제는 더더욱 아니다.
- 1차 MVP는 **무료 우선**: 운영 서버에서 유료 LLM API를 상시 호출하지 않는다.
- Claude Max 구독은 **개발 보조/Claude Code용**이다. 서비스 런타임에서 Claude API를 무료로 호출하는 구조가 아니다.

## 1.2 프로젝트 이름 후보

| 후보 | 의미 | 장점 | 단점 |
|---|---|---|---|
| **`eia-workbench`** ★추천 | EIA + 작업대 | 실무 SaaS 톤, 검색성 양호, npm/도메인 충돌 적음 | 무난함 |
| `eia-deskmate` | 평가사 책상 옆 도구 | 친근함 | 가벼워 보일 수 있음 |
| `eia-studio` | 작업 스튜디오 | B2B 톤 | 흔함 |
| `pyeongga-desk` | 평가(서) + 책상 | 한국어 고유 브랜드 | 영문권 확장 약함 |
| `eia-review-kit` | 검수 중심 정체성 | 정체성 명확 | 범위가 좁아 보임 |

**1순위:** `eia-workbench`. 이하 모든 예시는 이 이름 기준. 변경 시 변수만 치환하면 된다. 도메인·npm·GitHub org 실제 가용성은 이름 확정 직전에 직접 확인할 것.

## 1.3 1회성 사전 준비 (Git Bash)

Windows + VSCode + Git Bash 조합 기준. 이미 설치된 건 건너뛴다.

```bash
# 1-1. 필수 버전 확인 (Claude Code는 Node 18+ 필요)
node -v       # v18.x 이상이어야 함
npm -v
git --version
code -v       # VSCode CLI

# 1-2. Node가 없거나 낮으면 nvm-windows로 설치
#      sudo/관리자 권한 npm install 은 금지.

# 1-3. Claude Code CLI 설치 (Max 플랜 OAuth 로그인용)
npm install -g @anthropic-ai/claude-code
claude --version

# 1-4. VSCode에 Claude Code 확장 설치 (CLI를 GUI로 감싸는 공식 확장)
code --install-extension anthropic.claude-code

# 1-5. Git 전역 설정 (이미 했으면 생략)
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
git config --global core.autocrlf input   # Windows 줄바꿈 이슈 예방

# 1-6. Bun 설치 (gstack 요구사항. Superpowers는 필요 없지만 gstack 쓰면 필수)
curl -fsSL https://bun.sh/install | bash
# 설치 후 새 Git Bash 창을 연다
bun --version
```

첫 `claude` 실행 시 브라우저 OAuth 창이 뜬다. **Claude Max 계정으로 로그인**하면 Max 플랜 세션/사용량 한도로 Claude Code가 돌아간다. API 크레딧 결제창이 나오면 거절한다(API는 별도 과금).

> 참고: Windows 순정 PowerShell/cmd는 경로·셸 커맨드 호환성 문제가 잦다. 이 프로젝트는 **Git Bash 또는 WSL2**를 기본 셸로 고정한다.

## 1.4 저장소 초기화

```bash
# 작업 루트 (원하는 경로로 바꿔도 됨)
cd /c/work
mkdir eia-workbench && cd eia-workbench

# Git 초기화
git init
git branch -M main

# 기본 폴더 구조 (전제 문서 §7의 구조를 축약)
mkdir -p docs/plans docs/reviews docs/changelog docs/design
mkdir -p prompts/modules prompts/gs_sp
mkdir -p data/samples/public data/samples/private data/rules data/templates
mkdir -p scripts tests

# 필수 파일 스켈레톤
touch README.md CLAUDE.md progress.md DESIGN.md
touch .gitignore .claudeignore .editorconfig
touch docs/00_project_brief.md
touch docs/changelog/session_log.md
touch prompts/00_project_context.md
```

## 1.5 `.gitignore`

```gitignore
# 공통
node_modules/
dist/
build/
.next/
.cache/
coverage/
.DS_Store
Thumbs.db

# 환경/비밀
.env
.env.*
!.env.example
*.pem
*.key

# 에디터/런타임
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/

# 로그/임시
*.log
tmp/
.temp/

# 프로젝트 고유 (민감)
data/samples/private/
uploads/
```

## 1.6 `.claudeignore`

Claude Code가 컨텍스트에 안 올리는 파일. 민감/거대/무의미 파일 차단.

```
node_modules/
dist/
build/
coverage/
.next/
.cache/
*.log
.env
.env.*
data/samples/private/
uploads/
```

## 1.7 첫 커밋

```bash
git add .
git commit -m "chore: bootstrap eia-workbench skeleton"

# GitHub에 원격을 붙이려면 이후에:
# git remote add origin <URL>
# git push -u origin main
```

## 1.8 VSCode 워크스페이스 설정

### 1.8.1 `.vscode/settings.json` (커밋 대상)

```json
{
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000,
  "files.eol": "\n",
  "terminal.integrated.defaultProfile.windows": "Git Bash",
  "editor.formatOnSave": true,
  "editor.rulers": [100],
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.next/**": true,
    "**/dist/**": true,
    "**/coverage/**": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true,
    "data/samples/private": true
  }
}
```

> `autoSave 1000ms`는 중요하다. Claude Code는 디스크의 파일을 읽고 고치므로, 편집 중 저장되지 않은 버퍼가 있으면 Claude가 낡은 내용을 보게 된다.

### 1.8.2 `.vscode/extensions.json` (권장 확장 잠금)

```json
{
  "recommendations": [
    "anthropic.claude-code",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "editorconfig.editorconfig",
    "yzhang.markdown-all-in-one",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

---

# Part 2. 고정 문서 초안

## 2.1 `CLAUDE.md` (저장소 루트)

지침의 "자주 바뀌지 않는 규칙만" 원칙에 맞춰 짧게. 업무 지시는 들어가지 않는다.

```markdown
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
- 언어/런타임: TypeScript, Node.js 18+
- 프런트엔드: (착수 시 확정 — 정적 배포 가능한 프레임워크)
- 배포 후보: Cloudflare Pages + Workers + D1 + R2 + Turnstile (무료 구간)
- 문서·규칙 데이터: `/data/rules`, `/data/templates` (JSON/YAML)
- 셸: Git Bash (Windows) 또는 WSL2. PowerShell/cmd 전용 명령은 쓰지 않는다.

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
```

## 2.2 `progress.md` (초기 항목)

```markdown
# progress.md

## 현재 목표
eia-workbench 저장소 스캐폴딩 완료 및 `feature/project-shell` 계획서 초안 작성.

## 완료
- 저장소 초기화, 기본 폴더/파일 생성
- CLAUDE.md v0 작성 (§9 gstack+SP 운용 규칙 포함)
- .gitignore / .claudeignore 작성
- Claude Code CLI 설치, Max 계정 OAuth 연결

## 진행 중
- Office Hours 세션 준비 (docs/design/feature-project-shell.md 에 저장 예정)

## 다음 작업
1. /office-hours 로 feature/project-shell 설계문서 생성
2. Superpowers brainstorming 으로 정교화
3. writing-plans 로 plans/feature-project-shell.md 초안
4. /autoplan + 도메인 리뷰 (4중 리뷰)
5. 승인 후 워크트리 생성 → 구현

## 이슈/막힌 점
- 프런트엔드 프레임워크 미정. 정적 배포(CF Pages) 호환성 + 업무용 SaaS 느낌을 고려해 /office-hours 에서 확정 예정.
- 문서 파싱 범위(PDF만 vs HWP/HWPX 포함) 결정 필요. 1차는 PDF/DOCX/텍스트 붙여넣기로 고정 예정.
- 대상 업종 1개 미정.

## 결정된 설계
- LLM 은 1차 MVP 에서 "프롬프트 생성기 + 사용자 수동 Claude 실행"으로만 제공.
- 셸은 Git Bash/WSL2 고정. PowerShell 전용 스크립트 금지.
- 기능별 브랜치·워크트리: `feature/<name>`.

## 검증 상태
- 빌드/테스트 체인 아직 없음 (스캐폴딩 후 설치 예정).

## 남은 리스크
- 저작권: EIASS 비-KOGL 자료 취급 경계를 UI 문구·데이터 플로우에서 유지해야 함.
- 범위 팽창: 기능 욕심 생기면 계획서부터 쓰는 원칙 유지.
- /autoplan 토큰 소모량: 기능당 1회만 캐시 활용.
```

---

# Part 3. G-Stack + Superpowers 결합 실전 운영

## 3.1 용어 매핑 (영상 ↔ 실제 명령어)

| 영상에서 언급 | 실제 이름 | 제공 | 비고 |
|---|---|---|---|
| G-Stack "Office Hours" | `/office-hours` | gstack | 설계 문서를 `docs/`에 자동 저장 |
| G-Stack "Design Review" | `/design-review` | gstack | 실행 중인 URL을 넘겨서 80항목 비주얼 감사 |
| Superpowers "Brainstorming" | `brainstorming` 스킬 (자동) | Superpowers | "build/create" 감지 시 자동 활성 |
| Superpowers "Writing Plans" | `writing-plans` 스킬 | Superpowers | 2–5분 단위 마이크로태스크로 분해 |
| Superpowers "Review & Edit" | 공식 스킬명 아님 | — | **gstack의 `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`** 또는 `/autoplan`(삼중 일괄)로 대체 |
| "작업 공간 나누기" | `using-git-worktrees` 스킬 | Superpowers | 설계 승인 후 자동으로 worktree 생성 |
| "팀처럼 나눠서" | `subagent-driven-development` | Superpowers | 태스크별 새 서브에이전트, 2단계 리뷰 |
| "자동 기록" | `/checkpoint` (gstack) + finishing-a-development-branch (SP) | 둘 다 | progress.md 갱신에 사용 |

> 영상의 "Review & Edit로 이중 검증"은 gstack의 `/autoplan`(CEO → Design → Eng 자동 삼중 리뷰) 한 방에 대응한다. 여기에 **환경영향평가 도메인 리뷰**를 하나 더 추가해 4중 리뷰로 간다.

## 3.2 플러그인 설치

```bash
# 0) 작업 디렉터리
cd /c/work/eia-workbench

# 1) Claude Code 켜기
claude

# --- 아래부터는 Claude Code 안에서 실행 ---

# 2) Superpowers 설치 (공식 플러그인 마켓플레이스)
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace

# 3) gstack 설치 — https://github.com/garrytan/gstack 의 README 최상단
#    "Open Claude Code and paste this" 블록을 그대로 복사해 붙여넣기.
#    한 번만 하면 ~/.claude/skills/gstack/ 아래 설치되고, 이후 슬래시 명령으로 호출.

# 4) 정상 설치 확인
/using-superpowers
/office-hours     # 또는 `/office-hours --help`
```

설치 후 Claude Code 재시작. 이후 세션부터 plugin 스킬이 자동 활성된다.

## 3.3 전체 워크플로 — 10단계

한 기능당 이 10단계를 끝까지 돈다. "프롬프트"는 §3.5 해당 번호 파일을 그대로 붙여넣는다.

| # | 단계 | 트리거 | 플러그인 | 산출물 | 프롬프트 |
|---|---|---|---|---|---|
| 0 | 세션 부트 | 매 세션 첫 줄 | — | `progress.md` 확인 | §3.5-0 |
| 1 | 기능 상담 | `/office-hours` | gstack | `docs/design/<feature>.md` | §3.5-1 |
| 2 | 요구사항 정교화 | (자동) | SP brainstorming | 설계 스펙 초안 | §3.5-2 |
| 3 | 구현 계획서 | `writing-plans` 실행 | SP | `plans/<feature>.md` (태스크 리스트) | §3.5-3 |
| 4 | 계획 삼중+1 리뷰 | `/autoplan` → 도메인 리뷰 | gstack + 수동 | 리뷰 통과된 plan | §3.5-4 |
| 5 | 작업 공간 | (자동) | SP worktrees | `../eia-workbench-<feature>/` | §3.5-5 |
| 6 | 구현 | `subagent-driven-development` | SP | 코드 + 테스트 | §3.5-6 |
| 7 | UI 점검 | `/design-review http://localhost:3000` | gstack | 수정된 UI | §3.5-7 |
| 8 | 코드 리뷰 | `/review` | gstack | 리뷰 코멘트 반영 | §3.5-8 |
| 9 | QA | `/qa http://localhost:3000` | gstack | 버그 수정 | §3.5-9 |
| 10 | 마감·기록 | `/ship` → `/checkpoint` | gstack | PR, 갱신된 `progress.md` | §3.5-10 |

> 1인 개발이니 같은 기능을 10–15개 병렬로 돌릴 이유는 없다. **한 기능을 이 사이클로 끝까지 민 다음 다음 기능**으로 넘어간다.

## 3.4 기능별 작업공간 분리안

| Worktree/Branch | 담당 기능 | 의존성 |
|---|---|---|
| `feature/project-shell` | 프로젝트 생성, 자료 업로드, 기본 레이아웃 | 없음 (가장 먼저) |
| `feature/design-system` | UI 공통 컴포넌트 | project-shell |
| `feature/scoping-assistant` | 입지·스코핑 보조 | design-system |
| `feature/draft-checker` | 평가서 초안 점검 | design-system |
| `feature/opinion-response` | 주민·기관 의견 대응표 | design-system |
| `feature/prompt-generator` | Claude Max 수동 분석 프롬프트 생성 | scoping / draft / opinion 중 하나 이상 |
| `feature/deploy-free` | 무료 배포 (Cloudflare Pages) | 전 기능 완료 후 |

## 3.5 단계별 프롬프트 팩

각 프롬프트를 아래 경로로 저장한다. Claude Code 세션에서는 경로 참조만 해도 읽어준다.

```bash
mkdir -p prompts/gs_sp
```

### §3.5-0 · 세션 부트 (`prompts/gs_sp/00_session_boot.md`)

매 세션 첫 줄에 이 파일 경로를 참조하거나, 내용을 그대로 붙인다.

```text
너는 eia-workbench(환경영향평가 작성·검수 워크스페이스)의 수석 파트너다.
지금 내 저장소에는 gstack과 Superpowers 플러그인이 설치돼 있다.

세션 시작 전 의무 작업:
1. CLAUDE.md 전체를 읽어라. 특히 §9 "gstack + Superpowers 운용 규칙".
2. progress.md 를 읽고 오늘 이어서 할 작업을 1줄 요약하라.
3. 현재 git branch, 미커밋 변경, 현재 worktree 목록을 확인하라 (git status / git worktree list).
4. 마지막으로 docs/changelog/session_log.md 의 최상단 3개 항목만 훑어라.

출력 형식:
- "오늘 상태": 3줄 이하
- "이어서 할 작업 후보": 1~3개, 각 한 줄
- "내가 먼저 확인해야 할 것": 질문 2~5개

절대 이번 턴에 코드/파일을 수정하지 마라. 슬래시 명령도 실행하지 마라.
내가 다음 턴에 명령할 때까지 대기.
```

### §3.5-1 · 기능 상담 (`prompts/gs_sp/10_office_hours.md`)

```text
/office-hours 를 실행하기 전에, 이번 세션의 대상 기능을 고정한다.

대상 기능: {feature_name}
예: feature/project-shell | feature/scoping-assistant | feature/draft-checker
   | feature/opinion-response | feature/prompt-generator | feature/design-system

이제 /office-hours 를 실행하라. 실행 시 아래 프로젝트 제약을 먼저 Claude 컨텍스트로 주입하라:

- 사용자: 환경영향평가사/평가대행사 실무자. B2B.
- 무료 우선: 운영 서버에서 유료 LLM API 호출 금지.
- 법적 결론·승인 가능성 단정·현지조사 대체 주장 금지. UI·문서·테스트 assertion 모두 포함.
- EIASS 원문 재호스팅 금지. 공식 deep link + 사용자 업로드 문서만.
- Windows + Git Bash + VSCode + Claude Max.
- 스택 후보: TypeScript, Node 18+, Cloudflare Pages/Workers/D1/R2. (미확정은 질문으로 꺼낼 것)
- 대상 업종 1개 고정 (미정이면 첫 질문으로 물을 것): 육상풍력 / 태양광 / 도시개발 / 산업단지 중.

/office-hours 가 질문하는 동안 나는 성실히 답한다. 끝나면:
1. 설계문서를 docs/design/{feature_name}.md 로 저장.
2. 문서 말미에 "환경영향평가 도메인 위험 요약" 섹션을 반드시 추가 (위 제약 기준).
3. "다음 단계: /writing-plans" 안내 출력.
```

### §3.5-2 · Brainstorming 활용 (`prompts/gs_sp/20_brainstorming.md`)

```text
지금 Superpowers의 brainstorming 스킬이 활성되어 있을 것이다. 활성되지 않았다면:
"brainstorming 스킬로 {feature_name}의 요구사항을 정교화하자.
설계 문서는 docs/design/{feature_name}.md 에 있다." 라고 말해 활성화.

추가로, brainstorming 과정에서 반드시 다음 관점을 1번씩 질문에 섞어라:
1) 평가사 실무자의 "오늘 이걸로 몇 분을 아끼나?" 관점
2) 공공포털(EIASS) 복제가 되지 않게 차별화 포인트
3) 유료 API 없이 같은 가치를 낼 수 있는 대체 경로
4) UI에서 법적 단정 표현이 들어갈 위험 지점
5) 업로드 문서의 개인정보/민감정보 처리 경로

그리고 가능하면 이 단계에서 HTML 기반 목업(ASCII가 아니라 실제 렌더되는 구조)을 1–2개 제시하라.
출력은 docs/design/{feature_name}.md 의 "정교화 결과" 섹션에 덧붙인다.
코드는 아직 쓰지 않는다.
```

### §3.5-3 · Writing Plans (`prompts/gs_sp/30_writing_plans.md`)

```text
설계 문서 docs/design/{feature_name}.md 가 준비됐다.
이제 Superpowers의 writing-plans 스킬을 실행해 plans/{feature_name}.md 를 만들어라.

plan 형식 요구사항:
- 각 태스크는 2–5분짜리로 쪼갠다.
- 각 태스크에 다음을 반드시 포함:
  a) 정확한 파일 경로 (create/modify/delete 구분)
  b) 실패하는 테스트 파일 전체 코드 (RED)
  c) 최소 구현 코드 (GREEN)
  d) verification 커맨드 (예: `npm test -- path/to/test`)
  e) git commit 메시지 (Conventional Commits, 한국어 본문도 OK)

추가 요구 (eia-workbench 전용):
- LLM 응답을 다루는 태스크가 있다면, 반환 객체는 반드시
  `{result, basis, assumptions, limits, needsHumanReview:boolean}` 스키마.
  이 스키마의 타입 정의를 `src/lib/review.ts` 에 먼저 작성하는 태스크를 맨 앞에 넣어라.
- UI 문구를 생성하는 태스크에는 "법적 단정 표현 검출 테스트"를 함께 넣어라.
  예: 산출 문자열에 `/승인|통과|대상입니다/` 가 있으면 fail.
- 유료 API 키(`ANTHROPIC_API_KEY` 등)를 참조하는 코드가 들어가는 태스크는 아예 만들지 마라.
  만들었다면 plan에서 제거하라.

plan 완료 후:
- plans/{feature_name}.md 맨 위에 "Out of Scope" 섹션 10줄 이상. 이번에 절대 안 하는 것들.
- plan 끝에 "다음 단계: /autoplan" 안내.
```

### §3.5-4 · 삼중+1 리뷰 (`prompts/gs_sp/40_plan_review.md`)

```text
plans/{feature_name}.md 가 준비됐다. 지금부터 4중 리뷰를 실행한다.

Step 1. /autoplan 실행.
  - gstack 의 /plan-ceo-review → /plan-design-review → /plan-eng-review 가 자동 연결된다.
  - 각 리뷰의 Rating 점수와 핵심 지적을 plans/{feature_name}.md 의 "Reviews" 섹션에 추가한다.
  - 어느 하나라도 Rating 6/10 미만이면 plan을 수정한 뒤 다시 /autoplan.

Step 2. 환경영향평가 도메인 리뷰 (수동 4번째).
  CLAUDE.md §9.3 의 프롬프트를 그대로 실행하라. 5개 체크 항목 Pass/Fail 표를
  plans/{feature_name}.md 의 "Domain Review" 섹션에 저장.
  Fail 1개라도 있으면 plan 수정 → /autoplan 재실행.

Step 3. 최종 승인 게이트.
  - 나(사용자)에게 "4중 리뷰 통과. 구현 착수 승인?" 을 묻고 내 "go" 가 있을 때만 다음 단계로.
  - 승인 없이 구현에 들어가면 규칙 위반.

출력:
- /autoplan 결과 요약표 (리뷰어별 Rating, 주요 지적 3개)
- Domain Review 결과표
- 최종 판정: GO / NO-GO / 수정 후 재리뷰
```

### §3.5-5 · 워크트리 (`prompts/gs_sp/50_worktree.md`)

```text
plan이 승인됐다. 이제 Superpowers 의 using-git-worktrees 스킬이 자동으로 워크트리를 생성할 것이다.
그대로 두되, 아래를 확인하라.

확인 항목:
1. 워크트리 경로는 ../eia-workbench-{feature_name} 형식. 부모 디렉터리에 만들어지는 게 맞음.
2. 브랜치는 feature/{feature_name}. main이 아니어야 함.
3. 생성 직후 깨끗한 테스트 베이스라인을 확인했는지 (npm ci && npm test).
4. .env, data/samples/private/ 는 워크트리에도 gitignore/.claudeignore로 제외돼 있는지.

문제 없으면 현재 셸을 워크트리 디렉터리로 cd 하라.
문제가 있으면 내 승인 없이 진행하지 말고 질문하라.
```

### §3.5-6 · Sub-agent 구현 (`prompts/gs_sp/60_subagent_dev.md`)

```text
이제 plans/{feature_name}.md 의 태스크를 subagent-driven-development 로 실행한다.

구현 중 반드시 지킬 것:
1. 각 태스크마다 새 서브에이전트를 띄워라. 한 서브에이전트가 여러 태스크를 처리하지 않는다.
2. 서브에이전트가 plan 바깥 파일을 건드리면 그 변경은 폐기하고 재실행.
   (spec compliance 리뷰 단계에서 잡힐 것)
3. 모든 태스크에서 RED → GREEN → REFACTOR 순서.
   테스트가 먼저 실패하는 걸 내가 로그로 확인할 수 있어야 함.
4. 태스크 완료 시 verification-before-completion 스킬로 실제 실행 결과를 확인 후에만 다음 태스크로.
5. 한 태스크 완료마다 작은 commit. PR 전에 rebase/squash 하지 마라. 히스토리가 곧 리뷰 자료.

eia-workbench 도메인 가드 (구현 중 항상):
- 유료 API 호출 코드 금지. 서브에이전트가 시도하면 거절하고 "프롬프트 생성기" 대체안을 제시하라.
- UI 문구/테스트 assertion에 법적 단정 표현 금지.
- 파일 파싱이 필요하면 1차는 텍스트 붙여넣기 + PDF/DOCX만. HWP/HWPX는 TODO로 남기고 구현하지 마라.

막히면 systematic-debugging 스킬을 써라. 추측으로 고치지 말 것.

출력 (구현 종료 시):
- 완료 태스크 리스트 (plan과 대조)
- 변경 파일 목록 (create/modify/delete)
- 실행/테스트 커맨드
- 남은 리스크 3줄
```

### §3.5-7 · Design Review (`prompts/gs_sp/70_design_review.md`)

```text
이제 /design-review {local_url} 을 실행한다. 예: /design-review http://localhost:3000/projects/new

실행 전 조건:
1. 로컬 개발 서버가 켜져 있어야 함 (npm run dev).
2. CLAUDE.md §9.1~9.2 를 다시 읽어라. 특히 AI slop 기준.
3. DESIGN.md 가 이미 있으면 그에 맞춰 감사.
   없으면 이번 실행 전에 /design-consultation 을 먼저 돌려 DESIGN.md 를 만들라.

eia-workbench 전용 감사 추가 항목:
- 이모지 사용 0개 (한 개라도 있으면 High severity로 처리).
- 그라데이션, 3개 이상의 강조색, 네온, 글래스모피즘, 파스텔 배경 금지.
- 결과 카드에는 반드시 "근거 / 가정 / 한계 / 사람 검토 필요" 4필드가 UI에 보여야 함. 빠지면 High.
- "법적 단정 표현" 검색: 텍스트 노드에 "승인", "통과", "확정", "대상입니다" 가 있으면 High.
- 정보 밀도: 업무용 SaaS 기준. 카드 여백·폰트크기는 데스크톱 1280px 기준에서
  한 화면에 핵심 정보 3블록 이상 보여야 함.

자동 수정은 10건 이하로 제한. 그 이상이면 /design-review 를 --report-only 모드로 재실행하고,
수정은 내 승인 후 수동 적용.

출력: design-score, ai-slop-score, 적용된 수정 diff 요약.
```

### §3.5-8 · 코드 리뷰 (`prompts/gs_sp/80_review.md`)

```text
/review 를 실행한다. eia-workbench 전용 체크리스트를 함께 적용:

1. LLM 응답 객체에 {result, basis, assumptions, limits, needsHumanReview} 스키마 준수?
2. 유료 API 호출 코드 없음? (process.env 스캔에서 ANTHROPIC_API_KEY, OPENAI_API_KEY 등)
3. EIASS 원문을 DB/스토리지/픽스처에 저장하는 코드 없음?
4. 주민·기관 의견을 자동 축약·삭제하는 코드 없음?
5. 업로드 문서 저장 경로가 data/samples/private/ 또는 환경변수로 격리됨?
6. 에러 메시지/토스트/모달에 법적 단정 표현 없음?
7. 테스트가 하나라도 skip/only/todo 상태로 남지 않음?

각 항목 Pass/Fail + 근거 라인 표시.
Fail 1개라도 있으면 수정 diff 를 제시하고 내 승인 후 적용.
```

### §3.5-9 · QA (`prompts/gs_sp/90_qa.md`)

```text
/qa {local_url} 로 실제 브라우저 QA 를 실행한다.

eia-workbench 전용 시나리오 (모두 실행):
1. 정상 시나리오: 프로젝트 생성 → 기능 사용 → export 파일 다운로드.
2. 빈 입력: 모든 필수 필드를 빈 값으로 제출. 에러 메시지는 사용자 언어로, 단정적 톤이 아닌지.
3. 초과 입력: 아주 긴 의견/보고서 텍스트 (100,000자). 앱이 죽지 않고 합리적 메시지.
4. 민감 업로드: 데이터 예시 파일(/data/samples/public/sample_minimal.pdf)로 파싱 흐름.
   private 샘플은 쓰지 마라.
5. 권한/세션 (해당되면): 비로그인 상태 접근 차단.
6. export CSV/Markdown 파일을 열어
   {result, basis, assumptions, limits, needsHumanReview} 필드가 있는지 눈으로 확인.
7. Lighthouse/axe 기본 접근성 (대비, 포커스 링, 키보드 내비).

버그 발견 시 systematic-debugging 으로 근본 원인 찾고 수정. 패치 → 재 QA.

출력: 시나리오별 Pass/Fail, 수정 커밋 해시, 남은 known-issues.
```

### §3.5-10 · Ship & Checkpoint (`prompts/gs_sp/95_ship_checkpoint.md`)

```text
Step 1. /ship
- PR 생성까지만. 자동 배포 금지 (CLAUDE.md §9.5).
- PR 제목: `feat({feature_name}): <한 줄 요약>`
- PR 본문에 다음 링크/파일 포함:
  - docs/design/{feature_name}.md
  - plans/{feature_name}.md (Reviews, Domain Review 섹션 포함)
  - QA 결과 요약
  - 변경 파일 리스트
  - 알려진 제약 (무료 우선 유지 여부, 법적 단정 체크 통과 여부)

Step 2. finishing-a-development-branch (Superpowers)
- 옵션: merge locally / keep worktree / discard 중 선택을 내(사용자)에게 물을 것.
- main 에 merge한 경우, 워크트리 삭제는 내가 확인 후에만.

Step 3. /checkpoint
- progress.md 를 다음 템플릿으로 갱신:
  - 현재 목표
  - 완료 (오늘 것 포함)
  - 진행 중
  - 다음 작업
  - 이슈
  - 결정된 설계 (이번에 추가된 것만)
  - 검증 상태
  - 남은 리스크
- docs/changelog/session_log.md 최상단에 항목 1개 추가
  (오늘 날짜, 완료 요약, 다음 작업 한 줄).

Step 4. 세션 종료
- "다음 세션에 너에게 줄 첫 프롬프트"를 3줄 이내로 작성해 나에게 보여줘라.
  나는 이걸 복사해서 다음 세션 첫 줄에 쓴다.
```

## 3.6 첫 기능(`feature/project-shell`) 실제 녹취 예시

시작 전에 `main`에서:

```bash
cd /c/work/eia-workbench
git status
git pull --rebase
code .
# VSCode 터미널 (Git Bash) 에서
claude
```

**1턴 (세션 부트):**
> `prompts/gs_sp/00_session_boot.md 를 읽고 그 지시대로 수행해라.`

Claude: 오늘 상태 3줄 + 이어서 할 작업 후보 + 질문. 여기서 "feature/project-shell 착수"를 확정.

**2턴 (Office Hours):**
> `prompts/gs_sp/10_office_hours.md 의 내용을 수행해라. feature_name 은 feature/project-shell 이다. 업종은 일단 "육상풍력"으로 잠정 고정한다.`

Claude: `/office-hours` 실행 → 10~20분 질의응답 → `docs/design/feature-project-shell.md` 생성.

**3턴 (Brainstorming):**
> `prompts/gs_sp/20_brainstorming.md 의 내용을 수행해라.`

Claude: 자동으로 Superpowers brainstorming 이 활성되고, 도메인 질문 5종이 섞인 추가 질문. HTML 목업 1~2개 제시. 설계문서에 "정교화 결과" 섹션 추가.

**4턴 (Writing Plans):**
> `prompts/gs_sp/30_writing_plans.md 의 내용을 수행해라.`

Claude: `plans/feature-project-shell.md` 생성. 2–5분 단위 태스크 다수 + Out of Scope 섹션.

**5턴 (4중 리뷰):**
> `prompts/gs_sp/40_plan_review.md 의 내용을 수행해라.`

Claude: `/autoplan` 결과표 + 도메인 리뷰표. 내가 "go" 라고 답할 때까지 구현 안 함.

**6턴 (승인):**
> `go`

Claude: `using-git-worktrees` 가 자동으로 `../eia-workbench-feature-project-shell` 워크트리 생성 + 해당 디렉터리로 이동 + `npm ci && npm test` 실행.

**7턴 (구현):**
> `prompts/gs_sp/60_subagent_dev.md 의 내용을 수행해라. 태스크 1번부터 순서대로.`

Claude: 태스크별 서브에이전트로 RED → GREEN → REFACTOR → commit 반복. 막히면 systematic-debugging.

**8턴 (UI 점검):**
> `로컬 dev 서버 띄우고 prompts/gs_sp/70_design_review.md 를 수행해라.`

Claude: `npm run dev` → `/design-review http://localhost:3000` → AI slop 제거 수정 → diff 요약.

**9턴 (코드 리뷰):**
> `prompts/gs_sp/80_review.md 의 내용을 수행해라.`

**10턴 (QA):**
> `prompts/gs_sp/90_qa.md 의 내용을 수행해라.`

**11턴 (Ship + Checkpoint):**
> `prompts/gs_sp/95_ship_checkpoint.md 의 내용을 수행해라.`

Claude: PR 생성 → worktree 처리 선택 → `progress.md` & `session_log.md` 갱신 → 다음 세션 첫 프롬프트 3줄 제시.

그 3줄을 내가 어딘가에 복사해둔다. 다음 세션은 그걸로 시작한다.

## 3.7 세션 시작/종료 루틴

### 3.7.1 세션 시작 전 체크리스트

- [ ] 현재 브랜치 확인 (`git status`)
- [ ] 미커밋 변경사항 확인
- [ ] 오늘 작업할 기능 하나만 선택
- [ ] 관련 계획서 열기
- [ ] §3.5-0 세션 부트 프롬프트 주입
- [ ] Claude에게 바로 코딩 금지 지시

### 3.7.2 구현 전 체크리스트

- [ ] /office-hours 또는 기능 정의 프롬프트 실행
- [ ] writing-plans 로 계획서 작성
- [ ] /autoplan + 도메인 리뷰로 계획 검토
- [ ] 무료 운영 제약 확인
- [ ] 비범위 확정
- [ ] 테스트 기준 확정

### 3.7.3 구현 중 체크리스트

- [ ] 계획서 밖 기능 추가 금지
- [ ] 변경 파일 수시 확인
- [ ] 공통 컴포넌트 변경 시 영향 범위 확인
- [ ] UI 문구의 법적 단정 표현 제거
- [ ] export/저장 기능 우선 검증

### 3.7.4 구현 후 체크리스트

- [ ] 빌드 실행
- [ ] 수동 테스트
- [ ] /design-review → /review → /qa 순 실행
- [ ] /ship 로 PR 생성 (자동 배포 금지)
- [ ] /checkpoint 로 progress.md & session_log.md 갱신
- [ ] 다음 세션 첫 프롬프트 3줄 저장

### 3.7.5 저장 루틴 (하루 끝)

```bash
# 아직 main에 머지 안 했다면 워크트리에서 push
git push -u origin feature/project-shell

# main 워크트리로 돌아가 동기화
cd /c/work/eia-workbench
git fetch --all --prune
git status

# session_log.md / progress.md 가 main에 반영되지 않았다면 간단 커밋
git add progress.md docs/changelog/session_log.md
git commit -m "chore(log): session checkpoint $(date +%F)"
git push
```

## 3.8 트러블슈팅 & 현실 주의

- **설치 실패**: gstack은 Bun 필요, Superpowers는 Node 18+. Windows에서 순정 PowerShell로 Bun 설치가 더 편하면 그걸로 설치 후 Git Bash에서는 호출만 해도 된다.
- **스킬이 자동 활성 안 됨**: Claude Code를 완전히 재시작. `/using-superpowers` 로 Superpowers가 붙어 있는지 먼저 확인.
- **`/autoplan` 토큰이 많이 든다**: 실제로 꽤 소모한다. Claude Max 세션 한도 안에서 돈다면 괜찮지만, 기능당 한 번만 돌리고 그 결과를 plan 파일에 캐시한다. 같은 plan을 반복 리뷰 돌리지 말 것.
- **Superpowers가 유료 API 코드를 쓰려고 할 때**: 서브에이전트가 `Anthropic SDK` 호출 코드를 붙이려 시도할 수 있다. 프로젝트 규칙상 거절이다. §3.5-6 규칙이 이걸 막지만, 지나가는 경우를 대비해 `src/lib/review.ts`에 "Paid API is disabled in MVP" 런타임 가드를 처음부터 박아두면 좋다.
- **`/design-review` 가 수정하면 안 되는 파일을 건드릴 때**: `/design-review --report-only` 로 돌린 뒤 사람이 적용한다. 이 프로젝트에서는 기본값으로 이걸 쓰는 게 안전하다.
- **영상의 "자동 기록"을 너무 믿지 말 것**: Superpowers의 커밋은 태스크 단위로만 나온다. 세션 경계의 맥락은 `/checkpoint` + `progress.md` 가 책임진다. 둘 다 지켜야 다음 세션 복귀가 된다.
- **Max 플랜 토큰 소모**: 위 10단계를 한 기능에 끝까지 돌리면 Max 기준 한 세션의 상당 부분을 쓴다. 한 **Claude Max 창에서 한 기능**을 원칙으로. 여러 기능을 같은 창에서 돌리려 하지 말 것.

## 3.9 리스크와 방지 문구 (다시 강조)

| 리스크 | 잘못된 표현 | 권장 표현 |
|---|---|---|
| 법률판단 오해 | "이 사업은 환경영향평가 대상입니다" | "입력값 기준으로 대상 가능성이 있어 전문가 확인이 필요합니다" |
| 승인 가능성 단정 | "협의 통과 가능" | "보완 리스크를 낮추기 위한 체크 항목입니다" |
| 현지조사 대체 | "AI가 현황조사를 완료했습니다" | "문헌/입력자료 기준 검토이며 현지조사는 별도 필요합니다" |
| 공공자료 재사용 | "원문을 저장·제공합니다" | "공식 링크와 사용자가 제공한 자료를 기준으로 검토합니다" |
| AI 결과 과신 | "자동 작성 완료" | "초안 생성/검토 보조 결과이며 사람 검토가 필요합니다" |

---

# Part 4. 열린 결정 사항과 다음 액션

## 4.1 지금 당장의 확인 질문 (다음 턴에 답해줄 것)

1. **프로젝트명 확정**: `eia-workbench` 로 갈지, 목록에서 다른 걸 고를지.
2. **대상 업종 1개**: 육상풍력 / 태양광 / 도시개발 / 산업단지 중. Office Hours 질문 범위가 여기서 갈린다.
3. **프런트엔드 프레임워크**: Next.js / Astro / SvelteKit / Remix / 미정(Claude 추천). Cloudflare Pages 무료 배포 호환 기준.
4. **개발 OS**: Windows 11 + Git Bash / WSL2. 문서 파싱·셸 스크립트 난이도가 달라진다.
5. **DESIGN.md 생성 순서**: 지금 `/design-consultation` 을 돌려 `DESIGN.md` 를 먼저 만들지, 첫 기능 구현 후에 만들지. **먼저 만드는 쪽이 AI slop을 훨씬 덜 생성**하므로 권장.
6. **공개 샘플 문서**: `data/samples/public/` 에 넣을 샘플 1–3개가 있는지. 없으면 EIASS 공개 사례 중 하나를 직접 다운로드해 두어야 §3.5-9 QA가 의미가 있다.

## 4.2 다음 턴에서 바로 만들어줄 산출물

위 6개를 답하면 다음 턴에서:

- `docs/design/feature-project-shell.md` 초안
- `DESIGN.md` 초안 (§9.2 톤앤매너 규칙 반영)
- §3.5의 `prompts/gs_sp/` 파일들을 실제 파일 경로별로 한 번에 생성할 수 있는 `bash` 스크립트

까지 만들어 넘긴다.

## 4.3 10주 실행 로드맵 (전제 문서 요약)

| 기간 | 핵심 작업 | 산출물 |
|---|---|---|
| 1~2주 | 문제정의 재확정, 업종 1개 선정, 데이터/화면 IA 설계, 샘플 문서 3종 확보 | 기획 확정본, 와이어프레임, 데이터 스키마 |
| 3~4주 | 프로젝트 등록/목록, 입지 사전검토, 유사사례 검색, EIASS deep link 연결 | 클릭 가능한 데모 1차 |
| 5~6주 | PDF/DOCX 업로드, 보고서 구조 QA 규칙엔진, 결과 리포트 화면 | MVP 코어 완성 |
| 7~8주 | 의견 대응표 생성, R2 저장, CSV/DOCX 내보내기, Turnstile 적용 | 폐쇄형 파일럿 가능 |
| 9~10주 | 실사용자 테스트 2~3회, 규칙 보정, 품질 개선, 공개 데모/설명자료 | 파일럿 배포본 |

## 4.4 최종 운영 규칙 10가지 (잊지 말 것)

1. Claude에게 "바로 만들어줘"라고 하지 않는다.
2. 모든 기능은 Office Hours 또는 기능 정의서에서 시작한다.
3. 구현 전 계획서를 만들고, 4중 리뷰(`/autoplan` + 도메인 리뷰)를 거친다.
4. 기능별 worktree를 사용한다.
5. Claude가 만든 UI는 `/design-review` 를 거친다.
6. 법적 결론, 승인 가능성, 현지조사 대체 표현을 금지한다.
7. 운영 LLM API는 고객 검증 전까지 붙이지 않는다.
8. 사용자에게 제공되는 결과에는 `{result, basis, assumptions, limits, needsHumanReview}` 를 표시한다.
9. 세션마다 `progress.md` 와 `session_log.md` 를 갱신한다.
10. MVP는 "작게, 검수 가능하게, export 가능하게" 만든다.

---

## 부록 A. 한 눈에 보는 전체 흐름 (치트시트)

```
[매 세션 시작]
  cd /c/work/eia-workbench && git status && code .
  → VSCode 터미널(Git Bash) → claude
  → 프롬프트: "prompts/gs_sp/00_session_boot.md 수행"

[기능 하나의 사이클]
  1. 10_office_hours    → docs/design/<feat>.md
  2. 20_brainstorming   → 정교화 결과 섹션 추가
  3. 30_writing_plans   → plans/<feat>.md (RED/GREEN/verify)
  4. 40_plan_review     → /autoplan + 도메인 리뷰 (4중)
  5. 50_worktree        → ../eia-workbench-<feat>/ 자동 생성
  6. 60_subagent_dev    → 태스크별 서브에이전트 구현
  7. 70_design_review   → /design-review http://localhost:3000
  8. 80_review          → /review (도메인 체크리스트 포함)
  9. 90_qa              → /qa http://localhost:3000
  10. 95_ship_checkpoint → /ship(PR만) + /checkpoint

[매 세션 종료]
  - progress.md / docs/changelog/session_log.md 갱신
  - "다음 세션 첫 프롬프트 3줄" 저장
  - git push
```

## 부록 B. 파일 생성 스켈레톤 명령

첫 세팅 때 한 번에 실행할 수 있는 bash 스크립트 원안. Part 1 의 명령을 하나로 묶은 것.

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-eia-workbench}"
PARENT_DIR="${2:-/c/work}"

cd "$PARENT_DIR"
mkdir -p "$PROJECT_NAME" && cd "$PROJECT_NAME"

git init
git branch -M main

mkdir -p docs/plans docs/reviews docs/changelog docs/design
mkdir -p prompts/modules prompts/gs_sp
mkdir -p data/samples/public data/samples/private data/rules data/templates
mkdir -p scripts tests

touch README.md CLAUDE.md progress.md DESIGN.md
touch .gitignore .claudeignore .editorconfig
touch docs/00_project_brief.md
touch docs/changelog/session_log.md
touch prompts/00_project_context.md

echo "[ok] scaffold created at $(pwd)"
echo "[next] CLAUDE.md, progress.md, .gitignore, .claudeignore 내용을 이 매뉴얼에서 붙여넣으세요."
```

---

*문서 끝. 이 매뉴얼은 `docs/` 루트에 `eia-workbench-setup-manual.md` 로 보관하고, 규칙이 바뀌면 해당 섹션만 갱신할 것.*
