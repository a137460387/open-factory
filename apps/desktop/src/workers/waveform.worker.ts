import { zhCN } from '../i18n/strings';

export interface WaveformWorkerInput {
  arrayBuffer: ArrayBuffer;
  pointsPerSecond: number;
  durationHint?: number;
}

export interface WaveformWorkerOutput {
  success: boolean;
  peaks: number[];
  duration: number;
  channels: number;
  error?: string;
}

self.onmessage = (event: MessageEvent<WaveformWorkerInput>) => {
  try {
    const { arrayBuffer, pointsPerSecond, durationHint } = event.data;
    const bytes = new Uint8Array(arrayBuffer);
    const duration = Math.max(durationHint ?? bytes.length / 44_100, 0.001);
    const totalPoints = Math.max(32, Math.ceil(duration * pointsPerSecond));
    const peaks = extractBytePeaks(bytes, totalPoints);
    const payload: WaveformWorkerOutput = { success: true, peaks, duration, channels: 1 };
    self.postMessage(payload);
  } catch (error) {
    const payload: WaveformWorkerOutput = {
      success: false,
      peaks: [],
      duration: 0,
      channels: 0,
      error: error instanceof Error ? error.message : zhCN.errors.waveformGenerateFailed
    };
    self.postMessage(payload);
  }
};

function extractBytePeaks(bytes: Uint8Array, totalPoints: number): number[] {
  if (bytes.length === 0) {
    return Array.from({ length: totalPoints }, () => 0);
  }
  const bucketSize = Math.max(1, Math.floor(bytes.length / totalPoints));
  const peaks: number[] = [];
  for (let point = 0; point < totalPoints; point += 1) {
    const start = point * bucketSize;
    const end = Math.min(bytes.length, start + bucketSize);
    let peak = 0;
    for (let index = start; index < end; index += 1) {
      peak = Math.max(peak, Math.abs(bytes[index] - 128) / 128);
    }
    peaks.push(Number(peak.toFixed(3)));
  }
  return peaks;
}
