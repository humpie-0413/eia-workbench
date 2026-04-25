export interface EiaCase {
  eia_cd: string;
  biz_nm: string;
  region_sido: string | null;
  region_sido_code: string | null;
  region_sigungu: string | null;
  capacity_mw: number | null;
  area_ha: number | null;
  evaluation_year: number | null;
  evaluation_stage: '본안' | '전략';
  industry: 'onshore_wind';
  approv_organ_nm: string | null;
  drfop_start_dt: string | null;
  drfop_end_dt: string | null;
  eia_addr_txt: string | null;
}

export interface CaseSearchResult {
  total: number;
  page: number;
  pageSize: number;
  items: EiaCase[];
}
