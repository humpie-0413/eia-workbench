import { describe, it, expect } from 'vitest';
import { scopingInputSchema } from './scoping';

describe('scopingInputSchema', () => {
  it('accepts minimal valid input', () => {
    const r = scopingInputSchema.safeParse({
      site_area_m2: 5000,
      site_area_input_unit: 'sqm',
      land_use_zone: 'conservation_management'
    });
    expect(r.success).toBe(true);
  });

  it('accepts full input', () => {
    const r = scopingInputSchema.safeParse({
      site_area_m2: 10000,
      site_area_input_unit: 'ha',
      land_use_zone: 'planning_management',
      forest_conversion_m2: 700,
      forest_conversion_input_unit: 'sqm',
      capacity_mw_override: 50,
      notes: 'test'
    });
    expect(r.success).toBe(true);
  });

  it('rejects negative site_area_m2', () => {
    const r = scopingInputSchema.safeParse({
      site_area_m2: -1,
      site_area_input_unit: 'sqm',
      land_use_zone: 'conservation_management'
    });
    expect(r.success).toBe(false);
  });

  it('rejects unknown zone', () => {
    const r = scopingInputSchema.safeParse({
      site_area_m2: 1,
      site_area_input_unit: 'sqm',
      land_use_zone: 'residential_zone'
    });
    expect(r.success).toBe(false);
  });

  it('rejects site_area_m2 over 10M', () => {
    const r = scopingInputSchema.safeParse({
      site_area_m2: 10_000_001,
      site_area_input_unit: 'sqm',
      land_use_zone: 'conservation_management'
    });
    expect(r.success).toBe(false);
  });

  it('allows missing optional fields', () => {
    const r = scopingInputSchema.safeParse({
      site_area_m2: 100,
      site_area_input_unit: 'sqm',
      land_use_zone: 'conservation_management'
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.forest_conversion_m2).toBeUndefined();
      expect(r.data.capacity_mw_override).toBeUndefined();
      expect(r.data.notes).toBeUndefined();
    }
  });

  it('rejects notes over 1000 chars', () => {
    const r = scopingInputSchema.safeParse({
      site_area_m2: 1,
      site_area_input_unit: 'sqm',
      land_use_zone: 'conservation_management',
      notes: 'x'.repeat(1001)
    });
    expect(r.success).toBe(false);
  });
});
