import { describe, it, expect } from 'vitest';
import { HA_TO_SQM, normalizeAreaToSqm, denormalizeSqmToInputUnit } from './units';

describe('units', () => {
  it('HA_TO_SQM is 10_000', () => {
    expect(HA_TO_SQM).toBe(10_000);
  });

  it('normalizeAreaToSqm converts ha → sqm', () => {
    expect(normalizeAreaToSqm(1, 'ha')).toBe(10_000);
    expect(normalizeAreaToSqm(0.5, 'ha')).toBe(5_000);
  });

  it('normalizeAreaToSqm passes through sqm', () => {
    expect(normalizeAreaToSqm(500, 'sqm')).toBe(500);
    expect(normalizeAreaToSqm(0, 'sqm')).toBe(0);
  });

  it('denormalizeSqmToInputUnit converts sqm → ha', () => {
    expect(denormalizeSqmToInputUnit(10_000, 'ha')).toBe(1);
    expect(denormalizeSqmToInputUnit(7_500, 'ha')).toBe(0.75);
  });

  it('round-trip identity', () => {
    const inputHa = 0.75;
    const sqm = normalizeAreaToSqm(inputHa, 'ha');
    expect(denormalizeSqmToInputUnit(sqm, 'ha')).toBe(inputHa);

    const inputSqm = 5_000;
    const sqm2 = normalizeAreaToSqm(inputSqm, 'sqm');
    expect(denormalizeSqmToInputUnit(sqm2, 'sqm')).toBe(inputSqm);
  });
});
