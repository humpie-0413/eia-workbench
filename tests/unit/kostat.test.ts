import { describe, it, expect } from 'vitest';
import { loadRegions, isValidRegionCode, isValidSubCode, labelFor } from '@/lib/kostat';

describe('kostat', () => {
  it('loads at least 3 시/도', () => {
    const r = loadRegions();
    expect(r.regions.length).toBeGreaterThanOrEqual(3);
  });
  it('validates region codes', () => {
    expect(isValidRegionCode('42')).toBe(true);
    expect(isValidRegionCode('99')).toBe(false);
  });
  it('validates sub codes within parent', () => {
    expect(isValidSubCode('42', '42750')).toBe(true);
    expect(isValidSubCode('42', '11110')).toBe(false);
    expect(isValidSubCode('99', '11110')).toBe(false);
  });
  it('returns labels', () => {
    expect(labelFor('42')).toBe('강원특별자치도');
    expect(labelFor('42', '42750')).toBe('평창군');
    expect(labelFor('99')).toBe(null);
  });
});
