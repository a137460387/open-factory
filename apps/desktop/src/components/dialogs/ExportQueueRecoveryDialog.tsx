import { useState } from 'react';
import type { ExportQueueRecoveryCandidate } from '../../export/export-queue-persistence';
import { zhCN } from '../../i18n/strings';

export function ExportQueueRecoveryDialog({
  candidate,
  onRestoreAll,
  onRestoreSelected,
  onDiscardAll
}: {
  candidate: ExportQueueRecoveryCandidate;
  onRestoreAll(): void;
  onRestoreSelected(taskIds: string[]): void;
  onDiscardAll(): void;
}) {
  const [selectedIds, setSelectedIds] = useState(() => candidate.tasks.map((task) => task.id));
  const selected = new Set(selectedIds);
  const t = zhCN.exportDialog.recovery;

  function toggleTask(taskId: string, checked: boolean): void {
    setSelectedIds((current) => (checked ? Array.from(new Set([...current, taskId])) : current.filter((id) => id !== taskId)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="export-queue-recovery-dialog">
      <section className="w-full max-w-lg rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{t.title(candidate.tasks.length)}</h2>
          <div className="mt-1 text-xs text-slate-500">
            {t.pendingSummary(candidate.pendingCount)} · {t.interruptedSummary(candidate.interruptedCount)}
          </div>
        </div>
        <div className="max-h-[42vh] overflow-y-auto px-4 py-3">
          <div className="space-y-2">
            {candidate.tasks.map((task) => (
              <label key={task.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border border-line px-3 py-2 text-xs" data-testid="export-queue-recovery-task">
                <input
                  className="h-4 w-4 accent-brand"
                  type="checkbox"
                  checked={selected.has(task.id)}
                  aria-label={t.selectTask}
                  onChange={(event) => toggleTask(task.id, event.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">{task.name}</span>
                  <span className="block truncate text-[11px] text-slate-500">{task.outputPath}</span>
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700" data-testid="export-queue-recovery-task-status" data-status={task.status}>
                  {zhCN.exportDialog.status[task.status]}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
          <button className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel" type="button" data-testid="export-queue-discard-all" onClick={onDiscardAll}>
            {t.discardAll}
          </button>
          <button
            className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45"
            type="button"
            data-testid="export-queue-restore-selected"
            disabled={selectedIds.length === 0}
            onClick={() => onRestoreSelected(selectedIds)}
          >
            {t.restoreSelected}
          </button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]" type="button" data-testid="export-queue-restore-all" onClick={onRestoreAll}>
            {t.restoreAll}
          </button>
        </div>
      </section>
    </div>
  );
}
