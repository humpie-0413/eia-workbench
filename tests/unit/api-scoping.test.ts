import { describe, it, expect } from 'vitest';
import type { APIContext } from 'astro';

interface ScopingRunRow {
  id: string;
  project_id: string;
  rule_pack_version: string;
  input_json: string;
  output_json: string;
  created_at: string;
  deleted_at: string | null;
}

function memDb(projectCapacity: number | null = null) {
  const projects: Record<string, { id: string; capacity_mw: number | null; deleted_at: string | null }> = {
    p_test: { id: 'p_test', capacity_mw: projectCapacity, deleted_at: null },
  };
  const runs: Record<string, ScopingRunRow> = {};

  return {
    projects,
    runs,
    prepare(sql: string) {
      const isSelectProject = sql.startsWith('SELECT id, capacity_mw FROM projects');
      const isInsertRun = sql.startsWith('INSERT INTO scoping_runs');
      const isSelectLatest =
        sql.includes('FROM scoping_runs') &&
        sql.includes('ORDER BY created_at DESC') &&
        sql.includes('LIMIT 1');
      const isSelectList =
        sql.includes('FROM scoping_runs') &&
        sql.includes('ORDER BY created_at DESC') &&
        sql.includes('LIMIT 20');
      const isSelectOne = sql.includes('WHERE id = ? AND project_id = ?');
      const isSoftDelete = sql.startsWith('UPDATE scoping_runs SET deleted_at');

      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (isInsertRun) {
                const [id, project_id, version, input_json, output_json] = args as string[];
                runs[id] = {
                  id,
                  project_id,
                  rule_pack_version: version,
                  input_json,
                  output_json,
                  created_at: new Date().toISOString(),
                  deleted_at: null,
                };
              }
              if (isSoftDelete) {
                const [runId, pid] = args as string[];
                if (runs[runId] && runs[runId].project_id === pid) {
                  runs[runId].deleted_at = new Date().toISOString();
                }
              }
              return { success: true };
            },
            async first<T>() {
              if (isSelectProject) {
                const id = String(args[0]);
                return (projects[id] && !projects[id].deleted_at
                  ? projects[id]
                  : null) as T | null;
              }
              if (isSelectLatest) {
                const pid = String(args[0]);
                const list = Object.values(runs)
                  .filter((r) => r.project_id === pid && !r.deleted_at)
                  .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
                return (list[0] ?? null) as T | null;
              }
              if (isSelectOne) {
                const [runId, pid] = args as string[];
                const r = runs[runId];
                if (!r || r.project_id !== pid || r.deleted_at) return null as T | null;
                return r as unknown as T;
              }
              return null as T | null;
            },
            async all<T>() {
              if (isSelectList) {
                const pid = String(args[0]);
                const list = Object.values(runs)
                  .filter((r) => r.project_id === pid && !r.deleted_at)
                  .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
                return { results: list.slice(0, 20) as unknown as T[] };
              }
              return { results: [] as T[] };
            },
          };
        },
      };
    },
  } as unknown as D1Database & { projects: Record<string, unknown>; runs: Record<string, ScopingRunRow> };
}

function ctx(db: D1Database, method: string, url: string, body?: unknown, paramOverride?: Record<string, string>) {
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const req = new Request(url, init);
  return {
    request: req,
    params: paramOverride ?? { id: 'p_test' },
    locals: { runtime: { env: { DB: db } }, session: { jti: 'j1' } },
  } as unknown as APIContext;
}

