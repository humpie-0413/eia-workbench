import { describe, it, expect } from 'vitest';
import { pickPayload } from './payload-whitelist';

describe('pickPayload', () => {
  it('drops non-whitelisted (e.g., 본문 텍스트 유사 필드)', () => {
    const r = pickPayload({
      eiaCd: 'X-1',
      bizNm: 'Y',
      consultOpinionFullText: '주민 의견 본문 ...',
      drfopBodyText: '공람 본문 ...'
    });
    expect(Object.keys(r).sort()).toEqual(['bizNm', 'eiaCd']);
  });
});

describe('payload-whitelist — Ing detail 확장 (P1)', () => {
  it('Ing detail 필드 (stateNm/resReplyDt/applyDt) 화이트리스트 통과', () => {
    const out = pickPayload({
      eiaCd: 'X-1',
      stateNm: '1차 협의',
      resReplyDt: '2024-01-01',
      applyDt: '2024-01-01',
      bizNm: '영양풍력'
    });
    expect(out.stateNm).toBe('1차 협의');
    expect(out.resReplyDt).toBe('2024-01-01');
    expect(out.applyDt).toBe('2024-01-01');
  });

  it('region 매칭 결과 (matched_token/matched_sido/matched_sigungu) 화이트리스트 통과', () => {
    const out = pickPayload({
      eiaCd: 'X-1',
      bizNm: '영양풍력',
      matched_token: '영양',
      matched_sido: '경상북도',
      matched_sigungu: '영양군'
    });
    expect(out.matched_token).toBe('영양');
    expect(out.matched_sido).toBe('경상북도');
    expect(out.matched_sigungu).toBe('영양군');
  });

  it('PII 필드 (ccilMemEmail/ccilMemNm) 화이트리스트 미통과 (BLOCKING)', () => {
    const out = pickPayload({
      eiaCd: 'X-1',
      bizNm: '영양풍력',
      ccilMemEmail: 'leak@example.com',
      ccilMemNm: '홍길동'
    });
    expect(out.ccilMemEmail).toBeUndefined();
    expect(out.ccilMemNm).toBeUndefined();
  });
});
