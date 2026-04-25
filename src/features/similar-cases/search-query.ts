import type { CaseSearchQuery } from '../../lib/schemas/case-search';

const BAND_RANGES: Record<string, [number, number]> = {
  '<10': [0, 10],
  '10-50': [10, 50],
  '50-100': [50, 100],
  '>=100': [100, 1e9]
};

export interface BuiltQuery {
  sql: string;
  countSql: string;
  binds: unknown[];
  countBinds: unknown[];
}

export function buildCaseSearchSql(q: CaseSearchQuery): BuiltQuery {
  const where: string[] = ['industry = ?'];
  const binds: unknown[] = ['onshore_wind'];

  if (q.q && q.q.length > 0) {
    if (q.q.length > 3) {
      where.push(`eia_cd IN (SELECT eia_cd FROM eia_cases_fts WHERE eia_cases_fts MATCH ?)`);
      binds.push(`${q.q}*`);
    } else {
      where.push(`(biz_nm LIKE ? OR region_sido LIKE ? OR region_sigungu LIKE ?)`);
      const pat = `%${q.q}%`;
      binds.push(pat, pat, pat);
    }
  }
  if (q.sido && q.sido.length > 0) {
    where.push(`region_sido IN (${q.sido.map(() => '?').join(',')})`);
    binds.push(...q.sido);
  }
  if (q.capacity_band && q.capacity_band.length > 0) {
    const subs = q.capacity_band.map((b) => {
      const range = BAND_RANGES[b];
      if (!range) throw new Error(`unknown capacity_band: ${b}`);
      const [lo, hi] = range;
      binds.push(lo, hi);
      return `(capacity_mw >= ? AND capacity_mw < ?)`;
    });
    where.push(`(${subs.join(' OR ')})`);
  }
  if (q.year && q.year.length > 0) {
    where.push(`evaluation_year IN (${q.year.map(() => '?').join(',')})`);
    binds.push(...q.year);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (q.page - 1) * q.pageSize;
  const sql = `
    SELECT eia_cd, biz_nm, region_sido, region_sido_code, region_sigungu,
           capacity_mw, area_ha, evaluation_year, evaluation_stage, industry,
           approv_organ_nm, drfop_start_dt, drfop_end_dt, eia_addr_txt
    FROM eia_cases
    ${whereClause}
    ORDER BY evaluation_year DESC, fetched_at DESC
    LIMIT ? OFFSET ?
  `
    .replace(/\s+/g, ' ')
    .trim();
  const countSql = `SELECT COUNT(*) as n FROM eia_cases ${whereClause}`.trim();
  return { sql, countSql, binds: [...binds, q.pageSize, offset], countBinds: [...binds] };
}
