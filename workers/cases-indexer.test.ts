import { describe, it, expect, vi, afterEach } from 'vitest';
import { runIndexer } from './cases-indexer';

function makeD1() {
  const exec: string[] = [];
  return {
    exec: (sql: string) => {
      exec.push(sql);
      return Promise.resolve({ count: 1, duration: 0 });
    },
    prepare: (sql: string) => ({
      sql,
      bind: (..._args: unknown[]) => ({
        run: async () => {
          exec.push(sql);
          return { meta: {}, success: true };
        },
        first: async () => null,
        all: async () => ({ results: [] })
      })
    }),
    batch: async (stmts: { sql: string }[]) => {
      for (const s of stmts) exec.push(s.sql);
      return stmts.map(() => ({ meta: {}, success: true }));
    },
    _exec: exec
  };
}

const baseListResp = {
  response: {
    header: { resultCode: '00', resultMsg: 'OK' },
    body: {
      totalCount: 1,
      pageNo: 1,
      numOfRows: 100,
      items: {
        item: [
          {
            eiaCd: 'YS2025C001',
            eiaSeq: 45329,
            bizNm: '강원풍력 30MW',
            ccilOrganNm: '환경부 원주지방환경청',
            rnum: 1,
            stepChangeDt: '2025.06.18'
          }
        ]
      }
    }
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cases-indexer (15142987 discussion list)', () => {
  it('hits API and writes stage rows then swaps', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(baseListResp), { status: 200 }))
      );
    vi.stubGlobal('fetch', fetchMock);
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000,
      maxPagesPerQuery: 1
    });
    expect(summary.records_added).toBeGreaterThanOrEqual(1);
    expect(summary.skip_reasons).toBeDefined();
    expect(summary.skip_reasons.list_schema_invalid).toBeGreaterThanOrEqual(0);
    expect(summary.skip_reasons.wind_offshore).toBeGreaterThanOrEqual(0);
    expect(summary.skip_reasons.wind_not_keyword).toBeGreaterThanOrEqual(0);
    expect(summary.skip_reasons.transform_null).toBeGreaterThanOrEqual(0);
    expect(
      db._exec.some((s) =>
        /CREATE TABLE.*staging|INSERT OR REPLACE INTO eia_cases_staging/i.test(s)
      )
    ).toBe(true);
    expect(
      db._exec.some((s) => /ALTER TABLE.*RENAME|DROP TABLE eia_cases|RENAME TO eia_cases/i.test(s))
    ).toBe(true);
  });

  it('classifies non-wind list items into wind_not_keyword', async () => {
    const nonWindList = {
      response: {
        header: { resultCode: '00', resultMsg: 'OK' },
        body: {
          totalCount: 1,
          pageNo: 1,
          numOfRows: 100,
          items: {
            item: [{ eiaCd: 'S-1', eiaSeq: 1, bizNm: '태양광발전 50MW' }]
          }
        }
      }
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(new Response(JSON.stringify(nonWindList), { status: 200 }))
        )
    );
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000,
      maxPagesPerQuery: 1
    });
    expect(summary.skip_reasons.wind_not_keyword).toBeGreaterThanOrEqual(1);
    expect(summary.records_added).toBe(0);
  });

  it('classifies 해상풍력 list items into wind_offshore', async () => {
    const offshoreList = {
      response: {
        header: { resultCode: '00', resultMsg: 'OK' },
        body: {
          totalCount: 1,
          pageNo: 1,
          numOfRows: 100,
          items: {
            item: [{ eiaCd: 'O-1', eiaSeq: 2, bizNm: '서남해 해상풍력' }]
          }
        }
      }
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(new Response(JSON.stringify(offshoreList), { status: 200 }))
        )
    );
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000,
      maxPagesPerQuery: 1
    });
    expect(summary.skip_reasons.wind_offshore).toBeGreaterThanOrEqual(1);
    expect(summary.records_added).toBe(0);
  });

  it('aborts on api_calls > maxApiCalls', async () => {
    let count = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        count++;
        return Promise.resolve(new Response(JSON.stringify(baseListResp), { status: 200 }));
      })
    );
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 2
    });
    expect(summary.error).toMatch(/api_calls/);
    expect(count).toBeLessThanOrEqual(3);
  });

  it('uses 15142987 dscss list endpoint (no draft/strategy paths)', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        calls.push(url);
        return Promise.resolve(new Response(JSON.stringify(baseListResp), { status: 200 }));
      })
    );
    const db = makeD1();
    await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 4,
      maxPagesPerQuery: 1
    });
    expect(calls.length).toBeGreaterThan(0);
    for (const u of calls) {
      expect(u).toMatch(/EnvrnAffcEvlDscssSttusInfoInqireService/);
      expect(u).toMatch(/getDscssBsnsListInfoInqire/);
      expect(u).not.toMatch(/Draft/);
      expect(u).not.toMatch(/Strategy/);
    }
  });
});

