# ADR-0001 — 프런트엔드 프레임워크 선정: Astro 5 + React islands

- 날짜: 2026-04-19
- 상태: Accepted
- 결정자: 프로젝트 오너 (1인)

## 맥락

eia-workbench MVP 는 업무용 B2B SaaS 이며, 아래 제약이 있다:

- 무료 우선. Cloudflare Pages + Workers + D1 + R2 + Turnstile 로 무료구간에서 운영.
- 상시 SSR 서버 미도입. 문서 업로드/검수/export 가 주 흐름이라 정적 우선이 적합.
- 1인 개발. 복잡한 런타임 패턴(fetch 캐시, dynamic segments) 사고 위험 최소화 필요.
- 법적 단정 표현 검출·검수 테스트가 중요 → 테스트 경량성도 변수.
- 타입 안전성 (TypeScript strict).

## 검토 대상

| 후보 | 장점 | 단점 | 본 프로젝트 적합성 |
|---|---|---|---|
| **Astro 5** | 기본 static, 필요 곳만 island, CF 어댑터 공식, TS strict 지원 | 복잡한 SSR/RSC 기능 약함 | ★★★★☆ |
| Next.js 15 | 생태계 최대, App Router | CF 런타임 호환 주의, overhead, Vercel 편향 | ★★★☆☆ |
| SvelteKit | 작고 빠름, CF 어댑터 양호 | 생태계·채용성 낮음 | ★★★☆☆ |
| Remix | 데이터 로딩·변이 모델 우수 | React Router 통합 혼란기, CF 호환 테스트 소수 | ★★☆☆☆ |
| Nuxt 4 | DX 우수 | Vue 생태계, 현 프로젝트 학습비용 | ★★☆☆☆ |

## 결정

**Astro 5 + React islands + TypeScript strict**.

이유:
1. 정적 우선이 MVP 의 문서 업로드·검수·export 워크플로와 자연스럽게 맞는다.
2. 인터랙티브 컴포넌트(업로드 드롭존, 의견 대응표 에디터)만 React island 로 국한 → 번들 사이즈 작음.
3. `@astrojs/cloudflare` 어댑터로 Pages 배포와 엔드포인트 Workers 실행이 단순하다.
4. 1인 개발에서 "기본값이 static" 이 SSR 의 미묘한 함정(cache layer, route caching) 을 피하게 해준다.
5. 라이브러리 lock-in 이 낮다. React island 는 다른 프레임워크로 이식 가능.
6. shadcn/ui 스타일(소스 복붙)로 컴포넌트 확장이 가능해 UI 슬롭을 피하기 쉽다.

## 수반 결정

- UI 라이브러리 통째 도입 금지 (Chakra, MUI 등 금지). 필요한 컴포넌트만 직접 작성 또는 shadcn/ui 방식 복붙.
- 아이콘: Lucide React 한 가지.
- 서버 엔드포인트 = Astro endpoint (`src/pages/api/*.ts`).
- DB: D1, 로컬은 miniflare.
- 저장소: R2. 초기 업로드는 Worker 경유 → v2 에서 presigned URL 검토.

## 파기 조건 (언제 재검토하는가)

- Astro 에서 CF D1/R2 바인딩에 치명적 이슈가 발견될 때
- 사용자 피드백에서 "문서 편집 실시간성" 같이 SSR/RSC 급 기능이 필수가 될 때
- 번들 크기가 현저히 커져 static-first 이점이 사라질 때

## 참고

- `docs/eia-workbench-setup-manual.md` §1.1, §9
- `DESIGN.md` (톤앤매너 가드)
