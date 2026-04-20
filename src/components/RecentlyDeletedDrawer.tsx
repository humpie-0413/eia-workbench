import { useEffect, useRef, useState } from 'react';
import { pushToast } from './toast-store';

type DelP = { id: string; name: string; deleted_at: string };
type DelU = { id: string; project_id: string; original_name: string; deleted_at: string };

export default function RecentlyDeletedDrawer() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<DelP[]>([]);
  const [uploads, setUploads] = useState<DelU[]>([]);
  const openerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const r = await fetch('/api/deleted');
      if (!r.ok) return;
      const j = (await r.json()) as { projects: DelP[]; uploads: DelU[] };
      setProjects(j.projects);
      setUploads(j.uploads);
    } catch {
      pushToast('error', '목록을 불러오지 못했습니다.');
    }
  }

  function close() {
    setOpen(false);
    queueMicrotask(() => openerRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    void refresh();
    queueMicrotask(() => panelRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        queueMicrotask(() => openerRef.current?.focus());
        return;
      }
      if (e.key === 'Tab') {
        const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
          'a, button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        );
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function daysLeft(ts: string): number {
    const deleted = new Date(ts).getTime();
    const expires = deleted + 30 * 24 * 3600 * 1000;
    return Math.max(0, Math.ceil((expires - Date.now()) / (24 * 3600 * 1000)));
  }

  async function restoreProject(id: string) {
    try {
      const r = await fetch(`/api/projects/${id}/restore`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' }
      });
      if (r.status === 204) {
        pushToast('info', '프로젝트를 복구했습니다.');
        void refresh();
      } else {
        pushToast('error', `복구 실패 (HTTP ${r.status}).`);
      }
    } catch {
      pushToast('error', '복구 중 오류가 발생했습니다.');
    }
  }

  async function restoreUpload(pid: string, uid: string) {
    try {
      const r = await fetch(`/api/projects/${pid}/uploads/${uid}/restore`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' }
      });
      if (r.status === 204) {
        pushToast('info', '파일을 복구했습니다.');
        void refresh();
      } else {
        pushToast('error', `복구 실패 (HTTP ${r.status}).`);
      }
    } catch {
      pushToast('error', '복구 중 오류가 발생했습니다.');
    }
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 rounded-md border border-border bg-surface px-4 text-small text-text-secondary"
      >
        최근 삭제
      </button>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="최근 삭제함"
            tabIndex={-1}
            className="absolute right-0 top-0 h-full w-96 overflow-y-auto border-l border-border bg-surface p-6 focus:outline-none"
          >
            <h2 className="mb-4 text-h1">최근 삭제 (30일 내)</h2>

            <section className="mb-6">
              <h3 className="mb-2 text-h2">프로젝트</h3>
              {projects.length === 0 ? (
                <p className="text-small text-text-tertiary">없음.</p>
              ) : (
                projects.map((x) => (
                  <div
                    key={x.id}
                    className="flex items-center justify-between border-b border-border py-2"
                  >
                    <div>
                      <p>{x.name}</p>
                      <p className="text-small text-text-tertiary">
                        D-{daysLeft(x.deleted_at)} 남음
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreProject(x.id)}
                      className="text-small text-primary hover:underline"
                    >
                      되돌리기
                    </button>
                  </div>
                ))
              )}
            </section>

            <section>
              <h3 className="mb-2 text-h2">파일</h3>
              {uploads.length === 0 ? (
                <p className="text-small text-text-tertiary">없음.</p>
              ) : (
                uploads.map((x) => (
                  <div
                    key={x.id}
                    className="flex items-center justify-between border-b border-border py-2"
                  >
                    <div>
                      <p>{x.original_name}</p>
                      <p className="text-small text-text-tertiary">
                        D-{daysLeft(x.deleted_at)} 남음
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreUpload(x.project_id, x.id)}
                      className="text-small text-primary hover:underline"
                    >
                      되돌리기
                    </button>
                  </div>
                ))
              )}
            </section>

            <button
              type="button"
              onClick={close}
              className="mt-6 h-9 rounded-md border border-border px-4"
            >
              닫기
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
