import type {
  QualityLevel,
  ExportTaskPriority,
  ExportUploadState,
  PostExportQualityCheckResult,
} from '@open-factory/editor-core';
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