describe('POST /api/projects/[id]/scoping', () => {
  it('creates a run, returns 201 with results[] and rule_pack_version', async () => {
    const { POST } = await import('@/pages/api/projects/[id]/scoping/index');
    const db = memDb(120);
    const res = await POST(
      ctx(db, 'POST', 'http://localhost:3000/api/projects/p_test/scoping', {
        site_area_m2: 10000,
        site_area_input_unit: 'sqm',
        land_use_zone: 'planning_management',
        forest_conversion_m2: 700,
      }),
    );
    expect(res.status).toBe(201);
    const j = (await res.json()) as { runId: string; rule_pack_version: string; results: { ruleId: string; triggered: boolean }[] };
    expect(j.runId).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(j.rule_pack_version).toMatch(/^onshore_wind\/v2/);
    expect(j.results).toHaveLength(5);

    const capRule = j.results.find((r) => r.ruleId === 'eia_target_capacity');
    expect(capRule?.triggered).toBe(true);

    const planRule = j.results.find((r) => r.ruleId === 'small_eia_planning');
    expect(planRule?.triggered).toBe(true);

    const forestRule = j.results.find((r) => r.ruleId === 'forest_conversion_review');
    expect(forestRule?.triggered).toBe(true);
  });

  it('returns 400 for invalid input (negative area)', async () => {
    const { POST } = await import('@/pages/api/projects/[id]/scoping/index');
    const db = memDb();
    const res = await POST(
      ctx(db, 'POST', 'http://localhost:3000/api/projects/p_test/scoping', {
        site_area_m2: -1,
        site_area_input_unit: 'sqm',
        land_use_zone: 'conservation_management',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON', async () => {
    const { POST } = await import('@/pages/api/projects/[id]/scoping/index');
    const db = memDb();
    const badReq = new Request('http://localhost:3000/api/projects/p_test/scoping', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json{{{',
    });
    const res = await POST({
      request: badReq,
      params: { id: 'p_test' },
      locals: { runtime: { env: { DB: db } }, session: { jti: 'j' } },
    } as unknown as APIContext);
    expect(res.status).toBe(400);
  });

  it('returns 404 when project not found', async () => {
    const { POST } = await import('@/pages/api/projects/[id]/scoping/index');
    const db = memDb();
    const res = await POST(
      ctx(db, 'POST', 'http://localhost:3000/api/projects/nope/scoping', {
        site_area_m2: 1,
        site_area_input_unit: 'sqm',
        land_use_zone: 'conservation_management',
      }, { id: 'nope' }),
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /api/projects/[id]/scoping', () => {
  it('returns null when no runs exist', async () => {
    const { GET } = await import('@/pages/api/projects/[id]/scoping/index');
    const db = memDb();
    const res = await GET(ctx(db, 'GET', 'http://localhost:3000/api/projects/p_test/scoping'));
    expect(res.status).toBe(200);
    const j = (await res.json()) as { run: null | unknown };
    expect(j.run).toBeNull();
  });

  it('returns the latest run after POST', async () => {
    const { POST, GET } = await import('@/pages/api/projects/[id]/scoping/index');
    const db = memDb(120);
    await POST(
      ctx(db, 'POST', 'http://localhost:3000/api/projects/p_test/scoping', {
        site_area_m2: 5000,
        site_area_input_unit: 'sqm',
        land_use_zone: 'conservation_management',
      }),
    );
    const res = await GET(ctx(db, 'GET', 'http://localhost:3000/api/projects/p_test/scoping'));
    const j = (await res.json()) as { run: { rule_pack_version: string; results: unknown[] } };
    expect(j.run.rule_pack_version).toMatch(/^onshore_wind\/v2/);
    expect(Array.isArray(j.run.results)).toBe(true);
  });
});

describe('GET /api/projects/[id]/scoping/runs', () => {
  it('returns empty list initially, then 1 after POST', async () => {
    const { POST } = await import('@/pages/api/projects/[id]/scoping/index');
    const { GET } = await import('@/pages/api/projects/[id]/scoping/runs/index');
    const db = memDb(120);
    let res = await GET(ctx(db, 'GET', 'http://localhost:3000/api/projects/p_test/scoping/runs'));
    expect(((await res.json()) as { runs: unknown[] }).runs).toEqual([]);

    await POST(
      ctx(db, 'POST', 'http://localhost:3000/api/projects/p_test/scoping', {
        site_area_m2: 5000,
        site_area_input_unit: 'sqm',
        land_use_zone: 'conservation_management',
      }),
    );
    res = await GET(ctx(db, 'GET', 'http://localhost:3000/api/projects/p_test/scoping/runs'));
    const j = (await res.json()) as { runs: { id: string }[] };
    expect(j.runs).toHaveLength(1);
  });
});

describe('DELETE /api/projects/[id]/scoping/runs/[runId]', () => {
  it('soft-deletes and removes from subsequent list', async () => {
    const { POST } = await import('@/pages/api/projects/[id]/scoping/index');
    const { GET: getList } = await import('@/pages/api/projects/[id]/scoping/runs/index');
    const { DELETE } = await import('@/pages/api/projects/[id]/scoping/runs/[runId]');
    const db = memDb(120);
    const post = await POST(
      ctx(db, 'POST', 'http://localhost:3000/api/projects/p_test/scoping', {
        site_area_m2: 5000,
        site_area_input_unit: 'sqm',
        land_use_zone: 'conservation_management',
      }),
    );
    const { runId } = (await post.json()) as { runId: string };

    const delRes = await DELETE(
      ctx(db, 'DELETE', `http://localhost:3000/api/projects/p_test/scoping/runs/${runId}`, undefined, {
        id: 'p_test',
        runId,
      }),
    );
    expect(delRes.status).toBe(204);

    const listRes = await getList(ctx(db, 'GET', 'http://localhost:3000/api/projects/p_test/scoping/runs'));
    expect(((await listRes.json()) as { runs: unknown[] }).runs).toHaveLength(0);
  });
});
