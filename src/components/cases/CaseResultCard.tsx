import type { EiaCase } from '@/lib/types/case-search';

export default function CaseResultCard({
  eiaCase,
  onSelect
}: {
  eiaCase: EiaCase;
  onSelect: () => void;
}) {
  return (
    <article className="mb-3 rounded-md border border-border bg-surface p-4">
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <h2 className="text-h2">{eiaCase.biz_nm}</h2>
        <p className="text-small text-text-secondary">
          {eiaCase.region_sido
            ? `${eiaCase.region_sido} ${eiaCase.region_sigungu ?? ''}`
            : '지역 미상'}
          {eiaCase.capacity_mw != null ? ` · ${eiaCase.capacity_mw} MW` : ''}
          {eiaCase.evaluation_year != null ? ` · ${eiaCase.evaluation_year}` : ''}
          {' · '}
          <span className="rounded bg-bg px-1">{eiaCase.evaluation_stage}</span>
        </p>
      </button>
    </article>
  );
}
