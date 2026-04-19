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
