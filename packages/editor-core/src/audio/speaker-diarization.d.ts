import type { Clip, Track } from '../model-types';
import type { DialogueInterval } from './dialogue-detection';
export type SpeakerDiarizationConfidence = 'high' | 'medium' | 'low';
export interface SpeakerDiarizationFrame {
    time: number;
    duration: number;
    loudness: number;
    pitchHz?: number;
    spectralCentroidHz?: number;
}
export interface SpeakerDiarizationOptions {
    silenceThreshold?: number;
    pitchChangeThresholdHz?: number;
    minSegmentDuration?: number;
    maxSpeakers?: number;
    dialogueIntervals?: Array<Pick<DialogueInterval, 'start' | 'end'>>;
}
export interface SpeakerDiarizationSegment {
    id: string;
    speakerId: string;
    speakerIndex: number;
    start: number;
    end: number;
    duration: number;
    averagePitchHz: number;
    averageCentroidHz: number;
    confidence: number;
    confidenceLabel: SpeakerDiarizationConfidence;
}
export interface SpeakerDiarizationTrackOptions {
    baseId?: string;
    speakerNamePrefix?: string;
    clipNamePrefix?: string;
}
export declare function detectSpeakerSegments(frames: SpeakerDiarizationFrame[], options?: SpeakerDiarizationOptions): SpeakerDiarizationSegment[];
export declare function buildSpeakerDiarizationTracks(sourceClip: Extract<Clip, {
    type: 'audio' | 'video';
}>, segments: SpeakerDiarizationSegment[], options?: SpeakerDiarizationTrackOptions): Track[];
export declare function hasLowConfidenceSpeakerSegments(segments: SpeakerDiarizationSegment[]): boolean;
export declare function labelConfidence(confidence: number): SpeakerDiarizationConfidence;
//# sourceMappingURL=speaker-diarization.d.ts.map