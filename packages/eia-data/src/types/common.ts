/**
 * 공공데이터포털 (data.go.kr) 공통 응답 envelope.
 *
 * 대부분의 엔드포인트가 동일한 외형을 사용:
 *   { response: { header: {...}, body: {...} } }
 *
 * 데이터셋별 body.items 구조는 엔드포인트별 타입에서 확장한다.
 */

export interface PortalResponseHeader {
  /** '00' = 정상, 그 외는 에러 코드 */
  resultCode: string;
  resultMsg: string;
}

export interface PortalResponseBody<T> {
  numOfRows?: number;
  pageNo?: number;
  totalCount?: number;
  /**
   * 일부 엔드포인트는 단건일 때 배열이 아닌 객체로 반환하므로 union.
   */
  items?: { item?: T[] | T };
}

export interface PortalResponse<T> {
  response: {
    header: PortalResponseHeader;
    body?: PortalResponseBody<T>;
  };
}

export const PORTAL_SUCCESS_CODE = '00';

/** resultCode 기준으로 정상 응답 여부 판정. */
export function isPortalSuccess(res: PortalResponse<unknown>): boolean {
  return res.response.header.resultCode === PORTAL_SUCCESS_CODE;
}
