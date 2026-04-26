import { describe, it, expect } from 'vitest';
import { eiassProjectUrl } from './deep-link';

describe('eiassProjectUrl', () => {
  it('builds searchListNew.do URL with BIZ_CD param', () => {
    const url = eiassProjectUrl('WJ2020A001');
    expect(url).toBe(
      'https://www.eiass.go.kr/biz/base/info/searchListNew.do?menu=biz&sKey=BIZ_CD&sVal=WJ2020A001'
    );
  });

  it('always points to eiass.go.kr host', () => {
    const url = eiassProjectUrl('YS2025C001');
    expect(url.startsWith('https://www.eiass.go.kr/')).toBe(true);
  });

  it('uses /biz/base/info/searchListNew.do path (not /proj/view.do)', () => {
    const url = eiassProjectUrl('A-1');
    expect(url).toContain('/biz/base/info/searchListNew.do');
    expect(url).not.toContain('/proj/view.do');
  });

  it('passes eiaCd through encodeURIComponent for special chars', () => {
    const url = eiassProjectUrl('AB&CD=1');
    expect(url).toContain('sVal=AB%26CD%3D1');
  });

  it('preserves alphanumeric eiaCd unchanged after encode', () => {
    const url = eiassProjectUrl('YS2025C001');
    expect(url).toContain('sVal=YS2025C001');
  });
});
