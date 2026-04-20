import type { APIRoute } from 'astro';
import { z } from 'zod';
import { projectCreateSchema } from '@/lib/schemas';
import { newProjectId } from '@/lib/id';
import { isValidRegionCode, isValidSubCode } from '@/lib/kostat';
import { logger } from '@/lib/logger';

const bodySchema = projectCreateSchema.superRefine((v, ctx) => {
  if (v.site_region_code && !isValidRegionCode(v.site_region_code)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['site_region_code'], message: 'invalid region code' });
  }
  if (v.site_region_code && v.site_sub_region_code && !isValidSubCode(v.site_region_code, v.site_sub_region_code)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['site_sub_region_code'], message: 'invalid sub code' });
  }
});

export const POST: APIRoute = async ({ request, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 });
    }
    const id = newProjectId();
    await env.DB.prepare(
      `INSERT INTO projects
        (id, owner_id, name, industry, site_region_code, site_region, site_sub_region_code, site_sub_region, capacity_mw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, null, parsed.data.name, parsed.data.industry,
      parsed.data.site_region_code ?? null, parsed.data.site_region ?? null,
      parsed.data.site_sub_region_code ?? null, parsed.data.site_sub_region ?? null,
      parsed.data.capacity_mw ?? null
    ).run();
    logger.info({ route: '/api/projects', method: 'POST', status: 201, latencyMs: Date.now() - t0, jti });
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({
      route: '/api/projects',
      method: 'POST',
      status: 500,
      latencyMs: Date.now() - t0,
      jti,
      error: err instanceof Error ? err : new Error(String(err))
    });
    return Response.json({ error: 'internal' }, { status: 500 });
  }
};

export const GET: APIRoute = async ({ locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';
  const { results } = await env.DB.prepare(
    `SELECT id, name, industry, site_region, site_sub_region, capacity_mw, created_at
     FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC`
  ).all();
  logger.info({ route: '/api/projects', method: 'GET', status: 200, latencyMs: Date.now() - t0, jti });
  return Response.json({ projects: results });
};
