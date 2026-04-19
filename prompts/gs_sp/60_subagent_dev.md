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
