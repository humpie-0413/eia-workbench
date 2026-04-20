import { useStore } from '@nanostores/react';
import { $toasts, dismiss, type Toast } from './toast-store';

const KIND_STYLE: Record<Toast['kind'], string> = {
  info: 'bg-surface border-border text-text-primary',
  warn: 'bg-warning-bg border-warning text-warning',
  error: 'bg-danger-bg border-danger text-danger'
};

export default function Toast() {
  const items = useStore($toasts);
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2" role="region" aria-label="알림">
      {items.map((t) => (
        <div key={t.id} role="alert"
             className={`border rounded-md px-4 py-2 text-small shadow-sm ${KIND_STYLE[t.kind]}`}>
          <span>{t.message}</span>
          <button onClick={() => dismiss(t.id)} aria-label="닫기" className="ml-3 text-text-tertiary">×</button>
        </div>
      ))}
    </div>
  );
}
