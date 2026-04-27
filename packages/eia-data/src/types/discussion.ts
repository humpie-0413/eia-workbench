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
  list: 'getDscssBsnsListInfoInqire',
  ingDetail: 'getDscssSttusDscssIngDetailInfoInqire'
} as const;

// === Ing detail (15142987) — eiaCd 기반 ===
// 응답 envelope: response.body.items.item (single | array). totalCount=0 시 items 없음.
export const dscssIngDetailItemSchema = z.object({
  stateNm: z.string(),
  resReplyDt: z.string().optional(),
  applyDt: z.string().optional()
});
export type DscssIngDetailItem = z.infer<typeof dscssIngDetailItemSchema>;

// envelope (data.go.kr 공통 패턴)
export const dscssIngDetailEnvelopeSchema = z.object({
  response: z.object({
    header: z.object({
      resultCode: z.string(),
      resultMsg: z.string()
    }),
    body: z.object({
      items: z
        .union([
          z.object({ item: z.union([z.array(z.unknown()), z.unknown()]) }),
          z.string() // empty body 가 빈 string 으로 오는 케이스 (totalCount=0)
        ])
        .optional(),
      totalCount: z.union([z.string(), z.number()]).optional()
    })
  })
});
