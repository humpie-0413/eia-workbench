# Rule pack 법령 원문 레퍼런스

**목적:** `data/rules/scoping/*.yaml` 의 규칙 숫자를 작성·유지보수할 때 대조할 **법령 원문** 을 로컬에 둔다.

## 배치 규칙

1. **파일명 규칙**
   - `enforcement-decree-eia-2025-02-18-annex-03.pdf` — 환경영향평가법 시행령 별표3 (환경영향평가 대상사업)
   - `enforcement-decree-eia-2025-02-18-annex-04.pdf` — 환경영향평가법 시행령 별표4 (소규모 환경영향평가)
   - `forest-management-act-enforcement-decree-YYYY-MM-DD-annex-XX.pdf` — 산지관리법 시행령 / 시행규칙
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
   - `.gitignore` 에 `data/rules/scoping/reference/*.pdf` 추가.
   - 대신 `data/rules/scoping/reference/MANIFEST.md` 에 "어떤 PDF 가 필요하고 어디서 받는지" 만 커밋.

## 현재 필요 PDF (T1 재감사 전)

- [ ] `enforcement-decree-eia-2025-02-18-annex-03.pdf`
  - 출처: https://law.go.kr/flDownload.do?flSeq=34819077 (2026-04-22 기준 링크, 갱신 가능)
- [ ] `enforcement-decree-eia-2025-02-18-annex-04.pdf`
  - 출처: https://www.law.go.kr/LSW/flDownload.do?flSeq=41077151
- [ ] `forest-management-act-enforcement-rules-YYYY-MM-DD-annex-04.pdf`
  - 산지관리법 시행규칙 별표4 (허가기준 적용범위)

## 갱신 주기

- **최소 분기 1회** 법제처에서 최신 개정본 확인
- 개정 발견 시 새 파일(새 날짜 suffix) 로 추가하고, 기존 YAML rule pack 의 `rule_pack_version` 을 bump
