import { Clip, Keyframe, Timeline } from '../../model';
import { BatchKeyframeEditOperation, KeyframeSelectionRef } from './keyframe-edit-commands';
export declare function uniqueKeyframeRefs(refs: KeyframeSelectionRef[]): KeyframeSelectionRef[];
export declare function groupKeyframeRefsByClip(refs: KeyframeSelectionRef[]): Map<string, KeyframeSelectionRef[]>;
export declare function calculateKeyframeSelectionCenter(timeline: Timeline, refs: KeyframeSelectionRef[]): number;
export declare function keyframeRefKey(ref: KeyframeSelectionRef): string;
export declare function calculateDistributedKeyframeTimeMap(timeline: Timeline, refs: KeyframeSelectionRef[]): Map<string, number>;
export declare function getBatchAlignValue(timeline: Timeline, refs: KeyframeSelectionRef[], value: number | undefined): number;
export declare function getBatchEditedKeyframeTime(clip: Clip, frame: Keyframe<number>, operation: BatchKeyframeEditOperation, center: number): number;
export declare function clampKeyframeTime(time: number, duration: number): number;
//# sourceMappingURL=utils-keyframe.d.ts.map