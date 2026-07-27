/**
 * Rhythm Matcher Engine
 *
 * Detects audio beats, analyzes video motion, and aligns rhythm to template
 * keyframes for "beat-sync" editing effects.
 *
 * Pipeline: detectAudioBeats -> analyzeVideoMotion -> matchRhythmToTemplate
 *           -> createRhythmAlignedTemplate (one-shot)
 */
import type { EditingTemplate } from '../models/template-schema';
/** A single beat point detected from audio data. */
export interface AudioBeat {
    /** Time position in seconds */
    time: number;
    /** Beat strength 0-1 (normalized peak amplitude) */
    strength: number;
    /** Dominant frequency band index (0 = low, 1 = mid, 2 = high) */
    frequency: number;
}
/** A single motion analysis point from video frames. */
export interface VideoMotionPoint {
    /** Time position in seconds */
    time: number;
    /** Motion magnitude 0-1 (normalized inter-frame difference) */
    motionMagnitude: number;
    /** Dominant motion direction in radians */
    direction: number;
}
/** Overall rhythm analysis result. */
export interface AudioRhythmProfile {
    /** Detected BPM (beats per minute) */
    bpm: number;
    /** Sorted beat points */
    beats: AudioBeat[];
    /** Average interval between beats in seconds */
    avgBeatInterval: number;
    /** Rhythm classification */
    rhythmType: 'slow' | 'medium' | 'fast' | 'variable';
}
/**
 * Detect beat points from raw PCM audio amplitude data.
 *
 * Uses energy-peak detection: compute windowed RMS energy, normalize,
 * identify local peaks above threshold, filter closely-spaced duplicates.
 *
 * @param audioData - PCM amplitude samples normalized to -1..1
 * @param sampleRate - Sample rate in Hz (default 44100)
 * @returns Sorted array of AudioBeat points
 */
export declare function detectAudioBeats(audioData: readonly number[], sampleRate?: number): AudioBeat[];
/**
 * Analyze video motion from per-frame motion magnitude data.
 *
 * Normalizes magnitudes and estimates direction from inter-frame gradients.
 *
 * @param frames - Array of { time, motionMagnitude } per frame
 * @param fps - Frames per second (default 30)
 * @returns Array of VideoMotionPoint with direction estimates
 */
export declare function analyzeVideoMotion(frames: readonly {
    time: number;
    motionMagnitude: number;
}[], fps?: number): VideoMotionPoint[];
/**
 * Find high-motion turning points from analyzed motion data.
 *
 * A turning point is a local maximum above MOTION_HIGH_THRESHOLD
 * within a sliding window.
 *
 * @param motionPoints - Output from analyzeVideoMotion
 * @returns Subset of points that are high-motion peaks
 */
export declare function findMotionPeaks(motionPoints: readonly VideoMotionPoint[]): VideoMotionPoint[];
/**
 * Match a rhythm profile to an editing template.
 *
 * Maps beat times to normalizedTime (0-1), then generates scale-punch,
 * opacity-pulse, and position-shift keyframes at each beat for a
 * "beat-sync" effect.
 *
 * @param rhythmProfile - Analyzed rhythm data
 * @param template - Source editing template
 * @returns New template with rhythm-aligned keyframes injected
 */
export declare function matchRhythmToTemplate(rhythmProfile: AudioRhythmProfile, template: EditingTemplate): EditingTemplate;
/**
 * One-shot pipeline: detect beats, analyze motion, merge, and align to template.
 *
 * Combines audio beat detection with video motion analysis. Motion peaks that
 * don't coincide with audio beats are added as supplemental beats weighted by
 * the audioWeight parameter.
 *
 * @param template - Base editing template to align
 * @param audioData - PCM audio amplitude samples (-1..1)
 * @param videoFrames - Per-frame motion data with timestamps
 * @param options - Optional sampleRate, fps, audioWeight (0-1, default 0.7)
 * @returns Rhythm-aligned template with sync keyframes
 */
export declare function createRhythmAlignedTemplate(template: EditingTemplate, audioData: readonly number[], videoFrames: readonly {
    time: number;
    motionMagnitude: number;
}[], options?: {
    sampleRate?: number;
    fps?: number;
    audioWeight?: number;
}): EditingTemplate;
//# sourceMappingURL=rhythm-matcher.d.ts.map