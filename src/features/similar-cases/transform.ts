import { isOnshoreWindCandidate } from './wind-filter';
import { parseRegion } from './region-parser';
import { pickPayload } from './payload-whitelist';

const SOURCE_DATASET = '15142998';

export type QueriedBizGubunCd = 'C' | 'L';

const MW_RE = /(\d+(?:\.\d+)?)\s*(MW|㎿|메가와트)/i;
const KW_RE = /(\d+(?:\.\d+)?)\s*(kW|㎾|킬로와트)/i;
const HA_RE = /(\d+(?:\.\d+)?)\s*ha/i;
const SQM_RE = /(\d+(?:\.\d+)?)\s*(?:㎡|m²)/i;
const SQKM_RE = /(\d+(?:\.\d+)?)\s*(?:㎢|km²)/i;
const AREA_UNIT_RE = /^(?:ha|㎡|m²|㎢|km²)$/i;

export type Stage = 'draft' | 'strategy';

export interface TransformInput {
  stage: Stage;
  /**
   * 인덱서가 list API 호출 시 사용한 bizGubn 값. 실 응답에 bizGubunCd 가
   * 누락되므로 신뢰 소스를 호출 파라미터로 변경한다.
   */
  queriedBizGubunCd: QueriedBizGubunCd;
  /**
   * stage='draft' 면 list/detail 에 eiaCd, stage='strategy' 면 perCd 가 PK.
   * 두 stage 의 응답 shape 가 다르므로 union 으로 받는다.
   */
  list: Record<string, unknown> & { bizNm: string };
  detail: Record<string, unknown>;
}

export interface TransformedRow {
  eia_cd: string;
  eia_seq: string | null;
  biz_gubun_cd: string;
  biz_gubun_nm: string;
  biz_nm: string;
  biz_main_nm: string | null;
  approv_organ_nm: string | null;
  biz_money: number | null;
  biz_size: string | null;
  biz_size_dan: string | null;
  drfop_tmdt: string | null;
  drfop_start_dt: string | null;
  drfop_end_dt: string | null;
  eia_addr_txt: string | null;
  industry: 'onshore_wind';
  region_sido: string | null;
  region_sido_code: string | null;
  region_sigungu: string | null;
  capacity_mw: number | null;
  area_ha: number | null;
  evaluation_year: number | null;
  evaluation_stage: '본안' | '전략';
  source_dataset: '15142998';
  source_payload: string;
}

function parseCapacity(
  bizSize: string | null,
  bizSizeDan: string | null,
  bizNm: string
): number | null {
  if (bizSize && bizSizeDan) {
    const num = Number(String(bizSize).replace(/,/g, ''));
    if (Number.isFinite(num)) {
      const dan = bizSizeDan.toLowerCase().trim();
      if (/^mw|메가/.test(dan)) return num;
      if (/^kw|㎾|킬로/.test(dan)) return num / 1000;
      if (AREA_UNIT_RE.test(bizSizeDan.trim())) return null;
    }
  }
  const m = MW_RE.exec(bizNm) ?? KW_RE.exec(bizNm);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return null;
    return /kW|㎾/i.test(m[2] ?? '') ? n / 1000 : n;
  }
  return null;
}

function parseArea(
  bizSize: string | null,
  bizSizeDan: string | null,
  bizNm: string
): number | null {
  if (bizSize && bizSizeDan) {
    const num = Number(String(bizSize).replace(/,/g, ''));
    if (Number.isFinite(num)) {
      const dan = bizSizeDan.trim();
      if (dan === 'ha') return num;
      if (dan === '㎡' || dan === 'm²') return num / 10000;
      if (dan === '㎢' || dan === 'km²') return num * 100;
    }
  }
  const ha = HA_RE.exec(bizNm);
  if (ha) return Number(ha[1]);
  const sq = SQM_RE.exec(bizNm);
  if (sq) return Number(sq[1]) / 10000;
  const km = SQKM_RE.exec(bizNm);
  if (km) return Number(km[1]) * 100;
  return null;
}

function parseYear(drfopStartDt: string | null, drfopTmdt: string | null): number | null {
  const src = drfopStartDt ?? drfopTmdt;
  if (!src) return null;
  const m = /(\d{4})/.exec(src);
  if (!m) return null;
  const y = Number(m[1]);
  const now = new Date().getFullYear();
  if (y < 2000 || y > now + 1) return null;
  return y;
}

export function transformItem(input: TransformInput): TransformedRow | null {
  const { stage, queriedBizGubunCd, list, detail } = input;
  if (!isOnshoreWindCandidate({ bizGubunCd: queriedBizGubunCd, bizNm: list.bizNm })) return null;

  const merged: Record<string, unknown> = { ...list, ...detail };
  // PK 매핑 (CLAUDE.md §10.2 디폴트 액션 옵션 A): perCd 와 eiaCd 는
  // 발급 namespace 가 다르므로 같은 eia_cd 컬럼에 저장해도 충돌 가능성 매우 낮음.
  // evaluation_stage='전략' 으로 구분.
  const pk =
    stage === 'strategy'
      ? merged.perCd != null
        ? String(merged.perCd)
        : ''
      : merged.eiaCd != null
        ? String(merged.eiaCd)
        : '';
  if (!pk) return null;
  const seqRaw = stage === 'strategy' ? merged.bizSeq : merged.eiaSeq;
  const region = parseRegion(String(merged.eiaAddrTxt ?? ''));
  const bizSize = (merged.bizSize as string | undefined) ?? null;
  const bizSizeDan = (merged.bizSizeDan as string | undefined) ?? null;
  const bizNm = String(merged.bizNm);

  const payload = pickPayload(merged);
  return {
    eia_cd: pk,
    eia_seq: seqRaw != null ? String(seqRaw) : null,
    biz_gubun_cd: queriedBizGubunCd,
    biz_gubun_nm: String(merged.bizGubunNm ?? ''),
    biz_nm: bizNm,
    biz_main_nm: (merged.bizmainNm as string | undefined) ?? null,
    approv_organ_nm: (merged.approvOrganNm as string | undefined) ?? null,
    biz_money: merged.bizMoney != null ? Number(merged.bizMoney) : null,
    biz_size: bizSize,
    biz_size_dan: bizSizeDan,
    drfop_tmdt: (merged.drfopTmdt as string | undefined) ?? null,
    drfop_start_dt: (merged.drfopStartDt as string | undefined) ?? null,
    drfop_end_dt: (merged.drfopEndDt as string | undefined) ?? null,
    eia_addr_txt: (merged.eiaAddrTxt as string | undefined) ?? null,
    industry: 'onshore_wind',
    region_sido: region.sido,
    region_sido_code: region.sidoCode,
    region_sigungu: region.sigungu,
    capacity_mw: parseCapacity(bizSize, bizSizeDan, bizNm),
    area_ha: parseArea(bizSize, bizSizeDan, bizNm),
    evaluation_year: parseYear(
      (merged.drfopStartDt as string | undefined) ?? null,
      (merged.drfopTmdt as string | undefined) ?? null
    ),
    evaluation_stage: stage === 'strategy' ? '전략' : '본안',
    source_dataset: SOURCE_DATASET,
    source_payload: JSON.stringify(payload)
  };
}
