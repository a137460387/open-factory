import type { Clip, ClipKeyframes, Timeline, Track, Transition } from './model-types';
export declare const SPEED_CURVE_INTEGRATION_STEPS = 100;
export declare function findClipAtTime(track: Track, time: number): Clip | undefined;
export declare function getActiveClipsAtTime(timeline: Timeline, time: number): Clip[];
export declare function splitClip<TClip extends Clip>(clip: TClip, splitTime: number): [TClip, TClip];
export declare function trimClip<TClip extends Clip>(clip: TClip, newTrimStart: number, newTrimEnd: number): TClip;
export declare function moveClip<TClip extends Clip>(clip: TClip, newStart: number): TClip;
export declare function detectOverlap(track: Track, clip: Clip, excludeId?: string): boolean;
export declare function snapTime(time: number, grid?: number): number;
export declare function getTimelineDuration(timeline: Timeline): number;
export declare function getTimelinePlaybackDuration(timeline: Pick<Timeline, 'tracks' | 'transitions'>): number;
export declare function getRenderableTracks<TTrack extends {
    muted?: boolean;
    solo?: boolean;
}>(timeline: {
    tracks: TTrack[];
}): TTrack[];
export declare function getTrackVolume(track: Track): number;
export declare function getTrackPan(track: Track): number;
export declare function getTransitionMaxDuration(fromClip: Pick<Clip, 'duration'> | {
    duration: number;
}, toClip: Pick<Clip, 'duration'> | {
    duration: number;
}): number;
export declare function clampTransitionDuration(duration: number | undefined, fromClip: Pick<Clip, 'duration'> | {
    duration: number;
}, toClip: Pick<Clip, 'duration'> | {
    duration: number;
}): number;
export declare function areClipsAdjacent(fromClip: Pick<Clip, 'start' | 'duration'> | {
    start: number;
    duration: number;
}, toClip: Pick<Clip, 'start'> | {
    start: number;
}): boolean;
export declare function findAdjacentTransitionClips(timeline: Pick<Timeline, 'tracks' | 'transitions'>, fromClipId: string, toClipId: string): {
    track: Track;
    fromClip: Clip;
    toClip: Clip;
    fromIndex: number;
    toIndex: number;
} | undefined;
export declare function getClipPlaybackStart(timeline: Pick<Timeline, 'tracks' | 'transitions'>, clipId: string): number | undefined;
export declare function getTransitionPlaybackWindow(timeline: Pick<Timeline, 'tracks' | 'transitions'>, transition: Transition): {
    start: number;
    end: number;
    duration: number;
    fromClip: Clip;
    toClip: Clip;
} | undefined;
export declare function getClipSpeed(clip: Pick<Clip, 'speed'> | {
    speed?: number;
}): number;
export declare function getClipSpeedAtTime(clip: Pick<Clip, 'speed' | 'keyframes'> | {
    speed?: number;
    keyframes?: ClipKeyframes;
}, localTime: number): number;
export declare function hasSpeedKeyframes(keyframes: ClipKeyframes | undefined): boolean;
export declare function getClipSourceVisibleDuration(clip: Pick<Clip, 'duration' | 'speed' | 'keyframes'> | {
    duration: number;
    speed?: number;
    keyframes?: ClipKeyframes;
}): number;
export declare function getClipDisplayDuration(sourceVisibleDuration: number, speed: number | undefined, keyframes?: ClipKeyframes): number;
export declare function setClipSpeed<TClip extends Clip>(clip: TClip, speed: number): TClip;
export declare function calculateSpeedCurveSourceDuration(displayDuration: number, keyframes: ClipKeyframes | undefined, fallbackSpeed: number | undefined, steps?: number): number;
export declare function calculateSpeedCurveDisplayDuration(sourceVisibleDuration: number, keyframes: ClipKeyframes | undefined, fallbackSpeed: number | undefined, steps?: number): number;
export declare function replaceClip(timeline: Timeline, replacement: Clip): Timeline;
export declare function removeClip(timeline: Timeline, clipId: string): {
    timeline: Timeline;
    clip?: Clip;
    index: number;
    trackId?: string;
};
//# sourceMappingURL=timeline.d.ts.map