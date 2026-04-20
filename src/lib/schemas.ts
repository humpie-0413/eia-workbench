import { z } from 'zod';
import { ALLOWED_MIME, MAX_FILE_BYTES } from './constants';

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.literal('onshore_wind'),
  site_region_code: z.string().max(10).optional(),
  site_region: z.string().max(50).optional(),
  site_sub_region_code: z.string().max(10).optional(),
  site_sub_region: z.string().max(50).optional(),
  capacity_mw: z.number().min(0).max(10000).optional()
});
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const loginSchema = z.object({
  password: z.string().min(1).max(512),
  turnstileToken: z.string().min(1)
});
export type LoginInput = z.infer<typeof loginSchema>;

export const uploadMetaSchema = z.object({
  original_name: z.string().min(1).max(300),
  mime: z.enum(ALLOWED_MIME),
  size_bytes: z.number().int().positive().max(MAX_FILE_BYTES)
});
export type UploadMetaInput = z.infer<typeof uploadMetaSchema>;
