import { clamp01 } from '@open-factory/editor-core/utils/math';

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
    return clamp01(payload > 1 ? payload / 100 : payload);
  }
  if (typeof payload.progress === 'number') {
    return clamp01(payload.progress);
  }
  if (typeof payload.progressPct === 'number') {
    return clamp01(payload.progressPct / 100);
  }
  if (
    typeof payload.outTimeUs === 'number' &&
    typeof payload.expectedDurationUs === 'number' &&
    payload.expectedDurationUs > 0
  ) {
    return clamp01(payload.outTimeUs / payload.expectedDurationUs);
  }
  return 0;
}
