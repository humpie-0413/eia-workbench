import { describe, it, expect } from 'vitest';
import { exportResultsToCsv } from './csv-export';
import type { ScopingResult } from '../../lib/types/analysis-result';

function makeResult(overrides: Partial<ScopingResult> = {}): ScopingResult {
  return {
    ruleId: 'r1',
    title: 'Rule 1',
    category: 'eia_target',
    rule_pack_version: 'onshore_wind/v2.0.0',
    result: 'likely_applicable',
    basis: [{ id: 'c1', title: '법 §1' }],
    assumptions: ['a'],
    limits: ['현지조사 필요'],
    needsHumanReview: true,
    triggered: true,
    ...overrides
  };
}

describe('exportResultsToCsv', () => {
  it('emits header + one row per result with CRLF line endings', () => {
    const csv = exportResultsToCsv([makeResult()]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('ruleId,title,category');
    expect(lines[1]).toContain('r1');
    expect(lines[1]).toContain('Rule 1');
    expect(lines[1]).toContain('true');
  });

  it('escapes commas and quotes inside cells', () => {
    const csv = exportResultsToCsv([makeResult({ title: 'A, B', assumptions: ['say "hi"'] })]);
    expect(csv).toContain('"A, B"');
    expect(csv).toContain('"say ""hi"""');
  });

  it('joins multi-value fields with pipe separator', () => {
    const csv = exportResultsToCsv([
      makeResult({
        basis: [
          { id: 'a', title: 'A' },
          { id: 'b', title: 'B' }
        ]
      })
    ]);
    expect(csv).toContain('A | B');
  });

  it('emits empty string for absent skip_reason', () => {
    const csv = exportResultsToCsv([makeResult()]);
    expect(csv.split('\r\n')[1]).toMatch(/,,/);
  });
});
