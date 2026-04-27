// src/features/similar-cases/sigungu-parser.test.ts
import { describe, it, expect } from 'vitest';
import { deriveRegionFromBizNm } from './sigungu-parser';

describe('deriveRegionFromBizNm', () => {
  it('returns null result when no region token', () => {
    const r = deriveRegionFromBizNm('영양풍력단지'.replace('영양', '연천')); // '연천풍력단지' (LUT 미등록)
    expect(r.matched_sido).toBeNull();
    expect(r.matched_sigungu).toBeNull();
    expect(r.matched_token).toBeNull();
  });

  it('matches sigungu LUT entry from bizNm 어근', () => {
    const r = deriveRegionFromBizNm('영양풍력발전단지');
    expect(r.matched_sido).toBe('경상북도');
    expect(r.matched_sigungu).toBe('영양군');
    expect(r.matched_token).toBe('영양');
    expect(r.sidoCode).toBe('47');
  });

  it('matches with explicit 군 suffix in bizNm', () => {
    const r = deriveRegionFromBizNm('의성군 황학산 풍력');
    expect(r.matched_sigungu).toBe('의성군');
    expect(r.matched_sido).toBe('경상북도');
  });

  it('광역시 우선 — 광역시 토큰이 시·군·구 LUT 보다 우선', () => {
    const r = deriveRegionFromBizNm('서울특별시 강서구 풍력 영양 시범');
    expect(r.matched_sido).toBe('서울');
    expect(r.matched_sigungu).toBeNull();
    expect(r.matched_token).toBe('서울');
  });

  it('어두/어말 경계 — "광주광역시" 의 "광주" 만 광역시 매치', () => {
    const r = deriveRegionFromBizNm('광주광역시 풍력 시범');
    expect(r.matched_sido).toBe('광주');
  });

  it('multiple sigungu tokens — first match only', () => {
    const r = deriveRegionFromBizNm('의성 청송 풍력');
    expect(r.matched_token).toBe('의성');
    expect(r.matched_sigungu).toBe('의성군');
  });

  it('LUT 미등록 토큰은 무시, 다음 토큰 시도', () => {
    const r = deriveRegionFromBizNm('연천 영양 풍력'); // 연천 미등록 → 영양 LUT 매치
    expect(r.matched_token).toBe('영양');
  });

  it('어근-only 운영 데이터 패턴 — "강릉 안인풍력발전사업" (cases-2026-04-26.md)', () => {
    // suffix 없이 공백 + 부사업명 결합. SIGUNGU_TOKEN regex 미매치 → step 2.5 substring fallback.
    const r = deriveRegionFromBizNm('강릉 안인풍력발전사업');
    expect(r.matched_sido).toBe('강원도');
    expect(r.matched_sigungu).toBe('강릉시');
    expect(r.matched_token).toBe('강릉');
    expect(r.sidoCode).toBe('51');
  });
});
