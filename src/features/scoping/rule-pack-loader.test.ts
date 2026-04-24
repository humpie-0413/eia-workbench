import { describe, it, expect } from 'vitest';
import { loadRulePackFromString, validateAudit } from './rule-pack-loader';

const minimalYaml = `
version: test/v1
industry: onshore_wind
rule_pack_audit:
  findings_doc: docs/findings/test.md
  audit_verdict: PASS
  audit_date: '2026-04-23'
  source_pdfs: []
source_note: test
rules:
  - id: rule_a
    title: Test
    category: eia_target
    when:
      gte: { field: x, value: 1 }
    onUndefined: skip
    onTrue: { result: likely_applicable, basis: [], assumptions: [], limits: [] }
    onFalse: { result: likely_not_applicable, basis: [], assumptions: [], limits: [] }
`;

describe('rule-pack-loader', () => {
  it('parses valid YAML', () => {
    const p = loadRulePackFromString(minimalYaml);
    expect(p.version).toBe('test/v1');
    expect(p.rules).toHaveLength(1);
    expect(p.rule_pack_audit.audit_verdict).toBe('PASS');
  });

  it('throws when rule_pack_audit meta is missing', () => {
    const bad = `
version: test/v1
industry: onshore_wind
rules: []
`;
    expect(() => loadRulePackFromString(bad)).toThrow(/rule_pack_audit/);
  });

  it('validateAudit passes when verdict is PASS', () => {
    const p = loadRulePackFromString(minimalYaml);
    expect(() => validateAudit(p)).not.toThrow();
  });

  it('validateAudit throws when verdict is FAIL', () => {
    const failYaml = minimalYaml.replace('audit_verdict: PASS', 'audit_verdict: FAIL');
    const p = loadRulePackFromString(failYaml);
    expect(() => validateAudit(p)).toThrow(/audit FAIL/);
  });

  it('validateAudit throws when verdict is PARTIAL', () => {
    const partialYaml = minimalYaml.replace('audit_verdict: PASS', 'audit_verdict: PARTIAL');
    const p = loadRulePackFromString(partialYaml);
    expect(() => validateAudit(p)).toThrow(/PARTIAL/);
  });

  it('loads the shipped onshore_wind.v2.yaml pack', async () => {
    const { readFile } = await import('node:fs/promises');
    const text = await readFile('data/rules/scoping/onshore_wind.v2.yaml', 'utf-8');
    const pack = loadRulePackFromString(text);
    expect(pack.rules).toHaveLength(5);
    validateAudit(pack);
  });
});
