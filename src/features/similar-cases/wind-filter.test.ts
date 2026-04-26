import { describe, it, expect } from 'vitest';
import { isOnshoreWindCandidate, classifyOnshoreWind } from './wind-filter';

describe('isOnshoreWindCandidate (regex-only, 15142987)', () => {
  it('accepts 풍력 in bizNm', () => {
    expect(isOnshoreWindCandidate({ bizNm: '강원평창풍력발전사업' })).toBe(true);
  });
  it('accepts 풍력발전', () => {
    expect(isOnshoreWindCandidate({ bizNm: '영월새푸른풍력발전' })).toBe(true);
  });
  it('rejects 해상풍력', () => {
    expect(isOnshoreWindCandidate({ bizNm: '서남해 해상풍력' })).toBe(false);
    expect(isOnshoreWindCandidate({ bizNm: '해상 풍력 단지' })).toBe(false);
  });
  it('rejects unrelated bizNm', () => {
    expect(isOnshoreWindCandidate({ bizNm: '태양광발전' })).toBe(false);
    expect(isOnshoreWindCandidate({ bizNm: '광역상수도' })).toBe(false);
  });
  it('accepts 5 representative wind variants (실 응답 샘플)', () => {
    expect(isOnshoreWindCandidate({ bizNm: '평창풍력 30MW' })).toBe(true);
    expect(isOnshoreWindCandidate({ bizNm: '영월 새푸른 풍력발전사업' })).toBe(true);
    expect(isOnshoreWindCandidate({ bizNm: '강원풍력단지 조성사업' })).toBe(true);
    expect(isOnshoreWindCandidate({ bizNm: '신안 풍력 발전' })).toBe(true);
    expect(isOnshoreWindCandidate({ bizNm: '제주 어승생 풍력' })).toBe(true);
  });
});

describe('classifyOnshoreWind (진단용 reason 분류)', () => {
  it("'ok' for 풍력", () => {
    expect(classifyOnshoreWind({ bizNm: '강원평창풍력발전사업' })).toBe('ok');
  });
  it("'offshore' for 해상풍력", () => {
    expect(classifyOnshoreWind({ bizNm: '서남해 해상풍력' })).toBe('offshore');
    expect(classifyOnshoreWind({ bizNm: '해상 풍력' })).toBe('offshore');
  });
  it("'not_wind_keyword' when bizNm has no 풍력", () => {
    expect(classifyOnshoreWind({ bizNm: '태양광발전' })).toBe('not_wind_keyword');
  });
});
