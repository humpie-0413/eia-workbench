# 00. Project Brief (초안)

> `/office-hours` 첫 실행 후 이 파일을 확정한다.

## 한 줄 정의
환경영향평가사·평가대행사를 위한 보고서 작성·검수·의견 대응 워크스페이스 (B2B SaaS MVP).

## 대상 사용자
- 환경영향평가사 (평가대행사 소속·독립)
- 평가대행사 내부 검토자

## MVP 범위 (잠정)
- 프로젝트 생성·자료 업로드 (PDF/DOCX/텍스트)
- 입지 사전검토 체크 보조 (규칙 기반)
- 평가서 초안 구조 점검
- 주민·기관 의견 대응표 생성 보조
- Claude 수동 분석용 프롬프트 생성기
- CSV/Markdown export

## 명시적 비범위
- EIASS 원문 재호스팅·대량 수집
- 법적 결론/승인 가능성 단정
- 운영 서버의 유료 LLM API 상시 호출
- 현지조사 대체

## 주요 제약
- 무료 우선 (Cloudflare Pages/Workers/D1/R2/Turnstile 구간)
- Windows + Git Bash + VSCode + Claude Max
- 대상 업종 1개 (Office Hours 에서 확정)
