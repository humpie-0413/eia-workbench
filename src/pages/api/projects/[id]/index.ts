import type { APIRoute } from 'astro';
import { logger } from '@/lib/logger';

export const GET: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const id = params.id;
  if (id === undefined) {
    return new Response('bad request', { status: 400 });
  }
  const row = await env.DB.prepare(
    `SELECT id, name, industry, site_region_code, site_region, site_sub_region_code, site_sub_region, capacity_mw, created_at
     FROM projects WHERE id = ? AND deleted_at IS NULL`
  )
    .bind(id)
    .first();
  if (!row) {
    logger.info({
      route: '/api/projects/[id]',
      method: 'GET',
      status: 404,
      latencyMs: Date.now() - t0,
      jti
    });
    return new Response('not found', { status: 404 });
  }
  logger.info({
    route: '/api/projects/[id]',
    method: 'GET',
    status: 200,
    latencyMs: Date.now() - t0,
    jti
  });
  return Response.json({ project: row });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const id = params.id;
  if (id === undefined) {
    return new Response('bad request', { status: 400 });
  }
  await env.DB.prepare(
    `UPDATE projects SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`
  )
    .bind(id)
    .run();
  // Also soft-delete child uploads, so "최근 삭제" drawer shows them under the parent.
  await env.DB.prepare(
    `UPDATE uploads SET deleted_at = datetime('now') WHERE project_id = ? AND deleted_at IS NULL`
  )
    .bind(id)
    .run();
  logger.info({
    route: '/api/projects/[id]',
    method: 'DELETE',
    status: 204,
    latencyMs: Date.now() - t0,
    jti
  });
  return new Response(null, { status: 204 });
};
