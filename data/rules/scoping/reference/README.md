# Rule pack 법령 원문 레퍼런스

**목적:** `data/rules/scoping/*.yaml` 의 규칙 숫자를 작성·유지보수할 때 대조할 **법령 원문** 을 로컬에 둔다.

## 배치 규칙

1. **파일명 규칙**
   - `enforcement-decree-eia-YYYY-MM-DD-annex-NN.pdf` — 환경영향평가법 시행령 [별표 NN]
   - `enforcement-decree-forest-management-act-YYYY-MM-DD-annex-NN.pdf` — 산지관리법 시행령 [별표 NN]
   - `forest-management-act-enforcement-rules-YYYY-MM-DD-annex-NN.pdf` — 산지관리법 시행규칙 [별표 NN]
   - 날짜는 **법령 시행일자** (개정일자) 기준

2. **출처**
   - 법제처 국가법령정보센터 (law.go.kr) — **별표/별지 다운로드** 메뉴에서 PDF 수령
   - 사본 저장 시 다운로드한 **원본 바이너리** 그대로 (편집/변환 금지)

3. **재호스팅 금지 원칙** (CLAUDE.md §2-4)
   - 이 디렉터리의 PDF 들은 **로컬 레퍼런스** 전용.
   - 퍼블릭 URL·배포 번들·deploy artifact·Cloudflare R2 업로드 **모두 금지**.
   - 공식 링크는 별도 `citation_url` 필드로 YAML rule pack 에 남기고, 원문 자체는 이 폴더에 로컬로만 둠.

4. **git 추적 정책**
   - 초안 MVP 범위: PDF 파일은 **git 에 포함하지 않음** (용량, 저작권).
   - `.gitignore` 에 `data/rules/scoping/reference/*.pdf` 포함.
   - 대신 본 README.md 에 "어떤 PDF 가 필요하고 어디서 받는지" 만 커밋.

## 현재 배치된 PDF (2026-04-23 T1 재감사 시점)

- [x] `enforcement-decree-eia-2025-02-18-annex-03.pdf`
  - 환경영향평가법 시행령 [별표 3] — 환경영향평가 대상사업의 구체적인 종류, 범위 및 협의 요청시기
  - 내용 개정일 표기: `<개정 2025. 9. 23.>`
  - 출처: https://law.go.kr/flDownload.do?flSeq=34819077
- [x] `enforcement-decree-eia-2025-10-01-annex-04.pdf`
  - 환경영향평가법 시행령 [별표 4] — 소규모 환경영향평가 대상사업의 종류, 범위 및 협의 요청시기
  - 내용 개정일 표기: `<개정 2025. 10. 1.>`
  - 출처: https://www.law.go.kr/LSW/flDownload.do?flSeq=41077151
- [x] `enforcement-decree-forest-management-act-2023-06-07-annex-04.pdf`
  - 산지관리법 시행령 [별표 4] — 산지전용허가기준의 적용범위와 사업별·규모별 세부기준 (제20조제6항 관련)
  - 내용 개정일 표기: `<개정 2023. 6. 7.>`
  - 출처: https://www.law.go.kr/ → 산지관리법 시행령 → 별표 4

## 누락 상태 (향후 수령 대상)

- [ ] `forest-management-act-enforcement-rules-YYYY-MM-DD-annex-04.pdf`
  - 산지관리법 **시행규칙** [별표 4] — 산지전용허가기준 적용 세부기준 (**시행령** 과 구별)
  - 시행령 별표 4 의 "660㎡ 이상 풍력발전시설은 산지전용타당성조사 대상" 조항과 연관된 시행규칙의 세부 기준이 있는지 확인 대상
  - T1 재감사 시점에는 **시행령 별표 4 만으로 rule pack v2 작성 가능** 판단. 시행규칙 별표 4 는 후속 세부화 단계에서 수령

## 파일명 정정 이력

- 2026-04-23: 최초 수령된 3개 PDF 중 2개 파일명·내용 swap 발견 → 내용 기준 재명명 (아래 두 파일)
  - 구 `enforcement-decree-eia-2025-02-18-annex-04.pdf.pdf` (실제 내용=산지관리법 시행령 별표4) → 신 `enforcement-decree-forest-management-act-2023-06-07-annex-04.pdf.pdf`
  - 구 `forest-management-act-enforcement-rules-YYYY-MM-DD-annex-04.pdf.pdf` (실제 내용=환경영향평가법 시행령 별표4) → 신 `enforcement-decree-eia-2025-10-01-annex-04.pdf.pdf`
- 확장자 `.pdf.pdf` 이중 확장자는 원본 저장 상태 유지 (재편집 금지 원칙)

## 갱신 주기

- **최소 분기 1회** 법제처에서 최신 개정본 확인
- 개정 발견 시 새 파일(새 날짜 suffix) 로 추가하고, 기존 YAML rule pack 의 `rule_pack_version` 을 bump
