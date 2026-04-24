import type { APIRoute } from 'astro';
import { logger } from '@/lib/logger';

export const GET: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';

  const projectId = params.id;
  if (projectId === undefined) return new Response('bad request', { status: 400 });

  const { results } = await env.DB.prepare(
    `SELECT id, rule_pack_version, created_at
       FROM scoping_runs
      WHERE project_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 20`,
  )
    .bind(projectId)
    .all<{ id: string; rule_pack_version: string; created_at: string }>();

  logger.info({
    route: '/api/projects/[id]/scoping/runs',
    method: 'GET',
    status: 200,
    latencyMs: Date.now() - t0,
    jti,
  });

  return Response.json({ runs: results ?? [] });
};
