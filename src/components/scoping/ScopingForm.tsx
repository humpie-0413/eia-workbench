import { useId, useState } from 'react';
import AreaInput from './AreaInput';
import { pushToast } from '../toast-store';
import { normalizeAreaToSqm, type AreaUnit } from '@/features/scoping/units';
import { LAND_USE_ZONES, zoneLabelKo, type LandUseZone } from '@/features/scoping/zone';

export interface ScopingFormProps {
  projectId: string;
  projectCapacityMw: number | null;
}

export default function ScopingForm({ projectId, projectCapacityMw }: ScopingFormProps) {
  const zoneId = useId();
  const capId = useId();
  const notesId = useId();
  const [siteArea, setSiteArea] = useState('');
  const [siteUnit, setSiteUnit] = useState<AreaUnit>('sqm');
  const [zone, setZone] = useState<LandUseZone>('planning_management');
  const [forestArea, setForestArea] = useState('');
  const [forestUnit, setForestUnit] = useState<AreaUnit>('sqm');
  const [capOverride, setCapOverride] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const siteNum = Number(siteArea);
    if (!Number.isFinite(siteNum) || siteNum < 0) {
      pushToast('error', '사업면적은 0 이상 숫자여야 합니다.');
      return;
    }
    const body: Record<string, unknown> = {
      site_area_m2: normalizeAreaToSqm(siteNum, siteUnit),
      site_area_input_unit: siteUnit,
      land_use_zone: zone
    };
    if (forestArea.trim() !== '') {
      const fn = Number(forestArea);
      if (Number.isFinite(fn) && fn >= 0) {
        body.forest_conversion_m2 = normalizeAreaToSqm(fn, forestUnit);
        body.forest_conversion_input_unit = forestUnit;
      }
    }
    if (capOverride.trim() !== '') {
      const cn = Number(capOverride);
      if (Number.isFinite(cn) && cn >= 0) body.capacity_mw_override = cn;
    }
    if (notes.trim() !== '') body.notes = notes.trim();

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/scoping`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        pushToast('error', `검토 실행 실패 (HTTP ${res.status}).`);
        return;
      }
      const data = await res.json();
      pushToast('info', '검토 보조 결과를 갱신했습니다.');
      window.dispatchEvent(new CustomEvent('scoping:run', { detail: data }));
    } finally {
      setSubmitting(false);
    }
  }

  const capDescId = `${capId}-desc`;
  return (
    <form
      onSubmit={onSubmit}
      aria-label="스코핑 입력"
      className="space-y-4 rounded-md border border-border bg-surface p-4"
    >
      <h2 className="text-h2">검토 입력</h2>
      <AreaInput
        label="사업부지 면적"
        value={siteArea}
        unit={siteUnit}
        onValueChange={setSiteArea}
        onUnitChange={setSiteUnit}
        required
        placeholder="예: 8000"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={zoneId} className="text-small font-semibold text-text-primary">
          용도지역
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
        </label>
        <select
          id={zoneId}
          value={zone}
          onChange={(e) => setZone(e.target.value as LandUseZone)}
          className="h-9 rounded-md border border-border bg-surface px-2 text-body"
          aria-required="true"
        >
          {LAND_USE_ZONES.map((z) => (
            <option key={z} value={z}>
              {zoneLabelKo(z)}
            </option>
          ))}
        </select>
      </div>
      <AreaInput
        label="산지전용 예정 면적 (선택)"
        value={forestArea}
        unit={forestUnit}
        onValueChange={setForestArea}
        onUnitChange={setForestUnit}
        placeholder="예: 800"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={capId} className="text-small font-semibold text-text-primary">
          발전용량 덮어쓰기 (MW, 선택)
        </label>
        <input
          id={capId}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={capOverride}
          onChange={(e) => setCapOverride(e.target.value)}
          placeholder={projectCapacityMw != null ? `프로젝트 값: ${projectCapacityMw}` : '예: 120'}
          aria-describedby={capDescId}
          className="h-9 rounded-md border border-border bg-surface px-3 text-body"
        />
        <p id={capDescId} className="text-small text-text-tertiary">
          비우면 프로젝트에 저장된 값을 사용합니다.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={notesId} className="text-small font-semibold text-text-primary">
          메모 (선택)
        </label>
        <textarea
          id={notesId}
          rows={3}
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-body"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="h-9 w-full rounded-md bg-primary px-4 text-small font-semibold text-surface hover:bg-primary-hover disabled:opacity-50"
      >
        {submitting ? '검토 실행 중…' : '검토 실행'}
      </button>
    </form>
  );
}
