export interface SpectrumSelectionRange {
  inPoint: number;
  outPoint: number;
}

export function resolveSpectrumTime(clientX: number, rectLeft: number, rectWidth: number, duration: number): number {
  if (!Number.isFinite(clientX) || !Number.isFinite(rectLeft) || !Number.isFinite(rectWidth) || !Number.isFinite(duration) || rectWidth <= 0 || duration <= 0) {
    return 0;
  }
  const ratio = Math.min(1, Math.max(0, (clientX - rectLeft) / rectWidth));
  return roundSeconds(ratio * duration);
}

export function resolveSpectrumSelection(startX: number, endX: number, rectLeft: number, rectWidth: number, duration: number): SpectrumSelectionRange {
  const start = resolveSpectrumTime(startX, rectLeft, rectWidth, duration);
  const end = resolveSpectrumTime(endX, rectLeft, rectWidth, duration);
  return {
    inPoint: Math.min(start, end),
    outPoint: Math.max(start, end)
  };
}

function roundSeconds(value: number): number {
  return Math.round(value * 1000) / 1000;
}
