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

  it('rejects bizGubunCd outside 1자리 영문', () => {
    const bad = draftListItemSchema.safeParse({
      eiaCd: 'A-2024-001',
      bizGubunCd: 'CC',
      bizGubunNm: '에너지개발',
      bizNm: '강원풍력'
    });
    expect(bad.success).toBe(false);
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
