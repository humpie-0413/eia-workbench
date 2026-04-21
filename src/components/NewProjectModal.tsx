import { useEffect, useRef, useState } from 'react';
import data from '@/data/administrative-divisions.json';
import { pushToast } from './toast-store';

type Region = { code: string; name: string; subs: Array<{ code: string; name: string }> };
const regions = (data as { regions: Region[] }).regions;

export default function NewProjectModal() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [regionCode, setRegionCode] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null); // P3: opener ref

  // P3: show/close + initial focus + focus restore on close
  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
      queueMicrotask(() => firstRef.current?.focus());
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  const subs = regions.find((r) => r.code === regionCode)?.subs ?? [];

  function closeModal() {
    setOpen(false);
    // P3: restore focus to opener
    queueMicrotask(() => openerRef.current?.focus());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: String(form.get('name') ?? ''),
      industry: 'onshore_wind'
    };
    const reg = String(form.get('site_region_code') ?? '');
    const sub = String(form.get('site_sub_region_code') ?? '');
    if (reg) {
      body.site_region_code = reg;
      body.site_region = regions.find((r) => r.code === reg)?.name;
    }
    if (sub) {
      body.site_sub_region_code = sub;
      body.site_sub_region = regions
        .find((r) => r.code === reg)
        ?.subs.find((s) => s.code === sub)?.name;
    }
    const capRaw = String(form.get('capacity_mw') ?? '');
    if (capRaw) body.capacity_mw = Number(capRaw);

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    setSubmitting(false);
    if (res.status === 201) {
      const { id } = (await res.json()) as { id: string };
      window.location.href = `/projects/${id}`;
      return;
    }
    pushToast('error', '프로젝트 생성에 실패했습니다. 입력값을 다시 확인해 주세요.');
  }

  return (
    <>
      <button
        type="button"
        ref={openerRef}
        onClick={() => setOpen(true)}
        className="h-9 rounded-md bg-primary px-4 text-white hover:bg-primary-hover"
      >
        새 프로젝트
      </button>
      <dialog ref={dialogRef} onClose={closeModal} className="rounded-md p-0 backdrop:bg-black/40">
        <form
          method="dialog"
          onSubmit={handleSubmit}
          className="w-[32rem] space-y-4 bg-surface p-6"
        >
          <h2 className="text-h1">새 프로젝트</h2>
          <label className="block space-y-1">
            <span className="text-body font-semibold">이름 *</span>
            <input
              ref={firstRef}
              name="name"
              required
              maxLength={200}
              className="h-9 w-full rounded-md border border-border px-3"
            />
          </label>
          <div className="space-y-1">
            <span className="text-body font-semibold">업종</span>
            <p className="flex h-9 items-center rounded-md border border-border bg-bg px-3 text-text-secondary">
              육상풍력 (onshore_wind) · v0 고정
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-body font-semibold">시/도</span>
              <select
                name="site_region_code"
                value={regionCode}
                onChange={(e) => setRegionCode(e.target.value)}
                className="h-9 w-full rounded-md border border-border px-3"
              >
                <option value="">선택 없음</option>
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-body font-semibold">시/군/구</span>
              <select
                name="site_sub_region_code"
                disabled={!regionCode}
                className="h-9 w-full rounded-md border border-border px-3"
              >
                <option value="">선택 없음</option>
                {subs.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-body font-semibold">용량 (MW, 선택)</span>
            <input
              name="capacity_mw"
              type="number"
              min={0}
              max={10000}
              step={0.1}
              className="h-9 w-full rounded-md border border-border px-3"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="h-9 rounded-md border border-border px-4"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 rounded-md bg-primary px-4 text-white disabled:opacity-50"
            >
              {submitting ? '생성 중…' : '만들기'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
