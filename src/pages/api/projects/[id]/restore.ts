import type { APIRoute } from 'astro';
import { logger } from '@/lib/logger';

export const PATCH: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const id = params.id;
  if (id === undefined) {
    return new Response('bad request', { status: 400 });
  }
  await env.DB.prepare(
    `UPDATE projects SET deleted_at = NULL WHERE id = ?`
  ).bind(id).run();
  logger.info({ route: '/api/projects/[id]/restore', method: 'PATCH', status: 204, latencyMs: Date.now() - t0, jti });
  return new Response(null, { status: 204 });
};
