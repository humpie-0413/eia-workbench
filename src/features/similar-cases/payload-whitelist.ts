export const PAYLOAD_WHITELIST = [
  'eiaCd',
  'eiaSeq',
  'bizGubunCd',
  'bizGubunNm',
  'bizNm',
  'bizmainNm',
  'approvOrganNm',
  'bizMoney',
  'bizSize',
  'bizSizeDan',
  'drfopTmdt',
  'drfopStartDt',
  'drfopEndDt',
  'eiaAddrTxt',
  // 15142987 (discussion) list 응답 추가 필드
  'ccilOrganNm',
  'stepChangeDt',
  // P1: Ing detail 필드 (2026-04-26)
  'stateNm',
  'resReplyDt',
  'applyDt',
  // P1: region 매칭 결과 (2026-04-26)
  'matched_token',
  'matched_sido',
  'matched_sigungu'
] as const;
// PII (ccilMemEmail, ccilMemNm) 의도적으로 제외 — §10.4 재호스팅 가드.

export type PayloadKey = (typeof PAYLOAD_WHITELIST)[number];

export function pickPayload(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PAYLOAD_WHITELIST) {
    if (item[k] !== undefined) out[k] = item[k];
  }
  return out;
}
