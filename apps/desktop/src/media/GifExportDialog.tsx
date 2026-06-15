import { ImageDown, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MediaAsset } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { convertLocalFileSrc, exportMediaGif, generateGifPreview, type GifDitherAlgorithm } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import {
  DEFAULT_GIF_WORKFLOW_SETTINGS,
  buildDefaultGifOutputPath,
  estimateGifFileSizeBytes,
  formatGifFileSize,
  normalizeGifWorkflowSettings,
  type GifWorkflowSettings
} from './gifWorkflow';

interface GifExportDialogProps {
  asset: MediaAsset;
  onClose(): void;
}

const DITHER_OPTIONS: GifDitherAlgorithm[] = ['bayer', 'floyd_steinberg'];

export default function GifExportDialog({ asset, onClose }: GifExportDialogProps) {
  const t = zhCN.mediaBin.gifExport;
  const [settings, setSettings] = useState<GifWorkflowSettings>(() =>
    normalizeGifWorkflowSettings(
      {
        ...DEFAULT_GIF_WORKFLOW_SETTINGS,
        scaleWidth: Math.min(480, Math.max(16, asset.width || DEFAULT_GIF_WORKFLOW_SETTINGS.scaleWidth)),
        duration: Math.min(DEFAULT_GIF_WORKFLOW_SETTINGS.duration, asset.duration || DEFAULT_GIF_WORKFLOW_SETTINGS.duration)
      },
      asset.duration
    )
  );
  const [outputPath, setOutputPath] = useState(() => buildDefaultGifOutputPath(asset.path));
  const [previewPath, setPreviewPath] = useState<string>();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [completedPath, setCompletedPath] = useState<string>();
  const previewRunRef = useRef(0);
  const estimate = useMemo(
    () =>
      formatGifFileSize(
        estimateGifFileSizeBytes({
          sourceWidth: asset.width,
          sourceHeight: asset.height,
          scaleWidth: settings.scaleWidth,
          frameRate: settings.frameRate,
          duration: settings.duration
        })
      ),
    [asset.height, asset.width, settings.duration, settings.frameRate, settings.scaleWidth]
  );

  useEffect(() => {
    const runId = previewRunRef.current + 1;
    previewRunRef.current = runId;
    setPreviewLoading(true);
    const timer = window.setTimeout(() => {
      void generateGifPreview({
        sourcePath: asset.path,
        frameRate: settings.frameRate,
        startTime: settings.startTime,
        duration: settings.duration,
        dither: settings.dither
      })
        .then((result) => {
          if (previewRunRef.current === runId) {
            setPreviewPath(result.outputPath);
          }
        })
        .catch(() => {
          if (previewRunRef.current === runId) {
            setPreviewPath(undefined);
          }
        })
        .finally(() => {
          if (previewRunRef.current === runId) {
            setPreviewLoading(false);
          }
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [asset.path, settings.dither, settings.duration, settings.frameRate, settings.startTime]);

  const updateSetting = <K extends keyof GifWorkflowSettings>(key: K, value: GifWorkflowSettings[K]) => {
    setSettings((current) => normalizeGifWorkflowSettings({ ...current, [key]: value }, asset.duration));
    setCompletedPath(undefined);
  };

  const exportGif = async () => {
    const nextSettings = normalizeGifWorkflowSettings(settings, asset.duration);
    setSettings(nextSettings);
    setExporting(true);
    setCompletedPath(undefined);
    try {
      const result = await exportMediaGif({
        sourcePath: asset.path,
        outputPath,
        frameRate: nextSettings.frameRate,
        scaleWidth: nextSettings.scaleWidth,
        startTime: nextSettings.startTime,
        duration: nextSettings.duration,
        loopCount: nextSettings.loopCount,
        dither: nextSettings.dither
      });
      setCompletedPath(result.outputPath);
      showToast({ kind: 'success', title: t.completedTitle, message: result.outputPath });
    } catch (error) {
      showToast({ kind: 'error', title: t.failedTitle, message: error instanceof Error ? error.message : t.failedMessage });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="gif-export-dialog">
      <div className="grid max-h-[88vh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold text-ink">
              <ImageDown size={18} />
              {t.title}
            </div>
            <div className="mt-0.5 truncate text-xs text-slate-500" title={asset.path}>
              {asset.name}
            </div>
          </div>
          <button className="rounded-md p-2 text-slate-500 hover:bg-panel" type="button" aria-label={zhCN.common.close} data-testid="gif-export-close" onClick={onClose} disabled={exporting}>
            <X size={18} />
          </button>
        </div>
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_260px] gap-px bg-line">
          <div className="min-h-0 overflow-y-auto bg-white p-4">
            <div className="grid grid-cols-2 gap-3">
              <NumberField label={t.frameRate} testId="gif-frame-rate-input" min={1} max={30} step={1} value={settings.frameRate} onChange={(value) => updateSetting('frameRate', value)} />
              <NumberField label={t.scaleWidth} testId="gif-scale-input" min={16} max={4096} step={16} value={settings.scaleWidth} onChange={(value) => updateSetting('scaleWidth', value)} />
              <NumberField label={t.startTime} testId="gif-start-time-input" min={0} max={asset.duration || undefined} step={0.1} value={settings.startTime} onChange={(value) => updateSetting('startTime', value)} />
              <NumberField label={t.duration} testId="gif-duration-input" min={0.1} max={asset.duration || undefined} step={0.1} value={settings.duration} onChange={(value) => updateSetting('duration', value)} />
              <NumberField label={t.loopCount} testId="gif-loop-count-input" min={0} max={100} step={1} value={settings.loopCount} onChange={(value) => updateSetting('loopCount', value)} hint={t.loopHint} />
              <label className="block text-xs font-semibold text-slate-600">
                {t.dither}
                <select
                  className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-sm text-slate-700"
                  value={settings.dither}
                  data-testid="gif-dither-select"
                  onChange={(event) => updateSetting('dither', event.target.value as GifDitherAlgorithm)}
                >
                  {DITHER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t.ditherOptions[option]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-4 block text-xs font-semibold text-slate-600">
              {t.outputPath}
              <input
                className="mt-1 h-9 w-full rounded-md border border-line px-2 text-sm text-slate-700"
                value={outputPath}
                data-testid="gif-output-path-input"
                onChange={(event) => {
                  setOutputPath(event.target.value);
                  setCompletedPath(undefined);
                }}
              />
            </label>
          </div>
          <div className="flex min-h-0 flex-col bg-panel p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">{t.preview}</div>
            <div className="mt-2 flex aspect-video items-center justify-center overflow-hidden rounded-md border border-line bg-white">
              {previewPath ? <img className="h-full w-full object-contain" src={convertLocalFileSrc(previewPath)} alt="" data-testid="gif-preview-image" /> : <span className="text-xs text-slate-400">{t.previewUnavailable}</span>}
            </div>
            <div className="mt-2 h-5 text-xs text-slate-500" data-testid="gif-preview-status">
              {previewLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" />
                  {t.previewLoading}
                </span>
              ) : null}
            </div>
            <div className="mt-4 rounded-md border border-line bg-white px-3 py-2">
              <div className="text-xs font-semibold text-slate-500">{t.estimate}</div>
              <div className="mt-1 text-lg font-semibold text-ink" data-testid="gif-size-estimate">
                {estimate}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <div className="min-w-0 truncate text-xs text-slate-500" data-testid="gif-export-status">
            {completedPath ? t.completedMessage(completedPath) : t.ready}
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-line px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel disabled:opacity-50" type="button" disabled={exporting} onClick={onClose}>
              {zhCN.common.cancel}
            </button>
            <button className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50" type="button" disabled={exporting || !outputPath.trim()} data-testid="gif-export-button" onClick={() => void exportGif()}>
              {exporting ? <Loader2 size={15} className="animate-spin" /> : <ImageDown size={15} />}
              {exporting ? t.exporting : t.export}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  testId,
  value,
  min,
  max,
  step,
  hint,
  onChange
}: {
  label: string;
  testId: string;
  value: number;
  min: number;
  max?: number;
  step: number;
  hint?: string;
  onChange(value: number): void;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <input
        className="mt-1 h-9 w-full rounded-md border border-line px-2 text-sm tabular-nums text-slate-700"
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isInteger(value) ? value : Number(value.toFixed(2))}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? <span className="mt-1 block text-[11px] font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}
