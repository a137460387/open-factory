import {
  appendExportRangeSequence,
  exportRenderRangeFromPoints,
  getTimelinePlaybackDuration,
  normalizeExportRanges,
  normalizeExportRenderRange,
  type NormalizedExportRenderRange,
  type ExportPipelineNodeStatus,
  type ExportRenderRange,
  type Project,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import type { ExportPresetSettings } from '../export-presets';
import type { ExportProject, VersionedExportTaskMetadata } from '@open-factory/editor-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportRangeMode = 'all' | 'in-out' | 'selected-clips';

export interface ExportJob {
  outputPath: string;
  range?: ExportRenderRange | null;
  project?: Project;
  settings?: ExportPresetSettings;
  metadata?: ExportProject['metadata'];
  versionedBatch?: VersionedExportTaskMetadata;
  presetName?: string;
  sequenceName?: string;
}

// ---------------------------------------------------------------------------
// Range resolution
// ---------------------------------------------------------------------------

export function resolveInOutExportRanges(
  project: Project,
  inPoint: number | undefined,
  outPoint: number | undefined,
): NormalizedExportRenderRange[] {
  const timelineDuration = getTimelinePlaybackDuration(project.timeline);
  const fps = project.settings.fps || 30;
  const stored = normalizeExportRanges(project.exportRanges, timelineDuration).flatMap((range) => {
    const normalized = normalizeExportRenderRange(
      { id: range.id, label: range.label, start: range.start, duration: range.end - range.start },
      timelineDuration,
      fps,
    );
    return normalized ? [normalized] : [];
  });
  if (stored.length > 0) {
    return stored;
  }
  const current = exportRenderRangeFromPoints(inPoint, outPoint, timelineDuration, fps, {
    id: 'current-in-out',
    label: zhCN.timeline.exportRangeLabel(1),
  });
  return current ? [current] : [];
}

export function resolveSelectedClipExportRange(
  project: Project,
  selectedClipIds: string[],
): NormalizedExportRenderRange | null {
  const selected = new Set(selectedClipIds);
  if (selected.size === 0) return null;
  const clips = project.timeline.tracks.flatMap((track) => track.clips).filter((clip) => selected.has(clip.id));
  if (clips.length === 0) return null;
  const start = Math.min(...clips.map((clip) => clip.start));
  const end = Math.max(...clips.map((clip) => clip.start + clip.duration));
  return exportRenderRangeFromPoints(
    start,
    end,
    getTimelinePlaybackDuration(project.timeline),
    project.settings.fps || 30,
    {
      id: 'selected-clips',
      label: zhCN.exportDialog.range.options['selected-clips'],
    },
  );
}

export function resolveActiveExportRanges(
  mode: ExportRangeMode,
  inOutRanges: NormalizedExportRenderRange[],
  selectedClipRange: NormalizedExportRenderRange | null,
): NormalizedExportRenderRange[] {
  if (mode === 'in-out') return inOutRanges;
  if (mode === 'selected-clips') return selectedClipRange ? [selectedClipRange] : [];
  return [];
}

// ---------------------------------------------------------------------------
// Job builders
// ---------------------------------------------------------------------------

export function buildExportJobs(paths: string[], ranges: NormalizedExportRenderRange[]): ExportJob[] {
  if (ranges.length === 0) return paths.map((path) => ({ outputPath: path, range: null }));
  if (ranges.length === 1) return paths.map((path) => ({ outputPath: path, range: ranges[0] }));
  if (paths.length >= ranges.length) return ranges.map((range, index) => ({ outputPath: paths[index], range }));
  const basePath = paths[0];
  return ranges.map((range, index) => ({
    outputPath: appendExportRangeSequence(basePath, index + 1, ranges.length),
    range,
  }));
}

// ---------------------------------------------------------------------------
// Pipeline status
// ---------------------------------------------------------------------------

export function updatePipelineStatus(
  statuses: Record<string, ExportPipelineNodeStatus>,
  nodeId: string,
  status: ExportPipelineNodeStatus,
): Record<string, ExportPipelineNodeStatus> {
  return { ...statuses, [nodeId]: status };
}

export function pipelineStatusClass(status: ExportPipelineNodeStatus): string {
  if (status === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'failed') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'running') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'skipped') return 'border-slate-200 bg-slate-50 text-slate-500';
  return 'border-slate-200 bg-white text-slate-600';
}

// ---------------------------------------------------------------------------
// Timing / format utilities
// ---------------------------------------------------------------------------

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function formatDuration(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return zhCN.common.unavailable;
  return `${Math.round(value * 10) / 10}s`;
}

export function formatExportRangeSummary(
  mode: ExportRangeMode,
  ranges: NormalizedExportRenderRange[],
  selectedClipRange: NormalizedExportRenderRange | null,
): string {
  if (mode === 'all') return zhCN.exportDialog.range.allSummary;
  if (mode === 'selected-clips' && !selectedClipRange) return zhCN.exportDialog.range.unavailable;
  if (ranges.length === 0) return zhCN.exportDialog.range.unavailable;
  if (ranges.length === 1)
    return zhCN.exportDialog.range.singleSummary(formatDuration(ranges[0].start), formatDuration(ranges[0].duration));
  return zhCN.exportDialog.range.multiSummary(ranges.length);
}
