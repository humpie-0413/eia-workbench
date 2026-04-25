import { z } from 'zod';

const stringy = z.union([z.string(), z.number()]).transform((v) => String(v));

export const draftListItemSchema = z.object({
  eiaCd: z.string().min(1),
  eiaSeq: stringy.optional(),
  bizGubunCd: z.string().optional(),
  bizGubunNm: z.string(),
  bizNm: z.string(),
  drfopTmdt: z.string().optional()
});
export type DraftListItem = z.infer<typeof draftListItemSchema>;

export const draftDetailItemSchema = draftListItemSchema.extend({
  bizmainNm: z.string().optional(),
  approvOrganNm: z.string().optional(),
  drfopStartDt: z.string().optional(),
  drfopEndDt: z.string().optional(),
  eiaAddrTxt: z.string().optional()
});
export type DraftDetailItem = z.infer<typeof draftDetailItemSchema>;

export const strategyDraftListItemSchema = draftListItemSchema;
export type StrategyDraftListItem = z.infer<typeof strategyDraftListItemSchema>;

export const strategyDraftDetailItemSchema = draftDetailItemSchema.extend({
  bizMoney: z.coerce.number().int().nonnegative().optional(),
  bizSize: z.string().optional(),
  bizSizeDan: z.string().optional()
});
export type StrategyDraftDetailItem = z.infer<typeof strategyDraftDetailItemSchema>;

export const DRAFT_DISPLAY_BASE_PATH =
  '/1480523/EnvrnAffcEvlDraftDsplayInfoInqireService' as const;

export const DRAFT_DISPLAY_OPERATIONS = {
  draftList: 'getDraftPblancDsplayListInfoInqire',
  draftDetail: 'getDraftPblancDsplaybtntOpinionDetailInfoInqire',
  strategyList: 'getStrategyDraftPblancDsplayListInfoInqire',
  strategyDetail: 'getStrategyDraftPblancDsplaybtntOpinionDetailInfoInqire'
} as const;
