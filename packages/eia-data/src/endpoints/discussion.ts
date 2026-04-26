import { DSCSS_STATUS_BASE_PATH, DSCSS_STATUS_OPERATIONS } from '../types/discussion';

export function buildDscssListPath(): string {
  return `${DSCSS_STATUS_BASE_PATH}/${DSCSS_STATUS_OPERATIONS.list}`;
}

// 15142987 list 응답에는 bizGubunCd 가 없으므로 wind 식별은 bizNm regex 만 사용한다.
// 인덱서가 검색어로 조회 양을 통제할 때 사용.
export const WIND_SEARCH_TEXTS = ['풍력', '해상풍력', '육상풍력'] as const;
