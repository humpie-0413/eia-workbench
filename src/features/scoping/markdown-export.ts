import type { ScopingResult } from '../../lib/types/analysis-result';

export interface MarkdownExportInput {
  input: Record<string, unknown>;
  results: ScopingResult[];
  rulePackVersion: string;
  createdAt: string;
}

export function exportResultsToMarkdown(doc: MarkdownExportInput): string {
  const { input, results, rulePackVersion, createdAt } = doc;
  const triggered = results.filter((r) => r.triggered);
  const skipped = results.filter((r) => !r.triggered);

  const lines: string[] = [];
  lines.push('# 스코핑 검토 보조 결과');
  lines.push('');
  lines.push(`- 생성: ${createdAt}`);
  lines.push(`- rule pack: \`${rulePackVersion}\``);
  lines.push('');
  lines.push(
    '> 본 결과는 법령·지침 기반 자동 체크 보조이며 법적 결론이 아닙니다. 현지조사와 전문가 확인이 별도로 필요합니다.'
  );
  lines.push('');
  lines.push('## 입력');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(input, null, 2));
  lines.push('```');
  lines.push('');
  lines.push(`## 발동 (${triggered.length})`);
  lines.push('');
  if (triggered.length === 0) {
    lines.push('발동된 규칙이 없습니다.');
    lines.push('');
  } else {
    for (const r of triggered) {
      writeRule(lines, r);
    }
  }
  lines.push(`## 스킵 / 해당 아님 (${skipped.length})`);
  lines.push('');
  for (const r of skipped) {
    writeRule(lines, r);
  }
  return lines.join('\n');
}

function writeRule(lines: string[], r: ScopingResult): void {
  lines.push(`### ${r.title} (\`${r.ruleId}\`)`);
  lines.push('');
  lines.push(
    `- 상태: ${r.triggered ? '발동' : '해당 아님'}${r.skip_reason ? ` (${r.skip_reason})` : ''}`
  );
  lines.push(`- 분류: ${r.category}`);
  lines.push(`- 결과: ${r.result}`);
  if (r.basis.length > 0) {
    lines.push('- 근거:');
    for (const c of r.basis) {
      const link = c.refLink ? ` — ${c.refLink}` : '';
      lines.push(`  - ${c.title}${link}`);
    }
  }
  if (r.assumptions.length > 0) {
    lines.push('- 가정:');
    for (const a of r.assumptions) lines.push(`  - ${a}`);
  }
  if (r.limits.length > 0) {
    lines.push('- 한계:');
    for (const l of r.limits) lines.push(`  - ${l}`);
  }
  lines.push('- 사람 검토 필요: 예');
  lines.push('');
}
