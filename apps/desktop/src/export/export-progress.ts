interface ExportProgressPayload {
  taskId?: string;
  progress?: number;
  progressPct?: number;
  outTimeUs?: number;
  expectedDurationUs?: number;
}

export type ExportProgressEvent = number | ExportProgressPayload;

export function normalizeExportProgressPayload(payload: ExportProgressEvent): number {
  if (typeof payload === 'number') {
    return clampProgress(payload > 1 ? payload / 100 : payload);
  }
  if (typeof payload.progress === 'number') {
    return clampProgress(payload.progress);
  }
  if (typeof payload.progressPct === 'number') {
    return clampProgress(payload.progressPct / 100);
  }
  if (
    typeof payload.outTimeUs === 'number' &&
    typeof payload.expectedDurationUs === 'number' &&
    payload.expectedDurationUs > 0
  ) {
    return clampProgress(payload.outTimeUs / payload.expectedDurationUs);
  }
  return 0;
}

function clampProgress(progress: number): number {
  return Math.min(1, Math.max(0, progress));
}
