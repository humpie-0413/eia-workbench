# feature/project-shell — 설계문서 (초안)

> 이 문서는 `/office-hours` 가 실제로 돌리기 전의 **사전 초안**이다.
> 세션에서 `/office-hours` 를 실행해 질문·답을 채우며 정교화한다.
> 완료 시 말미 "환경영향평가 도메인 위험 요약" 섹션이 확정되어 있어야 다음 단계(`writing-plans`)로 간다.

## 1. 목적

eia-workbench 첫 기능. 다음을 제공한다:

1. **프로젝트 생성**: 평가사가 "새 프로젝트" (= 하나의 환경영향평가 대상사업) 를 만든다.
2. **자료 업로드**: PDF / DOCX / 텍스트 붙여넣기를 한 프로젝트에 귀속.
3. **기본 레이아웃**: 좌측 네비 (프로젝트 목록) + 상단 메타 + 중앙 워크스페이스.
4. **프로젝트 목록**: 전환/검색/삭제(소프트).

이 기능 완료 시점에서 사용자는:
- 프로젝트를 만들고 → 자료를 넣고 → 다음 기능(스코핑·초안점검 등)으로 들어갈 준비가 된 상태.

## 2. 대상 사용자·업종

- 사용자: 환경영향평가사 (평가대행사 내부)
- 대상 업종: **육상풍력 (Onshore Wind)** 한 개만.
  다른 업종은 v2 에서 확장.
- 조직 관리(팀/권한) 없음. 단일 사용자 로컬 작업이 기본. 파일럿 이후에 팀 도입.

## 3. 핵심 사용자 여정 (A→E)

| 단계 | 사용자 행동 | 결과 | 관련 파일/엔드포인트 |
|---|---|---|---|
| A | `/` 접근 | 프로젝트 목록 페이지 | `src/pages/index.astro` |
| B | "새 프로젝트" 클릭 → 폼 작성 | `POST /api/projects` → D1 insert → detail 이동 | `src/pages/api/projects.ts` |
| C | 상세 페이지에서 파일 업로드 | R2 업로드 + D1 metadata 기록 | `src/pages/api/projects/[id]/uploads.ts` |
| D | 업로드 목록 확인/삭제 | D1 soft-delete + R2 tombstone | 같음 |
| E | "다음: 스코핑" 버튼 | 다음 기능으로 라우팅 (v2 연결) | placeholder |

## 4. 데이터 모델 (초안)

```sql
-- D1
CREATE TABLE projects (
  id TEXT PRIMARY KEY,              -- nanoid
  name TEXT NOT NULL,
  industry TEXT NOT NULL CHECK(industry IN ('onshore_wind')),
  site_region TEXT,                 -- 시·도 (선택)
  site_sub_region TEXT,             -- 시·군·구 (선택)
  capacity_mw REAL,                 -- 풍력 용량 (선택)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  r2_key TEXT NOT NULL,             -- R2 object key
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,               -- 'application/pdf' | '...docx' | 'text/plain'
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
```

허용 MIME: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain` 만.
HWP/HWPX 는 v2.

## 5. 화면 구조

### 5.1 프로젝트 목록 (`/`)
- 좌측 네비는 v0 에서 단순화 (로고 + "새 프로젝트" 버튼만).
- 본문: 검색바 + 프로젝트 카드 리스트 (업종·지역·최근업로드 시각 표시).

### 5.2 프로젝트 상세 (`/projects/[id]`)
- 상단: 이름·업종 배지·지역·생성일.
- 중앙: 탭 (`자료` / `스코핑` / `초안점검` / `의견대응` — v0 에선 "자료"만 활성).
- 자료 탭:
  - 업로드 드롭존 (최대 50MB/파일, 확장자 검증).
  - 파일 리스트 (이름·크기·업로드시각·삭제 버튼).
  - 경고 영역: "업로드 문서는 귀하의 자료입니다. EIASS 원문 재호스팅 금지."

### 5.3 새 프로젝트 모달
- 필드: 이름(필수), 업종(육상풍력 고정), 시·도(optional), 시·군·구(optional), 용량 MW(optional).
- 검증: 이름 빈 값 차단, 업종은 단일 옵션만 표시.

## 6. 기술 선택

- Astro 5 + React islands + TypeScript strict
- 서버 엔드포인트: Astro endpoint (`src/pages/api/*.ts`) → Cloudflare Workers 에서 실행
- DB: D1 (SQLite) 로컬은 `@miniflare` 로 개발
- 스토리지: R2 (pre-signed URL 은 v2, 초기엔 Worker 경유 업로드)
- 폼 검증: Zod
- 테스트: Vitest + Playwright (e2e)

## 7. Out of Scope (v0 에서 절대 안 할 것)

- 팀/권한/조직 관리
- 이메일 초대
- 공개 공유 링크
- HWP/HWPX 파싱
- 업로드 문서의 자동 OCR/본문 파싱 (이건 feature/draft-checker 에서)
- 다른 업종 (태양광·도시개발·산업단지)
- 실시간 공동편집
- AI 프롬프트 호출 (v0 은 순수 CRUD + 업로드)

## 8. 비-목표 정교화 가드

- "프로젝트 템플릿 라이브러리" 같은 확장은 v2 의 scoping/draft-checker 가 들어오면서 자연스럽게 생긴다. 이 시점에 선도입 금지.
- "프로젝트 공유"는 사용자 검증(파일럿 1명 이상 3프로젝트 완료) 전까지 만들지 않는다.

## 9. 성공 지표 (v0 출시 기준)

- 평가사 1명이 15분 이내에 프로젝트를 만들고 PDF 2개를 업로드·삭제할 수 있다.
- 화면 어디에도 이모지·그라데이션·법적 단정 표현이 없다 (`/design-review` 통과).
- `/review` 체크리스트 전 항목 Pass.
- `/qa` 모든 시나리오 Pass.

## 10. 환경영향평가 도메인 위험 요약

| 위험 | 본 기능에서 발생 가능성 | 방지책 |
|---|---|---|
| ① 법적 결론 단정 | 낮음. UI 카피에서만 가능 | DESIGN.md §7 정규식 검출 테스트 포함 |
| ② 현지조사 대체 주장 | 낮음. 업로드 안내 문구에만 가능 | "업로드는 자료 보관용이며 현지조사 대체 아님" 고정 문구 |
| ③ EIASS 원문 재호스팅 | **중간**. 사용자가 공공자료를 올리면 R2 에 저장됨 | 업로드 약관에 "사용자 책임", 공개 샘플은 `data/samples/public/` 만 저장소에 포함, private 은 gitignore |
| ④ 주민·기관 의견 축약 | 해당 없음 (이 기능엔 의견 없음) | — |
| ⑤ `{result, basis, assumptions, limits, needsHumanReview}` 스키마 미사용 | 낮음. 이 기능은 순수 CRUD | 다음 기능에서 본격 적용 |

## 11. 다음 단계

1. `prompts/gs_sp/10_office_hours.md` 를 따라 `/office-hours` 실행 → 본 문서 Q&A 보강.
2. 끝나면 "정교화 결과" 섹션 추가 (`prompts/gs_sp/20_brainstorming.md`).
3. `writing-plans` → `plans/feature-project-shell.md` 생성.
