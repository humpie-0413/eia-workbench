import type { EiaCase } from '@/lib/types/case-search';
import { eiassProjectUrl } from '../../../packages/eia-data/src/deep-link';

export default function CasePreviewPane({ eiaCase }: { eiaCase: EiaCase | null }) {
  if (!eiaCase) {
    return (
      <p className="text-small text-text-tertiary">카드를 선택하면 메타데이터가 표시됩니다.</p>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-border bg-surface p-4">
      <h2 className="text-h2">{eiaCase.biz_nm}</h2>
      <dl className="grid gap-1 text-small">
        <div>
          <dt className="inline text-text-secondary">위치: </dt>
          <dd className="inline">{eiaCase.eia_addr_txt ?? '미상'}</dd>
        </div>
        <div>
          <dt className="inline text-text-secondary">규모: </dt>
          <dd className="inline">
            {eiaCase.capacity_mw != null ? `${eiaCase.capacity_mw} MW` : '미상'}
          </dd>
        </div>
        <div>
          <dt className="inline text-text-secondary">평가시기: </dt>
          <dd className="inline">
            {eiaCase.evaluation_year ?? '미상'} ({eiaCase.evaluation_stage})
          </dd>
        </div>
        <div>
          <dt className="inline text-text-secondary">협의기관: </dt>
          <dd className="inline">{eiaCase.approv_organ_nm ?? '미상'}</dd>
        </div>
      </dl>
      <a
        href={eiassProjectUrl(eiaCase.eia_cd)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-small text-white hover:bg-primary-hover"
      >
        EIASS 원문 열기 ↗
      </a>
      <p className="text-small text-text-tertiary">
        본 도구는 사례 메타데이터만 표시합니다. 본문은 EIASS 원문에서 확인하세요.
      </p>
    </div>
  );
}
