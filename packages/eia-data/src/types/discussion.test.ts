import { describe, it, expect } from 'vitest';
import { dscssBsnsListItemSchema } from './discussion';

describe('dscssBsnsListItemSchema (15142987)', () => {
  it('parses 실 응답 minimal shape', () => {
    const ok = dscssBsnsListItemSchema.safeParse({
      eiaCd: 'YS2025C001',
      eiaSeq: 45329,
      bizNm: '강원평창풍력발전사업',
      ccilOrganNm: '환경부 원주지방환경청',
      rnum: 1,
      stepChangeDt: '2025.06.18'
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.eiaCd).toBe('YS2025C001');
      expect(ok.data.eiaSeq).toBe('45329');
      expect(ok.data.rnum).toBe('1');
    }
  });

  it('coerces eiaSeq number → string', () => {
    const ok = dscssBsnsListItemSchema.safeParse({
      eiaCd: 'YS2025C002',
      eiaSeq: 99,
      bizNm: '풍력'
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.eiaSeq).toBe('99');
  });

  it('missing eiaCd → fail', () => {
    const fail = dscssBsnsListItemSchema.safeParse({ bizNm: '풍력' });
    expect(fail.success).toBe(false);
    if (!fail.success) {
      expect(fail.error.issues[0]?.path).toEqual(['eiaCd']);
    }
  });

  it('missing bizNm → fail', () => {
    const fail = dscssBsnsListItemSchema.safeParse({ eiaCd: 'A-1' });
    expect(fail.success).toBe(false);
    if (!fail.success) {
      expect(fail.error.issues[0]?.path).toEqual(['bizNm']);
    }
  });

  it('allows ccilOrganNm/rnum/stepChangeDt absent', () => {
    const ok = dscssBsnsListItemSchema.safeParse({
      eiaCd: 'X-1',
      bizNm: '풍력단지'
    });
    expect(ok.success).toBe(true);
  });
});
