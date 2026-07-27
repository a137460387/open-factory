export type SpatialAudioDistance = 'near' | 'medium' | 'far';
export type SpatialAudioRenderMode = 'panner' | 'binaural';
export type SpatialAudioRoomModel = 'none' | 'small-room' | 'hall' | 'outdoor';
export interface ClipSpatialAudio {
    x: number;
    y: number;
    z: number;
    distance: SpatialAudioDistance;
    azimuth: number;
    elevation: number;
    distanceMeters: number;
    renderMode: SpatialAudioRenderMode;
    roomModel: SpatialAudioRoomModel;
}
export declare const DEFAULT_SPATIAL_AUDIO: ClipSpatialAudio;
export declare const SPATIAL_AUDIO_ROOM_MODELS: SpatialAudioRoomModel[];
export declare const KEMAR_HRTF_FILE_NAME = "kemar.bin";
export declare const KEMAR_HRTF_EXPECTED_BYTES: number;
export declare const KEMAR_AZIMUTH_COUNT = 72;
export declare const KEMAR_ELEVATION_COUNT = 44;
export declare const KEMAR_AZIMUTH_STEP_DEGREES: number;
export declare const KEMAR_ELEVATION_MIN_DEGREES = -40;
export declare const KEMAR_ELEVATION_MAX_DEGREES = 90;
export declare const KEMAR_ELEVATION_STEP_DEGREES: number;
export interface KemarHrtfGridSample {
    azimuth: {
        lowerIndex: number;
        upperIndex: number;
        nearestIndex: number;
        weight: number;
    };
    elevation: {
        lowerIndex: number;
        upperIndex: number;
        nearestIndex: number;
        weight: number;
    };
}
export interface SpatialAudioPreviewModeOptions {
    outputChannelCount: number;
    hrtfAvailable: boolean;
}
export declare function normalizeSpatialAudio(input: Partial<ClipSpatialAudio> | undefined): ClipSpatialAudio;
export declare function isDefaultSpatialAudio(input: Partial<ClipSpatialAudio> | undefined): boolean;
export declare function calculateSpatialDistanceGain(input: Partial<ClipSpatialAudio> | undefined): number;
export declare function mapSpatialXToPanGains(x: number): {
    left: number;
    right: number;
};
export declare function resolveSpatialCartesianPosition(input: Partial<ClipSpatialAudio> | undefined): {
    x: number;
    y: number;
    z: number;
};
export declare function resolveKemarHrtfGridSample(input: {
    azimuth: number;
    elevation: number;
}): KemarHrtfGridSample;
export declare function resolveSpatialAudioPreviewMode(input: Partial<ClipSpatialAudio> | undefined, options: SpatialAudioPreviewModeOptions): SpatialAudioRenderMode;
export declare function shouldCopyKemarHrtfAsset(exists: boolean, sizeBytes: number | undefined, expectedBytes?: number): boolean;
export declare function buildKemarHrtfPath(appDataDir: string): string;
export declare function buildRoomImpulseResponsePath(appDataDir: string, roomModel: SpatialAudioRoomModel): string | null;
export declare function buildSofalizerArgs(input: Partial<ClipSpatialAudio> | undefined, hrtfPath: string | undefined): string[];
//# sourceMappingURL=spatial-audio.d.ts.map