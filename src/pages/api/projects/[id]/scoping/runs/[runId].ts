import type { APIRoute } from 'astro';
import { logger } from '@/lib/logger';

export const GET: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';

  const { id: projectId, runId } = params;
  if (projectId === undefined || runId === undefined) {
    return new Response('bad request', { status: 400 });
  }

  const row = await env.DB.prepare(
    `SELECT id, rule_pack_version, input_json, output_json, created_at
       FROM scoping_runs
      WHERE id = ? AND project_id = ? AND deleted_at IS NULL`,
  )
    .bind(runId, projectId)
    .first<{
      id: string;
      rule_pack_version: string;
      input_json: string;
      output_json: string;
      created_at: string;
    }>();

  if (!row) return new Response('not found', { status: 404 });

  logger.info({
    route: '/api/projects/[id]/scoping/runs/[runId]',
    method: 'GET',
    status: 200,
    latencyMs: Date.now() - t0,
    jti,
  });

  return Response.json({
    run: {
      id: row.id,
      rule_pack_version: row.rule_pack_version,
      input: JSON.parse(row.input_json),
      results: JSON.parse(row.output_json),
      created_at: row.created_at,
    },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';

  const { id: projectId, runId } = params;
  if (projectId === undefined || runId === undefined) {
    return new Response('bad request', { status: 400 });
  }

  await env.DB.prepare(
    `UPDATE scoping_runs SET deleted_at = datetime('now')
      WHERE id = ? AND project_id = ? AND deleted_at IS NULL`,
  )
    .bind(runId, projectId)
    .run();

  logger.info({
    route: '/api/projects/[id]/scoping/runs/[runId]',
    method: 'DELETE',
    status: 204,
    latencyMs: Date.now() - t0,
    jti,
  });

  return new Response(null, { status: 204 });
};
