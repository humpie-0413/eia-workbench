import { describe, it, expect } from 'vitest';
import type { APIContext } from 'astro';

interface ProjectRow { id: string; deleted_at: string | null; }
interface UploadRow {
  id: string; project_id: string; r2_key: string; sha256: string;
  original_name: string; mime: string; size_bytes: number;
  created_at: string; deleted_at: string | null;
}

function memState() {
  const projects: Record<string, ProjectRow> = { p1: { id: 'p1', deleted_at: null } };
  const uploads: Record<string, UploadRow> = {};
  const objects: Record<string, Uint8Array> = {};
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.startsWith('INSERT INTO uploads')) {
                uploads[String(args[0])] = {
                  id: String(args[0]), project_id: String(args[1]), r2_key: String(args[2]),
                  sha256: String(args[3]), original_name: String(args[4]),
                  mime: String(args[5]), size_bytes: Number(args[6]),
                  created_at: 'x', deleted_at: null
                };
              }
              return { success: true };
            },
            async first<T>(): Promise<T | null | undefined> {
              if (sql.includes('FROM projects WHERE id = ?')) {
                const val = projects[String(args[0])];
                return val as unknown as T | null | undefined;
              }
              if (sql.includes('COALESCE(SUM')) {
                const pid = String(args[0]);
                const rows = Object.values(uploads).filter((u) => u.project_id === pid && !u.deleted_at);
                return ({ total: rows.reduce((s, r) => s + r.size_bytes, 0), n: rows.length } as unknown) as T;
              }
              if (sql.includes('FROM uploads WHERE project_id = ? AND sha256 = ?')) {
                const pid = String(args[0]); const sha = String(args[1]);
                const found = Object.values(uploads).find((u) => u.project_id === pid && u.sha256 === sha && !u.deleted_at);
                return (found as unknown) as T | null | undefined;
              }
              return null;
            },
            async all<T>(): Promise<{ results: T[] }> {
              if (sql.includes('FROM uploads') && sql.includes('ORDER BY created_at DESC')) {
                const pid = String(args[0]);
                const rows = Object.values(uploads).filter((u) => u.project_id === pid && !u.deleted_at);
                return { results: rows as unknown as T[] };
              }
              return { results: [] };
            }
          };
        }
      };
    }
  } as unknown as D1Database;
  const r2 = {
    async put(key: string, body: ArrayBuffer) { objects[key] = new Uint8Array(body); return { key } as R2Object; },
    async delete(_key: string) { return; }
  } as unknown as R2Bucket;
  return { db, r2, projects, uploads, objects };
}

async function call(form: FormData, env: { DB: D1Database; UPLOADS: R2Bucket }, projectId = 'p1') {
  const { POST } = await import('@/pages/api/projects/[id]/uploads/index');
  return POST({
    request: new Request(`http://localhost:3000/api/projects/${projectId}/uploads`, {
      method: 'POST', body: form, headers: { origin: 'http://localhost:3000' }
    }),
    params: { id: projectId },
    locals: { runtime: { env }, session: { jti: 'j' } }
  } as unknown as APIContext);
}

async function callGet(env: { DB: D1Database; UPLOADS: R2Bucket }, projectId = 'p1') {
  const { GET } = await import('@/pages/api/projects/[id]/uploads/index');
  return GET({
    request: new Request(`http://localhost:3000/api/projects/${projectId}/uploads`, {
      method: 'GET', headers: { origin: 'http://localhost:3000' }
    }),
    params: { id: projectId },
    locals: { runtime: { env }, session: { jti: 'j' } }
  } as unknown as APIContext);
}

function fd(name: string, content: Uint8Array, mime: string): FormData {
  const form = new FormData();
  const buf = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
  form.append('file', new Blob([buf], { type: mime }), name);
  return form;
}

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

describe('POST /api/projects/[id]/uploads', () => {
  it('accepts valid PDF', async () => {
    const s = memState();
    const res = await call(fd('a.pdf', PDF, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    expect(res.status).toBe(201);
    expect(Object.values(s.uploads).length).toBe(1);
  });
  it('rejects HWP with 415', async () => {
    const s = memState();
    const res = await call(fd('a.hwp', new Uint8Array([1, 2, 3]), 'application/x-hwp'), { DB: s.db, UPLOADS: s.r2 });
    expect(res.status).toBe(415);
  });
  it('rejects size over 30MB', async () => {
    const s = memState();
    const big = new Uint8Array(31 * 1024 * 1024);
    big.set(PDF);
    const res = await call(fd('big.pdf', big, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    expect(res.status).toBe(413);
  });
  it('rejects duplicate sha256 with 409', async () => {
    const s = memState();
    await call(fd('a.pdf', PDF, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    const res = await call(fd('a-copy.pdf', PDF, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    expect(res.status).toBe(409);
  });
  it('rejects when project file count reaches 30', async () => {
    const s = memState();
    for (let i = 0; i < 30; i++) {
      const uniq = new Uint8Array(PDF.length + 4);
      uniq.set(PDF);
      new DataView(uniq.buffer).setUint32(PDF.length, i);
      await call(fd(`f${i}.pdf`, uniq, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    }
    const extra = new Uint8Array(PDF.length + 4);
    extra.set(PDF); new DataView(extra.buffer).setUint32(PDF.length, 999);
    const res = await call(fd('overflow.pdf', extra, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    expect(res.status).toBe(413);
  });
  it('rejects magic-bytes mismatch with 415', async () => {
    const s = memState();
    const res = await call(fd('fake.pdf', new Uint8Array([1, 2, 3]), 'application/pdf'), { DB: s.db, UPLOADS: s.r2 });
    expect(res.status).toBe(415);
  });
  it('404 when project does not exist', async () => {
    const s = memState();
    const res = await call(fd('a.pdf', PDF, 'application/pdf'), { DB: s.db, UPLOADS: s.r2 }, 'zzz');
    expect(res.status).toBe(404);
  });
  it('returns 500 when R2 put fails', async () => {
    const s = memState();
    const r2Fail = {
      async put() { throw new Error('R2 unavailable'); },
      async delete() { return; }
    } as unknown as R2Bucket;
    const res = await call(fd('a.pdf', PDF, 'application/pdf'), { DB: s.db, UPLOADS: r2Fail });
    expect(res.status).toBe(500);
    expect(Object.values(s.uploads).length).toBe(0);
  });
});

describe('GET /api/projects/[id]/uploads', () => {
  it('404 when project does not exist', async () => {
    const s = memState();
    const res = await callGet({ DB: s.db, UPLOADS: s.r2 }, 'zzz');
    expect(res.status).toBe(404);
  });
});
