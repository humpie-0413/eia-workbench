import { atom } from 'nanostores';

export type Toast = { id: string; kind: 'info' | 'warn' | 'error'; message: string };
export const $toasts = atom<Toast[]>([]);

export function pushToast(kind: Toast['kind'], message: string) {
  const id = Math.random().toString(36).slice(2);
  $toasts.set([...$toasts.get(), { id, kind, message }]);
  setTimeout(() => $toasts.set($toasts.get().filter((t) => t.id !== id)), 5000);
}

export function dismiss(id: string) {
  $toasts.set($toasts.get().filter((t) => t.id !== id));
}
