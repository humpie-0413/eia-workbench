import { z } from 'zod';

export const CAPACITY_BANDS = ['<10', '10-50', '50-100', '>=100'] as const;
export type CapacityBand = (typeof CAPACITY_BANDS)[number];

const arrify = <T extends z.ZodTypeAny>(s: T) =>
  z.union([s, z.array(s)]).transform((v) => (Array.isArray(v) ? v : [v]));

export const caseSearchQuerySchema = z.object({
  q: z.string().trim().min(0).max(80).optional(),
  sido: arrify(z.string().min(1).max(8)).optional(),
  capacity_band: arrify(z.enum(CAPACITY_BANDS)).optional(),
  year: arrify(z.coerce.number().int().min(2000).max(2100)).optional(),
  page: z.coerce.number().int().min(1).max(200).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(50)
});
export type CaseSearchQuery = z.infer<typeof caseSearchQuerySchema>;
