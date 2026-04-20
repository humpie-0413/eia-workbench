import type { APIRoute } from 'astro';
import { logger } from '@/lib/logger';

export const PATCH: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const uploadId = params.uploadId;
  if (uploadId === undefined) {
    return new Response('bad request', { status: 400 });
  }
  await env.DB.prepare(`UPDATE uploads SET deleted_at = NULL WHERE id = ?`).bind(uploadId).run();
  logger.info({
    route: '/api/projects/[id]/uploads/[uploadId]/restore',
    method: 'PATCH',
    status: 204,
    latencyMs: Date.now() - t0,
    jti
  });
  return new Response(null, { status: 204 });
};
