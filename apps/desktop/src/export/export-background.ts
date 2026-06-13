export type ExportCompletionAction = 'none' | 'notification' | 'shutdown' | 'hibernate';

export const EXPORT_COMPLETION_ACTIONS: ExportCompletionAction[] = ['none', 'notification', 'shutdown', 'hibernate'];

export function normalizeExportCompletionAction(value: string | undefined): ExportCompletionAction {
  return value === 'notification' || value === 'shutdown' || value === 'hibernate' ? value : 'none';
}

export function normalizeScheduledExportStart(value: string | undefined, now = new Date()): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const scheduledMs = Date.parse(value);
  if (!Number.isFinite(scheduledMs) || scheduledMs <= now.getTime()) {
    return undefined;
  }
  return new Date(scheduledMs).toISOString();
}

export function localDatetimeInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function buildExportTrayProgressLabel(progress: number, runningCount: number): string {
  const pct = Math.round(Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)) * 100);
  return runningCount > 0 ? `Open Factory ${pct}%` : 'Open Factory';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
