const ONSHORE_RE = /풍력/;
const OFFSHORE_RE = /해상\s*풍력/;
const ALLOWED_GUBUN = new Set(['C', 'L']);

export function isOnshoreWindCandidate(input: { bizGubunCd: string; bizNm: string }): boolean {
  if (!ALLOWED_GUBUN.has(input.bizGubunCd)) return false;
  if (OFFSHORE_RE.test(input.bizNm)) return false;
  return ONSHORE_RE.test(input.bizNm);
}
