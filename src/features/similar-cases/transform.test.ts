import { describe, it, expect } from 'vitest';
import { transformItem, type TransformedRow } from './transform';

const baseList = {
  eiaCd: 'X-1', bizGubunCd: 'C', bizGubunNm: '에너지개발',
  bizNm: '강원평창풍력발전사업 30MW', drfopTmdt: '2024-01-15 ~ 2024-02-14'
};
const baseDetail = { ...baseList, eiaAddrTxt: '강원특별자치도 평창군 봉평면', drfopStartDt: '2024-01-15', drfopEndDt: '2024-02-14' };

describe('transformItem', () => {
  it('returns null when not onshore wind', () => {
    expect(transformItem({ stage: 'draft', list: { ...baseList, bizNm: '태양광발전' }, detail: { ...baseDetail, bizNm: '태양광발전' } })).toBeNull();
  });

  it('extracts capacity from bizNm regex when bizSize 없음', () => {
    const r = transformItem({ stage: 'draft', list: baseList, detail: baseDetail }) as TransformedRow;
    expect(r.industry).toBe('onshore_wind');
    expect(r.capacity_mw).toBe(30);
    expect(r.area_ha).toBeNull();
    expect(r.evaluation_year).toBe(2024);
    expect(r.evaluation_stage).toBe('본안');
    expect(r.region_sido).toBe('강원');
    expect(r.region_sido_code).toBe('51');
    expect(r.region_sigungu).toBe('평창군');
  });

  it('strategy: bizSize MW + bizSizeDan ha 복합 추출', () => {
    const list = { ...baseList, bizNm: '영월새푸른풍력' };
    const detail = { ...list, eiaAddrTxt: '강원 영월군', bizSize: '21', bizSizeDan: 'MW' };
    const r = transformItem({ stage: 'strategy', list, detail }) as TransformedRow;
    expect(r.capacity_mw).toBe(21);
    expect(r.evaluation_stage).toBe('전략');
  });

  it('bizSizeDan ㎡ → area_ha ÷10000', () => {
    const r = transformItem({
      stage: 'strategy',
      list: { ...baseList, bizNm: '풍력단지' },
      detail: { ...baseDetail, bizSize: '500000', bizSizeDan: '㎡' }
    }) as TransformedRow;
    expect(r.area_ha).toBe(50);
    expect(r.capacity_mw).toBeNull();
  });

  it('source_payload omits non-whitelisted fields', () => {
    const r = transformItem({
      stage: 'draft',
      list: baseList,
      detail: { ...baseDetail, drfopBodyText: '본문 ...' as unknown as string }
    }) as TransformedRow;
    const pl = JSON.parse(r.source_payload);
    expect(pl.drfopBodyText).toBeUndefined();
    expect(pl.eiaCd).toBe('X-1');
  });

  it('evaluation_year 미래연도+2 → null', () => {
    const r = transformItem({
      stage: 'draft', list: baseList,
      detail: { ...baseDetail, drfopStartDt: '2099-01-15' }
    }) as TransformedRow;
    expect(r.evaluation_year).toBeNull();
  });
});
