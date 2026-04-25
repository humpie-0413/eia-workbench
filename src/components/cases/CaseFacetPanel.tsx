import { useEffect, useState } from 'react';
import { CAPACITY_BANDS } from '@/lib/schemas/case-search';
import { SIDO_LUT } from '@/features/similar-cases/sido-lut';

const YEARS = [2024, 2023, 2022, 2021, 2020];

export default function CaseFacetPanel({ onChange }: { onChange: () => void }) {
  const [sido, setSido] = useState<string[]>([]);
  const [bands, setBands] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);

  useEffect(() => {
    const sp = new URL(window.location.href).searchParams;
    setSido(sp.getAll('sido'));
    setBands(sp.getAll('capacity_band'));
    setYears(sp.getAll('year').map(Number).filter(Number.isFinite));
  }, []);

  function syncUrl(next: { sido?: string[]; bands?: string[]; years?: number[] }) {
    const url = new URL(window.location.href);
    url.searchParams.delete('sido');
    url.searchParams.delete('capacity_band');
    url.searchParams.delete('year');
    (next.sido ?? sido).forEach((v) => url.searchParams.append('sido', v));
    (next.bands ?? bands).forEach((v) => url.searchParams.append('capacity_band', v));
    (next.years ?? years).forEach((v) => url.searchParams.append('year', String(v)));
    window.history.replaceState({}, '', url.toString());
    onChange();
  }

  function toggle<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  return (
    <div className="space-y-4 text-small">
      <details open>
        <summary className="font-semibold">시·도</summary>
        <ul>
          {SIDO_LUT.map((r) => (
            <li key={r.short}>
              <label>
                <input
                  type="checkbox"
                  checked={sido.includes(r.short)}
                  onChange={() => {
                    const next = toggle(sido, r.short);
                    setSido(next);
                    syncUrl({ sido: next });
                  }}
                />{' '}
                {r.short}
              </label>
            </li>
          ))}
        </ul>
      </details>
      <details open>
        <summary className="font-semibold">규모(MW)</summary>
        <ul>
          {CAPACITY_BANDS.map((b) => (
            <li key={b}>
              <label>
                <input
                  type="checkbox"
                  checked={bands.includes(b)}
                  onChange={() => {
                    const next = toggle(bands, b);
                    setBands(next);
                    syncUrl({ bands: next });
                  }}
                />{' '}
                {b}
              </label>
            </li>
          ))}
        </ul>
      </details>
      <details open>
        <summary className="font-semibold">평가시기</summary>
        <ul>
          {YEARS.map((y) => (
            <li key={y}>
              <label>
                <input
                  type="checkbox"
                  checked={years.includes(y)}
                  onChange={() => {
                    const next = toggle(years, y);
                    setYears(next);
                    syncUrl({ years: next });
                  }}
                />{' '}
                {y}
              </label>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
