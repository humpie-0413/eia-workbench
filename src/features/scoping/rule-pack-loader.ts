import yaml from 'js-yaml';
import type { Citation, AnalysisResultKind, ScopingRuleCategory } from '../../lib/types/analysis-result';

export interface RulePackAudit {
  findings_doc: string;
  audit_verdict: 'PASS' | 'FAIL' | 'PARTIAL';
  audit_date: string;
  source_pdfs: string[];
}

export interface RuleOutcome {
  result: AnalysisResultKind;
  basis: Citation[];
  assumptions: string[];
  limits: string[];
}

export type WhenClause =
  | { equals: { field: string; value: unknown } }
  | { gte: { field: string; value: number } }
  | { gt: { field: string; value: number } }
  | { lte: { field: string; value: number } }
  | { lt: { field: string; value: number } }
  | { one_of: { field: string; values: string[] } }
  | { gte_by_zone: { field: string; thresholds: Record<string, number> } }
  | { all_of: WhenClause[] };

export interface Rule {
  id: string;
  title: string;
  category: ScopingRuleCategory;
  when: WhenClause;
  onUndefined: 'skip' | 'false';
  onTrue: RuleOutcome;
  onFalse: RuleOutcome;
}

export interface RulePack {
  version: string;
  industry: string;
  rule_pack_audit: RulePackAudit;
  source_note: string;
  rules: Rule[];
}

export function loadRulePackFromString(text: string): RulePack {
  const parsed = yaml.load(text) as RulePack;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('rule pack: YAML root must be an object');
  }
  if (!parsed.rule_pack_audit) {
    throw new Error(
      'rule pack: rule_pack_audit meta 누락 (issue #13 — 법령 숫자 원문 대조 의무)',
    );
  }
  if (!Array.isArray(parsed.rules)) {
    throw new Error('rule pack: rules must be an array');
  }
  return parsed;
}

export function validateAudit(pack: RulePack): void {
  const v = pack.rule_pack_audit.audit_verdict;
  if (v !== 'PASS') {
    throw new Error(
      `rule pack audit FAIL: verdict=${v} (PASS 아니면 engine 실행 거부 — issue #13)`,
    );
  }
}
