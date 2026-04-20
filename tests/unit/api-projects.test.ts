import { describe, it, expect } from 'vitest';
import type { APIContext } from 'astro';

// Mini in-memory D1 mock
function memDb() {
  const projects: Record<string, Record<string, unknown>> = {};
  return {
    projects,
    prepare(sql: string) {
      async function allImpl<T>() {
        const rows = Object.values(projects).filter((p) => !p.deleted_at);
        return ({ results: rows as T[] });
      }
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.startsWith('INSERT INTO projects')) {
                const id = String(args[0]);
                projects[id] = {
                  id, owner_id: args[1], name: args[2], industry: args[3],
                  site_region_code: args[4], site_region: args[5],
                  site_sub_region_code: args[6], site_sub_region: args[7],
                  capacity_mw: args[8], created_at: new Date().toISOString(), deleted_at: null
                };
              }
              return { success: true };
            },
            async first<T>() {
              if (sql.includes('WHERE id = ?')) {
                const id = String(args[0]);
                return (projects[id] as unknown) as T;
              }
              return null;
            },
            all: allImpl
          };
        },
        all: allImpl
      };
    }
  } as unknown as D1Database & { projects: Record<string, unknown> };
}

async function callRoute(method: 'GET' | 'POST', body?: unknown, db?: D1Database) {
  const { POST, GET } = await import('@/pages/api/projects/index');
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' }
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const req = new Request('http://localhost:3000/api/projects', init);
  const ctx = {
    request: req,
    locals: { runtime: { env: { DB: db } }, session: { jti: 'j1' } }
  } as unknown as APIContext;
  if (method === 'POST') return POST(ctx);
  return GET(ctx);
}

describe('POST /api/projects', () => {
  it('creates a project and returns 201 with id', async () => {
    const db = memDb();
    const res = await callRoute('POST', { name: '강원 풍력 1단지', industry: 'onshore_wind' }, db);
    expect(res.status).toBe(201);
    const j = await res.json() as { id: string };
    expect(j.id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it('returns 400 for invalid body', async () => {
    const db = memDb();
    const res = await callRoute('POST', { name: '', industry: 'onshore_wind' }, db);
    expect(res.status).toBe(400);
  });

  it('returns 400 when region codes are invalid', async () => {
    const db = memDb();
    const res = await callRoute('POST',
      { name: 'x', industry: 'onshore_wind', site_region_code: '99' }, db);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/projects', () => {
  it('lists alive projects', async () => {
    const db = memDb();
    await callRoute('POST', { name: 'A', industry: 'onshore_wind' }, db);
    const res = await callRoute('GET', undefined, db);
    expect(res.status).toBe(200);
    const j = await res.json() as { projects: unknown[] };
    expect(j.projects.length).toBe(1);
  });
});
