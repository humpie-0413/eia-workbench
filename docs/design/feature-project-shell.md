# feature/project-shell — 설계문서 (확정본 v1)

> `/office-hours` Q&A 6세트 + 보안 리뷰(12건) 반영 완료.
> 다음 단계는 `writing-plans`로 `docs/plans/feature-project-shell.md` 작성.

## 1. 목적

eia-workbench 첫 기능. 평가사가 **환경영향평가 대상사업** 하나를 프로젝트로 생성하고, 관련 자료(PDF/DOCX/TXT)를 업로드·관리할 수 있는 **작업 쉘**. LLM 분석·규칙 엔진·초안 검수는 본 기능에 포함하지 않음(후속 기능에서 `자료` 탭의 파일을 소비함).

이 기능 완료 시점에서 사용자는:

- 프로젝트를 만들고 → 자료를 넣고 → 다음 기능(스코핑·초안점검 등)으로 들어갈 준비가 된 상태.

## 2. 대상 사용자·업종

- 사용자: 환경영향평가사 (평가대행사 내부). B2B.
- 대상 업종: **육상풍력 (onshore_wind)** 1개. 다른 업종은 v2.
- 조직 관리·팀·권한 없음. v0는 **"1 배포 = 1 조직"** 운용 원칙(§10 H1 참조). 멀티 유저·매직링크는 v1.

## 3. 핵심 사용자 여정

| 단계 | 행동                                       | 결과                                                                | 라우트/엔드포인트                                                             |
| ---- | ------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 0    | `/login` 접근                              | Turnstile + 패스워드 → 세션 쿠키                                    | `GET /login` (폼), `POST /login` (제출)                                       |
| A    | `/` 접근                                   | 프로젝트 목록 (경고 배너 고정)                                      | `src/pages/index.astro`                                                       |
| B    | "새 프로젝트" 모달 작성 · 제출             | `POST /api/projects` → D1 insert → 프론트가 `/projects/[id]`로 이동 | `src/pages/api/projects.ts`                                                   |
| C    | 상세에서 파일 업로드                       | Worker에서 SHA-256·magic bytes 검증 → R2 put → D1 insert            | `src/pages/api/projects/[id]/uploads.ts`                                      |
| D    | 업로드 목록 확인/삭제                      | D1 soft-delete(R2는 30일 후 Cron이 하드삭제)                        | 같음                                                                          |
| E    | 프로젝트·파일 "최근 삭제" 드로어에서 복구  | `PATCH /api/.../restore` → `deleted_at=NULL`                        | `src/pages/api/projects/[id]/restore.ts`, `.../uploads/[uploadId]/restore.ts` |
| F    | 비활성 탭(`스코핑/초안점검/의견대응`) 클릭 | `aria-disabled` tooltip: "v0 범위 밖, 로드맵 안내"                  | 클라이언트 상호작용만                                                         |
| G    | 로그아웃                                   | 세션 쿠키 폐기                                                      | `POST /logout`                                                                |

## 4. 데이터 모델

```sql
-- D1

CREATE TABLE projects (
  id                    TEXT PRIMARY KEY,           -- nanoid(12)
  owner_id              TEXT,                       -- v0 NULL, v1에서 사용자별 분리용 예약
  name                  TEXT NOT NULL,              -- ≤200자
  industry              TEXT NOT NULL CHECK(industry IN ('onshore_wind')),
  site_region_code      TEXT,                       -- KOSTAT 시/도 코드 (예: '42')
  site_region           TEXT,                       -- 라벨 캐시 (예: '강원특별자치도')
  site_sub_region_code  TEXT,                       -- KOSTAT 시/군/구 코드 (예: '42750')
  site_sub_region       TEXT,                       -- 라벨 캐시 (예: '평창군')
  capacity_mw           REAL,                       -- [0, 10000]
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at            TEXT
);

CREATE TABLE uploads (
  id              TEXT PRIMARY KEY,                  -- nanoid(12)
  project_id      TEXT NOT NULL REFERENCES projects(id),
  r2_key          TEXT NOT NULL,                     -- 'projects/<projectId>/<nanoid>' (원본명 포함 금지)
  sha256          TEXT NOT NULL,                     -- 64-hex
  original_name   TEXT NOT NULL,                     -- 메타로만 저장, 키에 사용 금지
  mime            TEXT NOT NULL,                     -- 'application/pdf' | '...docx' | 'text/plain'
  size_bytes      INTEGER NOT NULL,                  -- ≤ 30*1024*1024
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);

CREATE UNIQUE INDEX uploads_project_sha_alive
  ON uploads(project_id, sha256) WHERE deleted_at IS NULL;

-- 브루트포스 방어
CREATE TABLE login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT NOT NULL,
  ts         TEXT NOT NULL DEFAULT (datetime('now')),
  ok         INTEGER NOT NULL                         -- 0/1
);
CREATE INDEX login_attempts_ip_ts ON login_attempts(ip, ts);
```

