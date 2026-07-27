export interface DecodedWaveformInput {
    channels: Float32Array[];
    sampleRate: number;
    pointsPerSecond: number;
}
export interface DecodedWaveform {
    peaks: number[];
    duration: number;
    channels: number;
    pointsPerSecond: number;
    samplesPerPoint: number;
    isSampled: boolean;
}
export interface PixelPeakInput {
    channels: Float32Array[];
    pixelWidth: number;
}
export declare function extractDecodedWaveform(input: DecodedWaveformInput): DecodedWaveform;
export declare function sampleAudioPeaksForPixels(input: PixelPeakInput): number[];
export declare function buildWaveformChannelHash(channels: number, sampleRate: number, duration: number): string;
export declare function buildTimelineWaveformCacheKey(mediaPath: string, channelHash: string): string;
//# sourceMappingURL=waveform.d.ts.map