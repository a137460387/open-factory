import type { ExportState } from '../hooks/useExportState';
import type { ExportActions } from '../hooks/useExportActions';
import { StatusPill } from './ExportTaskRow';
import {
  PostExportScriptResultPanel,
  ExportRecoveryPanel,
  PostExportQualityAssurancePanel,
} from './PostExportStatusPanels';
import { QualityResultPanel } from './QualityResultPanel';
import { ExportUploadStatusPanel } from './ExportUploadSection';
import { priorityLabel } from '../lib/exportFormatHelpers';
import { openPath } from '../../lib/tauri-bridge';

interface ExportHistoryProps {
  state: ExportState;
  actions: ExportActions;
}

export function ExportHistory({ state, actions }: ExportHistoryProps) {
  const { t, history, qualityTaskId, qualityProgress, qualityResult, qualityError } = state;

  return (
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
                  onClick={() => void actions.evaluateHistoryQuality(entry)}
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
                  onRetry={entry.upload.status === 'error' ? () => void actions.retryHistoryUpload(entry) : undefined}
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
          onCancel={() => void actions.cancelRunningQualityEvaluation()}
        />
      ) : null}
    </div>
  );
}
