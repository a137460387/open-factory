import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { zhCN } from '../../i18n/strings';
import type { ToastEventDetail } from '../../lib/toast';
import { useSafeTimeout } from '../../hooks/useSafeTimeout';

interface ToastItem extends ToastEventDetail {
  id: number;
}

const toneClass = {
  info: 'border-slate-300 bg-white',
  success: 'border-emerald-300 bg-emerald-50',
  warning: 'border-amber-300 bg-amber-50',
  error: 'border-rose-300 bg-rose-50'
};

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const safeTimeout = useSafeTimeout();

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastEventDetail>).detail;
      const id = Date.now() + Math.random();
      setItems((current) => [...current, { id, kind: 'info', ...detail }]);
      safeTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== id));
      }, 4500);
    };
    window.addEventListener('open-factory-toast', onToast);
    return () => window.removeEventListener('open-factory-toast', onToast);
  }, [safeTimeout]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className={clsx('rounded-md border p-3 shadow-soft', toneClass[item.kind ?? 'info'])}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">{item.title}</div>
              {item.message ? <div className="mt-1 text-sm text-slate-600">{item.message}</div> : null}
              {item.action ? (
                <button
                  className="mt-2 rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-panel"
                  type="button"
                  data-testid="toast-action-button"
                  onClick={() => {
                    item.action?.onClick();
                    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
                  }}
                >
                  {item.action.label}
                </button>
              ) : null}
            </div>
            <button
              className="rounded p-1 text-slate-500 hover:bg-black/5"
              aria-label={zhCN.errors.dismissToast}
              onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
