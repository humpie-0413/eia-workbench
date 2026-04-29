import { describe, it, expect } from 'vitest';
import { SIDO_LUT, sidoLabel, sidoCode, sidoLegacyLabel } from './sido-lut';

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

  // ---- P3 §3(a) legacyLabel for sido-only fallback ----

  it('sidoLegacyLabel — 광역도는 legacy 풀 라벨 (sigungu-lut.json 일관성)', () => {
    expect(sidoLegacyLabel('강원')).toBe('강원도'); // canonical: '강원특별자치도'
    expect(sidoLegacyLabel('전북')).toBe('전라북도'); // canonical: '전북특별자치도'
    expect(sidoLegacyLabel('제주')).toBe('제주도'); // canonical: '제주특별자치도'
    expect(sidoLegacyLabel('경북')).toBe('경상북도');
  });
  it('sidoLegacyLabel — 광역시는 canonical label 그대로', () => {
    expect(sidoLegacyLabel('서울')).toBe('서울특별시');
    expect(sidoLegacyLabel('세종')).toBe('세종특별자치시');
  });
  it('sidoLegacyLabel — unknown returns null', () => {
    expect(sidoLegacyLabel('없음')).toBeNull();
  });
});
