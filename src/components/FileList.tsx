import { useEffect, useState, useCallback } from 'react';
import { pushToast } from './toast-store';

type Upload = {
  id: string;
  original_name: string;
  mime: string;
  size_bytes: number;
  created_at: string;
};

export default function FileList({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<Upload[]>([]);
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/uploads`);
    if (!res.ok) return;
    const j = (await res.json()) as { uploads: Upload[] };
    setItems(j.uploads);
  }, [projectId]);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener('uploads:refresh', h);
    return () => window.removeEventListener('uploads:refresh', h);
  }, [refresh]);

  async function del(id: string) {
    const res = await fetch(`/api/projects/${projectId}/uploads/${id}`, { method: 'DELETE' });
    if (res.status === 204) {
      pushToast('info', '삭제했습니다. 30일 내 "최근 삭제"에서 복구 가능.');
      refresh();
    } else {
      pushToast('error', `삭제 실패 (HTTP ${res.status}).`);
    }
  }

  if (items.length === 0) {
    return <p className="text-small text-text-tertiary">업로드된 파일이 없습니다.</p>;
  }

  return (
    <table className="w-full overflow-hidden rounded-md border border-border">
      <thead className="bg-bg text-small text-text-secondary">
        <tr>
          <th className="px-4 py-2 text-left">이름</th>
          <th className="px-4 py-2 text-left">크기</th>
          <th className="px-4 py-2 text-left">업로드</th>
          <th className="sr-only px-4 py-2 text-left">동작</th>
        </tr>
      </thead>
      <tbody>
        {items.map((u) => (
          <tr key={u.id} className="border-t border-border">
            <td className="px-4 py-2">{u.original_name}</td>
            <td className="px-4 py-2 text-small text-text-secondary">
              {(u.size_bytes / 1024).toFixed(0)} KB
            </td>
            <td className="px-4 py-2 text-small text-text-tertiary">
              {new Date(u.created_at).toLocaleString('ko-KR')}
            </td>
            <td className="px-4 py-2 text-right">
              <button
                onClick={() => del(u.id)}
                aria-label={`${u.original_name} 삭제`}
                className="text-small text-danger hover:underline"
              >
                삭제
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
