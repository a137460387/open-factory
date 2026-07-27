import type { MulticamClipAngle, MediaMetadata } from './model-types';
export interface MulticamSyncResult {
    offsets: Map<string, number>;
    confidence: number;
    driftDetected: boolean;
    driftRate?: number;
}
export interface ManualSyncMarker {
    angleId: string;
    time: number;
}
export declare function syncMulticamByAudio(angles: MulticamClipAngle[], audioSamplesMap: Map<string, ArrayLike<number>>): Promise<MulticamSyncResult>;
export declare function syncMulticamByTimecode(angles: MulticamClipAngle[], metadata: Record<string, MediaMetadata>): MulticamSyncResult;
export declare function syncMulticamByManual(angles: MulticamClipAngle[], markers: ManualSyncMarker[]): MulticamSyncResult;
export declare function detectMulticamDrift(angles: MulticamClipAngle[], audioSamplesMap?: Map<string, ArrayLike<number>>): Promise<{
    driftDetected: boolean;
    driftRate: number;
}>;
//# sourceMappingURL=multicam-sync.d.ts.map