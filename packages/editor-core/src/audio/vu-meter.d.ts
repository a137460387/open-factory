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
export declare const VU_MIN_DB = -60;
export declare const VU_MAX_DB = 0;
export declare const VU_PEAK_HOLD_MS = 2000;
export declare function createVuMeterState(): VuMeterState;
export declare function readVuMeter(analyser: AnalyserLike, state?: VuMeterState, nowMs?: number, peakHoldMs?: number): VuMeterReading;
export declare function clampDb(value: number): number;
//# sourceMappingURL=vu-meter.d.ts.map