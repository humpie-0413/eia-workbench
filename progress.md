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
