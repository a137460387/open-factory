export declare const DEFAULT_PAUSE_THRESHOLD = 1.2;
export declare const DEFAULT_ZCR_DIFF_THRESHOLD = 0.15;
export declare const DEFAULT_SPEAKER_NAME_PREFIX = "\u8BF4\u8BDD\u4EBA";
export interface SubtitleSegmentInput {
    id: string;
    start: number;
    end: number;
    text: string;
    zeroCrossingRate?: number;
}
export interface SpeakerAssignment {
    segmentId: string;
    speakerId: number;
}
export interface SpeakerDiarizationResult {
    assignments: SpeakerAssignment[];
    speakerLabels: Record<number, string>;
}
export declare function detectPauseBoundaries(segments: readonly SubtitleSegmentInput[], pauseThreshold?: number): boolean[];
export declare function detectSpeakerChange(currentZcr: number, previousZcr: number, zcrThreshold?: number): boolean;
export declare function assignSpeakerIds(segments: readonly SubtitleSegmentInput[], pauseThreshold?: number, zcrThreshold?: number): SpeakerAssignment[];
export declare function buildSpeakerLabels(count: number, prefix?: string): Record<number, string>;
export declare function renameSpeaker(labels: Record<number, string>, oldId: number, newName: string): Record<number, string>;
export declare function batchRenameSpeakers(labels: Record<number, string>, renames: Record<number, string>): Record<number, string>;
export declare function performSpeakerDiarization(segments: readonly SubtitleSegmentInput[], pauseThreshold?: number, zcrThreshold?: number): SpeakerDiarizationResult;
//# sourceMappingURL=subtitle-speaker-diarization.d.ts.map