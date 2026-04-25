import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from '../../src/pages/api/cases/index';

function ctx(url: string, opts?: { items?: Array<Record<string, unknown>>; total?: number }) {
  const items = opts?.items ?? [
    {
      eia_cd: 'X-1',
      biz_nm: '강원풍력',
      industry: 'onshore_wind',
      evaluation_stage: '본안'
    }
  ];
  const total = opts?.total ?? items.length;
  const env = {
    DB: {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: items }),
          first: async () => ({ n: total })
        })
      })
    }
  };
  return { request: new Request(url), locals: { runtime: { env } } } as never;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/cases', () => {
  it('returns 200 + items for valid query', async () => {
    const res = await GET(ctx('https://x/api/cases?sido=강원&page=1'));
    expect(res.status).toBe(200);
    const j = (await res.json()) as { total: number; items: Array<{ eia_cd: string }> };
    expect(j.total).toBe(1);
    expect(j.items[0]!.eia_cd).toBe('X-1');
  });

  it('returns 400 on schema fail (unknown capacity_band)', async () => {
    const res = await GET(ctx('https://x/api/cases?capacity_band=weird'));
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe('invalid_query');
  });

  it('returns 400 when q exceeds 80 chars', async () => {
    const longQ = 'a'.repeat(81);
    const res = await GET(ctx(`https://x/api/cases?q=${longQ}`));
    expect(res.status).toBe(400);
  });

  it('does not log query string (Q7 — search 텀 비기록)', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await GET(ctx('https://x/api/cases?q=secret-search-term'));
    for (const call of spy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('secret-search-term');
    }
  });

  it('sets Cache-Control: public, max-age=300', async () => {
    const res = await GET(ctx('https://x/api/cases?sido=강원'));
    expect(res.headers.get('Cache-Control')).toMatch(/max-age=300/);
  });

  it('coerces multiple sido params into array', async () => {
    const res = await GET(ctx('https://x/api/cases?sido=강원&sido=전남'));
    expect(res.status).toBe(200);
  });

  it('returns total=0 + empty items when DB has nothing', async () => {
    const res = await GET(ctx('https://x/api/cases', { items: [], total: 0 }));
    expect(res.status).toBe(200);
    const j = (await res.json()) as { total: number; items: unknown[] };
    expect(j.total).toBe(0);
    expect(j.items).toEqual([]);
  });
});
