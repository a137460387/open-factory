import { useState } from 'react';
import { exportTimeline, type Project, type TimelineExportFormat } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { openFileDialog, readFile, saveFileDialog, writeFile } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';

export interface TimelineImportSummary {
  title: string;
  matchedCount: number;
  missingCount: number;
}

interface TimelineExportDialogProps {
  project: Project;
  onClose(): void;
  onCompleted?(path: string): void;
  onImportEdl?(contents: string, path: string): TimelineImportSummary | Promise<TimelineImportSummary>;
  onImportFcpXml?(contents: string, path: string): TimelineImportSummary | Promise<TimelineImportSummary>;
}

export function TimelineExportDialog({
  project,
  onClose,
  onCompleted,
  onImportEdl,
  onImportFcpXml,
}: TimelineExportDialogProps) {
  const t = zhCN.timelineExport;
  const [format, setFormat] = useState<TimelineExportFormat>('edl');
  const [busy, setBusy] = useState(false);

  async function exportFile() {
    try {
      setBusy(true);
      const extension = format === 'edl' ? 'edl' : 'xml';
      const path = await saveFileDialog(`${project.name || 'timeline'}.${extension}`, [
        { name: t.filterName(format), extensions: [extension] },
      ]);
      if (!path) {
        return;
      }
      await writeFile(path, exportTimeline(project, format));
      showToast({ kind: 'success', title: t.success, message: path });
      onCompleted?.(path);
      onClose();
    } catch (error) {
      showToast({ kind: 'error', title: t.failed, message: error instanceof Error ? error.message : t.failedMessage });
    } finally {
      setBusy(false);
    }
  }

  async function importEdlFile() {
    if (!onImportEdl) {
      return;
    }
    try {
      setBusy(true);
      const [path] = await openFileDialog(false, [{ name: t.filterName('edl'), extensions: ['edl'] }]);
      if (!path) {
        return;
      }
      const summary = await onImportEdl(await readFile(path), path);
      showToast({
        kind: 'success',
        title: t.importSuccess,
        message: t.importSummary(summary.matchedCount, summary.missingCount),
      });
      onClose();
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.importFailed,
        message: error instanceof Error ? error.message : t.importFailedMessage,
      });
    } finally {
      setBusy(false);
    }
  }

  async function importFcpXmlFile() {
    if (!onImportFcpXml) {
      return;
    }
    try {
      setBusy(true);
      const [path] = await openFileDialog(false, [{ name: 'Final Cut Pro XML', extensions: ['xml'] }]);
      if (!path) {
        return;
      }
      const summary = await onImportFcpXml(await readFile(path), path);
      showToast({
        kind: 'success',
        title: t.importFcpXmlSuccess,
        message: t.importSummary(summary.matchedCount, summary.missingCount),
      });
      onClose();
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.importFcpXmlFailed,
        message: error instanceof Error ? error.message : t.importFcpXmlFailedMessage,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="timeline-export-dialog"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-soft">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-ink">{t.title}</h2>
          <p className="text-sm text-slate-500">{t.description}</p>
        </div>
        <label className="block text-xs font-medium text-slate-600">
          <span>{t.format}</span>
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={format}
            onChange={(event) => setFormat(event.target.value === 'fcp-xml' ? 'fcp-xml' : 'edl')}
            data-testid="timeline-export-format-select"
          >
            <option value="edl">{t.formats.edl}</option>
            <option value="fcp-xml">{t.formats.fcpXml}</option>
          </select>
        </label>
        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {onImportEdl ? (
              <button
                className="rounded-md border border-line px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel disabled:opacity-50"
                type="button"
                onClick={() => void importEdlFile()}
                disabled={busy}
                data-testid="timeline-import-edl-button"
              >
                {busy ? t.importing : t.importEdl}
              </button>
            ) : (
              <span />
            )}
            {onImportFcpXml ? (
              <button
                className="rounded-md border border-line px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel disabled:opacity-50"
                type="button"
                onClick={() => void importFcpXmlFile()}
                disabled={busy}
                data-testid="timeline-import-fcpxml-button"
              >
                {busy ? t.importing : t.importFcpXml}
              </button>
            ) : (
              <span />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              className="rounded-md border border-line px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel"
              type="button"
              onClick={onClose}
              disabled={busy}
            >
              {zhCN.common.cancel}
            </button>
            <button
              className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-[#176858] disabled:opacity-50"
              type="button"
              onClick={() => void exportFile()}
              disabled={busy}
              data-testid="timeline-export-save-button"
            >
              {busy ? t.exporting : t.export}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
