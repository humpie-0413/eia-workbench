import { describe, it, expect } from 'vitest';
import {
  draftListItemSchema,
  draftDetailItemSchema,
  strategyDraftListItemSchema,
  strategyDraftDetailItemSchema
} from './draft-display';

describe('draft-display zod schemas', () => {
  it('parses minimal list item', () => {
    const ok = draftListItemSchema.safeParse({
      eiaCd: 'A-2024-001',
      eiaSeq: '1',
      bizGubunCd: 'C',
      bizGubunNm: '에너지개발',
      bizNm: '강원평창풍력발전사업',
      drfopTmdt: '2024-01-15 ~ 2024-02-14'
    });
    expect(ok.success).toBe(true);
  });

  it('parses item without bizGubunCd (실 응답에 필드 부재)', () => {
    const ok = draftListItemSchema.safeParse({
      eiaCd: 'YS2025C001',
      eiaSeq: 45329,
      bizGubunNm: '에너지개발',
      bizNm: '강원풍력',
      drfopTmdt: '2025.06.18 ~ 2025.07.15'
    });
    expect(ok.success).toBe(true);
  });

  it('coerces eiaSeq number → string', () => {
    const ok = draftListItemSchema.safeParse({
      eiaCd: 'YS2025C001',
      eiaSeq: 45329,
      bizGubunNm: '에너지개발',
      bizNm: '강원풍력'
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.eiaSeq).toBe('45329');
    }
  });

  it('strategy detail allows bizMoney/bizSize/bizSizeDan', () => {
    const ok = strategyDraftDetailItemSchema.safeParse({
      eiaCd: 'B-2024-002',
      bizGubunCd: 'L',
      bizGubunNm: '산지개발',
      bizNm: '영월새푸른풍력',
      bizMoney: 50000000000,
      bizSize: '21',
      bizSizeDan: 'MW',
      eiaAddrTxt: '강원특별자치도 영월군'
    });
    expect(ok.success).toBe(true);
  });

  it('detail items missing required eiaCd → fail', () => {
    expect(draftDetailItemSchema.safeParse({ bizNm: 'X' }).success).toBe(false);
    expect(strategyDraftListItemSchema.safeParse({ bizNm: 'Y' }).success).toBe(false);
  });
});
