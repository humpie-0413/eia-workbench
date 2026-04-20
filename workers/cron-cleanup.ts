import { CRON_HARD_DELETE_ROW_CEILING } from '@/lib/constants';

type Alert = (e: Record<string, unknown>) => void;

export async function runCleanup(env: Env, alert: Alert): Promise<void> {
  const pCount =
    (
      await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
      ).first<{ n: number }>()
    )?.n ?? 0;
  const uCount =
    (
      await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM uploads WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
      ).first<{ n: number }>()
    )?.n ?? 0;
  const total = pCount + uCount;
  if (total > CRON_HARD_DELETE_ROW_CEILING) {
    alert({ level: 'error', reason: 'cron_row_ceiling_exceeded', total });
    return;
  }

  const dueKeys = await env.DB.prepare(
    `SELECT r2_key FROM uploads WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
  ).all<{ r2_key: string }>();
  for (const row of dueKeys.results ?? []) {
    await env.UPLOADS.delete(row.r2_key).catch(() => undefined);
  }

  await env.DB.prepare(
    `DELETE FROM uploads WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
  ).run();
  await env.DB.prepare(
    `DELETE FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')`
  ).run();
  await env.DB.prepare(
    `DELETE FROM login_attempts WHERE ts < datetime('now','-30 days')`
  ).run();
}

export default {
  async scheduled(_event: ScheduledController, env: Env) {
    await runCleanup(env, (e) => console.log(JSON.stringify(e)));
  }
};
