export const PAYLOAD_WHITELIST = [
  'eiaCd', 'eiaSeq', 'bizGubunCd', 'bizGubunNm', 'bizNm',
  'bizmainNm', 'approvOrganNm', 'bizMoney', 'bizSize', 'bizSizeDan',
  'drfopTmdt', 'drfopStartDt', 'drfopEndDt', 'eiaAddrTxt'
] as const;

export type PayloadKey = (typeof PAYLOAD_WHITELIST)[number];

export function pickPayload(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PAYLOAD_WHITELIST) {
    if (item[k] !== undefined) out[k] = item[k];
  }
  return out;
}
