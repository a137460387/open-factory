export interface RgbaFrame {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

export interface RgbHistogram {
  r: number[];
  g: number[];
  b: number[];
}

export interface WaveformScope {
  columns: number[][];
}

export interface VectorscopePoint {
  x: number;
  y: number;
  count: number;
}

export interface ColorScopes {
  histogram: RgbHistogram;
  waveform: WaveformScope;
  vectorscope: VectorscopePoint[];
}

export function computeColorScopes(frame: RgbaFrame, waveformColumns = frame.width): ColorScopes {
  return {
    histogram: computeRgbHistogram(frame),
    waveform: computeWaveform(frame, waveformColumns),
    vectorscope: computeVectorscope(frame)
  };
}

export function computeRgbHistogram(frame: RgbaFrame): RgbHistogram {
  assertFrame(frame);
  const histogram: RgbHistogram = {
    r: Array.from({ length: 256 }, () => 0),
    g: Array.from({ length: 256 }, () => 0),
    b: Array.from({ length: 256 }, () => 0)
  };
  forEachPixel(frame, (r, g, b) => {
    histogram.r[r] += 1;
    histogram.g[g] += 1;
    histogram.b[b] += 1;
  });
  return histogram;
}

export function computeWaveform(frame: RgbaFrame, columnCount = frame.width): WaveformScope {
  assertFrame(frame);
  const columns = Array.from({ length: Math.max(1, Math.round(columnCount)) }, () => Array.from({ length: 101 }, () => 0));
  forEachPixel(frame, (r, g, b, _a, x) => {
    const column = Math.min(columns.length - 1, Math.floor((x / Math.max(1, frame.width)) * columns.length));
    const ire = Math.min(100, Math.max(0, Math.round((luma(r, g, b) / 255) * 100)));
    columns[column][ire] += 1;
  });
  return { columns };
}

export function computeVectorscope(frame: RgbaFrame, precision = 3): VectorscopePoint[] {
  assertFrame(frame);
  const buckets = new Map<string, VectorscopePoint>();
  const multiplier = 10 ** precision;
  forEachPixel(frame, (r, g, b) => {
    const { x, y } = rgbToCbCrPoint(r, g, b);
    const roundedX = Math.round(x * multiplier) / multiplier;
    const roundedY = Math.round(y * multiplier) / multiplier;
    const key = `${roundedX},${roundedY}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, { x: roundedX, y: roundedY, count: 1 });
    }
  });
  return [...buckets.values()];
}

export function rgbToCbCrPoint(r: number, g: number, b: number): { x: number; y: number } {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return {
    x: Math.min(1, Math.max(-1, (cb - 128) / 128)),
    y: Math.min(1, Math.max(-1, (cr - 128) / 128))
  };
}

function forEachPixel(frame: RgbaFrame, visitor: (r: number, g: number, b: number, a: number, x: number, y: number) => void): void {
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const index = (y * frame.width + x) * 4;
      visitor(frame.data[index] ?? 0, frame.data[index + 1] ?? 0, frame.data[index + 2] ?? 0, frame.data[index + 3] ?? 255, x, y);
    }
  }
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function assertFrame(frame: RgbaFrame): void {
  if (frame.width <= 0 || frame.height <= 0 || frame.data.length < frame.width * frame.height * 4) {
    throw new Error('Color scope frame is empty or incomplete.');
  }
}
