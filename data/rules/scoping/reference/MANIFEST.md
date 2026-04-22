# Rule pack 레퍼런스 파일 목록

**Status:** 초기 상태 — 사용자가 PDF 수동 다운로드 필요 (T1 재감사 선결 조건)

| # | 파일 (예정) | 상태 | 용도 |
|---|---|---|---|
| 1 | `enforcement-decree-eia-2025-02-18-annex-03.pdf` | ⬜ 미확보 | rule 1 (EIA 대상사업 — 100 MW·30만 ㎡ 기준 확정용) |
| 2 | `enforcement-decree-eia-2025-02-18-annex-04.pdf` | ⬜ 미확보 | rule 2/3 (소규모 EIA — 용도지역별 면적 기준 확정용) |
| 3 | `forest-management-act-enforcement-rules-YYYY-MM-DD-annex-04.pdf` | ⬜ 미확보 | rule 4 (산지전용 660㎡ 기준 확정용) |

## 수령 절차

1. 법제처 국가법령정보센터 접속 (https://law.go.kr)
2. 시행령 검색 → "별표/별지" 탭 → 별표3, 별표4 각각 PDF 다운로드
3. 위 파일명 규칙으로 리네임 후 `data/rules/scoping/reference/` 에 배치
4. 본 MANIFEST 에서 상태를 ✅ 로 갱신 (단 파일 자체는 git 추적 제외)

## 재감사 트리거

3 개 파일 모두 ✅ 되면 T1 재감사 (Claude) 를 지시할 수 있음.
