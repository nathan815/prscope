import { create } from 'zustand';
import { useEffect, useRef } from 'react';

interface Toast {
  id: number;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  add: (message: string) => void;
  remove: (id: number) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string) {
  useToastStore.getState().add(message);
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => el.classList.add('translate-y-0', 'opacity-100'));
  }, []);

  return (
    <div
      ref={ref}
      onClick={onDismiss}
      className="translate-y-2 opacity-0 transition-all duration-200 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm px-4 py-2.5 rounded-lg shadow-lg cursor-pointer max-w-xs"
    >
      {t.message}
    </div>
  );
}
