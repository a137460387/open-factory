export interface ExportRenderRange {
  id?: string;
  label?: string;
  start: number;
  duration: number;
}

export interface NormalizedExportRenderRange {
  id?: string;
  label?: string;
  start: number;
  duration: number;
}

export function normalizeExportRenderRange(
  range: ExportRenderRange | null | undefined,
  timelineDuration: number,
  fps: number,
): NormalizedExportRenderRange | null {
  if (!range || !Number.isFinite(range.start) || !Number.isFinite(range.duration) || range.duration <= 0) {
    return null;
  }
  const safeFps = Math.max(1, Number.isFinite(fps) ? fps : 30);
  const timelineFrames = Math.max(1, Math.round(Math.max(0, timelineDuration) * safeFps));
  const startFrame = Math.min(timelineFrames - 1, Math.max(0, Math.round(range.start * safeFps)));
  const durationFrames = Math.max(1, Math.round(range.duration * safeFps));
  const endFrame = Math.min(timelineFrames, startFrame + durationFrames);
  return {
    id: range.id,
    label: range.label,
    start: roundFrameTime(startFrame / safeFps),
    duration: roundFrameTime((endFrame - startFrame) / safeFps),
  };
}

export function exportRenderRangeFromPoints(
  start: number | undefined,
  end: number | undefined,
  timelineDuration: number,
  fps: number,
  metadata: Pick<ExportRenderRange, 'id' | 'label'> = {},
): NormalizedExportRenderRange | null {
  if (typeof start !== 'number' || typeof end !== 'number') {
    return null;
  }
  const left = Math.min(start, end);
  const right = Math.max(start, end);
  return normalizeExportRenderRange({ ...metadata, start: left, duration: right - left }, timelineDuration, fps);
}

export function appendExportRangeSequence(path: string, sequence: number, total = sequence): string {
  const index = Math.max(1, Math.round(sequence));
  const width = Math.max(2, String(Math.max(index, Math.round(total))).length);
  const suffix = String(index).padStart(width, '0');
  const normalized = path.trim();
  const separatorIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  const directory = separatorIndex >= 0 ? normalized.slice(0, separatorIndex + 1) : '';
  const fileName = separatorIndex >= 0 ? normalized.slice(separatorIndex + 1) : normalized;
  const extensionIndex = fileName.lastIndexOf('.');
  if (extensionIndex <= 0) {
    return `${directory}${fileName}-${suffix}`;
  }
  return `${directory}${fileName.slice(0, extensionIndex)}-${suffix}${fileName.slice(extensionIndex)}`;
}

function roundFrameTime(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
