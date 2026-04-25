import { describe, it, expect } from 'vitest';
import { buildCaseSearchSql } from './search-query';

describe('buildCaseSearchSql', () => {
  it('q (>3 chars) + sido OR + capacity_band ranges as AND + year IN + LIMIT/OFFSET', () => {
    const r = buildCaseSearchSql({
      q: '강원풍력',
      sido: ['강원', '전남'],
      capacity_band: ['10-50'],
      year: [2024, 2023],
      page: 1,
      pageSize: 50
    });
    expect(r.sql).toMatch(/eia_cases_fts MATCH/);
    expect(r.sql).toMatch(/region_sido IN \(\?,\?\)/);
    expect(r.sql).toMatch(/capacity_mw >= \? AND capacity_mw < \?/);
    expect(r.sql).toMatch(/evaluation_year IN \(\?,\?\)/);
    expect(r.sql).toMatch(/ORDER BY evaluation_year DESC/);
    expect(r.sql).toMatch(/LIMIT \? OFFSET \?/);
    expect(r.binds).toEqual(
      expect.arrayContaining(['강원풍력*', '강원', '전남', 10, 50, 2024, 2023, 50, 0])
    );
  });

  it('uses LIKE fallback when q.length <= 3', () => {
    const r = buildCaseSearchSql({ q: '강원', page: 1, pageSize: 50 });
    expect(r.sql).toMatch(/biz_nm LIKE \? OR region_sido LIKE \? OR region_sigungu LIKE \?/);
    expect(r.sql).not.toMatch(/MATCH/);
    expect(r.binds).toEqual(expect.arrayContaining(['%강원%']));
  });

  it('without q: no FTS, no LIKE', () => {
    const r = buildCaseSearchSql({ page: 1, pageSize: 50 });
    expect(r.sql).not.toMatch(/MATCH/);
    expect(r.sql).not.toMatch(/LIKE/);
  });

  it('count query has same WHERE shape', () => {
    const r = buildCaseSearchSql({ sido: ['강원'], page: 1, pageSize: 50 });
    expect(r.countSql).toMatch(/SELECT COUNT/);
    expect(r.countSql).toMatch(/region_sido IN/);
    expect(r.countBinds).toEqual(['onshore_wind', '강원']);
  });

  it('always pins industry = onshore_wind', () => {
    const r = buildCaseSearchSql({ page: 1, pageSize: 50 });
    expect(r.sql).toMatch(/industry = \?/);
    expect(r.binds[0]).toBe('onshore_wind');
  });

  it('OFFSET = (page-1) * pageSize', () => {
    const r = buildCaseSearchSql({ page: 3, pageSize: 20 });
    const offset = r.binds[r.binds.length - 1];
    expect(offset).toBe(40);
    const limit = r.binds[r.binds.length - 2];
    expect(limit).toBe(20);
  });
});
