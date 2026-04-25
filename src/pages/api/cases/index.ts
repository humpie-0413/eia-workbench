import type { APIRoute } from 'astro';
import { caseSearchQuerySchema } from '@/lib/schemas/case-search';
import { buildCaseSearchSql } from '@/features/similar-cases/search-query';

export const GET: APIRoute = async ({ request, locals }) => {
  const { searchParams } = new URL(request.url);

  const obj: Record<string, unknown> = {};
  for (const k of new Set(searchParams.keys())) {
    const all = searchParams.getAll(k);
    obj[k] = all.length > 1 ? all : all[0];
  }

  const parsed = caseSearchQuerySchema.safeParse(obj);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'invalid_query', issues: parsed.error.flatten() }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const built = buildCaseSearchSql(parsed.data);
  const env = (locals as { runtime: { env: { DB: D1Database } } }).runtime.env;
  const [list, count] = await Promise.all([
    env.DB.prepare(built.sql)
      .bind(...built.binds)
      .all(),
    env.DB.prepare(built.countSql)
      .bind(...built.countBinds)
      .first<{ n: number }>()
  ]);

  // Q7 — search query string (q) 비로깅. count 만 메트릭 용도로 기록.
  console.log(JSON.stringify({ kind: 'cases-search', count: count?.n ?? 0 }));

  return new Response(
    JSON.stringify({
      total: count?.n ?? 0,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      items: list.results ?? []
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
    }
  );
};
