import { describe, it, expect } from 'vitest';
import { caseSearchQuerySchema } from './case-search';

describe('caseSearchQuerySchema', () => {
  it('parses sido + capacity_band + year arrays from query', () => {
    const r = caseSearchQuerySchema.parse({
      q: '강원',
      sido: ['강원', '전남'],
      capacity_band: ['10-50', '50-100'],
      year: ['2024', '2023'],
      page: '2'
    });
    expect(r.sido).toEqual(['강원', '전남']);
    expect(r.capacity_band).toEqual(['10-50', '50-100']);
    expect(r.year).toEqual([2024, 2023]);
    expect(r.page).toBe(2);
    expect(r.pageSize).toBe(50);
  });

  it('rejects unknown capacity_band', () => {
    expect(() => caseSearchQuerySchema.parse({ capacity_band: ['weird'] })).toThrow();
  });

  it('coerces single-value sido into array', () => {
    const r = caseSearchQuerySchema.parse({ sido: '강원' });
    expect(r.sido).toEqual(['강원']);
  });

  it('rejects q longer than 80 chars', () => {
    expect(() => caseSearchQuerySchema.parse({ q: 'a'.repeat(81) })).toThrow();
  });

  it('rejects page out of range', () => {
    expect(() => caseSearchQuerySchema.parse({ page: '0' })).toThrow();
    expect(() => caseSearchQuerySchema.parse({ page: '201' })).toThrow();
  });

  it('rejects pageSize > 50', () => {
    expect(() => caseSearchQuerySchema.parse({ pageSize: '51' })).toThrow();
  });

  it('defaults page=1, pageSize=50 when omitted', () => {
    const r = caseSearchQuerySchema.parse({});
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(50);
  });
});
