import { useRef, useState } from 'react';
import { pushToast } from './toast-store';

const ALLOWED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);
const MAX_BYTES = 30 * 1024 * 1024;

export default function UploadDropzone({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.name.match(/\.(hwp|hwpx)$/i)) {
      pushToast('warn', 'HWP는 한컴오피스에서 PDF로 저장 후 업로드해 주세요.');
      return;
    }
    if (!ALLOWED.has(file.type)) {
      pushToast('error', 'PDF / DOCX / TXT만 지원합니다.');
      return;
    }
    if (file.size > MAX_BYTES) {
      pushToast('error', '파일당 30MB 한도를 초과했습니다.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/uploads`, { method: 'POST', body: form });
    setBusy(false);
    if (res.status === 201) {
      pushToast('info', `업로드 완료: ${file.name}`);
      window.dispatchEvent(new CustomEvent('uploads:refresh'));
      return;
    }
    if (res.status === 409) {
      const j = (await res.json()) as { original_name: string; created_at: string };
      pushToast('warn', `이미 업로드됨: ${j.original_name} · ${new Date(j.created_at).toLocaleString('ko-KR')}`);
      return;
    }
    if (res.status === 413) {
      pushToast('error', '프로젝트 한도(300MB 또는 30파일)에 도달했습니다.');
      return;
    }
    if (res.status === 415) {
      pushToast('error', '파일 형식 검증에 실패했습니다.');
      return;
    }
    pushToast('error', `업로드 실패 (HTTP ${res.status}).`);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={async (e) => {
        e.preventDefault();
        for (const f of Array.from(e.dataTransfer.files)) await upload(f);
      }}
      className="border-2 border-dashed border-border rounded-md p-8 text-center bg-surface"
      role="region" aria-label="파일 업로드 영역"
    >
      <p className="text-body">
        PDF / DOCX / TXT만 지원합니다.
        HWP는 한컴오피스에서 PDF로 저장 후 업로드해 주세요.{' '}
        <a href="https://www.hancomoffice.com/" target="_blank" rel="noreferrer"
           className="text-primary underline">온라인 변환 안내 ↗</a>
      </p>
      <p className="text-small text-text-tertiary mt-1">드래그하여 놓거나 버튼으로 선택.</p>
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
              className="mt-4 h-9 px-4 rounded-md bg-primary text-white disabled:opacity-50">
        {busy ? '업로드 중…' : '파일 선택'}
      </button>
      <input ref={inputRef} type="file" hidden multiple
             accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
             onChange={async (e) => {
               for (const f of Array.from(e.target.files ?? [])) await upload(f);
               if (inputRef.current) inputRef.current.value = '';
             }} />
    </div>
  );
}
