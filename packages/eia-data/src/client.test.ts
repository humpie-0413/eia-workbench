import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PortalClient } from './client';

const env = { SERVICE_KEY: 'test-key' };

describe('PortalClient.call', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns parsed body for resultCode=00', async () => {
    const json = { response: { header: { resultCode: '00', resultMsg: 'OK' }, body: { items: { item: [{ x: 1 }] } } } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(json), { status: 200 })));
    const client = new PortalClient(env);
    const res = await client.call<{ x: number }>({ path: '/svc/op', query: { type: 'json' } });
    expect(res.response.header.resultCode).toBe('00');
  });

  it('throws on resultCode != 00', async () => {
    const json = { response: { header: { resultCode: '03', resultMsg: 'NO_DATA' } } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(json), { status: 200 })));
    const client = new PortalClient(env);
    await expect(client.call({ path: '/svc/op' })).rejects.toThrow(/03|NO_DATA/);
  });

  it('retries once on 5xx', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('boom', { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ response: { header: { resultCode: '00', resultMsg: 'OK' } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new PortalClient(env, { retries: 1 });
    await client.call({ path: '/svc/op' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('redacts serviceKey from thrown error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 500 })));
    const client = new PortalClient({ SERVICE_KEY: 'SUPER_SECRET' }, { retries: 0 });
    let err: unknown;
    try {
      await client.call({ path: '/svc/op' });
    } catch (e) {
      err = e;
    }
    expect(String(err)).not.toContain('SUPER_SECRET');
  });
});
