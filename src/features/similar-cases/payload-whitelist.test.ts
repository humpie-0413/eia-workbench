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
