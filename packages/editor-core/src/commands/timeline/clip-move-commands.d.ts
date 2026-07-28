import type { TimelineAccessor } from './index';
import { BeatAlignmentUpdate, BeatSnapUpdate } from '../../beats';
import { ProtectedRange } from '../../model';
import { Command } from '../command';
export declare class MoveClipCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly newStart;
    private readonly protectedRanges;
    readonly description = "Move clip";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, newStart: number, protectedRanges?: ProtectedRange[]);
    execute(): void;
    undo(): void;
}
export declare class MoveClipsCommand implements Command {
    private readonly accessor;
    private readonly newStartsByClipId;
    private readonly protectedRanges;
    readonly description = "Move clips";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, newStartsByClipId: Record<string, number>, protectedRanges?: ProtectedRange[]);
    execute(): void;
    undo(): void;
}
export declare class BatchShiftClipsCommand implements Command {
    private readonly accessor;
    private readonly offsetsByClipId;
    private readonly protectedRanges;
    readonly description = "Shift clips";
    private delegate?;
    constructor(accessor: TimelineAccessor, offsetsByClipId: Record<string, number>, protectedRanges?: ProtectedRange[]);
    execute(): void;
    undo(): void;
}
export declare class BatchReorderClipsCommand implements Command {
    private readonly accessor;
    private readonly startsByClipId;
    private readonly protectedRanges;
    readonly description = "Batch reorder clips";
    private delegate?;
    constructor(accessor: TimelineAccessor, startsByClipId: Record<string, number>, protectedRanges?: ProtectedRange[]);
    execute(): void;
    undo(): void;
}
export declare class SnapToBeatsCommand implements Command {
    private readonly accessor;
    private readonly clipIds;
    private readonly beatTimes;
    private readonly maxDistance;
    readonly description = "Snap clips to beats";
    private before?;
    private after?;
    private updates?;
    constructor(accessor: TimelineAccessor, clipIds: string[], beatTimes: number[], maxDistance?: number);
    get appliedUpdates(): BeatSnapUpdate[];
    execute(): void;
    undo(): void;
}
export interface BatchAlignToBeatOptions {
    maxDistance?: number;
    syncSpeed?: boolean;
}
export declare class BatchAlignToBeatCommand implements Command {
    private readonly accessor;
    private readonly clipIds;
    private readonly beatTimes;
    private readonly options;
    readonly description = "Batch align clips to beats";
    private before?;
    private after?;
    private updates?;
    constructor(accessor: TimelineAccessor, clipIds: string[], beatTimes: number[], options?: BatchAlignToBeatOptions);
    get appliedUpdates(): BeatAlignmentUpdate[];
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=clip-move-commands.d.ts.map