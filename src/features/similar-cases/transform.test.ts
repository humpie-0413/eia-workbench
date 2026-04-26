import { describe, it, expect } from 'vitest';
import { transformItem, type TransformedRow } from './transform';

const baseList = {
  eiaCd: 'X-1',
  bizGubunNm: '에너지개발',
  bizNm: '강원평창풍력발전사업 30MW',
  drfopTmdt: '2024-01-15 ~ 2024-02-14'
};
const baseDetail = {
  ...baseList,
  eiaAddrTxt: '강원특별자치도 평창군 봉평면',
  drfopStartDt: '2024-01-15',
  drfopEndDt: '2024-02-14'
};

const baseStrategyList = {
  perCd: 'P-1',
  bizSeq: 1,
  bizGubunNm: '에너지개발',
  bizNm: '강원평창풍력발전사업 30MW',
  drfopTmdt: '2024-01-15 ~ 2024-02-14'
};
const baseStrategyDetail = {
  ...baseStrategyList,
  eiaAddrTxt: '강원특별자치도 평창군 봉평면',
  drfopStartDt: '2024-01-15',
  drfopEndDt: '2024-02-14'
};

const queriedC = 'C' as const;

describe('transformItem', () => {
  it('returns null when not onshore wind', () => {
    expect(
      transformItem({
        stage: 'draft',
        queriedBizGubunCd: queriedC,
        list: { ...baseList, bizNm: '태양광발전' },
        detail: { ...baseDetail, bizNm: '태양광발전' }
      })
    ).toBeNull();
  });

  it('extracts capacity from bizNm regex when bizSize 없음', () => {
    const r = transformItem({
      stage: 'draft',
      queriedBizGubunCd: queriedC,
      list: baseList,
      detail: baseDetail
    }) as TransformedRow;
    expect(r.industry).toBe('onshore_wind');
    expect(r.capacity_mw).toBe(30);
    expect(r.area_ha).toBeNull();
    expect(r.evaluation_year).toBe(2024);
    expect(r.evaluation_stage).toBe('본안');
    expect(r.region_sido).toBe('강원');
    expect(r.region_sido_code).toBe('51');
    expect(r.region_sigungu).toBe('평창군');
    expect(r.biz_gubun_cd).toBe('C');
    expect(r.eia_cd).toBe('X-1');
  });

  it('strategy: bizSize MW + bizSizeDan ha 복합 추출 (perCd PK)', () => {
    const list = { ...baseStrategyList, bizNm: '영월새푸른풍력' };
    const detail = { ...list, eiaAddrTxt: '강원 영월군', bizSize: '21', bizSizeDan: 'MW' };
    const r = transformItem({
      stage: 'strategy',
      queriedBizGubunCd: 'L',
      list,
      detail
    }) as TransformedRow;
    expect(r.capacity_mw).toBe(21);
    expect(r.evaluation_stage).toBe('전략');
    expect(r.biz_gubun_cd).toBe('L');
    expect(r.eia_cd).toBe('P-1');
    expect(r.eia_seq).toBe('1');
  });

  it('bizSizeDan ㎡ → area_ha ÷10000', () => {
    const r = transformItem({
      stage: 'draft',
      queriedBizGubunCd: queriedC,
      list: { ...baseList, bizNm: '풍력단지' },
      detail: { ...baseDetail, bizSize: '500000', bizSizeDan: '㎡' }
    }) as TransformedRow;
    expect(r.area_ha).toBe(50);
    expect(r.capacity_mw).toBeNull();
  });

  it('source_payload omits non-whitelisted fields', () => {
    const r = transformItem({
      stage: 'draft',
      queriedBizGubunCd: queriedC,
      list: baseList,
      detail: { ...baseDetail, drfopBodyText: '본문 ...' as unknown as string }
    }) as TransformedRow;
    const pl = JSON.parse(r.source_payload);
    expect(pl.drfopBodyText).toBeUndefined();
    expect(pl.eiaCd).toBe('X-1');
  });

  it('evaluation_year 미래연도+2 → null', () => {
    const r = transformItem({
      stage: 'draft',
      queriedBizGubunCd: queriedC,
      list: baseList,
      detail: { ...baseDetail, drfopStartDt: '2099-01-15' }
    }) as TransformedRow;
    expect(r.evaluation_year).toBeNull();
  });

  it('drfopTmdt with dot separator (실 응답 형식) → year 추출', () => {
    const r = transformItem({
      stage: 'draft',
      queriedBizGubunCd: queriedC,
      list: { ...baseList, drfopTmdt: '2025.06.18 ~ 2025.07.15' },
      detail: { ...baseDetail, drfopStartDt: undefined, drfopTmdt: '2025.06.18 ~ 2025.07.15' }
    }) as TransformedRow;
    expect(r.evaluation_year).toBe(2025);
  });

  it('list 응답에 bizGubunCd 없어도 queriedBizGubunCd로 정상 처리', () => {
    const listNoGubun = { ...baseList } as { bizGubunCd?: string } & typeof baseList;
    delete listNoGubun.bizGubunCd;
    const r = transformItem({
      stage: 'draft',
      queriedBizGubunCd: queriedC,
      list: listNoGubun,
      detail: baseDetail
    }) as TransformedRow;
    expect(r.industry).toBe('onshore_wind');
    expect(r.biz_gubun_cd).toBe('C');
  });

  it('strategy: perCd 없으면 null (transform_null)', () => {
    const r = transformItem({
      stage: 'strategy',
      queriedBizGubunCd: queriedC,
      list: { bizNm: '풍력', bizGubunNm: '에너지개발' },
      detail: { eiaAddrTxt: '강원' }
    });
    expect(r).toBeNull();
  });

  it('strategy: bizGubunNm 누락(실 응답) → 빈 문자열로 복원', () => {
    const r = transformItem({
      stage: 'strategy',
      queriedBizGubunCd: queriedC,
      list: { perCd: 'P-2', bizSeq: 2, bizNm: '강릉풍력' },
      detail: { perCd: 'P-2', eiaAddrTxt: '강원 강릉시' }
    }) as TransformedRow;
    expect(r.eia_cd).toBe('P-2');
    expect(r.biz_gubun_nm).toBe('');
  });

  it('strategy detail merges into list — eiaAddrTxt 우선', () => {
    const r = transformItem({
      stage: 'strategy',
      queriedBizGubunCd: 'L',
      list: { ...baseStrategyList, bizNm: '풍력' },
      detail: { ...baseStrategyDetail, bizNm: '풍력', eiaAddrTxt: '강원 영월군' }
    }) as TransformedRow;
    expect(r.eia_addr_txt).toBe('강원 영월군');
  });
});
