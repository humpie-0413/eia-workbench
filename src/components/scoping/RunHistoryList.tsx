import { useCallback, useEffect, useState } from 'react';
import { pushToast } from '../toast-store';

interface HistoryRow {
  id: string;
  rule_pack_version: string;
  created_at: string;
}

export interface RunHistoryListProps {
  projectId: string;
}

export default function RunHistoryList({ projectId }: RunHistoryListProps) {
  const [items, setItems] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/scoping/runs`);
      if (!res.ok) return;
      const j = (await res.json()) as { runs: HistoryRow[] };
      setItems(j.runs);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener('scoping:run', h);
    return () => window.removeEventListener('scoping:run', h);
  }, [refresh]);

  async function loadRun(id: string) {
    const res = await fetch(`/api/projects/${projectId}/scoping/runs/${id}`);
    if (!res.ok) {
      pushToast('error', `실행 로드 실패 (HTTP ${res.status}).`);
      return;
    }
    const j = await res.json();
    window.dispatchEvent(new CustomEvent('scoping:load-run', { detail: j }));
  }

  async function del(id: string) {
    const res = await fetch(`/api/projects/${projectId}/scoping/runs/${id}`, { method: 'DELETE' });
    if (res.status === 204) {
      pushToast('info', '실행 기록을 소프트 삭제했습니다.');
      refresh();
    } else {
      pushToast('error', `삭제 실패 (HTTP ${res.status}).`);
    }
  }

  return (
    <section aria-label="최근 검토 실행" className="rounded-md border border-border bg-surface p-4">
      <h2 className="text-h2">최근 실행</h2>
      {loading ? (
        <p className="mt-2 text-small text-text-tertiary">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-small text-text-tertiary">아직 실행 기록이 없습니다.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {items.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2 text-small">
              <button
                type="button"
                onClick={() => loadRun(r.id)}
                className="flex-1 text-left text-text-primary hover:underline"
                aria-label={`${new Date(r.created_at).toLocaleString('ko-KR')} 실행 불러오기`}
              >
                <div>{new Date(r.created_at).toLocaleString('ko-KR')}</div>
                <div className="text-text-tertiary">{r.rule_pack_version}</div>
              </button>
              <button
                type="button"
                onClick={() => del(r.id)}
                aria-label={`${r.id} 실행 삭제`}
                className="text-small text-danger hover:underline"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
