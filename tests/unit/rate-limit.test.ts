import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recordAttempt, isBlocked } from '@/lib/auth/rate-limit';

function fakeDb() {
  const rows: Array<{ ip: string; ts: string; ok: number }> = [];
  return {
    rows,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.startsWith('INSERT')) {
                rows.push({
                  ip: String(args[0]),
                  ts: new Date().toISOString(),
                  ok: Number(args[1])
                });
              }
              return { success: true };
            },
            async first<T>() {
              if (sql.includes('COUNT')) {
                const ip = String(args[0]);
                const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
                const n = rows.filter((r) => r.ip === ip && r.ok === 0 && r.ts >= since).length;
                return { n } as unknown as T;
              }
              return null;
            }
          };
        }
      };
    }
  } as unknown as D1Database & { rows: Array<{ ip: string; ts: string; ok: number }> };
}

describe('rate-limit', () => {
  beforeEach(() => vi.useRealTimers());
  it('not blocked initially', async () => {
    const db = fakeDb();
    expect(await isBlocked(db, '1.2.3.4')).toBe(false);
  });
  it('blocks after 5 failures in window', async () => {
    const db = fakeDb();
    for (let i = 0; i < 5; i++) await recordAttempt(db, '1.2.3.4', false);
    expect(await isBlocked(db, '1.2.3.4')).toBe(true);
  });
  it('does not block after 4 failures', async () => {
    const db = fakeDb();
    for (let i = 0; i < 4; i++) await recordAttempt(db, '1.2.3.4', false);
    expect(await isBlocked(db, '1.2.3.4')).toBe(false);
  });
  it('successes do not count toward block', async () => {
    const db = fakeDb();
    for (let i = 0; i < 10; i++) await recordAttempt(db, '1.2.3.4', true);
    expect(await isBlocked(db, '1.2.3.4')).toBe(false);
  });
});
