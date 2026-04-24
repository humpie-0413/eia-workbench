import { describe, it, expect } from 'vitest';
import { LAND_USE_ZONES, zoneLabelKo, type LandUseZone } from './zone';

describe('land_use_zone', () => {
  it('defines 5 zones', () => {
    expect(LAND_USE_ZONES).toHaveLength(5);
    expect(LAND_USE_ZONES).toEqual([
      'conservation_management',
      'production_management',
      'planning_management',
      'agricultural_forestry',
      'natural_environment_conservation',
    ]);
  });

  it('zoneLabelKo returns Korean labels', () => {
    const cases: [LandUseZone, string][] = [
      ['conservation_management', '보전관리지역'],
      ['production_management', '생산관리지역'],
      ['planning_management', '계획관리지역'],
      ['agricultural_forestry', '농림지역'],
      ['natural_environment_conservation', '자연환경보전지역'],
    ];
    for (const [zone, label] of cases) {
      expect(zoneLabelKo(zone)).toBe(label);
    }
  });
});
