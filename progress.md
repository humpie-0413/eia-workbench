# progress.md

## 현재 목표
`feature/project-shell` 설계 확정 완료 → `writing-plans`로 `docs/plans/feature-project-shell.md` 작성.

## 완료
- 저장소 초기화 (`git init`, main 브랜치).
- 기본 폴더·파일 25종 생성 + 첫 커밋 `d9529f6`.
- `CLAUDE.md` v0 작성 (§9 gstack+SP 운용 규칙 포함).
- `.gitignore` / `.claudeignore` / `.editorconfig` / `.vscode/{settings,extensions}.json` 설정.
- `progress.md` 초기 버전, `README.md`.
- 프롬프트 팩 11종 (`prompts/gs_sp/00_session_boot.md` ~ `95_ship_checkpoint.md`).
- `prompts/00_project_context.md` — 세션 앞머리 컨텍스트 1장.
- `scripts/bootstrap.sh` — 스캐폴드 재생성용.
- **결정 반영**:
  - 프로젝트명: `eia-workbench` 확정.
  - 대상 업종: **육상풍력** 1개.
  - 프런트엔드: **Astro 5 + React islands + TS strict** (`docs/design/adr-0001-frontend-framework.md`).
  - 개발 환경: Windows + Git Bash + VSCode + Claude Max.
- `DESIGN.md` v0 초안 (색/타이포/간격/접근성/컴포넌트/법적단정 검출 가드).
- `docs/design/feature-project-shell.md` 사전 초안 (Office Hours 전 베이스).
- `data/samples/public/README.md` — 3개 공개 샘플 조달 가이드.
- `data/samples/private/README.md`, `data/rules/README.md`, `data/templates/README.md`.
- Claude Code CLI + gstack + Superpowers 설치·확인.

## 진행 중
- `writing-plans` 스킬 대기. 입력: 확정된 `docs/design/feature-project-shell.md` v1.

## 최근 완료 (2026-04-20)
- `feature/project-shell` Office Hours Q&A 6세트 + 보안 리뷰 12건 완료.
- `docs/design/feature-project-shell.md` v1 확정 (§10 보안 설계, §11 도메인 위험 갱신).
- 주요 결정:
  - auth v0: 싱글 패스워드 + Turnstile, `owner_id` 예약
  - 업로드: Worker proxy, 30MB/파일, 300MB/프로젝트, 30파일/프로젝트
  - 입지: KOSTAT 시/도·시/군/구 코드 드롭다운 + 라벨 캐시
  - HWP/HWPX: v0는 차단·안내. rhwp `@rhwp/core`는 v0.5 `feature/hwp-ingest` + `ADR-0002`로 분리
  - 테스트: Vitest + Playwright 3 시나리오 + axe lint, ~25 테스트
  - 비활성 탭: `aria-disabled` + tooltip
  - 소프트삭제: 최근 30일 드로어 + Cron 하드삭제
  - 중복: `(project_id, sha256)` UNIQUE
  - 보안 12건: 브루트포스 방어, magic bytes 검증, CSRF Origin, CSP, 로깅 PII 제외, Cron 안전가드 등 모두 설계 반영.

## 다음 작업
1. `writing-plans`로 `docs/plans/feature-project-shell.md` 작성 (2–5분 단위 태스크, 확정 설계 §3–§10 커버).
2. `/autoplan` → 도메인 리뷰 (4중 리뷰, `prompts/gs_sp/40_plan_review.md`).
3. 승인 시 워크트리 `../eia-workbench-feature-project-shell` 생성 → 구현.
4. 착수 전 공개 샘플 3개 (`data/samples/public/`) 조달.
5. `/design-consultation` 1회 돌려 `DESIGN.md` v1 확정(구현 시작 전).
6. project-shell 마감 직후: `docs/design/adr-0002-hwp-support.md` + `docs/plans/feature-hwp-ingest.md` (v0.5).

## 이슈/막힌 점
- 없음. (공개 샘플 PDF/DOCX 3종 조달이 QA 단계 선행 조건)

## 결정된 설계
- 운영 LLM 은 MVP 에서 "프롬프트 생성기 + 사용자 수동 Claude 실행" 전용.
- 셸 Git Bash/WSL2 고정. PowerShell 전용 스크립트 금지.
- 기능별 브랜치·워크트리: `feature/<name>`.
- 프런트엔드: Astro 5 + React islands (ADR-0001).
- 대상 업종: 육상풍력. v2 에서 다른 업종 추가 검토.
- UI 라이브러리 통째 도입 금지. shadcn/ui 방식 복붙 + Lucide 아이콘만.
- v0 운용 원칙: **"1 배포 = 1 조직"** (멀티테넌트는 v1).
- HWP 지원: v0.5로 분리 (ADR-0002).

## 검증 상태
- 빌드/테스트 체인 아직 없음 (첫 기능 구현 착수 시 `npm init` + Astro 스캐폴딩).
- git 1차 커밋 확인 OK.

## 남은 리스크
- **저작권**: EIASS 비-KOGL 자료 취급 경계 유지. 업로드 UI 문구에 "사용자 책임·공공원문 재배포 금지" 고정 표시 필요.
- **범위 팽창**: 기능 욕심 생기면 `docs/plans/` 새 계획서부터.
- **Astro + CF 어댑터**: D1/R2 바인딩 호환 테스트는 첫 plan 에 편입. 치명적 이슈 시 ADR-0001 파기 조건.
- **토큰 소모**: `/autoplan` 은 기능당 1회, 결과는 plan 에 캐시.
