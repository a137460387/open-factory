import { getTimelineDuration, type Project } from '@open-factory/editor-core';
import { formatTimeShort } from '@open-factory/editor-core/utils/time';
import { Eye, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { zhCN } from '../i18n/strings';
import {
  deleteProjectSnapshot,
  formatSnapshotSize,
  listProjectSnapshots,
  readProjectSnapshot,
  type ProjectSnapshotEntry,
} from '../lib/projectSnapshots';
import { showToast } from '../lib/toast';

interface SnapshotHistoryDialogProps {
  projectId: string;
  projectPath?: string;
  onRestore(project: Project): void;
  onClose(): void;
}

export function SnapshotHistoryDialog({ projectId, projectPath, onRestore, onClose }: SnapshotHistoryDialogProps) {
  const t = zhCN.projectSnapshots;
  const [snapshots, setSnapshots] = useState<ProjectSnapshotEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ entry: ProjectSnapshotEntry; project: Project }>();

  useEffect(() => {
    void refresh();
  }, [projectId]);

  const refresh = async () => {
    setLoading(true);
    try {
      const entries = await listProjectSnapshots(projectId);
      setSnapshots(entries);
      if (preview && !entries.some((entry) => entry.path === preview.entry.path)) {
        setPreview(undefined);
      }
    } catch (error) {
      showToast({ kind: 'error', title: t.loadFailed, message: error instanceof Error ? error.message : t.loadFailed });
    } finally {
      setLoading(false);
    }
  };

  const previewSnapshot = async (entry: ProjectSnapshotEntry) => {
    try {
      const project = await readProjectSnapshot(entry, projectPath);
      setPreview({ entry, project });
    } catch (error) {
      showToast({ kind: 'error', title: t.loadFailed, message: error instanceof Error ? error.message : t.loadFailed });
    }
  };

  const restoreSnapshot = async (entry: ProjectSnapshotEntry) => {
    try {
      const project = await readProjectSnapshot(entry, projectPath);
      onRestore(project);
      showToast({ kind: 'success', title: t.restored, message: entry.name });
      onClose();
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.restoreFailed,
        message: error instanceof Error ? error.message : t.restoreFailed,
      });
    }
  };

  const deleteSnapshot = async (entry: ProjectSnapshotEntry) => {
    try {
      await deleteProjectSnapshot(entry);
      showToast({ kind: 'success', title: t.deleted, message: entry.name });
      await refresh();
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.deleteFailed,
        message: error instanceof Error ? error.message : t.deleteFailed,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="snapshot-history-dialog"
    >
      <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-ink">{t.historyTitle}</div>
            <div className="mt-0.5 text-xs text-slate-500" data-testid="snapshot-history-count">
              {loading ? zhCN.common.unavailable : t.snapshotCount(snapshots.length)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
              type="button"
              onClick={() => void refresh()}
            >
              {t.refresh}
            </button>
            <button
              className="rounded-md p-2 text-slate-500 hover:bg-panel"
              type="button"
              aria-label={zhCN.common.close}
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-px bg-line">
          <div className="min-h-0 overflow-y-auto bg-white">
            {snapshots.length === 0 ? (
              <div className="p-6 text-sm text-slate-500" data-testid="snapshot-history-empty">
                {t.empty}
              </div>
            ) : (
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[minmax(160px,1fr)_190px_90px_160px] border-b border-line bg-panel px-4 py-2 text-xs font-semibold uppercase text-slate-500">
                  <div>{t.columns.name}</div>
                  <div>{t.columns.time}</div>
                  <div>{t.columns.size}</div>
                  <div />
                </div>
                {snapshots.map((entry) => (
                  <div
                    key={entry.path}
                    className="grid grid-cols-[minmax(160px,1fr)_190px_90px_160px] items-center gap-2 border-b border-line px-4 py-3 text-sm"
                    data-testid="snapshot-row"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink" title={entry.name}>
                        {entry.name}
                      </div>
                      <div className="truncate text-xs text-slate-400" title={entry.path}>
                        {entry.path}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600">{formatSnapshotTime(entry.createdAt)}</div>
                    <div className="text-xs tabular-nums text-slate-600">{formatSnapshotSize(entry.size)}</div>
                    <div className="flex justify-end gap-1">
                      <IconButton
                        label={t.preview}
                        testId="snapshot-preview-button"
                        onClick={() => void previewSnapshot(entry)}
                      >
                        <Eye size={14} />
                      </IconButton>
                      <IconButton
                        label={t.restore}
                        testId="snapshot-restore-button"
                        onClick={() => void restoreSnapshot(entry)}
                      >
                        <RotateCcw size={14} />
                      </IconButton>
                      <IconButton
                        label={t.delete}
                        testId="snapshot-delete-button"
                        onClick={() => void deleteSnapshot(entry)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="min-h-0 bg-panel p-4" data-testid="snapshot-preview-panel">
            {preview ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">{t.preview}</div>
                  <div className="mt-1 text-sm font-semibold text-ink">{preview.entry.name}</div>
                </div>
                <div className="rounded-md border border-line bg-white p-3 text-sm text-slate-700">
                  {t.previewSummary(
                    preview.project.name,
                    preview.project.timeline.tracks.length,
                    preview.project.media.length,
                    formatDuration(getTimelineDuration(preview.project.timeline)),
                  )}
                </div>
                <div className="space-y-1 text-xs text-slate-500">
                  {preview.project.timeline.tracks.map((track) => (
                    <div key={track.id} className="truncate">
                      {track.name} · {track.clips.length}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">{t.preview}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  testId,
  children,
  onClick,
}: {
  label: string;
  testId: string;
  children: React.ReactNode;
  onClick(): void;
}) {
  return (
    <button
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
      type="button"
      title={label}
      aria-label={label}
      data-testid={testId}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function formatSnapshotTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { hour12: false });
}
