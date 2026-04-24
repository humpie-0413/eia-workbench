import type { APIRoute } from 'astro';
import { scopingInputSchema } from '@/lib/schemas/scoping';
import { getOnshoreWindRulePack } from '@/features/scoping/rule-pack-onshore-wind';
import { evaluate, type EvalInput } from '@/features/scoping/engine';
import { newScopingRunId } from '@/lib/id';
import { logger } from '@/lib/logger';

interface ProjectRow {
  id: string;
  capacity_mw: number | null;
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';

  const projectId = params.id;
  if (projectId === undefined) return new Response('bad request', { status: 400 });

  const project = await env.DB.prepare(
    `SELECT id, capacity_mw FROM projects WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(projectId)
    .first<ProjectRow>();
  if (!project) return new Response('project not found', { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const parsed = scopingInputSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'invalid_input', issues: parsed.error.issues }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const pack = getOnshoreWindRulePack();

  const evalInput: EvalInput = {
    site_area_m2: parsed.data.site_area_m2,
    land_use_zone: parsed.data.land_use_zone,
    forest_conversion_m2: parsed.data.forest_conversion_m2,
    capacity_mw: parsed.data.capacity_mw_override ?? project.capacity_mw ?? undefined,
  };

  const results = evaluate(pack, evalInput);

  const runId = newScopingRunId();
  await env.DB.prepare(
    `INSERT INTO scoping_runs (id, project_id, rule_pack_version, input_json, output_json)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(runId, projectId, pack.version, JSON.stringify(parsed.data), JSON.stringify(results))
    .run();

  logger.info({
    route: '/api/projects/[id]/scoping',
    method: 'POST',
    status: 201,
    latencyMs: Date.now() - t0,
    jti,
  });

  return new Response(
    JSON.stringify({ runId, rule_pack_version: pack.version, results }),
    { status: 201, headers: { 'content-type': 'application/json' } },
  );
};

export const GET: APIRoute = async ({ params, locals }) => {
  const t0 = Date.now();
  const env = locals.runtime.env;
  const jti = locals.session?.jti ?? 'anon';

  const projectId = params.id;
  if (projectId === undefined) return new Response('bad request', { status: 400 });

  const row = await env.DB.prepare(
    `SELECT id, rule_pack_version, input_json, output_json, created_at
       FROM scoping_runs
      WHERE project_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
  )
    .bind(projectId)
    .first<{
      id: string;
      rule_pack_version: string;
      input_json: string;
      output_json: string;
      created_at: string;
    }>();

  logger.info({
    route: '/api/projects/[id]/scoping',
    method: 'GET',
    status: 200,
    latencyMs: Date.now() - t0,
    jti,
  });

  if (!row) return Response.json({ run: null });

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
