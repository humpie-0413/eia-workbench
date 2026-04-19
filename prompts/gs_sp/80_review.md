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
