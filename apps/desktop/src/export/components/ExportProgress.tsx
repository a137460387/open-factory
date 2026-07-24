import type { ExportState } from '../hooks/useExportState';
import type { ExportActions } from '../hooks/useExportActions';
import { Clock3, ListPlus, Minimize2, Trash2 } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { ExportTaskRow } from './ExportTaskRow';
import { PreflightPanel } from './PreflightPanel';
import { ExportWarmupStatusPanel } from './ExportOptimizationPanel';
import { formatExportWarning } from '../export-utils';
import { minimizeToTray } from '../../lib/tauri-bridge';
import { setExportQueuePaused, setExportQueueMaxConcurrent } from '../export-queue-runner';

interface ExportProgressProps {
  state: ExportState;
  actions: ExportActions;
}

export function ExportProgress({ state, actions }: ExportProgressProps) {
  const {
    t,
    error,
    preflight,
    warmupStatus,
    tasks,
    runnerActive,
    resourcePaused,
    queuePaused,
    maxConcurrent,
    clearFinishedTasks,
    capabilities,
    hardwareEncodingRequested,
  } = state;

  return (
    <>
      {/* Preflight */}
      {preflight ? (
        <PreflightPanel
          issues={preflight.issues}
          onDismiss={() => state.setPreflight(undefined)}
          onContinue={() => void actions.continueAfterWarnings()}
          onRelink={state.onRelinkMissing ? actions.relinkFromPreflight : undefined}
        />
      ) : null}

      {/* Hardware encoding fallback warning */}
      {hardwareEncodingRequested && capabilities && !capabilities.hardwareEncoderAvailable ? (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900"
          data-testid="export-hardware-fallback-warning"
        >
          {t.hardwareEncodingFallback}
        </div>
      ) : null}

      {/* Warmup status */}
      {warmupStatus ? <ExportWarmupStatusPanel status={warmupStatus} /> : null}

      {/* Error display */}
      {error ? (
        <pre className="max-h-32 overflow-auto rounded-md bg-rose-50 p-2 text-xs text-rose-800 whitespace-pre-wrap">
          {error}
        </pre>
      ) : null}

      {/* Queue list */}
      <div className="rounded-md border border-line" data-testid="export-queue-list">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <div>
            <div className="text-xs font-semibold text-slate-700">{t.queueTitle}</div>
            <div className="text-[11px] text-slate-500">
              {queuePaused
                ? t.queuePausedByUser
                : resourcePaused
                  ? t.queuePausedForMemory
                  : runnerActive
                    ? t.queueRunning(maxConcurrent)
                    : zhCN.common.idle}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
              <span>{t.maxConcurrent}</span>
              <select
                className="rounded-md border border-line px-2 py-1"
                value={maxConcurrent}
                onChange={(event) => setExportQueueMaxConcurrent(Number(event.target.value))}
                data-testid="export-max-concurrent-select"
              >
                {[1, 2, 3, 4].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel"
              onClick={clearFinishedTasks}
            >
              <Trash2 size={13} />
              {t.clearFinished}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel"
              type="button"
              data-testid="export-queue-pause-button"
              onClick={() => setExportQueuePaused(!queuePaused)}
            >
              <Clock3 size={13} />
              {queuePaused ? t.resumeQueue : t.pauseQueue}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel"
              type="button"
              data-testid="export-minimize-to-tray-button"
              onClick={() => void minimizeToTray()}
            >
              <Minimize2 size={13} />
              {t.minimizeToTray}
            </button>
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="px-3 py-5 text-center text-xs text-slate-500">{t.noTasks}</div>
          ) : (
            tasks.map((task) => <ExportTaskRow key={task.id} taskId={task.id} />)
          )}
        </div>
      </div>
    </>
  );
}
