import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyTurnstile } from '@/lib/auth/turnstile';

function okFetch(body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })) as unknown as typeof fetch;
}

describe('verifyTurnstile', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns true when Cloudflare responds with { success: true }', async () => {
    vi.stubGlobal('fetch', okFetch({ success: true }));
    await expect(verifyTurnstile('tok', 'secret', '1.2.3.4')).resolves.toBe(true);
  });

  it('returns false when success is the string "true" (shape-narrowing rejects it)', async () => {
    vi.stubGlobal('fetch', okFetch({ success: 'true' }));
    await expect(verifyTurnstile('tok', 'secret', '1.2.3.4')).resolves.toBe(false);
  });

  it('returns false when body is not an object', async () => {
    vi.stubGlobal('fetch', okFetch(null));
    await expect(verifyTurnstile('tok', 'secret', '1.2.3.4')).resolves.toBe(false);
  });

  it('returns false when success field is missing', async () => {
    vi.stubGlobal('fetch', okFetch({}));
    await expect(verifyTurnstile('tok', 'secret', '1.2.3.4')).resolves.toBe(false);
  });

  it('returns false when upstream responds non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      (async () => new Response('err', { status: 502 })) as unknown as typeof fetch
    );
    await expect(verifyTurnstile('tok', 'secret', '1.2.3.4')).resolves.toBe(false);
  });
});
