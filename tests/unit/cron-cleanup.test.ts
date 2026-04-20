import { describe, it, expect } from 'vitest';
import { runCleanup, type CleanupEnv } from '@/../workers/cron-cleanup';

function setup(rowCount: number, r2Keys: string[] = []) {
  const deletes: string[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(..._args: unknown[]) {
          return {
            async first<T>() {
              if (sql.startsWith('SELECT COUNT')) return ({ n: rowCount } as unknown) as T;
              return null;
            },
            async all<T>() {
              if (sql.startsWith('SELECT r2_key')) {
                return { results: r2Keys.map((k) => ({ r2_key: k })) as T[] };
              }
              return { results: [] as T[] };
            },
            async run() {
              if (sql.startsWith('DELETE')) deletes.push(sql);
              return { success: true };
            }
          };
        },
        async first<T>() {
          if (sql.startsWith('SELECT COUNT')) return ({ n: rowCount } as unknown) as T;
          return null;
        },
        async all<T>() {
          if (sql.startsWith('SELECT r2_key')) {
            return { results: r2Keys.map((k) => ({ r2_key: k })) as T[] };
          }
          return { results: [] as T[] };
        },
        async run() {
          if (sql.startsWith('DELETE')) deletes.push(sql);
          return { success: true };
        }
      };
    }
  } as unknown as D1Database;
  const r2Deleted: string[] = [];
  const r2 = { async delete(k: string) { r2Deleted.push(k); } } as unknown as R2Bucket;
  return { db, r2, deletes, r2Deleted };
}

describe('runCleanup', () => {
  it('aborts and alerts when row count exceeds ceiling', async () => {
    const s = setup(1500);
    const logs: unknown[] = [];
    await runCleanup({ DB: s.db, UPLOADS: s.r2 } as unknown as CleanupEnv, (e) => logs.push(e));
    expect(s.deletes.length).toBe(0);
    expect(logs.some((l) => JSON.stringify(l).includes('ceiling'))).toBe(true);
  });
  it('deletes r2 objects then d1 rows', async () => {
    const s = setup(2, ['projects/p1/k1', 'projects/p1/k2']);
    await runCleanup({ DB: s.db, UPLOADS: s.r2 } as unknown as CleanupEnv, () => {});
    expect(s.r2Deleted).toEqual(['projects/p1/k1', 'projects/p1/k2']);
    expect(s.deletes.length).toBeGreaterThanOrEqual(2);
  });
  it('skips r2 delete when no uploads are due', async () => {
    const s = setup(1, []);
    await runCleanup({ DB: s.db, UPLOADS: s.r2 } as unknown as CleanupEnv, () => {});
    expect(s.r2Deleted.length).toBe(0);
  });
});
