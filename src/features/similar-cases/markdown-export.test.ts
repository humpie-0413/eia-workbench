import { describe, it, expect } from 'vitest';
import { exportCasesToMarkdown } from './markdown-export';
import type { EiaCase } from '@/lib/types/case-search';

const baseCase: EiaCase = {
  eia_cd: 'A-1',
  biz_nm: '강원풍력',
  region_sido: '강원',
  region_sido_code: '51',
  region_sigungu: '평창군',
  capacity_mw: 30,
  area_ha: null,
  evaluation_year: 2024,
  evaluation_stage: '본안',
  industry: 'onshore_wind',
  approv_organ_nm: '환경부',
  drfop_start_dt: '2024-01-15',
  drfop_end_dt: '2024-02-14',
  eia_addr_txt: '강원 평창군'
};

describe('exportCasesToMarkdown', () => {
  it('produces table with header and EIASS deep-link column', () => {
    const md = exportCasesToMarkdown([baseCase], { q: '강원', sido: ['강원'] });
    expect(md).toMatch(/^# 유사사례 검색 결과/m);
    expect(md).toMatch(/\| eiaCd \| 사업명 \| 위치 \| 규모 \| 평가시기 \| 단계 \| EIASS \|/);
    expect(md).toContain('https://www.eiass.go.kr');
    expect(md).toContain('강원풍력');
    expect(md).toContain('검색어: 강원');
  });

  it('escapes pipe characters in biz_nm', () => {
    const md = exportCasesToMarkdown(
      [{ ...baseCase, eia_cd: 'B-1', biz_nm: 'A|B 풍력', capacity_mw: 1 }],
      {}
    );
    expect(md).toContain('A\\|B 풍력');
  });

  it('includes 현지조사 한계 disclaimer', () => {
    const md = exportCasesToMarkdown([baseCase], {});
    expect(md).toMatch(/현지조사·전문가 검토를 대체하지 않습니다/);
  });

  it('renders 미상 for null capacity / year', () => {
    const md = exportCasesToMarkdown(
      [{ ...baseCase, capacity_mw: null, evaluation_year: null }],
      {}
    );
    expect(md).toContain('미상');
  });

  it('joins multi-value filters with commas', () => {
    const md = exportCasesToMarkdown([baseCase], {
      sido: ['강원', '전남'],
      capacity_band: ['10-50', '50-100'],
      year: [2024, 2023]
    });
    expect(md).toContain('시·도: 강원, 전남');
    expect(md).toContain('규모: 10-50, 50-100');
    expect(md).toContain('연도: 2024, 2023');
  });
});
