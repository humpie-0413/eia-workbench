const ONSHORE_RE = /풍력/;
const OFFSHORE_RE = /해상\s*풍력/;

export type WindClassification = 'ok' | 'offshore' | 'not_wind_keyword';

// 15142987 응답에는 bizGubunCd 가 없으므로 bizNm regex 만으로 분류한다.
// '해상풍력' 은 v0 범위 밖이므로 명시적 reject.
export function classifyOnshoreWind(input: { bizNm: string }): WindClassification {
  if (OFFSHORE_RE.test(input.bizNm)) return 'offshore';
  if (!ONSHORE_RE.test(input.bizNm)) return 'not_wind_keyword';
  return 'ok';
}

export function isOnshoreWindCandidate(input: { bizNm: string }): boolean {
  return classifyOnshoreWind(input) === 'ok';
}
