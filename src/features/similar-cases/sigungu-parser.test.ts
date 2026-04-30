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

  // ---- P3 §3(a) sido-only fallback (step 2.7) ----

  it('sido short token substring fallback — "강원풍력 발전단지 건설사업(리파워링)" → 강원도', () => {
    // 운영 D1 ME2022C006. 광역도 short ('강원') 만 등장 + sigungu LUT 미매치
    // → step 2.7 sido fallback. matched_sido 는 legacyLabel ('강원도') 로 sigungu-lut.json 일관.
    const r = deriveRegionFromBizNm('강원풍력 발전단지 건설사업(리파워링)');
    expect(r.matched_sido).toBe('강원도');
    expect(r.matched_sigungu).toBeNull();
    expect(r.matched_token).toBe('강원');
    expect(r.sidoCode).toBe('51');
  });

  it('sido short token 부재 — "풍백 풍력발전단지" NULL 유지 (landmark-only, Option A scope 외)', () => {
    // 광역시/시군구/광역도 토큰 모두 부재. landmark LUT 미구현 (별도 P3).
    const r = deriveRegionFromBizNm('풍백 풍력발전단지 조성사업');
    expect(r.matched_sido).toBeNull();
    expect(r.matched_sigungu).toBeNull();
    expect(r.matched_token).toBeNull();
  });

  it('priority — sigungu LUT substring 우선, sido short fallback 무관 ("강원도 강릉 풍력")', () => {
    // step 2.5 sigungu substring ('강릉') 가 step 2.7 sido short ('강원') 보다 우선.
    const r = deriveRegionFromBizNm('강원도 강릉 풍력');
    expect(r.matched_sido).toBe('강원도');
    expect(r.matched_sigungu).toBe('강릉시');
    expect(r.matched_token).toBe('강릉');
    expect(r.sidoCode).toBe('51');
  });

  it('priority — METRO 우선, sido short fallback 무관 ("광주 풍력")', () => {
    // step 1 METRO 가 step 2.7 (SIDO_LUT '광주' 도 존재) 보다 먼저 매치.
    const r = deriveRegionFromBizNm('광주 풍력 시범');
    expect(r.matched_sido).toBe('광주');
    expect(r.matched_sigungu).toBeNull();
    expect(r.matched_token).toBe('광주');
  });

  // ---- LUT 19 entry 확장 (강원 4 + 경북 3 + 전남 4 + 제주 2) ----
  // 신규 13 entry 의 step 2.5 어근 substring fallback 검증. 미래 신규 풍력 사업
  // 인덱싱 시 region 매칭률 향상 (60% → 추정 90%).

  it('태백 substring — "태백 매봉산풍력단지"', () => {
    const r = deriveRegionFromBizNm('태백 매봉산풍력단지');
    expect(r.matched_sido).toBe('강원도');
    expect(r.matched_sigungu).toBe('태백시');
    expect(r.matched_token).toBe('태백');
    expect(r.sidoCode).toBe('51');
  });

  it('평창 substring — "평창 대관령풍력"', () => {
    const r = deriveRegionFromBizNm('평창 대관령풍력');
    expect(r.matched_sido).toBe('강원도');
    expect(r.matched_sigungu).toBe('평창군');
    expect(r.matched_token).toBe('평창');
    expect(r.sidoCode).toBe('51');
  });

  it('정선 substring — "정선 OO풍력단지"', () => {
    const r = deriveRegionFromBizNm('정선 OO풍력단지');
    expect(r.matched_sido).toBe('강원도');
    expect(r.matched_sigungu).toBe('정선군');
    expect(r.matched_token).toBe('정선');
    expect(r.sidoCode).toBe('51');
  });

  it('영월 substring — "영월풍력단지"', () => {
    const r = deriveRegionFromBizNm('영월풍력단지');
    expect(r.matched_sido).toBe('강원도');
    expect(r.matched_sigungu).toBe('영월군');
    expect(r.matched_token).toBe('영월');
    expect(r.sidoCode).toBe('51');
  });

  it('영덕 substring — "영덕 풍력발전단지"', () => {
    const r = deriveRegionFromBizNm('영덕 풍력발전단지');
    expect(r.matched_sido).toBe('경상북도');
    expect(r.matched_sigungu).toBe('영덕군');
    expect(r.matched_token).toBe('영덕');
    expect(r.sidoCode).toBe('47');
  });

  it('포항 substring — "포항 OO풍력"', () => {
    const r = deriveRegionFromBizNm('포항 OO풍력');
    expect(r.matched_sido).toBe('경상북도');
    expect(r.matched_sigungu).toBe('포항시');
    expect(r.matched_token).toBe('포항');
    expect(r.sidoCode).toBe('47');
  });

  it('울진 substring — "울진풍력단지"', () => {
    const r = deriveRegionFromBizNm('울진풍력단지');
    expect(r.matched_sido).toBe('경상북도');
    expect(r.matched_sigungu).toBe('울진군');
    expect(r.matched_token).toBe('울진');
    expect(r.sidoCode).toBe('47');
  });

  it('영광 substring — "영광 백수풍력"', () => {
    const r = deriveRegionFromBizNm('영광 백수풍력');
    expect(r.matched_sido).toBe('전라남도');
    expect(r.matched_sigungu).toBe('영광군');
    expect(r.matched_token).toBe('영광');
    expect(r.sidoCode).toBe('46');
  });

  it('완도 substring — "완도 OO풍력"', () => {
    const r = deriveRegionFromBizNm('완도 OO풍력');
    expect(r.matched_sido).toBe('전라남도');
    expect(r.matched_sigungu).toBe('완도군');
    expect(r.matched_token).toBe('완도');
    expect(r.sidoCode).toBe('46');
  });

  it('신안 substring — "신안 자은풍력"', () => {
    const r = deriveRegionFromBizNm('신안 자은풍력');
    expect(r.matched_sido).toBe('전라남도');
    expect(r.matched_sigungu).toBe('신안군');
    expect(r.matched_token).toBe('신안');
    expect(r.sidoCode).toBe('46');
  });

  it('진도 substring — "진도 OO풍력"', () => {
    const r = deriveRegionFromBizNm('진도 OO풍력');
    expect(r.matched_sido).toBe('전라남도');
    expect(r.matched_sigungu).toBe('진도군');
    expect(r.matched_token).toBe('진도');
    expect(r.sidoCode).toBe('46');
  });

  it('서귀포 substring — "서귀포 OO풍력"', () => {
    const r = deriveRegionFromBizNm('서귀포 OO풍력');
    expect(r.matched_sido).toBe('제주도');
    expect(r.matched_sigungu).toBe('서귀포시');
    expect(r.matched_token).toBe('서귀포');
    expect(r.sidoCode).toBe('50');
  });

  it('제주 substring — "제주 OO풍력"', () => {
    const r = deriveRegionFromBizNm('제주 OO풍력');
    expect(r.matched_sido).toBe('제주도');
    expect(r.matched_sigungu).toBe('제주시');
    expect(r.matched_token).toBe('제주');
    expect(r.sidoCode).toBe('50');
  });

  // ---- 보강 1: 서귀포/제주 step 2.5 우선순위 ----

  it('priority — 서귀포 stem 이 제주 stem 보다 먼저 매치 ("제주특별자치도 서귀포 OO풍력")', () => {
    // bizNm 에 "제주" + "서귀포" 둘 다 substring 등장. step 2 SIGUNGU_TOKEN 미매치
    // ("특별자치도" 의 도 suffix 제외, "서귀포" 단독은 시 suffix 없음).
    // → step 2.5 substring 매치 시 sigungu-lut.json 의 keys 순서 (서귀포 → 제주) 가
    // priority 보장. 서귀포 가 더 specific 한 매치이므로 먼저 와야 함.
    const r = deriveRegionFromBizNm('제주특별자치도 서귀포 OO풍력');
    expect(r.matched_sido).toBe('제주도');
    expect(r.matched_sigungu).toBe('서귀포시');
    expect(r.matched_token).toBe('서귀포');
    expect(r.sidoCode).toBe('50');
  });
});
