import { SIDO_LUT, sidoLabel, sidoCode, type SidoShort } from './sido-lut';

const SIDO_SHORTS = SIDO_LUT.map((r) => r.short).join('|');
const SIDO_RE = new RegExp(`(${SIDO_SHORTS})(?:특별시|광역시|특별자치시|도|특별자치도)?`);
const SIGUNGU_RE = /(\S+?(?:시|군|구))/;

export interface RegionParts {
  sido: SidoShort | null;
  sidoLabel: string | null;
  sidoCode: string | null;
  sigungu: string | null;
}

export function parseRegion(addr: string): RegionParts {
  const m = SIDO_RE.exec(addr);
  if (!m) return { sido: null, sidoLabel: null, sidoCode: null, sigungu: null };
  const short = m[1] as SidoShort;
  const tail = addr.slice(m.index + m[0].length).trimStart();
  const sm = SIGUNGU_RE.exec(tail);
  return {
    sido: short,
    sidoLabel: sidoLabel(short),
    sidoCode: sidoCode(short),
    sigungu: sm ? (sm[1] ?? null) : null
  };
}
