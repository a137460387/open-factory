import { type ClipKeyframes, type MotionTrackPoint, type Transform } from './model';
export declare function motionTrackToPositionKeyframes(points: readonly Partial<MotionTrackPoint>[] | undefined, transform: Transform, duration: number): ClipKeyframes;
export declare function bindMotionTrackToPositionKeyframes(existing: ClipKeyframes | undefined, points: readonly Partial<MotionTrackPoint>[] | undefined, transform: Transform, duration: number): ClipKeyframes | undefined;
//# sourceMappingURL=motion-tracking.d.ts.map