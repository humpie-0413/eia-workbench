import type { ScopingResult } from '../../lib/types/analysis-result';

function csvEscape(value: string): string {
  if (value === '') return '';
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const HEADERS = [
  'ruleId',
  'title',
  'category',
  'rule_pack_version',
  'triggered',
  'result',
  'skip_reason',
  'basis',
  'assumptions',
  'limits',
  'needsHumanReview'
] as const;

export function exportResultsToCsv(results: ScopingResult[]): string {
  const lines: string[] = [HEADERS.join(',')];
  for (const r of results) {
    const row = [
      r.ruleId,
      r.title,
      r.category,
      r.rule_pack_version,
      String(r.triggered),
      r.result,
      r.skip_reason ?? '',
      r.basis.map((c) => c.title).join(' | '),
      r.assumptions.join(' | '),
      r.limits.join(' | '),
      String(r.needsHumanReview)
    ].map(csvEscape);
    lines.push(row.join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
