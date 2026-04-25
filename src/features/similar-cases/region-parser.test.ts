import { describe, it, expect } from 'vitest';
import { parseRegion } from './region-parser';

describe('parseRegion', () => {
  it('parses 강원특별자치도 평창군', () => {
    expect(parseRegion('강원특별자치도 평창군 봉평면')).toEqual({
      sido: '강원',
      sidoLabel: '강원특별자치도',
      sidoCode: '51',
      sigungu: '평창군'
    });
  });
  it('parses short prefix 강원 평창군', () => {
    const r = parseRegion('강원 평창군 일원');
    expect(r.sido).toBe('강원');
    expect(r.sigungu).toBe('평창군');
  });
  it('multi-region picks first sido', () => {
    const r = parseRegion('강원 평창군 외 1');
    expect(r.sido).toBe('강원');
  });
  it('returns nulls when not parsable', () => {
    expect(parseRegion('알 수 없는 지역')).toEqual({
      sido: null, sidoLabel: null, sidoCode: null, sigungu: null
    });
  });
});
