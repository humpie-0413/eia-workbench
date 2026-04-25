import { describe, it, expect } from 'vitest';
import { GET } from '../../src/pages/api/cases/[caseId]';

function ctx(eiaCd: string | undefined, found: boolean) {
  const row = found ? { eia_cd: eiaCd, biz_nm: 'X' } : null;
  return {
    params: { caseId: eiaCd },
    locals: {
      runtime: {
        env: {
          DB: {
            prepare: () => ({
              bind: () => ({ first: async () => row })
            })
          }
        }
      }
    }
  } as never;
}

describe('GET /api/cases/[caseId]', () => {
  it('200 when found', async () => {
    const res = await GET(ctx('X-1', true));
    expect(res.status).toBe(200);
    const j = (await res.json()) as { eia_cd: string };
    expect(j.eia_cd).toBe('X-1');
    expect(res.headers.get('Cache-Control')).toMatch(/max-age=300/);
  });

  it('404 when missing', async () => {
    const res = await GET(ctx('Z-9', false));
    expect(res.status).toBe(404);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe('not_found');
  });

  it('400 when caseId param missing', async () => {
    const res = await GET(ctx(undefined, false));
    expect(res.status).toBe(400);
  });
});
