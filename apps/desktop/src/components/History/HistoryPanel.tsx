import { GitBranch, History, MousePointer2 } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { showToast } from '../../lib/toast';
import { commandManager } from '../../store/commandManager';
import { useEditorStore } from '../../store/editorStore';

export function HistoryPanel() {
  const historyMeta = useEditorStore((state) => state.historyMeta);
  const t = zhCN.historyPanel;

  const jumpTo = (entryId: string, index: number) => {
    try {
      commandManager.jumpToEntry(entryId);
    } catch (error) {
      showToast({ kind: 'warning', title: t.jumpFailed, message: error instanceof Error ? error.message : t.jumpFailedMessage });
      commandManager.jumpTo(index);
    }
  };

  return (
    <aside className="flex min-h-0 flex-col bg-white" data-testid="history-panel">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <History size={16} />
        <div>
          <div className="text-sm font-semibold">{t.title}</div>
          <div className="text-xs text-slate-500">{t.subtitle}</div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {historyMeta.entries.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500" data-testid="history-empty-state">
            {t.empty}
          </div>
        ) : (
          <div className="space-y-2">
            {historyMeta.entries.map((entry, index) => {
              const current = entry.isCurrent ?? index === historyMeta.cursor;
              const depth = entry.branchDepth ?? 0;
              const isBranched = (entry.siblingCount ?? 0) > 1;
              return (
                <button
                  key={entry.id}
                  className={`w-full rounded-md border px-3 py-2 text-left transition ${
                    current
                      ? 'border-brand bg-[#e9f7f3] text-ink'
                      : entry.activePath
                        ? 'border-line bg-white text-slate-700 hover:bg-panel'
                        : 'border-line bg-white text-slate-500 hover:bg-panel'
                  }`}
                  type="button"
                  data-testid="history-entry"
                  data-history-index={index}
                  data-history-id={entry.id}
                  data-branch-depth={depth}
                  data-active-path={entry.activePath ? 'true' : 'false'}
                  data-current={current ? 'true' : 'false'}
                  style={{ paddingLeft: `${12 + depth * 14}px` }}
                  onClick={() => jumpTo(entry.id, index)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {depth > 0 ? <span className="h-6 w-px shrink-0 bg-line" aria-hidden="true" /> : null}
                        <div className="truncate text-sm font-semibold">{entry.description}</div>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <MousePointer2 size={12} />
                        <span>{t.affectedClips(entry.affectedClipCount)}</span>
                        {isBranched ? (
                          <span className="inline-flex items-center gap-1 rounded border border-line bg-panel px-1.5 py-0.5" data-testid="history-branch-badge">
                            <GitBranch size={11} />
                            {t.branchLabel((entry.branchIndex ?? 0) + 1, entry.siblingCount ?? 1)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <time className="shrink-0 text-xs tabular-nums text-slate-500">{formatHistoryTime(entry.timestamp)}</time>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="border-t border-line px-3 py-2 text-xs font-medium text-slate-600" data-testid="history-position">
        {t.position(historyMeta.position, historyMeta.total)}
      </div>
    </aside>
  );
}

function formatHistoryTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
