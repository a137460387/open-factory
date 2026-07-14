import type { MediaAsset } from '@open-factory/editor-core';
import { Scissors, X } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { zhCN } from '../i18n/strings';
import { analyzeAudioSpectrum, convertLocalFileSrc, type AudioSpectrumAnalysis } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import {
  resolveSpectrumContextMenu,
  resolveSpectrumSelection,
  resolveSpectrumTime,
  type SpectrumContextMenuState,
  type SpectrumSelectionRange,
} from './audioSpectrum';

interface AudioSpectrumDialogProps {
  asset: MediaAsset;
  onClose(): void;
  onSeek(time: number): void;
  onSelection(range: SpectrumSelectionRange): void;
  onSplitAtTime(time: number): void;
}

export default function AudioSpectrumDialog({
  asset,
  onClose,
  onSeek,
  onSelection,
  onSplitAtTime,
}: AudioSpectrumDialogProps) {
  const t = zhCN.mediaBin.spectrum;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [analysis, setAnalysis] = useState<AudioSpectrumAnalysis>();
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<SpectrumSelectionRange>();
  const [contextMenu, setContextMenu] = useState<SpectrumContextMenuState>();
  const dragStartRef = useRef<number>();
  const duration = Math.max(0.001, asset.duration || 1);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setAnalysis(undefined);
    drawPlaceholder(canvasRef.current);
    void analyzeAudioSpectrum(asset.path)
      .then((result) => {
        if (!canceled) {
          setAnalysis(result);
        }
      })
      .catch((error) => {
        if (!canceled) {
          showToast({
            kind: 'warning',
            title: t.failedTitle,
            message: error instanceof Error ? error.message : t.failedMessage,
          });
        }
      })
      .finally(() => {
        if (!canceled) {
          setLoading(false);
        }
      });
    return () => {
      canceled = true;
    };
  }, [asset.path, t.failedMessage, t.failedTitle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    if (!analysis?.spectrogramPath) {
      drawPlaceholder(canvas);
      return;
    }
    const image = new Image();
    image.onload = () => {
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      drawSelection(canvas, selection, duration);
    };
    image.onerror = () => drawPlaceholder(canvas);
    image.src = convertLocalFileSrc(analysis.spectrogramPath);
  }, [analysis?.spectrogramPath, duration, selection]);

  const selectionLabel = useMemo(() => {
    if (!selection) {
      return undefined;
    }
    return t.selection(formatTime(selection.inPoint), formatTime(selection.outPoint));
  }, [selection, t]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    setContextMenu(undefined);
    dragStartRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragStartRef.current === undefined) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setSelection(resolveSpectrumSelection(dragStartRef.current, event.clientX, rect.left, rect.width, duration));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const startX = dragStartRef.current;
    dragStartRef.current = undefined;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    if (startX === undefined || Math.abs(startX - event.clientX) <= 3) {
      onSeek(resolveSpectrumTime(event.clientX, rect.left, rect.width, duration));
      return;
    }
    const range = resolveSpectrumSelection(startX, event.clientX, rect.left, rect.width, duration);
    setSelection(range);
    onSelection(range);
  };

  const handleContextMenu = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setContextMenu(resolveSpectrumContextMenu(event.clientX, event.clientY, rect.left, rect.width, duration));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      data-testid="audio-spectrum-dialog"
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="flex min-h-12 items-center justify-between border-b border-line px-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{t.title}</div>
            <div className="truncate text-xs text-slate-500">{asset.name}</div>
          </div>
          <button
            className="rounded-md p-2 text-slate-500 hover:bg-panel"
            type="button"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="audio-spectrum-close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-h-0">
            <div className="relative overflow-hidden rounded-md border border-line bg-slate-950">
              <canvas
                ref={canvasRef}
                className="block aspect-[5/2] w-full cursor-crosshair"
                width={1280}
                height={512}
                data-testid="audio-spectrum-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onContextMenu={handleContextMenu}
              />
              {loading || analysis?.spectrogramError ? (
                <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
                  <span
                    className="rounded bg-black/70 px-2 py-1 text-xs font-medium text-white"
                    data-testid="audio-spectrum-status"
                  >
                    {loading ? t.loading : t.unavailable}
                  </span>
                </div>
              ) : null}
            </div>
            {selectionLabel ? (
              <div className="mt-2 text-xs font-medium text-slate-600" data-testid="audio-spectrum-selection">
                {selectionLabel}
              </div>
            ) : null}
          </div>
          <aside className="rounded-md border border-line bg-panel p-3 text-xs" data-testid="audio-spectrum-stats">
            <div className="mb-2 font-semibold text-slate-700">{t.stats}</div>
            <SpectrumStat
              label={t.integratedLufs}
              value={formatDb(analysis?.stats.integratedLufs, 'LUFS')}
              testId="audio-spectrum-stat-lufs"
            />
            <SpectrumStat
              label={t.dynamicRange}
              value={formatDb(analysis?.stats.dynamicRangeLu, 'LU')}
              testId="audio-spectrum-stat-range"
            />
            <SpectrumStat
              label={t.truePeak}
              value={formatDb(analysis?.stats.truePeakDbfs, 'dBFS')}
              testId="audio-spectrum-stat-true-peak"
            />
            <SpectrumStat
              label={t.peak}
              value={formatDb(analysis?.stats.peakDb, 'dB')}
              testId="audio-spectrum-stat-peak"
            />
            <SpectrumStat
              label={t.rms}
              value={formatDb(analysis?.stats.rmsDb, 'dB')}
              testId="audio-spectrum-stat-rms"
            />
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-panel"
              type="button"
              data-testid="audio-spectrum-split-button"
              onClick={() => onSplitAtTime(selection?.inPoint ?? 0)}
            >
              <Scissors size={13} />
              {zhCN.timeline.splitSelectedClip}
            </button>
          </aside>
        </div>
        {contextMenu ? (
          <div
            className="fixed z-[60] min-w-44 rounded-md border border-line bg-white p-1 text-xs shadow-soft"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            data-testid="audio-spectrum-context-menu"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-medium text-slate-700 hover:bg-panel"
              type="button"
              data-testid="audio-spectrum-split-context-item"
              onClick={() => {
                onSplitAtTime(contextMenu.time);
                setContextMenu(undefined);
              }}
            >
              <Scissors size={13} />
              {t.splitHere}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SpectrumStat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold tabular-nums text-ink" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

function drawPlaceholder(canvas: HTMLCanvasElement | null): void {
  const context = canvas?.getContext('2d');
  if (!canvas || !context) {
    return;
  }
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#111827');
  gradient.addColorStop(0.35, '#0f766e');
  gradient.addColorStop(0.7, '#f59e0b');
  gradient.addColorStop(1, '#111827');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = 0.28;
  for (let x = 0; x < canvas.width; x += 32) {
    context.fillStyle = x % 96 === 0 ? '#f8fafc' : '#93c5fd';
    context.fillRect(x, 0, 2, canvas.height);
  }
  context.globalAlpha = 1;
}

function drawSelection(
  canvas: HTMLCanvasElement,
  selection: SpectrumSelectionRange | undefined,
  duration: number,
): void {
  if (!selection) {
    return;
  }
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  context.fillStyle = 'rgba(255,255,255,0.22)';
  const start = Math.min(selection.inPoint, selection.outPoint);
  const end = Math.max(selection.inPoint, selection.outPoint);
  const safeDuration = Math.max(duration, 0.001);
  context.fillRect(
    (start / safeDuration) * canvas.width,
    0,
    ((end - start) / safeDuration) * canvas.width,
    canvas.height,
  );
}

function formatDb(value: number | undefined, unit: string): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} ${unit}` : zhCN.common.unavailable;
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const remaining = Math.floor(safeSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remaining}`;
}
