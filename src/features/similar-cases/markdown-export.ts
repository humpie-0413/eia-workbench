import type { EiaCase } from '@/lib/types/case-search';
import { eiassProjectUrl } from '../../../packages/eia-data/src/deep-link';

function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/\|/g, '\\|');
}

export interface ExportContext {
  q?: string;
  sido?: string[];
  capacity_band?: string[];
  year?: number[];
}

export function exportCasesToMarkdown(items: EiaCase[], ctx: ExportContext): string {
  const lines: string[] = [];
  lines.push('# 유사사례 검색 결과');

  const filters: string[] = [];
  if (ctx.q) filters.push(`검색어: ${ctx.q}`);
  if (ctx.sido?.length) filters.push(`시·도: ${ctx.sido.join(', ')}`);
  if (ctx.capacity_band?.length) filters.push(`규모: ${ctx.capacity_band.join(', ')}`);
  if (ctx.year?.length) filters.push(`연도: ${ctx.year.join(', ')}`);
  if (filters.length) lines.push('', filters.join(' · '));

  lines.push('', '> 본 도구는 검토 보조이며 현지조사·전문가 검토를 대체하지 않습니다.');
  lines.push('', '| eiaCd | 사업명 | 위치 | 규모 | 평가시기 | 단계 | EIASS |');
  lines.push('|---|---|---|---|---|---|---|');

  for (const c of items) {
    const region = [c.region_sido, c.region_sigungu].filter(Boolean).join(' ');
    const capacity = c.capacity_mw != null ? `${c.capacity_mw} MW` : '미상';
    const year = c.evaluation_year != null ? String(c.evaluation_year) : '미상';
    const link = eiassProjectUrl({ projectId: c.eia_cd });
    lines.push(
      `| ${esc(c.eia_cd)} | ${esc(c.biz_nm)} | ${esc(region)} | ${esc(capacity)} | ${year} | ${c.evaluation_stage} | [원문](${link}) |`
    );
  }
  return lines.join('\n') + '\n';
}
