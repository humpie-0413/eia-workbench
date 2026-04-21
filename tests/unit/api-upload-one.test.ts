import { describe, it, expect } from 'vitest';
import type { APIContext } from 'astro';
import type { D1Database } from '@cloudflare/workers-types';

interface UploadRow {
  id: string;
  project_id: string;
  r2_key: string;
  deleted_at: string | null;
}

function memState() {
  const uploads: Record<string, UploadRow> = {
    u1: { id: 'u1', project_id: 'p1', r2_key: 'projects/p1/abc', deleted_at: null }
  };
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.includes('UPDATE uploads SET deleted_at = datetime')) {
                const uploadId = String(args[0]);
                if (uploads[uploadId]) uploads[uploadId].deleted_at = 'now';
              }
              if (sql.includes('UPDATE uploads SET deleted_at = NULL')) {
                const uploadId = String(args[0]);
                if (uploads[uploadId]) uploads[uploadId].deleted_at = null;
              }
              return { success: true };
            },
            async first<T>() {
              const uploadId = String(args[0]);
              return uploads[uploadId] as unknown as T;
            }
          };
        }
      };
    }
  } as unknown as D1Database;
  return { db, uploads };
}

async function callDelete(uploadId: string, db: D1Database) {
  const { DELETE } = await import('@/pages/api/projects/[id]/uploads/[uploadId]/index');
  return DELETE({
    request: new Request(`http://x/api/projects/p1/uploads/${uploadId}`, {
      method: 'DELETE',
      headers: { origin: 'http://localhost:3000' }
    }),
    params: { id: 'p1', uploadId },
    locals: { runtime: { env: { DB: db } }, session: { jti: 'j' } }
  } as unknown as APIContext);
}

async function callRestore(uploadId: string, db: D1Database) {
  const { PATCH } = await import('@/pages/api/projects/[id]/uploads/[uploadId]/restore');
  return PATCH({
    request: new Request(`http://x/api/projects/p1/uploads/${uploadId}/restore`, {
      method: 'PATCH',
      headers: { origin: 'http://localhost:3000' }
    }),
    params: { id: 'p1', uploadId },
    locals: { runtime: { env: { DB: db } }, session: { jti: 'j' } }
  } as unknown as APIContext);
}

describe('DELETE /api/projects/[id]/uploads/[uploadId]', () => {
  it('soft-deletes upload', async () => {
    const s = memState();
    const res = await callDelete('u1', s.db);
    expect(res.status).toBe(204);
    const u1 = s.uploads.u1;
    if (u1 === undefined) throw new Error('upload not found');
    expect(u1.deleted_at).toBeTruthy();
  });
});

describe('PATCH /api/projects/[id]/uploads/[uploadId]/restore', () => {
  it('clears deleted_at', async () => {
    const s = memState();
    const u1 = s.uploads.u1;
    if (u1 === undefined) throw new Error('upload not found');
    u1.deleted_at = 'x';
    const res = await callRestore('u1', s.db);
    expect(res.status).toBe(204);
    expect(u1.deleted_at).toBe(null);
  });
});
