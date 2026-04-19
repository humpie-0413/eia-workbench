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
