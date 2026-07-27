/**
 * Audio Rhythm Analysis System
 *
 * Provides real-time audio spectrum analysis and beat detection:
 * - FFT-based frequency analysis
 * - Onset detection (beat tracking)
 * - Tempo estimation
 * - Rhythm pattern classification
 *
 * All computations are local-only, no external AI calls.
 */
export interface AudioRhythmConfig {
    /** FFT window size (must be power of 2) */
    fftSize: number;
    /** Hop size between FFT windows (samples) */
    hopSize: number;
    /** Sample rate (Hz) */
    sampleRate: number;
    /** Onset detection threshold (0-1) */
    onsetThreshold: number;
    /** Minimum tempo BPM */
    minBpm: number;
    /** Maximum tempo BPM */
    maxBpm: number;
    /** Minimum gap between onsets (seconds) */
    minOnsetGap: number;
}
export declare const DEFAULT_AUDIO_RHYTHM_CONFIG: AudioRhythmConfig;
export interface SpectrumFrame {
    /** Time in seconds */
    time: number;
    /** Frequency bins magnitudes (normalized 0-1) */
    magnitudes: number[];
    /** Spectral centroid (brightness) */
    centroid: number;
    /** Spectral flux (change from previous frame) */
    flux: number;
    /** Band energy: sub-bass, bass, low-mid, mid, high-mid, high */
    bandEnergies: [number, number, number, number, number, number];
}
export interface OnsetEvent {
    /** Time in seconds */
    time: number;
    /** Onset strength 0-1 */
    strength: number;
    /** Frequency band where onset was detected */
    band: 'sub-bass' | 'bass' | 'low-mid' | 'mid' | 'high-mid' | 'high';
}
export interface TempoEstimate {
    /** Estimated BPM */
    bpm: number;
    /** Confidence 0-1 */
    confidence: number;
    /** Beat phase offset (seconds) */
    phase: number;
}
export interface RhythmPattern {
    /** Pattern type */
    type: 'steady' | 'syncopated' | 'buildup' | 'breakdown' | 'irregular';
    /** Confidence 0-1 */
    confidence: number;
    /** Average inter-onset interval */
    avgInterval: number;
    /** Interval variance (regularity metric) */
    intervalVariance: number;
}
export interface AudioRhythmResult {
    /** Spectrum analysis per frame */
    spectrumFrames: SpectrumFrame[];
    /** Detected onsets */
    onsets: OnsetEvent[];
    /** Tempo estimation */
    tempo: TempoEstimate | null;
    /** Rhythm pattern classification */
    pattern: RhythmPattern;
    /** Beat-aligned timestamps */
    beatTimes: number[];
    /** Energy curve for timeline display */
    energyCurve: Array<{
        time: number;
        value: number;
    }>;
    /** Statistics */
    stats: {
        totalFrames: number;
        onsetCount: number;
        avgSpectralCentroid: number;
        avgEnergy: number;
    };
}
/**
 * Simple DFT for small arrays (no external FFT library needed).
 * For production, would use Web Audio API's AnalyserNode.
 */
export declare function computeMagnitudes(realInput: number[]): number[];
/**
 * Apply Hanning window to a signal frame.
 */
export declare function applyHanningWindow(signal: number[]): number[];
/**
 * Calculate spectral centroid from magnitude spectrum.
 * Returns normalized value 0-1 (0=dark, 1=bright).
 */
export declare function calculateSpectralCentroid(magnitudes: number[]): number;
/**
 * Calculate spectral flux between two magnitude frames.
 * Returns normalized change 0-1.
 */
export declare function calculateSpectralFlux(prev: number[], curr: number[]): number;
/**
 * Split magnitude spectrum into 6 frequency bands.
 */
export declare function calculateBandEnergies(magnitudes: number[], sampleRate: number, fftSize: number): [number, number, number, number, number, number];
/**
 * Detect onsets from spectrum frames using spectral flux peaks.
 */
export declare function detectOnsets(spectrumFrames: SpectrumFrame[], threshold: number, minGapSeconds: number): OnsetEvent[];
/**
 * Estimate tempo from onset times using autocorrelation of inter-onset intervals.
 */
export declare function estimateTempo(onsets: OnsetEvent[], minBpm: number, maxBpm: number): TempoEstimate | null;
/**
 * Generate beat timestamps from tempo estimate.
 */
export declare function generateBeatTimes(tempo: TempoEstimate, duration: number): number[];
/**
 * Classify rhythm pattern from onset intervals.
 */
export declare function classifyRhythmPattern(onsets: OnsetEvent[]): RhythmPattern;
/**
 * Run full audio rhythm analysis on raw audio samples.
 *
 * @param audioSamples - Mono audio samples (-1 to 1)
 * @param sampleRate - Sample rate in Hz
 * @param config - Analysis configuration
 */
export declare function analyzeAudioRhythm(audioSamples: ArrayLike<number>, sampleRate: number, config?: Partial<AudioRhythmConfig>): AudioRhythmResult;
/**
 * Align visual highlights with audio rhythm markers.
 * Returns combined markers with boosted scores for audio-visual alignment.
 */
export declare function alignHighlightsWithRhythm(visualTimes: number[], audioBeatTimes: number[], toleranceSeconds?: number): Array<{
    time: number;
    aligned: boolean;
    visualNearby: boolean;
    beatNearby: boolean;
}>;
//# sourceMappingURL=audio-rhythm-analysis.d.ts.map