import { describe, it, expect } from 'vitest';
import type { APIContext } from 'astro';

type ProjectRow = {
  id: string;
  name: string;
  industry: string;
  site_region_code: string | null;
  site_region: string | null;
  site_sub_region_code: string | null;
  site_sub_region: string | null;
  capacity_mw: number | null;
  created_at: string;
  deleted_at: string | null;
};

type DbWithRows = D1Database & { rows: Record<string, ProjectRow> };

function memDb(): DbWithRows {
  const rows: Record<string, ProjectRow> = {
    p1: {
      id: 'p1',
      name: 'A',
      industry: 'onshore_wind',
      site_region_code: null,
      site_region: null,
      site_sub_region_code: null,
      site_sub_region: null,
      capacity_mw: null,
      created_at: '2024-01-01T00:00:00Z',
      deleted_at: null
    }
  };
  const mock = {
    rows,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              const key = String(args[0]);
              const row = rows[key];
              if (row && sql.includes('UPDATE projects SET deleted_at = NULL')) {
                row.deleted_at = null;
              } else if (row && sql.includes('UPDATE projects SET deleted_at')) {
                row.deleted_at = 'now';
              }
              // Also handle uploads soft-delete (child cascade) — no-op here since no uploads in this mock.
              return { success: true };
            },
            async first<T>(): Promise<T | null> {
              if (sql.includes('SELECT')) {
                const key = String(args[0]);
                const row = rows[key];
                return (row === undefined ? null : row) as unknown as T | null;
              }
              return null;
            }
          };
        }
      };
    }
  };
  return mock as unknown as DbWithRows;
}

async function call(
  method: 'GET' | 'DELETE' | 'PATCH',
  id: string,
  db: DbWithRows
): Promise<Response> {
  const base = `http://localhost:3000/api/projects/${id}`;
  const reqInit = { method, headers: { origin: 'http://localhost:3000' } };
  const ctx = {
    request: new Request(method === 'PATCH' ? `${base}/restore` : base, reqInit),
    params: { id },
    locals: { runtime: { env: { DB: db } }, session: { jti: 'j' } }
  } as unknown as APIContext;

  if (method === 'PATCH') {
    const { PATCH } = await import('@/pages/api/projects/[id]/restore');
    return PATCH(ctx) as Promise<Response>;
  }
  const mod = await import('@/pages/api/projects/[id]/index');
  const handler = method === 'GET' ? mod.GET : mod.DELETE;
  return handler(ctx) as Promise<Response>;
}

describe('GET /api/projects/[id]', () => {
  it('returns the project', async () => {
    const db = memDb();
    const res = await call('GET', 'p1', db);
    expect(res.status).toBe(200);
  });
  it('returns 404 for unknown id', async () => {
    const db = memDb();
    const res = await call('GET', 'zzz', db);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/projects/[id]', () => {
  it('soft-deletes', async () => {
    const db = memDb();
    await call('DELETE', 'p1', db);
    expect(db.rows['p1']?.deleted_at).toBeTruthy();
  });
});

describe('PATCH /api/projects/[id]/restore', () => {
  it('clears deleted_at', async () => {
    const db = memDb();
    const row = db.rows['p1'];
    if (row === undefined) throw new Error('fixture missing');
    row.deleted_at = '2024-01-01';
    await call('PATCH', 'p1', db);
    expect(db.rows['p1']?.deleted_at).toBe(null);
  });
});
