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

describe('PortalClient.buildUrl — _type=json 강제', () => {
  it('_type 미지정 시 _type=json 을 자동 추가한다 (15142998 등 XML default 데이터셋 대응)', () => {
    const client = new PortalClient({ SERVICE_KEY: 'k' });
    const url = client.buildUrl({
      path: '/1480523/EnvrnAffcEvlDraftDsplayInfoInqireService/getDraftPblancDsplayListInfoInqire',
      query: { pageNo: 1, numOfRows: 10 }
    });
    expect(url).toContain('_type=json');
  });

  it('사용자가 query 에 _type 을 명시하면 그 값을 보존한다', () => {
    const client = new PortalClient({ SERVICE_KEY: 'k' });
    const url = client.buildUrl({
      path: '/svc/op',
      query: { _type: 'xml', pageNo: 1 }
    });
    expect(url).toContain('_type=xml');
    expect(url).not.toContain('_type=json');
  });

  it('query 자체가 없을 때도 _type=json 을 추가한다', () => {
    const client = new PortalClient({ SERVICE_KEY: 'k' });
    const url = client.buildUrl({ path: '/svc/op' });
    expect(url).toContain('_type=json');
  });
});
