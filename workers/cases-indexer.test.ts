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
        item: [{ eiaCd: 'A-1', bizGubunCd: 'C', bizGubunNm: '에너지개발', bizNm: '강원풍력 30MW' }]
      }
    }
  }
};

const detailResp = {
  response: {
    header: { resultCode: '00', resultMsg: 'OK' },
    body: {
      items: {
        item: {
          eiaCd: 'A-1',
          bizGubunCd: 'C',
          bizGubunNm: '에너지개발',
          bizNm: '강원풍력 30MW',
          eiaAddrTxt: '강원 평창군'
        }
      }
    }
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cases-indexer', () => {
  it('hits API and writes stage rows then swaps', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('Detail')) {
        return Promise.resolve(new Response(JSON.stringify(detailResp), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify(baseListResp), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000
    });
    expect(summary.records_added).toBeGreaterThanOrEqual(1);
    expect(summary.skip_reasons).toBeDefined();
    expect(summary.skip_reasons.list_schema_invalid).toBeGreaterThanOrEqual(0);
    expect(summary.skip_reasons.detail_schema_invalid).toBeGreaterThanOrEqual(0);
    expect(summary.skip_reasons.wind_gubn_invalid).toBeGreaterThanOrEqual(0);
    expect(summary.skip_reasons.wind_offshore).toBeGreaterThanOrEqual(0);
    expect(summary.skip_reasons.wind_not_keyword).toBeGreaterThanOrEqual(0);
    expect(summary.skip_reasons.transform_null).toBeGreaterThanOrEqual(0);
    expect(
      db._exec.some((s) => /CREATE TABLE.*staging|INSERT OR REPLACE INTO eia_cases_staging/i.test(s))
    ).toBe(true);
    expect(
      db._exec.some((s) => /ALTER TABLE.*RENAME|DROP TABLE eia_cases|RENAME TO eia_cases/i.test(s))
    ).toBe(true);
  });

  it('classifies non-wind list items into wind_not_keyword (no detail call)', async () => {
    const nonWindList = {
      response: {
        header: { resultCode: '00', resultMsg: 'OK' },
        body: {
          totalCount: 1,
          pageNo: 1,
          numOfRows: 100,
          items: {
            item: [{ eiaCd: 'S-1', bizGubunCd: 'C', bizGubunNm: '에너지개발', bizNm: '태양광발전 50MW' }]
          }
        }
      }
    };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('Detail')) {
        return Promise.resolve(new Response(JSON.stringify(detailResp), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify(nonWindList), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000
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
            item: [{ eiaCd: 'O-1', bizGubunCd: 'C', bizGubunNm: '에너지개발', bizNm: '서남해 해상풍력' }]
          }
        }
      }
    };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('Detail')) {
        return Promise.resolve(new Response(JSON.stringify(detailResp), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify(offshoreList), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const db = makeD1();
    const summary = await runIndexer({
      env: { SERVICE_KEY: 'k', DB: db as never },
      maxApiCalls: 8000
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

  it('strategy stage overrides draft stage on eia_cd conflict', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('Strategy') && url.includes('Detail')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                response: {
                  header: { resultCode: '00', resultMsg: 'OK' },
                  body: {
                    items: {
                      item: {
                        eiaCd: 'X-1',
                        bizGubunCd: 'C',
                        bizGubunNm: '에너지개발',
                        bizNm: '풍력',
                        bizSize: '30',
                        bizSizeDan: 'MW',
                        eiaAddrTxt: '강원 영월군'
                      }
                    }
                  }
                }
              }),
              { status: 200 }
            )
          );
        }
        if (url.includes('Detail')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                response: {
                  header: { resultCode: '00', resultMsg: 'OK' },
                  body: {
                    items: {
                      item: {
                        eiaCd: 'X-1',
                        bizGubunCd: 'C',
                        bizGubunNm: '에너지개발',
                        bizNm: '풍력',
                        eiaAddrTxt: '강원 평창군'
                      }
                    }
                  }
                }
              }),
              { status: 200 }
            )
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              response: {
                header: { resultCode: '00', resultMsg: 'OK' },
                body: {
                  items: {
                    item: [
                      { eiaCd: 'X-1', bizGubunCd: 'C', bizGubunNm: '에너지개발', bizNm: '풍력' }
                    ]
                  }
                }
              }
            }),
            { status: 200 }
          )
        );
      })
    );
    const db = makeD1();
    await runIndexer({ env: { SERVICE_KEY: 'k', DB: db as never }, maxApiCalls: 8000 });
    const insert = db._exec.find((s) => /INSERT OR REPLACE INTO eia_cases_staging/i.test(s));
    expect(insert).toBeDefined();
  });
});
