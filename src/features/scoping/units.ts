export const HA_TO_SQM = 10_000 as const;

export type AreaUnit = 'sqm' | 'ha';

export function normalizeAreaToSqm(value: number, unit: AreaUnit): number {
  if (unit === 'ha') return value * HA_TO_SQM;
  return value;
}

export function denormalizeSqmToInputUnit(sqm: number, unit: AreaUnit): number {
  if (unit === 'ha') return sqm / HA_TO_SQM;
  return sqm;
}
