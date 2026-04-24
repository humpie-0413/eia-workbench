import { describe, it, expect } from 'vitest';
import { buildManualAnalysisPrompt } from './prompt-generator';
import type { ScopingResult } from '../../lib/types/analysis-result';

function mk(overrides: Partial<ScopingResult> = {}): ScopingResult {
  return {
    ruleId: 'r1',
    title: 'Rule 1',
    category: 'eia_target',
    rule_pack_version: 'onshore_wind/v2.0.0',
    result: 'likely_applicable',
    basis: [{ id: 'c1', title: '법 §1' }],
    assumptions: [],
    limits: [],
    needsHumanReview: true,
    triggered: true,
    ...overrides
  };
}

describe('buildManualAnalysisPrompt', () => {
  it('embeds CLAUDE.md §2 constraint about legal conclusions', () => {
    const p = buildManualAnalysisPrompt({
      input: {},
      results: [mk()],
      rulePackVersion: 'onshore_wind/v2.0.0'
    });
    expect(p).toContain('CLAUDE.md §2');
    expect(p).toContain('법적 결론 단정 금지');
  });

  it('lists triggered rules and skipped rules separately', () => {
    const p = buildManualAnalysisPrompt({
      input: { site_area_m2: 8000 },
      results: [mk(), mk({ ruleId: 'r2', triggered: false, skip_reason: 'zone_mismatch' })],
      rulePackVersion: 'v'
    });
    expect(p).toMatch(/## 자동 엔진이 발동시킨 규칙 \(1\)/);
    expect(p).toMatch(/## 자동 엔진이 스킵한 규칙 \(1\)/);
    expect(p).toContain('zone_mismatch');
  });

  it('instructs Claude to avoid assertive phrasing', () => {
    const p = buildManualAnalysisPrompt({
      input: {},
      results: [mk()],
      rulePackVersion: 'v'
    });
    expect(p).toMatch(/금지:.+단정 표현/);
    expect(p).toMatch(/"가능성이 있음", "확인 필요"/);
  });

  it('includes the rule pack version for auditability', () => {
    const p = buildManualAnalysisPrompt({
      input: {},
      results: [],
      rulePackVersion: 'onshore_wind/v2.0.0'
    });
    expect(p).toContain('onshore_wind/v2.0.0');
  });
});