// describe('cases-indexer (15142987 discussion list)') 아래에 새 describe 추가
describe('runIndexer — P1 Ing detail integration', () => {
  function listResp(items: Array<Record<string, unknown>>) {
    return {
      response: {
        header: { resultCode: '00', resultMsg: 'OK' },
        body: { totalCount: items.length, pageNo: 1, numOfRows: 100, items: { item: items } }
      }
    };
  }
  function ingDetailResp(items: Array<Record<string, unknown>>) {
    return {
      response: {
        header: { resultCode: '00', resultMsg: 'OK' },
        body: items.length === 0
          ? { totalCount: 0, items: '' }
          : { totalCount: items.length, items: { item: items } }
      }
    };
  }
  function urlIs(url: string, op: 'list' | 'ingDetail'): boolean {
    if (op === 'list') return /getDscssBsnsListInfoInqire/.test(url);
    return /getDscssSttusDscssIngDetailInfoInqire/.test(url);
  }

  it('Ing detail success → detail_called/success/region_matched 카운트', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const body = urlIs(url, 'list')
        ? listResp([{ eiaCd: 'DG2009L001', bizNm: '영양풍력발전단지', eiaSeq: 1 }])
        : ingDetailResp([{ stateNm: '1차 협의', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }]);
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }));
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000,
      maxPagesPerQuery: 1
    });
    expect(summary.detail_called).toBe(1);
    expect(summary.detail_success).toBe(1);
    expect(summary.region_matched).toBe(1);
  });

  it('Ing detail HTTP fail 1회 → retry → success', async () => {
    let detailAttempt = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (urlIs(url, 'list')) {
        return Promise.resolve(new Response(JSON.stringify(listResp([{ eiaCd: 'X-1', bizNm: '영양풍력' }])), { status: 200 }));
      }
      detailAttempt++;
      if (detailAttempt === 1) {
        return Promise.resolve(new Response('boom', { status: 500 }));
      }
      return Promise.resolve(new Response(JSON.stringify(ingDetailResp([{ stateNm: '협의', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }])), { status: 200 }));
    }));
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000,
      maxPagesPerQuery: 1
    });
    expect(summary.detail_retry).toBe(1);
    expect(summary.detail_success).toBe(1);
  });

  it('Ing detail 모두 fail (retry 후도) → list-only fallback (no error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (urlIs(url, 'list')) {
        return Promise.resolve(new Response(JSON.stringify(listResp([{ eiaCd: 'X-1', bizNm: '영양풍력' }])), { status: 200 }));
      }
      return Promise.resolve(new Response('boom', { status: 500 }));
    }));
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000,
      maxPagesPerQuery: 1
    });
    expect(summary.detail_failed).toBe(1);
    expect(summary.error).toBeNull();
    expect(summary.records_added).toBe(1); // list-only fallback 적재
  });

  it('Ing detail empty items (totalCount=0) → list-only fallback (정상 흐름)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const body = urlIs(url, 'list')
        ? listResp([{ eiaCd: 'X-1', bizNm: '영양풍력' }])
        : ingDetailResp([]);
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }));
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000,
      maxPagesPerQuery: 1
    });
    expect(summary.detail_called).toBe(1);
    expect(summary.detail_success).toBe(1); // empty items 도 success 로 카운트 (정상 흐름)
    expect(summary.records_added).toBe(1);
  });
});
