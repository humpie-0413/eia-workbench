import { describe, it, expect } from 'vitest';
import { runCleanup, type CleanupEnv } from '@/../workers/cron-cleanup';

interface SetupOpts {
  projectsCount?: number;
  uploadsCount?: number;
  scopingRunsCount?: number;
  r2Keys?: string[];
}

function setup(opts: SetupOpts | number = {}, legacyR2Keys: string[] = []) {
  const cfg: SetupOpts =
    typeof opts === 'number'
      ? { projectsCount: opts, uploadsCount: opts, scopingRunsCount: opts, r2Keys: legacyR2Keys }
      : opts;
  const projectsCount = cfg.projectsCount ?? 0;
  const uploadsCount = cfg.uploadsCount ?? 0;
  const scopingRunsCount = cfg.scopingRunsCount ?? 0;
  const r2Keys = cfg.r2Keys ?? [];
  const deletes: string[] = [];

  function countFor(sql: string): number {
    if (sql.includes('FROM projects')) return projectsCount;
    if (sql.includes('FROM uploads')) return uploadsCount;
    if (sql.includes('FROM scoping_runs')) return scopingRunsCount;
    return 0;
  }

  const db = {
    prepare(sql: string) {
      const run = async () => {
        if (sql.startsWith('DELETE')) deletes.push(sql);
        return { success: true };
      };
      const first = async <T>() => {
        if (sql.startsWith('SELECT COUNT')) return { n: countFor(sql) } as unknown as T;
        return null;
      };
      const all = async <T>() => {
        if (sql.startsWith('SELECT r2_key')) {
          return { results: r2Keys.map((k) => ({ r2_key: k })) as T[] };
        }
        return { results: [] as T[] };
      };
      return {
        bind(..._args: unknown[]) {
          return { first, all, run };
        },
        first,
        all,
        run
      };
    }
  } as unknown as D1Database;
  const r2Deleted: string[] = [];
  const r2 = {
    async delete(k: string) {
      r2Deleted.push(k);
    }
  } as unknown as R2Bucket;
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

  it('includes scoping_runs in ceiling total — projects 400 + uploads 400 + scoping_runs 400 exceeds 1000', async () => {
    const s = setup({ projectsCount: 400, uploadsCount: 400, scopingRunsCount: 400 });
    const logs: unknown[] = [];
    await runCleanup({ DB: s.db, UPLOADS: s.r2 } as unknown as CleanupEnv, (e) => logs.push(e));
    expect(s.deletes.length).toBe(0);
    expect(logs.some((l) => JSON.stringify(l).includes('ceiling'))).toBe(true);
  });

  it('hard-deletes scoping_runs older than 30 days', async () => {
    const s = setup({ scopingRunsCount: 5 });
    await runCleanup({ DB: s.db, UPLOADS: s.r2 } as unknown as CleanupEnv, () => {});
    expect(s.deletes.some((d) => /DELETE FROM scoping_runs/.test(d))).toBe(true);
    expect(
      s.deletes.some((d) => /scoping_runs[\s\S]*deleted_at[\s\S]*-30 days/.test(d))
    ).toBe(true);
  });

  it('reports scoping_runs count in success log', async () => {
    const s = setup({ scopingRunsCount: 3 });
    const logs: Array<Record<string, unknown>> = [];
    await runCleanup({ DB: s.db, UPLOADS: s.r2 } as unknown as CleanupEnv, (e) =>
      logs.push(e as Record<string, unknown>)
    );
    const ok = logs.find((l) => l.reason === 'cron_cleanup_ok');
    expect(ok).toBeDefined();
    expect(ok?.scopingRunsCount).toBe(3);
  });
});
