import type { ExportTaskHistoryEntry } from "@open-factory/editor-core";
import { Clock3, Minimize2, Trash2 } from "lucide-react";
import { zhCN } from "../../i18n/strings";
import { ExportTaskRow, StatusPill } from "./ExportTaskRow";
import {
  PostExportScriptResultPanel,
  ExportRecoveryPanel,
  PostExportQualityAssurancePanel,
} from "./PostExportStatusPanels";
import { ExportUploadStatusPanel } from "./ExportUploadSection";
import { QualityResultPanel } from "./QualityResultPanel";
import { priorityLabel } from "../lib/exportFormatHelpers";
import { openPath } from "../../lib/tauri-bridge";
import { minimizeToTray } from "../../lib/tauri-bridge";
import { setExportQueueMaxConcurrent, setExportQueuePaused } from "../export-queue-runner";

export interface ExportQueuePanelProps {
  tasks: Array<{ id: string; status: string }>;
  history: ExportTaskHistoryEntry[];
  runnerActive: boolean;
  resourcePaused: boolean;
  queuePaused: boolean;
  maxConcurrent: number;
  clearFinishedTasks: () => void;
  qualityTaskId: string | undefined;
  qualityResult: { entry: ExportTaskHistoryEntry; result: { overallScore: number; ssim?: number; psnr?: number; vmaf?: number; details: Array<{ name: string; value: number | string; status: string }> } } | undefined;
  qualityProgress: number;
  qualityError: string | undefined;
  onEvaluateQuality: (entry: ExportTaskHistoryEntry) => void;
  onCancelQuality: () => void;
  onRetryUpload: (entry: ExportTaskHistoryEntry) => void;
}

export function ExportQueuePanel({
  tasks,
  history,
  runnerActive,
  resourcePaused,
  queuePaused,
  maxConcurrent,
  clearFinishedTasks,
  qualityTaskId,
  qualityResult,
  qualityProgress,
  qualityError,
  onEvaluateQuality,
  onCancelQuality,
  onRetryUpload,
}: ExportQueuePanelProps) {
  const t = zhCN.exportDialog;

  return (
    <>
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
          <div className="rounded-md border border-line" data-testid="export-history-list">
            <div className="border-b border-line px-3 py-2 text-xs font-semibold text-slate-700">{t.historyTitle}</div>
            <div className="max-h-32 overflow-y-auto">
              {history.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-500">{t.noHistory}</div>
              ) : (
                history.slice(0, 8).map((entry) => (
                  <div
                    key={entry.id}
                    className="border-b border-line px-3 py-2 text-xs last:border-b-0"
                    data-testid="export-history-entry"
                    data-status={entry.status}
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-800">{entry.name}</div>
                        <div className="truncate text-[11px] text-slate-500">{entry.outputPath}</div>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-500">{priorityLabel(entry.priority)}</span>
                      <StatusPill status={entry.status} />
                      {entry.logPath ? (
                        <button
                          className="rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel"
                          data-testid="export-history-log-button"
                          onClick={() => void openPath(entry.logPath!)}
                        >
                          {t.viewLog}
                        </button>
                      ) : null}
                      <button
                        className="rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        data-testid="export-quality-button"
                        disabled={entry.status !== 'success' || !entry.sourcePath || Boolean(qualityTaskId)}
                        title={!entry.sourcePath ? t.quality.sourceMissing : undefined}
                        onClick={() => void evaluateHistoryQuality(entry)}
                      >
                        {t.quality.button}
                      </button>
                    </div>
                    {entry.report?.recovery ? <ExportRecoveryPanel report={entry.report.recovery} /> : null}
                    {entry.report?.qualityAssurance ? (
                      <PostExportQualityAssurancePanel result={entry.report.qualityAssurance} />
                    ) : null}
                    {entry.report?.postExportScript ? (
                      <PostExportScriptResultPanel result={entry.report.postExportScript} />
                    ) : null}
                    {entry.upload ? (
                      <ExportUploadStatusPanel
                        upload={entry.upload}
                        onRetry={entry.upload.status === 'error' ? () => void retryHistoryUpload(entry) : undefined}
                      />
                    ) : null}
                  </div>
                ))
              )}
            </div>
            {qualityTaskId || qualityResult || qualityError ? (
              <QualityResultPanel
                result={qualityResult?.result}
                running={Boolean(qualityTaskId)}
                progress={qualityProgress}
                error={qualityError}
                onCancel={() => void cancelRunningQualityEvaluation()}
              />
            ) : null}
          </div>

    </>
  );
}