허용 MIME (Content-Type + 확장자 + magic bytes 3중 일치 필수):

- `application/pdf` — 헤더 `%PDF`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` — ZIP 매직 `PK\x03\x04` + `[Content_Types].xml` 존재
- `text/plain` — UTF-8 유효성 검사

HWP/HWPX는 **v0.5 feature/hwp-ingest로 분리** (§7, ADR-0002 예정).

## 5. 화면 구조

### 5.1 로그인 (`/login`)

- 입력: 패스워드 1개 + Turnstile 챌린지.
- 실패 시 응답 지연 ≥300ms, 5회/10분/IP 차단(토스트: "잠시 후 다시 시도하세요").
- 성공 시 `Set-Cookie: eia_session=...; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`.

### 5.2 프로젝트 목록 (`/`)

- 상단 경고 배너(노란색 계열, DESIGN.md 색 가드 내): "v0 파일럿 — 이 인스턴스의 프로젝트는 인증된 모든 사용자에게 보입니다. 조직별 격리가 필요하면 별도 배포."
- 좌측 네비: 로고 + "새 프로젝트" 버튼 + "최근 삭제" 드로어 토글.
- 본문: 검색바(이름·지역 부분일치) + 카드 리스트(이름·업종 배지·지역·최근 업로드 시각).
- 빈 상태: "첫 프로젝트를 만들어 보세요" + 기본 CTA.

### 5.3 프로젝트 상세 (`/projects/[id]`)

- 상단: 이름·`onshore_wind` 배지·지역(KOSTAT 라벨)·용량 MW·생성일.
- 탭: `자료` / `스코핑` / `초안점검` / `의견대응`. 후자 3개는 `aria-disabled=true`, 클릭 시 tooltip: "v0 범위 밖. 로드맵: feature/scoping-assistant, feature/draft-checker, feature/opinion-response."
- `자료` 탭:
  - 업로드 드롭존: "PDF / DOCX / TXT만 지원. HWP는 한컴오피스에서 PDF로 저장 후 업로드해 주세요. ([온라인 변환 안내 ↗](https://www.hancomoffice.com/))"
  - 한도 표시(진행바): "사용량 `<usedMB>`/300MB · `<count>`/30파일"
  - 파일 리스트: 이름·크기·업로드 시각·삭제 버튼. 중복 업로드 시도 시 토스트: "이미 업로드된 파일입니다: `<원본명>` · `<시각>`".
  - 경고: "업로드 문서는 귀하의 자료입니다. EIASS 원문 재호스팅 금지. 본 도구는 검토 보조이며 현지조사를 대체하지 않습니다."

### 5.4 새 프로젝트 모달

- 필드: 이름(필수, ≤200), 업종(`onshore_wind` 고정 표시), 시/도 select, 시/군/구 select(시/도 선택 후 필터링), 용량 MW(optional, 0–10000).
- 검증(Zod): 필수·최대 길이·코드 enum.

### 5.5 "최근 삭제" 드로어

- 목록: 프로젝트·파일 혼합, 최근 30일 내 `deleted_at NOT NULL`.
- 각 항목: 이름·유형 배지·삭제 시각·남은 보관일수(D-day)·"되돌리기" 버튼.
- 30일 경과 항목은 표시하지 않음(Cron이 하드삭제).

## 6. 기술 선택

- Astro 5 + React islands + TypeScript strict (ADR-0001)
- 서버 엔드포인트: Astro API 라우트 → Cloudflare Workers
- DB: D1 (개발은 Miniflare). 마이그레이션: `wrangler d1 migrations` + 파일은 `migrations/`
- 스토리지: R2 (v0는 Worker proxy 업로드, presigned URL은 v1)
- 폼 검증·서버 DTO: **Zod** 단일 소스
- 테스트: **Vitest**(단위) + **Playwright**(e2e 3 시나리오) + **axe** lint
- 상태 관리: URL 우선, 토스트·모달만 `nanostores`
- 스타일: Tailwind + shadcn/ui 복붙 + Lucide 아이콘(색·그라데이션 금지 규칙은 DESIGN.md)
- HWP 파서 **미채택** (v0.5 ADR-0002 예정)

### 6.1 A11y landmark 규칙 (2026-04-21 추가, PR #1 CI 실패 회고)

PR #1 CI 에서 `landmark-one-main` + `region` (axe moderate) 이 잡혔다. 원인은 (a) `login.astro` 가 layout 없이 bare `<html>/<body>` 로 뜨고, (b) `PilotWarningBanner` 의 `role="status"` 가 live region일 뿐 landmark 는 아니어서 AppLayout의 배너 텍스트가 어떤 landmark 에도 속하지 못한 것. 재발 방지 규칙:

- 모든 렌더 페이지는 **정확히 하나의 `<main>`** 을 가진다. `AppLayout`(인증 후) / `AuthLayout`(인증 전) 중 하나를 반드시 사용 — 페이지에서 직접 `<html>/<body>` 를 쓰지 않는다.
- `role="status"`/`role="alert"` 은 **landmark 가 아니다**. 사이트 알림 배너는 `<aside aria-label="...">` 같은 landmark 안에 둔다 — 그래야 axe `region` 규칙을 통과하면서 SR live-region 동작은 유지된다.
- Composite widget (`role="tablist"`, `role="tabpanel"`, `role="dialog"`) 에는 `aria-label` 또는 `aria-labelledby` 로 접근 가능한 이름을 반드시 지정한다.
- axe-smoke E2E 는 `includedImpacts: ['moderate','serious','critical']` 로 고정. 이 미만(= `'minor'` 만) 필터 금지 — moderate 를 빼면 이번 실패가 그대로 재발한다.
- 정적 가드: `src/lib/check-landmarks.ts` + `tests/unit/check-landmarks.test.ts` 로 layout 소스에 `<main>/<aside aria-label>/tablist aria-label` 이 실존하는지 msec 단위로 검증. E2E 가 없어도 회귀 차단.

## 7. Out of Scope (v0에서 하지 않는 것)

- 팀·권한·조직·초대
- 매직링크 / OTP / SSO
- 프로젝트 공유·공개 링크
- HWP/HWPX 파싱 → **v0.5 feature/hwp-ingest (ADR-0002)**
- 업로드 문서 OCR·본문 파싱 → feature/draft-checker
- 다른 업종(태양광·도시개발·산업단지)
- 실시간 공동편집
- AI·프롬프트 호출 (v0는 순수 CRUD + 업로드)
- R2 presigned URL 직접 업로드 → v1
- 시각 회귀 테스트, e2e 접근성 → v1

## 8. 비-목표 정교화 가드

- "프로젝트 템플릿 라이브러리" — v2의 scoping/draft-checker 착수 시점에 자연 도입. 선행 금지.
- "프로젝트 공유" — 파일럿 1명×3프로젝트 완료 검증 전까지 만들지 않음.
- "조직별 격리" — v0에서는 배포 분리로 대응. 코드·스키마 변경 금지.

## 9. 성공 지표 (v0 출시 기준)

- 평가사 1명이 15분 이내에 프로젝트를 만들고 PDF 2개를 업로드·삭제·복구할 수 있다.
- 화면·에러 문구 어디에도 이모지·그라데이션·법적 단정 표현이 없다 (`/design-review` + 단정어 grep 통과).
- `/review` 체크리스트 전 항목 Pass, `/qa` 모든 시나리오 Pass.
- Playwright 3 시나리오(CRUD happy / HWP 거부 안내 / 한도 초과) 100% green.
- Lighthouse 성능·접근성 각 ≥ 90 (`/`, `/projects/[id]`).

## 10. 보안 설계

`docs/design/feature-project-shell.md §10` — Q&A 직후 보안 리뷰에서 도출된 12건. 구현 단계 별도 합의 없이 아래 규격으로 고정.

### 10.1 인증·세션 (M1, M3, M5)

- 패스워드 비교: `crypto.subtle.timingSafeEqual` 등가 구현(Web Crypto).
- 브루트포스: **IP당 실패 5회/10분** 차단. `login_attempts` 테이블 조회 미들웨어.
- 실패 응답 지연: 성공/실패 모두 ≥300ms(타이밍 누출 방지).
- 세션 토큰: **HS256 JWT**, 페이로드 `{iat, exp, jti}`. 서명 키 `JWT_SECRET`(CF Workers Secret).
- 세션 폐기 레버: `JWT_SECRET` 회전 = 전 세션 무효화. 운영 런북에 기록. v0엔 세션 테이블 없음(의도적).
- 쿠키: `Set-Cookie: eia_session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`.
- 로그아웃: 쿠키 `Max-Age=0` 폐기.

### 10.2 업로드 검증 (M2)

- Content-Type 헤더 · 파일 확장자 · **magic bytes** 3중 일치 필수. 불일치 시 `415 Unsupported Media Type`.
- R2 키: `projects/<projectId>/<nanoid(16)>`. `original_name`은 D1에만 저장, 키에 포함 금지.
- SHA-256 계산: Worker에서 `crypto.subtle.digest('SHA-256', bytes)` 전체 바이트 다이제스트. 30MB 한도 안에서 CF Workers 128MB 메모리 제약 준수. 용량 한도 초과 시 바디 드레인 전에 중단.
- 파일당 30MB, 프로젝트당 300MB, 프로젝트당 30파일 서버 측 강제.
- 프로젝트 용량 합계: 업로드 트랜잭션에서 재집계(L3 경쟁 상태 허용, 로그 경고).

### 10.3 CSRF · 요청 출처 (M3)

- 모든 `POST/PUT/PATCH/DELETE /api/*` 에 **Origin 헤더 검사** 미들웨어: `origin === env.APP_ORIGIN` 아니면 `403`.
- `GET /api/*` 는 부작용 없도록 엄격히 유지(프리페치·링크 미리보기 대비).

### 10.4 CSP · 응답 헤더 (L1, L5)

모든 HTML 응답:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

파일 다운로드 엔드포인트(v0 구현 시):

```
Content-Disposition: attachment; filename="<RFC 5987 인코딩>"
X-Content-Type-Options: nosniff
```

### 10.5 로깅 (M4)

- `src/lib/logger.ts` 단일 채널. **허용 필드**: 레벨 · 라우트 · 메서드 · 상태코드 · latency · `jti` 해시 앞 8자 · 에러 name/message.
- **금지 필드**: req body, 파일명(원본), 프로젝트명, IP 평문, 사용자 입력 전문, R2 키 전체. IP는 `/24` 마스킹 저장.
- 에러 `cause` 직렬화 시 위 필터 통과 필수.

### 10.6 입력 검증 (L2)

Zod 스키마 `src/lib/schemas/*.ts`에 집중:

- `projectCreate`: `name` ≤200, `industry = 'onshore_wind' literal`, region codes in enum, `capacity_mw ∈ [0, 10000]`.
- `uploadInit`: `mime ∈ ALLOWED_MIME`, `size_bytes ≤ MAX_FILE_BYTES`.
- 모든 endpoint 첫 줄에 Zod parse. 실패 시 `400` + 필드별 에러.

### 10.7 Cron 하드삭제 안전 (L4)

- 쿼리 리터럴: `WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`.
- 가드: 실행 전 `SELECT COUNT(*)`, 1000건 초과면 **중단 + 에러 로그**.
- Vitest 단위 테스트로 쿼리 문자열·가드 경로 회귀 방지.
- R2 하드삭제는 D1 행 삭제 **성공 후**에만 수행(정합성).

### 10.8 비밀 관리

- `APP_PASSWORD`, `JWT_SECRET`, `TURNSTILE_SECRET_KEY`, R2 자격증명: **Cloudflare Workers Secrets**(암호화 저장). 평문 env var 금지.
- 로컬 개발: `.dev.vars`(`.gitignore` 포함). `.env` 저장소 커밋 금지(§6 이미 설정).

### 10.9 악성 첨부 고지 (L6)

- CF 무료 구간에 AV 스캐너 없음.
- README "보안 고지" 섹션: "업로드 파일은 본인 책임 하의 자기 문서만 허용. 출처 불분명 PDF 업로드 금지."
- 다운로드는 항상 `attachment` disposition — 인라인 렌더 차단.

## 11. 환경영향평가 도메인 위험 요약

| #   | 위험                                                                                 | 본 기능에서 발생 가능성              | 방지책                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①   | **법적 결론·승인 가능성 단정**                                                       | 낮음 (UI 카피에만 가능)              | DESIGN.md §7 단정어 정규식 grep 테스트 Playwright/Vitest 양쪽 포함. 경고 배너 "검토 보조이며 현지조사 대체 아님" 고정.                              |
| ②   | **현지조사 대체 주장**                                                               | 낮음 (업로드 안내 문구에만 가능)     | 업로드 드롭존 · 파일 리스트 헤더 고정 문구 "본 도구는 검토 보조이며 현지조사를 대체하지 않습니다."                                                  |
| ③   | **EIASS 원문 재호스팅**                                                              | **중간** (사용자 업로드 시 R2 저장)  | 업로드 경고 "자기 문서만 업로드, 공공자료 재배포 금지". 공개 샘플은 `data/samples/public/` 만 레포 포함, `private` 은 `.gitignore`·`.claudeignore`. |
| ④   | **주민·기관 의견 축약·왜곡**                                                         | 해당 없음 (본 기능엔 의견 처리 없음) | —                                                                                                                                                   |
| ⑤   | **결과 객체 표준 스키마** (`{result, basis, assumptions, limits, needsHumanReview}`) | 낮음 (v0는 순수 CRUD)                | 본 기능은 해당 없음. feature/scoping-assistant부터 의무 적용, `src/lib/types/analysis-result.ts` 에 타입 정의 예정.                                 |
| ⑥   | **유료 LLM 키 주입**                                                                 | 낮음 (v0 범위 밖)                    | CI lint: 소스·테스트에 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` 문자열 포함 시 빌드 실패.                                            |
| ⑦   | **단일 네임스페이스 교차 노출**                                                      | **중간** (v0 auth 구조상)            | `/login` · `/` 상단 경고 배너. README · 판매 안내문에 "1 배포 = 1 조직" 명시. 조직 분리 요청 시 별도 배포 템플릿 제공.                              |

## 12. 다음 단계

1. 본 문서 커밋 (`feat(design): finalize project-shell v1 with security section`).
2. `writing-plans` 스킬로 `docs/plans/feature-project-shell.md` 작성 — 2–5분 단위 태스크.
3. `/autoplan` 삼중 리뷰 + §9.3 **환경영향평가 도메인 리뷰**(수동, 4번째) 수행.
4. 워크트리 `../eia-workbench-feature-project-shell` 생성 → 구현.
5. **병행**: `docs/design/adr-0002-hwp-support.md` 스텁 생성(본 기능 완료 후 채움).
6. 공개 샘플 PDF 3종 조달(`data/samples/public/` — QA 선행 조건).
