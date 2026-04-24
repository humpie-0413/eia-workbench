import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { loadRulePackFromString, validateAudit, type RulePack } from './rule-pack-loader';
import { evaluate, evalCondition, type EvalInput } from './engine';

let pack: RulePack;

beforeAll(async () => {
  const text = await readFile('data/rules/scoping/onshore_wind.v2.yaml', 'utf-8');
  pack = loadRulePackFromString(text);
  validateAudit(pack);
});

function evalRule(input: EvalInput, ruleId: string) {
  const results = evaluate(pack, input);
  const r = results.find((x) => x.ruleId === ruleId);
  if (!r) throw new Error(`no result for rule: ${ruleId}`);
  return r;
}

describe('engine — rule 1 (eia_target_capacity, 100 MW)', () => {
  it('capacity_mw undefined → skip with input_undefined', () => {
    const r = evalRule({}, 'eia_target_capacity');
    expect(r.triggered).toBe(false);
    expect(r.result).toBe('skipped');
    expect(r.skip_reason).toBe('input_undefined');
  });

  it('capacity_mw = 99 (below) → not triggered', () => {
    const r = evalRule({ capacity_mw: 99 }, 'eia_target_capacity');
    expect(r.triggered).toBe(false);
    expect(r.result).toBe('likely_not_applicable');
  });

  it('capacity_mw = 100 (boundary) → triggered', () => {
    const r = evalRule({ capacity_mw: 100 }, 'eia_target_capacity');
    expect(r.triggered).toBe(true);
    expect(r.result).toBe('likely_applicable');
  });

  it('capacity_mw = 150 (above) → triggered', () => {
    const r = evalRule({ capacity_mw: 150 }, 'eia_target_capacity');
    expect(r.triggered).toBe(true);
  });
});

describe('engine — rule 2 (small_eia_conservation, 5000㎡)', () => {
  it('zone=conservation, area=4999 → not triggered', () => {
    const r = evalRule(
      { land_use_zone: 'conservation_management', site_area_m2: 4999 },
      'small_eia_conservation'
    );
    expect(r.triggered).toBe(false);
  });

  it('zone=conservation, area=5000 (boundary) → triggered', () => {
    const r = evalRule(
      { land_use_zone: 'conservation_management', site_area_m2: 5000 },
      'small_eia_conservation'
    );
    expect(r.triggered).toBe(true);
    expect(r.result).toBe('likely_applicable');
  });

  it('zone=planning, area=5000 → not triggered (equals false)', () => {
    const r = evalRule(
      { land_use_zone: 'planning_management', site_area_m2: 5000 },
      'small_eia_conservation'
    );
    expect(r.triggered).toBe(false);
  });

  it('zone undefined → skip input_undefined', () => {
    const r = evalRule({ site_area_m2: 5000 }, 'small_eia_conservation');
    expect(r.triggered).toBe(false);
    expect(r.skip_reason).toBe('input_undefined');
  });
});

describe('engine — rule 3 (small_eia_planning, 10000㎡)', () => {
  it('zone=planning, area=9999 → not triggered', () => {
    const r = evalRule(
      { land_use_zone: 'planning_management', site_area_m2: 9999 },
      'small_eia_planning'
    );
    expect(r.triggered).toBe(false);
  });

  it('zone=planning, area=10000 (boundary) → triggered', () => {
    const r = evalRule(
      { land_use_zone: 'planning_management', site_area_m2: 10000 },
      'small_eia_planning'
    );
    expect(r.triggered).toBe(true);
  });

  it('zone=conservation, area=15000 → not triggered (zone equals false)', () => {
    const r = evalRule(
      { land_use_zone: 'conservation_management', site_area_m2: 15000 },
      'small_eia_planning'
    );
    expect(r.triggered).toBe(false);
  });
});

