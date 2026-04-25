export const SIDO_LUT = [
  { short: '서울', label: '서울특별시', code: '11' },
  { short: '부산', label: '부산광역시', code: '26' },
  { short: '대구', label: '대구광역시', code: '27' },
  { short: '인천', label: '인천광역시', code: '28' },
  { short: '광주', label: '광주광역시', code: '29' },
  { short: '대전', label: '대전광역시', code: '30' },
  { short: '울산', label: '울산광역시', code: '31' },
  { short: '세종', label: '세종특별자치시', code: '36' },
  { short: '경기', label: '경기도', code: '41' },
  { short: '강원', label: '강원특별자치도', code: '51' },
  { short: '충북', label: '충청북도', code: '43' },
  { short: '충남', label: '충청남도', code: '44' },
  { short: '전북', label: '전북특별자치도', code: '52' },
  { short: '전남', label: '전라남도', code: '46' },
  { short: '경북', label: '경상북도', code: '47' },
  { short: '경남', label: '경상남도', code: '48' },
  { short: '제주', label: '제주특별자치도', code: '50' }
] as const;

export type SidoShort = (typeof SIDO_LUT)[number]['short'];

const LABEL = new Map(SIDO_LUT.map((r) => [r.short, r.label]));
const CODE = new Map(SIDO_LUT.map((r) => [r.short, r.code]));

export function sidoLabel(short: string): string | null {
  return LABEL.get(short as SidoShort) ?? null;
}
export function sidoCode(short: string): string | null {
  return CODE.get(short as SidoShort) ?? null;
}
