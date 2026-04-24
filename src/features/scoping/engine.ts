import type {
  RulePack,
  Rule,
  WhenClause,
  RuleOutcome,
} from './rule-pack-loader';
import type { ScopingResult, ScopingSkipReason } from '../../lib/types/analysis-result';

export interface EvalInput {
  site_area_m2?: number;
  land_use_zone?: string;
  forest_conversion_m2?: number;
  capacity_mw?: number;
}

type CondResult =
  | { kind: 'true' }
  | { kind: 'false' }
  | { kind: 'skip'; reason: ScopingSkipReason };

export function evaluate(pack: RulePack, input: EvalInput): ScopingResult[] {
  return pack.rules.map((rule) => evaluateOne(rule, input, pack.version));
}

function evaluateOne(
  rule: Rule,
  input: EvalInput,
  rule_pack_version: string,
): ScopingResult {
  const cond = evalCondition(rule.when, input);

  if (cond.kind === 'skip') {
    return buildResult(rule, rule_pack_version, rule.onFalse, {
      triggered: false,
      override: 'skipped',
      skip_reason: cond.reason,
    });
  }

  if (cond.kind === 'true') {
    return buildResult(rule, rule_pack_version, rule.onTrue, {
      triggered: true,
    });
  }

  return buildResult(rule, rule_pack_version, rule.onFalse, {
    triggered: false,
    skip_reason: 'condition_not_met',
  });
}

function buildResult(
  rule: Rule,
  rule_pack_version: string,
  outcome: RuleOutcome,
  flags: { triggered: boolean; override?: 'skipped'; skip_reason?: ScopingSkipReason },
): ScopingResult {
  return {
    ruleId: rule.id,
    title: rule.title,
    category: rule.category,
    rule_pack_version,
    result: flags.override ?? outcome.result,
    basis: outcome.basis,
    assumptions: outcome.assumptions,
    limits: outcome.limits,
    needsHumanReview: true,
    triggered: flags.triggered,
    ...(flags.skip_reason ? { skip_reason: flags.skip_reason } : {}),
  };
}

export function evalCondition(clause: WhenClause, input: EvalInput): CondResult {
  if ('all_of' in clause) {
    for (const sub of clause.all_of) {
      const r = evalCondition(sub, input);
      if (r.kind !== 'true') return r;
    }
    return { kind: 'true' };
  }

  if ('equals' in clause) {
    const { field, value } = clause.equals;
    const v = (input as Record<string, unknown>)[field];
    if (v === undefined || v === null) return { kind: 'skip', reason: 'input_undefined' };
    return v === value ? { kind: 'true' } : { kind: 'false' };
  }

  if ('gte' in clause) {
    const { field, value } = clause.gte;
    const v = (input as Record<string, unknown>)[field] as number | undefined;
    if (v === undefined || v === null) return { kind: 'skip', reason: 'input_undefined' };
    return v >= value ? { kind: 'true' } : { kind: 'false' };
  }

  if ('gt' in clause) {
    const { field, value } = clause.gt;
    const v = (input as Record<string, unknown>)[field] as number | undefined;
    if (v === undefined || v === null) return { kind: 'skip', reason: 'input_undefined' };
    return v > value ? { kind: 'true' } : { kind: 'false' };
  }

  if ('lte' in clause) {
    const { field, value } = clause.lte;
    const v = (input as Record<string, unknown>)[field] as number | undefined;
    if (v === undefined || v === null) return { kind: 'skip', reason: 'input_undefined' };
    return v <= value ? { kind: 'true' } : { kind: 'false' };
  }

  if ('lt' in clause) {
    const { field, value } = clause.lt;
    const v = (input as Record<string, unknown>)[field] as number | undefined;
    if (v === undefined || v === null) return { kind: 'skip', reason: 'input_undefined' };
    return v < value ? { kind: 'true' } : { kind: 'false' };
  }

  if ('one_of' in clause) {
    const { field, values } = clause.one_of;
    const v = (input as Record<string, unknown>)[field] as string | undefined;
    if (v === undefined || v === null) return { kind: 'skip', reason: 'input_undefined' };
    return values.includes(v) ? { kind: 'true' } : { kind: 'skip', reason: 'zone_mismatch' };
  }

  if ('gte_by_zone' in clause) {
    const { field, thresholds } = clause.gte_by_zone;
    const v = (input as Record<string, unknown>)[field] as number | undefined;
    const zone = input.land_use_zone;
    if (v === undefined || v === null || zone === undefined) {
      return { kind: 'skip', reason: 'input_undefined' };
    }
    const threshold = thresholds[zone];
    if (threshold === undefined) return { kind: 'skip', reason: 'zone_mismatch' };
    return v >= threshold ? { kind: 'true' } : { kind: 'false' };
  }

  throw new Error(`engine: unsupported when clause: ${JSON.stringify(clause)}`);
}
