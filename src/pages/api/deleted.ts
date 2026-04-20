import type { APIRoute } from 'astro';
import { logger } from '@/lib/logger';

export const GET: APIRoute = async ({ locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const projects = await env.DB.prepare(
    `SELECT id, name, deleted_at FROM projects
     WHERE deleted_at IS NOT NULL AND deleted_at >= datetime('now','-30 days')
     ORDER BY deleted_at DESC`
  ).all();
  const uploads = await env.DB.prepare(
    `SELECT id, project_id, original_name, deleted_at FROM uploads
     WHERE deleted_at IS NOT NULL AND deleted_at >= datetime('now','-30 days')
     ORDER BY deleted_at DESC`
  ).all();
  logger.info({ route: '/api/deleted', method: 'GET', status: 200, latencyMs: Date.now() - t0, jti });
  return Response.json({ projects: projects.results, uploads: uploads.results });
};
