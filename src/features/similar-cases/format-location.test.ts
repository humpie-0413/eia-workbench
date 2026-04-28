import { describe, expect, it } from 'vitest';
import { formatLocation } from './format-location';

describe('formatLocation', () => {
  it('returns "{sido} {sigungu}" when both populated (경상북도 영양군)', () => {
    expect(formatLocation({ region_sido: '경상북도', region_sigungu: '영양군' })).toBe(
      '경상북도 영양군'
    );
  });

  it('returns "{sido} {sigungu}" for 강원도 강릉시', () => {
    expect(formatLocation({ region_sido: '강원도', region_sigungu: '강릉시' })).toBe(
      '강원도 강릉시'
    );
  });

  it('returns sido only when sigungu is null (강원도)', () => {
    expect(formatLocation({ region_sido: '강원도', region_sigungu: null })).toBe('강원도');
  });

  it('returns "지역 미상" when both null', () => {
    expect(formatLocation({ region_sido: null, region_sigungu: null })).toBe('지역 미상');
  });
});
