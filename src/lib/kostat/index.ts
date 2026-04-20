import data from '@/data/administrative-divisions.json';

export interface Sub { code: string; name: string; }
export interface Region { code: string; name: string; subs: Sub[]; }
export interface RegionDataset { version: string; source: string; regions: Region[]; }

export function loadRegions(): RegionDataset {
  return data as RegionDataset;
}

export function isValidRegionCode(code: string): boolean {
  return loadRegions().regions.some((r) => r.code === code);
}

export function isValidSubCode(regionCode: string, subCode: string): boolean {
  const r = loadRegions().regions.find((x) => x.code === regionCode);
  return !!r && r.subs.some((s) => s.code === subCode);
}

export function labelFor(regionCode: string, subCode?: string): string | null {
  const r = loadRegions().regions.find((x) => x.code === regionCode);
  if (!r) return null;
  if (subCode === undefined) return r.name;
  const s = r.subs.find((x) => x.code === subCode);
  return s ? s.name : null;
}
