import { Download, Square, Timer, X } from 'lucide-react';
import {
  formatProfilerFrameReason,
  type PerformanceProfilerReport,
  type ProfilerRenderPassName,
} from '@open-factory/editor-core';
import { formatDurationMs } from '@open-factory/editor-core/utils/time';
import { zhCN } from '../i18n/strings';

interface ProfilerDialogProps {
  recording: boolean;
  elapsedMs: number;
  report?: PerformanceProfilerReport;
  onStart(): void;
  onStop(): void;
  onExportJson(): void;
  onClose(): void;
}

export function ProfilerDialog({
  recording,
  elapsedMs,
  report,
  onStart,
  onStop,
  onExportJson,
  onClose,
}: ProfilerDialogProps) {
  const t = zhCN.profiler;
  const passLabels = t.passLabels as Record<ProfilerRenderPassName, string>;
  const flameHeight = Math.max(80, (Math.max(0, ...(report?.flamegraph ?? []).map((node) => node.depth)) + 1) * 22);
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-end justify-end p-4"
      role="dialog"
      aria-modal="false"
      data-testid="profiler-dialog"
    >
      <div className="pointer-events-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-line bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <p className="mt-1 text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-600 hover:bg-panel"
            type="button"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3">
            <section className="rounded-md border border-line bg-panel p-3" data-testid="profiler-recording-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">{t.recording}</div>
                  <div
                    className="mt-1 font-mono text-2xl tabular-nums text-ink"
                    data-testid="profiler-recording-elapsed"
                  >
                    {formatDurationMs(elapsedMs)}
                  </div>
                </div>
                <Timer className={recording ? 'text-brand' : 'text-slate-400'} size={26} />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={recording}
                  data-testid="profiler-start-recording-button"
                  onClick={onStart}
                >
                  <Timer size={15} />
                  {t.start}
                </button>
                <button
                  className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!recording}
                  data-testid="profiler-stop-recording-button"
                  onClick={onStop}
                >
                  <Square size={14} />
                  {t.stop}
                </button>
              </div>
              <button
                className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!report}
                data-testid="profiler-export-json-button"
                onClick={onExportJson}
              >
                <Download size={15} />
                {t.exportJson}
              </button>
            </section>
            <section className="rounded-md border border-line p-3" data-testid="profiler-report-panel">
              <div className="grid gap-3 sm:grid-cols-4">
                <Metric label={t.frameCount} value={String(report?.summary.frameCount ?? 0)} />
                <Metric label={t.averageFrameMs} value={`${(report?.summary.averageFrameMs ?? 0).toFixed(1)} ms`} />
                <Metric label={t.peakMemory} value={formatBytes(report?.summary.peakMemoryBytes ?? 0)} />
                <Metric label={t.peakQueueDepth} value={String(report?.summary.peakQueueDepth ?? 0)} />
              </div>
              <div className="mt-4 grid gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{t.slowestFrames}</h3>
                  <div className="mt-2 space-y-2">
                    {(report?.summary.slowestFrames ?? []).length > 0 ? (
                      report?.summary.slowestFrames.map((frame) => (
                        <div
                          key={frame.frameIndex}
                          className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-slate-700"
                          data-testid="profiler-slowest-frame"
                        >
                          {formatProfilerFrameReason(frame, passLabels)}
                        </div>
                      ))
                    ) : (
                      <div
                        className="rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-slate-500"
                        data-testid="profiler-empty-state"
                      >
                        {recording ? t.recordingHint : t.empty}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{t.flamegraph}</h3>
                  <svg
                    className="mt-2 h-48 w-full overflow-hidden rounded-md border border-line bg-slate-950"
                    viewBox={`0 0 1000 ${flameHeight}`}
                    preserveAspectRatio="none"
                    data-testid="profiler-flamegraph"
                    role="img"
                    aria-label={t.flamegraph}
                  >
                    {(report?.flamegraph ?? []).map((node) => (
                      <g key={node.id}>
                        <rect
                          x={node.x}
                          y={node.y + 1}
                          width={node.width}
                          height={Math.max(1, node.height - 2)}
                          fill={colorForCategory(node.category)}
                          opacity="0.9"
                        />
                        {node.width > 60 ? (
                          <text
                            x={node.x + 6}
                            y={node.y + 13}
                            fill="white"
                            fontSize="11"
                            lengthAdjust="spacingAndGlyphs"
                          >
                            {node.name}
                          </text>
                        ) : null}
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel px-3 py-2">
      <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-lg tabular-nums text-ink">{value}</div>
    </div>
  );
}

function colorForCategory(category: string): string {
  if (category === 'effects') {
    return '#ef4444';
  }
  if (category === 'color') {
    return '#22c55e';
  }
  if (category === 'overlay') {
    return '#38bdf8';
  }
  if (category === 'export') {
    return '#f59e0b';
  }
  return '#8b5cf6';
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${Math.round(Math.max(0, bytes))} B`;
}
