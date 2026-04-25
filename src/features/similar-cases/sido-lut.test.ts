import { describe, it, expect } from 'vitest';
import { SIDO_LUT, sidoLabel, sidoCode } from './sido-lut';

describe('sido-lut', () => {
  it('has 17 sido entries', () => {
    expect(SIDO_LUT.length).toBe(17);
  });
  it('looks up label/code by short label', () => {
    expect(sidoLabel('강원')).toBe('강원특별자치도');
    expect(sidoCode('강원')).toBe('51');
    expect(sidoCode('서울')).toBe('11');
    expect(sidoCode('제주')).toBe('50');
  });
  it('returns null for unknown', () => {
    expect(sidoLabel('없음')).toBeNull();
    expect(sidoCode('없음')).toBeNull();
  });
});
