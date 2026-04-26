import { z } from 'zod';

const stringy = z.union([z.string(), z.number()]).transform((v) => String(v));

// === 협의현황 (15142987) — eiaCd PK ===
// 실 응답 received_keys (list): bizNm, ccilOrganNm, eiaCd, eiaSeq, rnum, stepChangeDt
// bizGubunCd / bizGubunNm 부재. drfopTmdt / eiaAddrTxt 도 list 응답에 없음.
export const dscssBsnsListItemSchema = z.object({
  eiaCd: z.string().min(1),
  eiaSeq: stringy.optional(),
  bizNm: z.string(),
  ccilOrganNm: z.string().optional(),
  rnum: stringy.optional(),
  stepChangeDt: z.string().optional()
});
export type DscssBsnsListItem = z.infer<typeof dscssBsnsListItemSchema>;

export const DSCSS_STATUS_BASE_PATH = '/1480523/EnvrnAffcEvlDscssSttusInfoInqireService' as const;

export const DSCSS_STATUS_OPERATIONS = {
  list: 'getDscssBsnsListInfoInqire'
} as const;
