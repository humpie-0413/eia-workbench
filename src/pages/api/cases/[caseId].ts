import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const eiaCd = params.caseId;
  if (!eiaCd) {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  const env = (locals as { runtime: { env: { DB: D1Database } } }).runtime.env;
  const row = await env.DB.prepare(
    `SELECT eia_cd, biz_nm, region_sido, region_sido_code, region_sigungu,
            capacity_mw, area_ha, evaluation_year, evaluation_stage, industry,
            approv_organ_nm, drfop_start_dt, drfop_end_dt, eia_addr_txt
       FROM eia_cases WHERE eia_cd = ?`
  )
    .bind(eiaCd)
    .first();
  if (!row) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify(row), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
  });
};
