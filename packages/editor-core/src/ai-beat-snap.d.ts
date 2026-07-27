import type { BeatSnapSuggestion, Clip } from './model-types';
export declare const BEAT_SNAP_TOLERANCE_MS = 150;
export interface BeatSnapResult {
    snappedClipIds: string[];
    suggestions: BeatSnapSuggestion[];
}
export declare function findNearestBeatBinarySearch(time: number, beatTimes: number[]): number | undefined;
export declare function isWithinSnapTolerance(time: number, beatTime: number): boolean;
export declare function calculateBeatSnapForClips(clips: Clip[], beatTimes: number[]): BeatSnapResult;
export declare function applyBeatSnapToClip(clip: Clip, edge: 'in' | 'out', suggestedTime: number): Clip;
export declare function removeSuggestion(suggestions: BeatSnapSuggestion[], clipId: string, edge: 'in' | 'out'): BeatSnapSuggestion[];
//# sourceMappingURL=ai-beat-snap.d.ts.map