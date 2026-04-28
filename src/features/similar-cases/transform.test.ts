import { describe, it, expect } from 'vitest';
import { transformItem, transformDscssItem, type TransformedRow } from './transform';

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

describe('transformDscssItem (15142987 list-only)', () => {
  it('returns null when bizNm is not onshore wind', () => {
    expect(
      transformDscssItem({
        list: { eiaCd: 'X-1', bizNm: '태양광발전' }
      })
    ).toBeNull();
  });

  it('returns null when bizNm is 해상풍력', () => {
    expect(
      transformDscssItem({
        list: { eiaCd: 'X-1', bizNm: '서남해 해상풍력' }
      })
    ).toBeNull();
  });

  it('extracts capacity from bizNm regex (list-only, no detail)', () => {
    const r = transformDscssItem({
      list: {
        eiaCd: 'YS2025C001',
        eiaSeq: 45329,
        bizNm: '강원평창풍력 30MW',
        ccilOrganNm: '환경부 원주지방환경청',
        stepChangeDt: '2025.06.18'
      }
    }) as TransformedRow;
    expect(r.industry).toBe('onshore_wind');
    expect(r.eia_cd).toBe('YS2025C001');
    expect(r.eia_seq).toBe('45329');
    expect(r.capacity_mw).toBe(30);
    expect(r.area_ha).toBeNull();
    expect(r.evaluation_year).toBe(2025);
    expect(r.evaluation_stage).toBe('unknown');
    expect(r.source_dataset).toBe('15142987');
    expect(r.biz_gubun_cd).toBe('');
    expect(r.biz_gubun_nm).toBe('');
    expect(r.approv_organ_nm).toBe('환경부 원주지방환경청');
    // list-only: detail-derived fields all null
    expect(r.eia_addr_txt).toBeNull();
    expect(r.region_sido).toBeNull();
    expect(r.region_sigungu).toBeNull();
    expect(r.drfop_tmdt).toBeNull();
    expect(r.biz_size).toBeNull();
  });

  it('source_payload omits non-whitelisted fields', () => {
    const r = transformDscssItem({
      list: {
        eiaCd: 'X-1',
        bizNm: '풍력단지',
        rnum: 7 as unknown as string,
        unknownField: 'should be omitted' as unknown as string,
        ccilOrganNm: '원주청'
      }
    }) as TransformedRow;
    const pl = JSON.parse(r.source_payload);
    expect(pl.unknownField).toBeUndefined();
    expect(pl.rnum).toBeUndefined();
    expect(pl.eiaCd).toBe('X-1');
    expect(pl.ccilOrganNm).toBe('원주청');
  });

  it('evaluation_year extracted from stepChangeDt (YYYY.MM.DD)', () => {
    const r = transformDscssItem({
      list: { eiaCd: 'A-1', bizNm: '풍력', stepChangeDt: '2024.01.05' }
    }) as TransformedRow;
    expect(r.evaluation_year).toBe(2024);
  });

  it('returns null when eiaCd missing', () => {
    expect(
      transformDscssItem({
        list: { eiaCd: '', bizNm: '풍력' } as unknown as { eiaCd: string; bizNm: string }
      })
    ).toBeNull();
  });

  it('P1 — Ing detail merge: stateNm "1차변경협의본안" → 본안 + region 영양 LUT 매치', () => {
    // 운영 데이터 패턴: '1차변경협의본안' (substring '본안' hit). Q4 strict 의도 부합.
    const r = transformDscssItem({
      list: { eiaCd: 'DG2009L001', bizNm: '영양풍력발전단지 건설사업' },
      detailItems: [{ stateNm: '1차변경협의본안', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }]
    }) as TransformedRow;
    expect(r.evaluation_stage).toBe('본안');
    expect(r.region_sido).toBe('경상북도');
    expect(r.region_sido_code).toBe('47');
    expect(r.region_sigungu).toBe('영양군');
    const pl = JSON.parse(r.source_payload);
    expect(pl.stateNm).toBe('1차변경협의본안');
    expect(pl.matched_token).toBe('영양');
  });

  it('P1 — detailItems empty → list-only fallback (stage unknown, region from bizNm)', () => {
    const r = transformDscssItem({
      list: { eiaCd: 'DG2018C001', bizNm: '풍백 풍력발전단지 조성사업' }, // LUT 미등록 토큰
      detailItems: []
    }) as TransformedRow;
    expect(r.evaluation_stage).toBe('unknown');
    expect(r.region_sido).toBeNull();
    expect(r.region_sigungu).toBeNull();
  });

  it('P1 — detailItems undefined (call 실패 fallback) → unknown + region 시도', () => {
    const r = transformDscssItem({
      list: { eiaCd: 'GW2025C001', bizNm: '양양 내현풍력발전단지' },
      detailItems: undefined
    }) as TransformedRow;
    expect(r.evaluation_stage).toBe('unknown');
    expect(r.region_sido).toBe('강원도');
    expect(r.region_sigungu).toBe('양양군');
  });

  it('P1 — Ing detail "전략환경영향평가" → 전략', () => {
    const r = transformDscssItem({
      list: { eiaCd: 'X-1', bizNm: '강릉풍력' },
      detailItems: [
        { stateNm: '전략환경영향평가', resReplyDt: '2024-01-01', applyDt: '2024-01-01' }
      ]
    }) as TransformedRow;
    expect(r.evaluation_stage).toBe('전략');
  });
});
