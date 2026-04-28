export function formatLocation(eiaCase: {
  region_sido: string | null;
  region_sigungu: string | null;
}): string {
  if (!eiaCase.region_sido) {
    return '지역 미상';
  }
  if (eiaCase.region_sigungu) {
    return `${eiaCase.region_sido} ${eiaCase.region_sigungu}`;
  }
  return eiaCase.region_sido;
}
