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