describe('engine — rule 4 (small_eia_other_zones, gte_by_zone)', () => {
  it('zone=agricultural_forestry, area=7500 (boundary) → triggered', () => {
    const r = evalRule(
      { land_use_zone: 'agricultural_forestry', site_area_m2: 7500 },
      'small_eia_other_zones'
    );
    expect(r.triggered).toBe(true);
  });

  it('zone=agricultural_forestry, area=7499 → not triggered', () => {
    const r = evalRule(
      { land_use_zone: 'agricultural_forestry', site_area_m2: 7499 },
      'small_eia_other_zones'
    );
    expect(r.triggered).toBe(false);
  });

  it('zone=natural_environment_conservation, area=5000 (boundary) → triggered', () => {
    const r = evalRule(
      { land_use_zone: 'natural_environment_conservation', site_area_m2: 5000 },
      'small_eia_other_zones'
    );
    expect(r.triggered).toBe(true);
  });

  it('zone=natural_environment_conservation, area=4999 → not triggered', () => {
    const r = evalRule(
      { land_use_zone: 'natural_environment_conservation', site_area_m2: 4999 },
      'small_eia_other_zones'
    );
    expect(r.triggered).toBe(false);
  });

  it('zone=production_management, area=7500 (boundary) → triggered', () => {
    const r = evalRule(
      { land_use_zone: 'production_management', site_area_m2: 7500 },
      'small_eia_other_zones'
    );
    expect(r.triggered).toBe(true);
  });

  it('zone=production_management, area=7499 → not triggered', () => {
    const r = evalRule(
      { land_use_zone: 'production_management', site_area_m2: 7499 },
      'small_eia_other_zones'
    );
    expect(r.triggered).toBe(false);
  });

  it('zone=conservation_management, area=100000 → zone_mismatch (one_of fails)', () => {
    const r = evalRule(
      { land_use_zone: 'conservation_management', site_area_m2: 100000 },
      'small_eia_other_zones'
    );
    expect(r.triggered).toBe(false);
    expect(r.skip_reason).toBe('zone_mismatch');
  });

  it('zone=planning_management, area=100000 → zone_mismatch', () => {
    const r = evalRule(
      { land_use_zone: 'planning_management', site_area_m2: 100000 },
      'small_eia_other_zones'
    );
    expect(r.skip_reason).toBe('zone_mismatch');
  });
});

describe('engine — rule 5 (forest_conversion_review, 660㎡)', () => {
  it('forest undefined → skip', () => {
    const r = evalRule({}, 'forest_conversion_review');
    expect(r.triggered).toBe(false);
    expect(r.skip_reason).toBe('input_undefined');
  });

  it('forest=659 → not triggered', () => {
    const r = evalRule({ forest_conversion_m2: 659 }, 'forest_conversion_review');
    expect(r.triggered).toBe(false);
  });

  it('forest=660 (boundary) → triggered (needs_check)', () => {
    const r = evalRule({ forest_conversion_m2: 660 }, 'forest_conversion_review');
    expect(r.triggered).toBe(true);
    expect(r.result).toBe('needs_check');
  });

  it('forest=2000 → triggered', () => {
    const r = evalRule({ forest_conversion_m2: 2000 }, 'forest_conversion_review');
    expect(r.triggered).toBe(true);
  });
});

describe('engine — all rules return needsHumanReview: true', () => {
  it('every rule sets needsHumanReview=true', () => {
    const results = evaluate(pack, {
      land_use_zone: 'conservation_management',
      site_area_m2: 10000,
      forest_conversion_m2: 800,
      capacity_mw: 120
    });
    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.needsHumanReview).toBe(true);
      expect(r.rule_pack_version).toBe(pack.version);
    }
  });
});

describe('evalCondition — operator coverage', () => {
  it('gt operator — value > threshold', () => {
    expect(evalCondition({ gt: { field: 'capacity_mw', value: 50 } }, { capacity_mw: 60 })).toEqual(
      { kind: 'true' }
    );
    expect(evalCondition({ gt: { field: 'capacity_mw', value: 60 } }, { capacity_mw: 60 })).toEqual(
      { kind: 'false' }
    );
  });

  it('lt operator — value < threshold', () => {
    expect(
      evalCondition({ lt: { field: 'capacity_mw', value: 100 } }, { capacity_mw: 50 })
    ).toEqual({ kind: 'true' });
    expect(evalCondition({ lt: { field: 'capacity_mw', value: 50 } }, { capacity_mw: 50 })).toEqual(
      { kind: 'false' }
    );
  });

  it('lte operator — value <= threshold', () => {
    expect(
      evalCondition({ lte: { field: 'capacity_mw', value: 50 } }, { capacity_mw: 50 })
    ).toEqual({ kind: 'true' });
  });

  it('lt/lte/gt — undefined field → skip', () => {
    expect(evalCondition({ lt: { field: 'capacity_mw', value: 50 } }, {})).toEqual({
      kind: 'skip',
      reason: 'input_undefined'
    });
  });

  it('equals operator with undefined → skip', () => {
    expect(evalCondition({ equals: { field: 'land_use_zone', value: 'x' } }, {})).toEqual({
      kind: 'skip',
      reason: 'input_undefined'
    });
  });

  it('unsupported operator throws', () => {
    expect(() =>
      evalCondition(
        { nonsense: { field: 'x', value: 1 } } as unknown as Parameters<typeof evalCondition>[0],
        {}
      )
    ).toThrow();
  });
});
