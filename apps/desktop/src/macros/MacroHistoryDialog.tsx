import { X } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import type { MacroHistoryEntry } from './clip-macros';

interface MacroHistoryDialogProps {
  entries: MacroHistoryEntry[];
  onClose(): void;
}

export function MacroHistoryDialog({ entries, onClose }: MacroHistoryDialogProps) {
  const t = zhCN.macros.history;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="macro-history-dialog"
    >
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <div className="text-xs text-slate-500">{t.subtitle}</div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel"
            type="button"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="macro-history-close-button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 overflow-auto p-4">
          {entries.length === 0 ? (
            <div
              className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600"
              data-testid="macro-history-empty"
            >
              {t.empty}
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-3 py-2">{t.macroName}</th>
                    <th className="px-3 py-2">{t.triggeredAt}</th>
                    <th className="px-3 py-2">{t.targetClip}</th>
                    <th className="px-3 py-2">{t.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {entries.map((entry) => (
                    <tr key={entry.id} data-testid="macro-history-row">
                      <td className="px-3 py-2 font-medium text-ink">{entry.macroName}</td>
                      <td className="px-3 py-2 text-slate-600">{formatHistoryTime(entry.triggeredAt)}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {entry.targetClipName ?? entry.targetClipId ?? zhCN.common.none}
                      </td>
                      <td
                        className={
                          entry.success
                            ? 'px-3 py-2 font-semibold text-emerald-700'
                            : 'px-3 py-2 font-semibold text-rose-700'
                        }
                      >
                        {entry.success ? t.success : (entry.error ?? t.failed)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatHistoryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
