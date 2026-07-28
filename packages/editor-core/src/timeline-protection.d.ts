import type { Clip, ProtectedRange, Track } from './model';
interface TimeInterval {
    start: number;
    end: number;
}
export declare function intervalsOverlap(left: TimeInterval, right: TimeInterval): boolean;
export declare function intervalContains(container: TimeInterval, child: TimeInterval): boolean;
export declare function getClipProtectedRanges(clip: Pick<Clip, 'start' | 'duration'>, ranges: ProtectedRange[]): ProtectedRange[];
export declare function canMoveClipWithProtectedRanges(clip: Pick<Clip, 'start' | 'duration'>, nextStart: number, ranges: ProtectedRange[]): boolean;
export declare function applyProtectedRippleDeleteToTrack(track: Track, selectedIds: Set<string>, protectedRanges: ProtectedRange[]): Track;
export declare function getRippleProtectedStopTime(removedIntervals: TimeInterval[], protectedRanges: ProtectedRange[]): number | undefined;
export {};
//# sourceMappingURL=timeline-protection.d.ts.map