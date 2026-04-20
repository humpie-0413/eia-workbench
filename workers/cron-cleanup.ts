import { CRON_HARD_DELETE_ROW_CEILING } from '@/lib/constants';

type Alert = (e: Record<string, unknown>) => void;

export type CleanupEnv = { DB: D1Database; UPLOADS: R2Bucket };

export async function runCleanup(env: CleanupEnv, alert: Alert): Promise<void> {
  // Fix 7 (N1): Parallelize the two COUNT queries
  const [pRow, uRow] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
    ).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM uploads WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
    ).first<{ n: number }>(),
  ]);
  const pCount = pRow?.n ?? 0;
  const uCount = uRow?.n ?? 0;

  const total = pCount + uCount;
  if (total > CRON_HARD_DELETE_ROW_CEILING) {
    alert({ level: 'error', reason: 'cron_row_ceiling_exceeded', total });
    return;
  }

  // Fix 1 (B1): Log R2 delete failures instead of silently swallowing
  const dueKeys = await env.DB.prepare(
    `SELECT r2_key FROM uploads WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
  ).all<{ r2_key: string }>();
  for (const row of dueKeys.results ?? []) {
    await env.UPLOADS.delete(row.r2_key).catch((err: unknown) => {
      alert({
        level: 'warn',
        reason: 'r2_delete_failed',
        key: row.r2_key,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // Fix 3 (I2): Per-DELETE try/catch so a single D1 failure doesn't abort the remaining two
  async function runDelete(sql: string, reason: string): Promise<void> {
    try {
      await env.DB.prepare(sql).run();
    } catch (e) {
      alert({
        level: 'error',
        reason,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await runDelete(
    `DELETE FROM uploads WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`,
    'd1_delete_uploads_failed'
  );
  await runDelete(
    `DELETE FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`,
    'd1_delete_projects_failed'
  );
  await runDelete(
    `DELETE FROM login_attempts WHERE ts < datetime('now','-30 days')`,
    'd1_delete_login_attempts_failed'
  );

  // Fix 4 (I3): Success logging at end of runCleanup
  alert({
    level: 'info',
    reason: 'cron_cleanup_ok',
    projectsCount: pCount,
    uploadsCount: uCount,
  });
}

// Fix 6 (I5): Use CleanupEnv in scheduled handler
export default {
  async scheduled(_event: ScheduledController, env: CleanupEnv) {
    await runCleanup(env, (e) => console.log(JSON.stringify(e)));
  },
};
