import { describe, it, expect } from 'vitest';
import { isOnshoreWindCandidate, classifyOnshoreWind } from './wind-filter';

describe('isOnshoreWindCandidate', () => {
  it('accepts bizGubunCd C + bizNm 풍력', () => {
    expect(isOnshoreWindCandidate({ bizGubunCd: 'C', bizNm: '강원평창풍력발전사업' })).toBe(true);
  });
  it('accepts bizGubunCd L + 풍력발전', () => {
    expect(isOnshoreWindCandidate({ bizGubunCd: 'L', bizNm: '영월새푸른풍력발전' })).toBe(true);
  });
  it('rejects 해상풍력', () => {
    expect(isOnshoreWindCandidate({ bizGubunCd: 'C', bizNm: '서남해 해상풍력' })).toBe(false);
    expect(isOnshoreWindCandidate({ bizGubunCd: 'C', bizNm: '해상 풍력 단지' })).toBe(false);
  });
  it('rejects unrelated bizNm even with C/L', () => {
    expect(isOnshoreWindCandidate({ bizGubunCd: 'C', bizNm: '태양광발전' })).toBe(false);
  });
  it('rejects bizGubunCd outside C/L', () => {
    expect(isOnshoreWindCandidate({ bizGubunCd: 'A', bizNm: '풍력' })).toBe(false);
  });
});

describe('classifyOnshoreWind (진단용 reason 분류)', () => {
  it("'ok' for C + 풍력", () => {
    expect(classifyOnshoreWind({ bizGubunCd: 'C', bizNm: '강원평창풍력발전사업' })).toBe('ok');
  });
  it("'gubn_invalid' for non-C/L bizGubunCd", () => {
    expect(classifyOnshoreWind({ bizGubunCd: 'A', bizNm: '풍력' })).toBe('gubn_invalid');
    expect(classifyOnshoreWind({ bizGubunCd: '', bizNm: '풍력' })).toBe('gubn_invalid');
  });
  it("'offshore' for 해상풍력 even with valid gubn", () => {
    expect(classifyOnshoreWind({ bizGubunCd: 'C', bizNm: '서남해 해상풍력' })).toBe('offshore');
    expect(classifyOnshoreWind({ bizGubunCd: 'L', bizNm: '해상 풍력' })).toBe('offshore');
  });
  it("'not_wind_keyword' when bizNm has no 풍력", () => {
    expect(classifyOnshoreWind({ bizGubunCd: 'C', bizNm: '태양광발전' })).toBe('not_wind_keyword');
  });
});
