import type { ScopingResult } from '../../lib/types/analysis-result';

export interface PromptInput {
  input: Record<string, unknown>;
  results: ScopingResult[];
  rulePackVersion: string;
}

export function buildManualAnalysisPrompt(doc: PromptInput): string {
  const { input, results, rulePackVersion } = doc;
  const triggered = results.filter((r) => r.triggered);
  const skipped = results.filter((r) => !r.triggered);

  const lines: string[] = [];
  lines.push('역할: 환경영향평가 검토 보조.');
  lines.push(
    '제약: CLAUDE.md §2 — 법적 결론 단정 금지. 승인/통과 단정 금지. "근거 / 가정 / 한계 / 사람 검토 필요" 4필드를 항상 명시. EIASS 원문 재호스팅 금지.'
  );
  lines.push(`rule pack: ${rulePackVersion}`);
  lines.push('');
  lines.push('## 사용자 입력');
  lines.push('```json');
  lines.push(JSON.stringify(input, null, 2));
  lines.push('```');
  lines.push('');
  lines.push(`## 자동 엔진이 발동시킨 규칙 (${triggered.length})`);
  if (triggered.length === 0) {
    lines.push('- 없음');
  } else {
    for (const r of triggered) {
      lines.push(`- ${r.title} (\`${r.ruleId}\`, ${r.category})`);
      for (const c of r.basis) lines.push(`    - 근거: ${c.title}`);
      for (const a of r.assumptions) lines.push(`    - 가정: ${a}`);
      for (const l of r.limits) lines.push(`    - 한계: ${l}`);
    }
  }
  lines.push('');
  lines.push(`## 자동 엔진이 스킵한 규칙 (${skipped.length})`);
  for (const r of skipped) {
    lines.push(`- ${r.title} (\`${r.ruleId}\`, 사유: ${r.skip_reason ?? 'condition_not_met'})`);
  }
  lines.push('');
  lines.push('## 요청 (사람이 직접 수행)');
  lines.push(
    '1) 발동된 규칙 각각에 대해, 사용자 입력 값이 임계값을 넘긴 이유를 "근거/가정/한계/사람 검토 필요" 4필드로 재정리해 주세요.'
  );
  lines.push(
    '2) 스킵된 규칙 중 `input_undefined` 는 사용자에게 어떤 추가 입력이 필요한지 1줄로 제시하세요.'
  );
  lines.push('3) 전 항목에 걸쳐 현지조사·전문가 확인이 필요한 포인트 3개 이하를 요약하세요.');
  lines.push(
    '금지: "대상입니다", "협의 통과", "승인됨" 같은 단정 표현. 대신 "가능성이 있음", "확인 필요" 사용.'
  );
  return lines.join('\n');
}
