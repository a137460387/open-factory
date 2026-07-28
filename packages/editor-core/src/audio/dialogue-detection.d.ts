import type { Clip } from '../model-types';
export type DialogueSensitivity = 'low' | 'medium' | 'high';
export interface DialogueDetectionFrame {
    time: number;
    duration: number;
    loudness: number;
    frequencyBins: Array<{
        hz: number;
        energy: number;
    }>;
}
export interface DialogueDetectionOptions {
    sensitivity?: DialogueSensitivity;
    minConfidence?: number;
    mergeGap?: number;
}
export interface DialogueInterval {
    id: string;
    start: number;
    end: number;
    duration: number;
    confidence: number;
}
export interface WhisperSegmentLike {
    id?: string;
    start: number;
    end: number;
    text?: string;
}
export interface DialogueWhisperMiss {
    id: string;
    start: number;
    end: number;
    duration: number;
    confidence: number;
}
export interface DialogueSubtitleClipInput {
    trackId: string;
    baseId?: string;
    namePrefix?: string;
}
export declare const VOICE_BAND_MIN_HZ = 300;
export declare const VOICE_BAND_MAX_HZ = 3400;
export declare const DIALOGUE_SENSITIVITY_PRESETS: {
    readonly low: {
        readonly minDuration: 0.7;
        readonly loudnessThreshold: 0.32;
        readonly voiceEnergyRatio: 0.62;
    };
    readonly medium: {
        readonly minDuration: 0.45;
        readonly loudnessThreshold: 0.24;
        readonly voiceEnergyRatio: 0.52;
    };
    readonly high: {
        readonly minDuration: 0.25;
        readonly loudnessThreshold: 0.16;
        readonly voiceEnergyRatio: 0.42;
    };
};
export declare function calculateVoiceBandEnergy(frequencyBins: DialogueDetectionFrame['frequencyBins']): {
    voiceEnergy: number;
    totalEnergy: number;
    ratio: number;
};
export declare function detectDialogueIntervals(frames: DialogueDetectionFrame[], options?: DialogueDetectionOptions): DialogueInterval[];
export declare function compareDialogueWithWhisper(dialogues: DialogueInterval[], whisperSegments: WhisperSegmentLike[], minOverlapRatio?: number): DialogueWhisperMiss[];
export declare function createSubtitleClipsFromDialogues(dialogues: DialogueInterval[], input: DialogueSubtitleClipInput): Array<Extract<Clip, {
    type: 'subtitle';
}>>;
//# sourceMappingURL=dialogue-detection.d.ts.map