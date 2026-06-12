import { ArrowDown, ArrowUp, FolderOpen, GripVertical, ListPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { MediaAsset } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';

export interface VideoStitchWizardSettings {
  assetIds: string[];
  transitionEnabled: boolean;
  transitionDuration: number;
  width: number;
  height: number;
  fps: number;
}

interface VideoStitchWizardDialogProps {
  media: MediaAsset[];
  projectSettings: { width: number; height: number; fps: number };
  onImportVideos(): Promise<string[]>;
  onGenerate(settings: VideoStitchWizardSettings): void;
  onClose(): void;
}

export function VideoStitchWizardDialog({ media, projectSettings, onImportVideos, onGenerate, onClose }: VideoStitchWizardDialogProps) {
  const t = zhCN.videoStitchWizard;
  const videoAssets = useMemo(() => media.filter((asset) => asset.type === 'video'), [media]);
  const [selectedIds, setSelectedIds] = useState(() => videoAssets.map((asset) => asset.id));
  const [draggedId, setDraggedId] = useState<string>();
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [transitionDuration, setTransitionDuration] = useState(0.5);
  const [width, setWidth] = useState(projectSettings.width);
  const [height, setHeight] = useState(projectSettings.height);
  const [fps, setFps] = useState(projectSettings.fps);
  const selectedAssets = selectedIds.flatMap((id) => {
    const asset = videoAssets.find((item) => item.id === id);
    return asset ? [asset] : [];
  });
  const canGenerate = selectedAssets.length >= 2;

  async function importVideos(): Promise<void> {
    const importedIds = await onImportVideos();
    if (importedIds.length > 0) {
      setSelectedIds((current) => Array.from(new Set([...current, ...importedIds])));
    }
  }

  function toggleAsset(assetId: string, checked: boolean): void {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(assetId) ? current : [...current, assetId];
      }
      return current.filter((id) => id !== assetId);
    });
  }

  function moveAsset(assetId: string, direction: -1 | 1): void {
    setSelectedIds((current) => {
      const index = current.indexOf(assetId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [removed] = next.splice(index, 1);
      next.splice(targetIndex, 0, removed);
      return next;
    });
  }

  function dropAsset(targetId: string): void {
    if (!draggedId || draggedId === targetId) {
      return;
    }
    setSelectedIds((current) => {
      const from = current.indexOf(draggedId);
      const to = current.indexOf(targetId);
      if (from < 0 || to < 0) {
        return current;
      }
      const next = [...current];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      return next;
    });
    setDraggedId(undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t.title} data-testid="video-stitch-wizard-dialog">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-600 hover:bg-panel" type="button" title={zhCN.common.close} aria-label={zhCN.common.close} onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_240px] gap-px bg-line">
          <section className="min-h-0 overflow-y-auto bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-700">{t.videoList}</div>
              <button className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-panel" type="button" data-testid="video-stitch-import-button" onClick={() => void importVideos()}>
                <FolderOpen size={14} />
                {t.importVideos}
              </button>
            </div>
            {videoAssets.length === 0 ? (
              <div className="rounded-md border border-dashed border-line p-6 text-center text-sm text-slate-500" data-testid="video-stitch-empty">{t.empty}</div>
            ) : (
              <div className="space-y-2" data-testid="video-stitch-media-list">
                {videoAssets.map((asset) => {
                  const selected = selectedIds.includes(asset.id);
                  return (
                    <label key={asset.id} className="flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-2 text-sm text-slate-700" data-testid={`video-stitch-media-${asset.id}`}>
                      <input className="h-4 w-4 accent-brand" type="checkbox" checked={selected} data-testid={`video-stitch-select-${asset.id}`} onChange={(event) => toggleAsset(asset.id, event.target.checked)} />
                      <span className="min-w-0 flex-1 truncate">{asset.name}</span>
                      <span className="text-xs tabular-nums text-slate-500">{t.assetDuration(asset.duration || 0)}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="mt-4 text-sm font-semibold text-slate-700">{t.order}</div>
            <div className="mt-2 space-y-2" data-testid="video-stitch-order-list">
              {selectedAssets.map((asset, index) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-2 rounded-md border border-line bg-white px-2 py-2 text-sm text-slate-700"
                  draggable
                  data-testid={`video-stitch-order-${asset.id}`}
                  onDragStart={() => setDraggedId(asset.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropAsset(asset.id)}
                >
                  <GripVertical size={15} className="text-slate-400" />
                  <span className="w-6 text-xs tabular-nums text-slate-500">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{asset.name}</span>
                  <button className="inline-flex h-7 w-7 items-center justify-center rounded border border-line hover:bg-panel disabled:opacity-40" type="button" title={t.moveUp} aria-label={t.moveUp} disabled={index === 0} onClick={() => moveAsset(asset.id, -1)}>
                    <ArrowUp size={14} />
                  </button>
                  <button className="inline-flex h-7 w-7 items-center justify-center rounded border border-line hover:bg-panel disabled:opacity-40" type="button" title={t.moveDown} aria-label={t.moveDown} disabled={index === selectedAssets.length - 1} onClick={() => moveAsset(asset.id, 1)}>
                    <ArrowDown size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <aside className="space-y-4 bg-white p-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input className="h-4 w-4 accent-brand" type="checkbox" checked={transitionEnabled} data-testid="video-stitch-transition-toggle" onChange={(event) => setTransitionEnabled(event.target.checked)} />
                {t.enableTransition}
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t.transitionDuration}
                <input className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm" type="number" min={0.1} max={5} step={0.1} value={transitionDuration} data-testid="video-stitch-transition-duration" onChange={(event) => setTransitionDuration(Number(event.target.value))} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberSetting label={t.width} value={width} min={160} max={7680} testId="video-stitch-width" onChange={setWidth} />
              <NumberSetting label={t.height} value={height} min={160} max={4320} testId="video-stitch-height" onChange={setHeight} />
              <NumberSetting label={t.fps} value={fps} min={1} max={120} testId="video-stitch-fps" onChange={setFps} />
            </div>
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
              type="button"
              disabled={!canGenerate}
              data-testid="video-stitch-generate-button"
              onClick={() =>
                onGenerate({
                  assetIds: selectedAssets.map((asset) => asset.id),
                  transitionEnabled,
                  transitionDuration,
                  width,
                  height,
                  fps
                })
              }
            >
              <ListPlus size={16} />
              {t.generate}
            </button>
            <div className="text-xs text-slate-500" data-testid="video-stitch-summary">{t.summary(selectedAssets.length)}</div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function NumberSetting({ label, value, min, max, testId, onChange }: { label: string; value: number; min: number; max: number; testId: string; onChange(value: number): void }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm" type="number" min={min} max={max} value={value} data-testid={testId} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
