import type { TimelineAccessor } from './index';
import { ProtectedRange } from '../../model';
import { FillGapOperation } from '../../timeline-gap-fill';
import { Command } from '../command';
export declare class SlipClipCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly delta;
    readonly description = "Slip clip";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, delta: number);
    execute(): void;
    undo(): void;
}
export declare class SlideClipCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly delta;
    private readonly minDuration;
    readonly description = "Slide clip";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, delta: number, minDuration?: number);
    execute(): void;
    undo(): void;
}
export declare class TrimClipCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly newTrimStart;
    private readonly newTrimEnd;
    private readonly newStart?;
    private readonly minDuration;
    readonly description = "Trim clip";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, newTrimStart: number, newTrimEnd: number, newStart?: number | undefined, minDuration?: number);
    execute(): void;
    undo(): void;
}
export declare class DeleteClipsCommand implements Command {
    private readonly accessor;
    private readonly clipIds;
    readonly description = "Delete clips";
    private removed;
    private removedTransitions;
    constructor(accessor: TimelineAccessor, clipIds: string[]);
    execute(): void;
    undo(): void;
}
export declare class RippleDeleteCommand implements Command {
    private readonly accessor;
    private readonly clipIds;
    private readonly protectedRanges;
    readonly description = "Ripple delete clips";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipIds: string[], protectedRanges?: ProtectedRange[]);
    execute(): void;
    undo(): void;
}
export declare class CloseGapCommand implements Command {
    private readonly accessor;
    private readonly trackId;
    private readonly time;
    readonly description = "Close timeline gap";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, trackId: string, time: number);
    execute(): void;
    undo(): void;
}
export declare class FillGapCommand implements Command {
    private readonly accessor;
    private readonly trackId;
    private readonly time;
    private readonly operation;
    readonly description = "Fill timeline gap";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, trackId: string, time: number, operation: FillGapOperation);
    execute(): void;
    undo(): void;
}
export declare class RollingTrimCommand implements Command {
    private readonly accessor;
    private readonly leftClipId;
    private readonly rightClipId;
    private readonly delta;
    private readonly minDuration;
    readonly description = "Rolling trim";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, leftClipId: string, rightClipId: string, delta: number, minDuration?: number);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=clip-trim-commands.d.ts.map