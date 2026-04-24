export const LAND_USE_ZONES = [
  'conservation_management',
  'production_management',
  'planning_management',
  'agricultural_forestry',
  'natural_environment_conservation',
] as const;

export type LandUseZone = (typeof LAND_USE_ZONES)[number];

const LABELS_KO: Record<LandUseZone, string> = {
  conservation_management: '보전관리지역',
  production_management: '생산관리지역',
  planning_management: '계획관리지역',
  agricultural_forestry: '농림지역',
  natural_environment_conservation: '자연환경보전지역',
};

export function zoneLabelKo(zone: LandUseZone): string {
  return LABELS_KO[zone];
}
