import type { QualityLevel, ExportTaskStatus, ExportTaskPriority, ExportTaskHistoryEntry, ExportUploadState, PostExportQualityCheckResult } from '@open-factory/editor-core';
import { assessQualityMetric } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

export function formatQualityMetricValue(value: number | undefined, suffix: string): string {
  if (!Number.isFinite(value)) {
    return zhCN.exportDialog.quality.unavailable;
  }
  return `${(value as number).toFixed(suffix ? 1 : 3)}${suffix}`;
}

export function formatPostExportQualityValue(check: PostExportQualityCheckResult, value: string | number): string {
  if (typeof value === 'string') {
    return value;
  }
  if (check.id === 'fileSize') {
    return formatBytes(value);
  }
  if (check.id === 'duration') {
    return `${value.toFixed(3)}s`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

export function formatOptionalNumber(value: number | undefined, decimals: number): string {
  return Number.isFinite(value) ? (value as number).toFixed(decimals) : zhCN.exportDialog.quality.unavailable;
}

export function formatBytes(value: number | undefined): string {
  if (!Number.isFinite(value)) {
    return zhCN.exportDialog.quality.unavailable;
  }
  const bytes = value as number;
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatMilliseconds(value: number | undefined): string {
  if (!Number.isFinite(value)) {
    return zhCN.exportDialog.quality.unavailable;
  }
  const seconds = (value as number) / 1000;
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
}

export function qualityLevelClass(level: QualityLevel): string {
  switch (level) {
    case 'excellent':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'average':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'poor':
      return 'border-rose-200 bg-rose-50 text-rose-700';
  }
}

export function postExportQualityStatusClass(status: 'pass' | 'warning' | 'fail'): string {
  if (status === 'pass') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (status === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-rose-200 bg-rose-50 text-rose-800';
}

export function uploadStatusClass(status: ExportUploadState['status']): string {
  if (status === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (status === 'running') {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }
  if (status === 'error') {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export function formatLoudness(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : zhCN.common.unavailable;
}

export function priorityLabel(priority: ExportTaskPriority): string {
  return zhCN.exportDialog.priorityOptions[priority];
}

export function getLastExportDurationSeconds(history: ExportTaskHistoryEntry[]): number | undefined {
  const entry = history.find((item) => item.startedAt && item.finishedAt);
  if (!entry?.startedAt || !entry.finishedAt) {
    return undefined;
  }
  const started = Date.parse(entry.startedAt);
  const finished = Date.parse(entry.finishedAt);
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) {
    return undefined;
  }
  return (finished - started) / 1000;
}

export function estimateDimensions(width: number, height: number, format: string): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  if (format !== 'gif') {
    return { width: safeWidth, height: safeHeight };
  }
  const longest = Math.max(safeWidth, safeHeight);
  if (longest <= 1080) {
    return { width: safeWidth, height: safeHeight };
  }
  const ratio = 1080 / longest;
  return {
    width: Math.max(1, Math.round(safeWidth * ratio)),
    height: Math.max(1, Math.round(safeHeight * ratio))
  };
}

export function formatExportWarning(warning: string): string {
  const textClip = warning.match(/^Text clip (.+) was skipped because FFmpeg drawtext\/libfreetype is unavailable\.$/);
  if (textClip) {
    return zhCN.exportDialog.textClipSkippedDrawtext(textClip[1]);
  }
  const transitionVisual = warning.match(/^Transition (.+) was skipped because both clips must be visual media clips\.$/);
  if (transitionVisual) {
    return zhCN.exportDialog.transitionSkippedVisualOnly(transitionVisual[1]);
  }
  const transitionChained = warning.match(/^Transition (.+) was skipped because chained transitions are not yet supported in one export segment\.$/);
  if (transitionChained) {
    return zhCN.exportDialog.transitionSkippedChained(transitionChained[1]);
  }
  const transitionMissingInput = warning.match(/^Transition (.+) was skipped because one of its clips has no media input\.$/);
  if (transitionMissingInput) {
    return zhCN.exportDialog.transitionSkippedMissingInput(transitionMissingInput[1]);
  }
  const missingMedia = warning.match(/^Clip (.+) has no media path and was skipped\.$/);
  if (missingMedia) {
    return zhCN.exportDialog.clipSkippedMissingMedia(missingMedia[1]);
  }
  const speedRampFallback = warning.match(/^Speed ramp setpts for clip (.+) exceeded 4096 characters and fell back to average speed\.$/);
  if (speedRampFallback) {
    return zhCN.exportDialog.speedRampSetptsFallback(speedRampFallback[1]);
  }
  const customShaderSlowWarning = warning.match(/^Custom shader effect for clip (.+) will render frame-by-frame and may be slow\.$/);
  if (customShaderSlowWarning) {
    return zhCN.exportDialog.customShaderSlowWarning(customShaderSlowWarning[1]);
  }
  const opticalFlowFallback = warning.match(/^Optical flow slow motion for clip (.+) fell back to blend because the current FFmpeg build did not report minterpolate support\.$/);
  if (opticalFlowFallback) {
    return zhCN.exportDialog.opticalFlowFallbackBlend(opticalFlowFallback[1]);
  }
  const slowMotionSkipped = warning.match(/^Slow motion interpolation for clip (.+) was skipped because the current FFmpeg build does not support minterpolate\.$/);
  if (slowMotionSkipped) {
    return zhCN.exportDialog.slowMotionInterpolationSkipped(slowMotionSkipped[1]);
  }
  if (warning === 'Current FFmpeg does not support drawtext/libfreetype. Install an FFmpeg build with libfreetype to export text overlays.') {
    return zhCN.exportDialog.ffmpegDrawtextUnavailable;
  }
  if (warning === 'Hardware video encoding was requested but no supported H.264 hardware encoder was detected. Falling back to software encoding.') {
    return zhCN.exportDialog.hardwareEncodingFallback;
  }
  return warning;
}
