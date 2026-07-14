import {
  buildExportProjectFromProject,
  buildFfmpegExportPlan,
  type ExportWatermarkPosition,
  type Project,
} from '@open-factory/editor-core';
import { FolderOpen, ImageDown, Loader2, Play, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { zhCN } from '../i18n/strings';
import {
  convertLocalFileSrc,
  getAppDataDir,
  getFfmpegCapabilities,
  openDirectoryDialog,
  runExport,
} from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { enqueueExport, setExportQueueMaxConcurrent } from '../export/export-queue-runner';
import { useExportQueueStore } from '../export/export-queue-store';
import {
  DEFAULT_BATCH_WATERMARK_TEMPLATE,
  DEFAULT_BATCH_WATERMARK_TEXT,
  buildBatchWatermarkJobs,
  isBatchWatermarkSupportedAsset,
  selectBatchWatermarkPreviewJob,
} from './batchWatermark';

interface BatchWatermarkDialogProps {
  project: Project;
  onClose(): void;
}

const WATERMARK_POSITIONS: ExportWatermarkPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export function BatchWatermarkDialog({ project, onClose }: BatchWatermarkDialogProps) {
  const t = zhCN.batchWatermark;
  const visualAssets = useMemo(() => project.media.filter(isBatchWatermarkSupportedAsset), [project.media]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [outputDirectory, setOutputDirectory] = useState('C:/Exports');
  const [fileNameTemplate, setFileNameTemplate] = useState(DEFAULT_BATCH_WATERMARK_TEMPLATE);
  const [watermarkText, setWatermarkText] = useState(DEFAULT_BATCH_WATERMARK_TEXT);
  const [position, setPosition] = useState<ExportWatermarkPosition>('bottom-right');
  const [fontSize, setFontSize] = useState(36);
  const [previewPath, setPreviewPath] = useState<string>();
  const [previewing, setPreviewing] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const tasks = useExportQueueStore((state) => state.tasks);
  const jobs = useMemo(
    () =>
      buildBatchWatermarkJobs(project, {
        assetIds: selectedIds,
        outputDirectory,
        fileNameTemplate,
        watermarkText,
        position,
        fontSize,
      }),
    [fileNameTemplate, fontSize, outputDirectory, position, project, selectedIds, watermarkText],
  );
  const previewJob = selectBatchWatermarkPreviewJob(jobs);
  const allSelected = visualAssets.length > 0 && selectedIds.length === visualAssets.length;

  const toggleAsset = (assetId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, assetId])) : current.filter((id) => id !== assetId),
    );
    setQueuedCount(0);
    setPreviewPath(undefined);
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : visualAssets.map((asset) => asset.id));
    setQueuedCount(0);
    setPreviewPath(undefined);
  };

  const chooseDirectory = async () => {
    const directory = await openDirectoryDialog();
    if (directory) {
      setOutputDirectory(directory);
      setQueuedCount(0);
    }
  };

  const previewFirst = async () => {
    if (!previewJob) {
      showToast({ kind: 'warning', title: t.title, message: t.selectFilesFirst });
      return;
    }
    setPreviewing(true);
    setPreviewPath(undefined);
    try {
      const capabilities = await getFfmpegCapabilities();
      if (!capabilities.available) {
        throw new Error(zhCN.errors.ffmpegMissing);
      }
      const appDataDir = await getAppDataDir();
      const outputPath = `${appDataDir.replace(/[\\/]+$/g, '')}/batch-watermark-previews/${Date.now()}.mp4`;
      const exportProject = buildExportProjectFromProject(previewJob.project, {
        outputPath,
        settings: previewJob.settings,
      });
      const plan = buildFfmpegExportPlan(exportProject, capabilities);
      await runExport(plan, `batch-watermark-preview-${Date.now()}`);
      setPreviewPath(outputPath);
      showToast({ kind: 'success', title: t.previewReadyTitle, message: previewJob.assetName });
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.previewFailedTitle,
        message: error instanceof Error ? error.message : t.previewFailedMessage,
      });
    } finally {
      setPreviewing(false);
    }
  };

  const enqueueJobs = async () => {
    if (jobs.length === 0) {
      showToast({ kind: 'warning', title: t.title, message: t.selectFilesFirst });
      return;
    }
    setQueueing(true);
    try {
      setExportQueueMaxConcurrent(2);
      for (const job of jobs) {
        await enqueueExport(job.project, job.outputPath, job.settings, 'normal');
      }
      setQueuedCount(jobs.length);
      showToast({ kind: 'success', title: t.queuedTitle, message: t.queuedMessage(jobs.length) });
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.queueFailedTitle,
        message: error instanceof Error ? error.message : t.queueFailedMessage,
      });
    } finally {
      setQueueing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="batch-watermark-dialog"
    >
      <div className="grid max-h-[88vh] w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold text-ink">
              <ImageDown size={18} />
              {t.title}
            </div>
            <div className="mt-0.5 truncate text-xs text-slate-500" data-testid="batch-watermark-summary">
              {t.summary(jobs.length, visualAssets.length)}
            </div>
          </div>
          <button
            className="rounded-md p-2 text-slate-500 hover:bg-panel disabled:opacity-50"
            type="button"
            aria-label={zhCN.common.close}
            data-testid="batch-watermark-close"
            disabled={queueing || previewing}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_290px] gap-px bg-line">
          <div className="flex min-h-0 flex-col bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="text-sm font-semibold text-ink">{t.sourceFiles}</div>
              <button
                className="rounded-md border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                type="button"
                data-testid="batch-watermark-select-all"
                onClick={toggleAll}
              >
                {allSelected ? t.clearSelection : t.selectAll}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {visualAssets.length === 0 ? (
                <div
                  className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-panel p-6 text-center text-sm text-slate-600"
                  data-testid="batch-watermark-empty"
                >
                  {t.empty}
                </div>
              ) : (
                <div className="space-y-2" data-testid="batch-watermark-file-list">
                  {visualAssets.map((asset) => {
                    const selected = selectedIds.includes(asset.id);
                    return (
                      <label
                        key={asset.id}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-line bg-white p-3 text-sm"
                        data-testid={`batch-watermark-file-${asset.id}`}
                      >
                        <input
                          className="h-4 w-4 accent-brand"
                          type="checkbox"
                          checked={selected}
                          data-testid={`batch-watermark-checkbox-${asset.id}`}
                          onChange={(event) => toggleAsset(asset.id, event.target.checked)}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">{asset.name}</span>
                          <span className="block truncate text-xs text-slate-500">{asset.path}</span>
                        </span>
                        <span className="rounded-full border border-line bg-panel px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {zhCN.mediaBin.assetType[asset.type]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto bg-panel p-4">
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                {t.outputDirectory}
                <div className="mt-1 flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-sm text-slate-700"
                    value={outputDirectory}
                    data-testid="batch-watermark-output-directory"
                    onChange={(event) => setOutputDirectory(event.target.value)}
                  />
                  <button
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
                    type="button"
                    title={t.chooseDirectory}
                    aria-label={t.chooseDirectory}
                    data-testid="batch-watermark-choose-directory"
                    onClick={() => void chooseDirectory()}
                  >
                    <FolderOpen size={15} />
                  </button>
                </div>
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                {t.fileNameTemplate}
                <input
                  className="mt-1 h-9 w-full rounded-md border border-line px-2 text-sm text-slate-700"
                  value={fileNameTemplate}
                  data-testid="batch-watermark-template-input"
                  onChange={(event) => setFileNameTemplate(event.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                {t.watermarkText}
                <input
                  className="mt-1 h-9 w-full rounded-md border border-line px-2 text-sm text-slate-700"
                  value={watermarkText}
                  data-testid="batch-watermark-text-input"
                  onChange={(event) => setWatermarkText(event.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold text-slate-600">
                  {t.position}
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-sm text-slate-700"
                    value={position}
                    data-testid="batch-watermark-position-select"
                    onChange={(event) => setPosition(event.target.value as ExportWatermarkPosition)}
                  >
                    {WATERMARK_POSITIONS.map((item) => (
                      <option key={item} value={item}>
                        {zhCN.exportDialog.watermark.positions[item]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  {t.fontSize}
                  <input
                    className="mt-1 h-9 w-full rounded-md border border-line px-2 text-sm text-slate-700"
                    type="number"
                    min={12}
                    max={128}
                    step={1}
                    value={fontSize}
                    data-testid="batch-watermark-font-size-input"
                    onChange={(event) => setFontSize(Number(event.target.value))}
                  />
                </label>
              </div>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-panel disabled:opacity-50"
                type="button"
                disabled={!previewJob || previewing || queueing}
                data-testid="batch-watermark-preview-button"
                onClick={() => void previewFirst()}
              >
                {previewing ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                {previewing ? t.previewing : t.previewFirst}
              </button>
              <div
                className="aspect-video overflow-hidden rounded-md border border-line bg-white"
                data-testid="batch-watermark-preview"
              >
                {previewPath ? (
                  <video
                    className="h-full w-full object-contain"
                    src={convertLocalFileSrc(previewPath)}
                    controls
                    data-testid="batch-watermark-preview-video"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">{t.previewEmpty}</div>
                )}
              </div>
              <div className="rounded-md border border-line bg-white p-2 text-xs text-slate-600">
                <div>{t.queueConcurrency}</div>
                <div className="mt-1" data-testid="batch-watermark-queue-status">
                  {t.queueStatus(tasks.length, queuedCount)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <div className="min-w-0 truncate text-xs text-slate-500" data-testid="batch-watermark-selected-count">
            {t.selectedCount(jobs.length)}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-line px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel disabled:opacity-50"
              type="button"
              disabled={queueing || previewing}
              onClick={onClose}
            >
              {zhCN.common.cancel}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
              type="button"
              disabled={jobs.length === 0 || queueing || previewing}
              data-testid="batch-watermark-enqueue-button"
              onClick={() => void enqueueJobs()}
            >
              {queueing ? <Loader2 size={15} className="animate-spin" /> : <ImageDown size={15} />}
              {queueing ? t.queueing : t.enqueue}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
