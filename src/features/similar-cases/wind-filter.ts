const ONSHORE_RE = /풍력/;
const OFFSHORE_RE = /해상\s*풍력/;
const ALLOWED_GUBUN = new Set(['C', 'L']);

export type WindClassification = 'ok' | 'gubn_invalid' | 'offshore' | 'not_wind_keyword';

export function classifyOnshoreWind(input: {
  bizGubunCd: string;
  bizNm: string;
}): WindClassification {
  if (!ALLOWED_GUBUN.has(input.bizGubunCd)) return 'gubn_invalid';
  if (OFFSHORE_RE.test(input.bizNm)) return 'offshore';
  if (!ONSHORE_RE.test(input.bizNm)) return 'not_wind_keyword';
  return 'ok';
}

export function isOnshoreWindCandidate(input: { bizGubunCd: string; bizNm: string }): boolean {
  return classifyOnshoreWind(input) === 'ok';
}
