import { type Transition, type TransitionType, type VideoClip } from './model';
export interface VideoStitchSegmentInput {
    mediaId: string;
    name: string;
    duration: number;
}
export interface VideoStitchSequenceOptions {
    trackId: string;
    startTime?: number;
    transitionEnabled?: boolean;
    transitionDuration?: number;
    transitionType?: TransitionType;
}
export interface VideoStitchSequence {
    clips: VideoClip[];
    transitions: Transition[];
    duration: number;
}
export declare function buildVideoStitchSequence(segments: VideoStitchSegmentInput[], options: VideoStitchSequenceOptions): VideoStitchSequence;
//# sourceMappingURL=video-stitching.d.ts.map