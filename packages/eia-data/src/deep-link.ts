/**
 * EIASS (환경영향평가 정보지원시스템) 원문 deep-link 생성 헬퍼.
 *
 * 공공데이터포털 (data.go.kr) 을 메타데이터 소스로 사용하되, 실제 원문 문서/공람
 * 페이지는 EIASS 에 있는 경우가 있어 사용자에게 EIASS deep-link 를 제공한다.
 * 원문을 재호스팅하지 않는다 (CLAUDE.md §2-4).
 *
 * EIASS 서비스 URL 패턴이 바뀌면 이 파일에서만 업데이트한다.
 *
 * 2026-04-26 보정: /proj/view.do?projectId= 는 404. 실제 동작 URL 은
 *   /biz/base/info/searchListNew.do?menu=biz&sKey=BIZ_CD&sVal=<eiaCd>
 * 이며 BIZ_CD 는 data.go.kr 의 eiaCd 와 동일하므로 eiaCd 만 받는다.
 */

const EIASS_BASE = 'https://www.eiass.go.kr';

/**
 * EIASS 사업 상세 페이지 URL 을 반환한다.
 * URL 패턴은 이 함수 내부에만 두어 외부 변경 영향을 격리.
 */
export function eiassProjectUrl(eiaCd: string): string {
  const encoded = encodeURIComponent(eiaCd);
  return `${EIASS_BASE}/biz/base/info/searchListNew.do?menu=biz&sKey=BIZ_CD&sVal=${encoded}`;
}
