import { describe, it, expect } from 'vitest';
import { exportResultsToMarkdown } from './markdown-export';
import type { ScopingResult } from '../../lib/types/analysis-result';

function mk(overrides: Partial<ScopingResult> = {}): ScopingResult {
  return {
    ruleId: 'r1',
    title: 'Rule 1',
    category: 'eia_target',
    rule_pack_version: 'onshore_wind/v2.0.0',
    result: 'likely_applicable',
    basis: [{ id: 'c1', title: '법 §1', refLink: 'https://example/1' }],
    assumptions: ['가정 a'],
    limits: ['한계 l'],
    needsHumanReview: true,
    triggered: true,
    ...overrides
  };
}

describe('exportResultsToMarkdown', () => {
  it('includes header + legal disclaimer + rule pack version', () => {
    const md = exportResultsToMarkdown({
      input: { site_area_m2: 8000 },
      results: [mk()],
      rulePackVersion: 'onshore_wind/v2.0.0',
      createdAt: '2026-04-24T00:00:00Z'
    });
    expect(md).toContain('# 스코핑 검토 보조 결과');
    expect(md).toContain('법적 결론이 아닙니다');
    expect(md).toContain('onshore_wind/v2.0.0');
    expect(md).toContain('2026-04-24T00:00:00Z');
  });

  it('splits triggered and skipped sections with counts', () => {
    const md = exportResultsToMarkdown({
      input: {},
      results: [mk(), mk({ ruleId: 'r2', triggered: false, skip_reason: 'input_undefined' })],
      rulePackVersion: 'v',
      createdAt: 'x'
    });
    expect(md).toMatch(/## 발동 \(1\)/);
    expect(md).toMatch(/## 스킵 \/ 해당 아님 \(1\)/);
    expect(md).toContain('input_undefined');
  });

  it('always marks "사람 검토 필요: 예"', () => {
    const md = exportResultsToMarkdown({
      input: {},
      results: [mk()],
      rulePackVersion: 'v',
      createdAt: 'x'
    });
    expect(md).toContain('사람 검토 필요: 예');
  });

  it('does not emit legal-assertion phrases like "승인" or "통과"', () => {
    const md = exportResultsToMarkdown({
      input: {},
      results: [mk()],
      rulePackVersion: 'v',
      createdAt: 'x'
    });
    expect(md).not.toMatch(/(환경영향평가\s*대상입니다|협의\s*통과|승인됨)/);
  });
});
