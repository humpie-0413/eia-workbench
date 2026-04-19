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
