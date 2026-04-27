// src/features/similar-cases/sigungu-parser.ts
import lut from '../../../data/region/sigungu-lut.json';
import { sidoCode } from './sido-lut';

const METRO = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종'] as const;

// 한글 어두/어말 경계 lookbehind/lookahead — '광역시'·'자치구' 잡음 분해 차단
const SIGUNGU_TOKEN = /(?<![가-힣])(\S+?(?:시|군|구))(?![가-힣])/g;

export interface RegionResult {
  matched_sido: string | null; // sido label (e.g. '경상북도', '서울')
  sidoCode: string | null; // KOSTAT 2자리
  matched_sigungu: string | null; // sigungu label (e.g. '영양군')
  matched_token: string | null; // 매칭에 사용된 원 토큰
}

const NULL_RESULT: RegionResult = {
  matched_sido: null,
  sidoCode: null,
  matched_sigungu: null,
  matched_token: null
};

export function deriveRegionFromBizNm(bizNm: string): RegionResult {
  // 1. 광역시 토큰 우선
  for (const metro of METRO) {
    if (bizNm.includes(metro)) {
      return {
        matched_sido: metro,
        sidoCode: sidoCode(metro),
        matched_sigungu: null,
        matched_token: metro
      };
    }
  }
  // 2. 시·군·구 LUT 첫 매치 (suffix 포함된 토큰)
  const tokens = [...bizNm.matchAll(SIGUNGU_TOKEN)].map((m) => m[1] ?? '');
  const lutMap = lut as Record<string, { sido: string; sidoCode: string; sigungu: string }>;
  for (const token of tokens) {
    const stem = token.replace(/(시|군|구)$/, '');
    const entry = lutMap[stem];
    if (entry) {
      return {
        matched_sido: entry.sido,
        sidoCode: entry.sidoCode,
        matched_sigungu: entry.sigungu,
        matched_token: token
      };
    }
  }
  // 2.5. (P1 보강) LUT 어근 substring 매치 — suffix 없는 어근만 있는 bizNm 대응
  //      운영 풍력 10건 모두 어근 only ('영양풍력', '강릉 안인풍력' 등). spec §4.4.4 step 2.5.
  for (const stem of Object.keys(lutMap)) {
    if (bizNm.includes(stem)) {
      const entry = lutMap[stem]!;
      return {
        matched_sido: entry.sido,
        sidoCode: entry.sidoCode,
        matched_sigungu: entry.sigungu,
        matched_token: stem // 어근 그대로 (suffix 없음)
      };
    }
  }
  // 3. 매칭 실패
  return NULL_RESULT;
}
