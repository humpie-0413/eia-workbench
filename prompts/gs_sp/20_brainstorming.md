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
