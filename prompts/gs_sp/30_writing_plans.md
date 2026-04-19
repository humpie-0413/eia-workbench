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
