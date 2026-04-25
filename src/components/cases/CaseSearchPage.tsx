import { useEffect, useState } from 'react';
import CaseFacetPanel from './CaseFacetPanel';
import CaseResultCard from './CaseResultCard';
import CasePreviewPane from './CasePreviewPane';
import CaseSearchGuide from './CaseSearchGuide';
import type { CaseSearchResult, EiaCase } from '@/lib/types/case-search';
import { exportCasesToMarkdown } from '@/features/similar-cases/markdown-export';

function readQ(): string {
  if (typeof window === 'undefined') return '';
  return new URL(window.location.href).searchParams.get('q') ?? '';
}

export default function CaseSearchPage() {
  const [q, setQ] = useState<string>(() => readQ());
  const [data, setData] = useState<CaseSearchResult | null>(null);
  const [selected, setSelected] = useState<EiaCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  function downloadMarkdown() {
    if (!data) return;
    const url = new URL(window.location.href);
    const qParam = url.searchParams.get('q');
    const ctx: Parameters<typeof exportCasesToMarkdown>[1] = {
      sido: url.searchParams.getAll('sido'),
      capacity_band: url.searchParams.getAll('capacity_band'),
      year: url.searchParams.getAll('year').map(Number).filter(Number.isFinite)
    };
    if (qParam) ctx.q = qParam;
    const md = exportCasesToMarkdown(data.items, ctx);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cases-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = setTimeout(async () => {
      setLoading(true);
      const url = new URL(window.location.href);
      if (q) url.searchParams.set('q', q);
      else url.searchParams.delete('q');
      window.history.replaceState({}, '', url.toString());

      const apiUrl = new URL('/api/cases', window.location.origin);
      url.searchParams.forEach((v, k) => apiUrl.searchParams.append(k, v));
      try {
        const res = await fetch(apiUrl.toString());
        if (res.ok) {
          const body = (await res.json()) as CaseSearchResult;
          setData(body);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, tick]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="case-q">
          검색어
        </label>
        <input
          id="case-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="사업명·지역명 검색 (예: 강원 평창 풍력)"
          className="h-10 min-w-[200px] flex-1 rounded-md border border-border bg-surface px-3"
        />
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-md border border-border px-3 text-small hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50"
          onClick={downloadMarkdown}
          disabled={!data || data.items.length === 0}
        >
          Markdown 내보내기
        </button>
      </div>
      <CaseSearchGuide />

      <div className="grid gap-4 md:grid-cols-[220px_1fr_320px]">
        <CaseFacetPanel onChange={() => setTick((n) => n + 1)} />
        <section aria-label="결과 리스트">
          {loading ? <p className="text-small text-text-tertiary">불러오는 중…</p> : null}
          {data && data.total === 0 ? (
            <p className="rounded-md border border-border bg-surface p-6 text-small text-text-secondary">
              조건에 맞는 사례가 없습니다. facet 을 줄이거나 검색어를 짧게 해보세요.
            </p>
          ) : null}
          {data?.items.map((c) => (
            <CaseResultCard key={c.eia_cd} eiaCase={c} onSelect={() => setSelected(c)} />
          ))}
          {data && data.total > data.items.length ? (
            <details className="mt-2 text-small text-text-tertiary">
              <summary>전체 {data.total}건</summary>
            </details>
          ) : null}
        </section>
        <aside aria-label="미리보기" className="hidden md:block">
          <CasePreviewPane eiaCase={selected} />
        </aside>
      </div>
    </div>
  );
}
