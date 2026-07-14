export interface AnalyserLike {
  fftSize: number;
  getByteTimeDomainData(data: Uint8Array): void;
}

export interface VuMeterState {
  peakDb: number;
  peakHeldAtMs: number;
}

export interface VuMeterReading {
  levelDb: number;
  peakDb: number;
  peakHeldAtMs: number;
}

export const VU_MIN_DB = -60;
export const VU_MAX_DB = 0;
export const VU_PEAK_HOLD_MS = 2000;

export function createVuMeterState(): VuMeterState {
  return {
    peakDb: VU_MIN_DB,
    peakHeldAtMs: 0,
  };
}

export function readVuMeter(
  analyser: AnalyserLike,
  state: VuMeterState = createVuMeterState(),
  nowMs = 0,
  peakHoldMs = VU_PEAK_HOLD_MS,
): VuMeterReading {
  const size = Math.max(1, analyser.fftSize || 1024);
  const samples = new Uint8Array(size);
  analyser.getByteTimeDomainData(samples);

  let sumSquares = 0;
  for (const sample of samples) {
    const normalized = (sample - 128) / 128;
    sumSquares += normalized * normalized;
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  const levelDb = clampDb(rms <= 0 ? VU_MIN_DB : 20 * Math.log10(rms));

  let peakDb = state.peakDb;
  let peakHeldAtMs = state.peakHeldAtMs;
  if (levelDb >= peakDb || nowMs - peakHeldAtMs >= peakHoldMs) {
    peakDb = levelDb;
    peakHeldAtMs = nowMs;
  }

  return {
    levelDb,
    peakDb: clampDb(peakDb),
    peakHeldAtMs,
  };
}

export function clampDb(value: number): number {
  if (!Number.isFinite(value)) {
    return VU_MIN_DB;
  }
  if (value > -0.05) {
    return VU_MAX_DB;
  }
  return Math.min(VU_MAX_DB, Math.max(VU_MIN_DB, value));
}
