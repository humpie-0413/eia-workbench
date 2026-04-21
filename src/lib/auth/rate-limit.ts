import { LOGIN_FAIL_MAX, LOGIN_FAIL_WINDOW_MINUTES } from '../constants';

export async function recordAttempt(db: D1Database, ip: string, ok: boolean): Promise<void> {
  await db
    .prepare('INSERT INTO login_attempts (ip, ok) VALUES (?, ?)')
    .bind(ip, ok ? 1 : 0)
    .run();
}

export async function isBlocked(db: D1Database, ip: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM login_attempts
       WHERE ip = ? AND ok = 0 AND ts >= datetime('now', ?)`
    )
    .bind(ip, `-${LOGIN_FAIL_WINDOW_MINUTES} minutes`)
    .first<{ n: number }>();
  return (row?.n ?? 0) >= LOGIN_FAIL_MAX;
}
