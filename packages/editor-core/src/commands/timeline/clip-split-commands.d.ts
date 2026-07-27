import type { TimelineAccessor, ProjectAccessor } from "./index";
import { ClipStabilization } from '../../model';
import { ProjectPlatformFitSuggestion } from '../../model-types';
import { Command } from '../command';
export declare class PackNestedSequenceCommand implements Command {
    private readonly accessor;
    private readonly clipIds;
    private readonly sequenceName;
    readonly description = "Pack nested sequence";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipIds: string[], sequenceName?: string);
    execute(): void;
    undo(): void;
}
export declare class SplitClipCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly splitTime;
    readonly description = "Split clip";
    private original?;
    private left?;
    private right?;
    private originalIndex;
    constructor(accessor: TimelineAccessor, clipId: string, splitTime: number);
    execute(): void;
    undo(): void;
}
export declare class SplitClipAtTimesCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly splitTimes;
    readonly description = "Split clip at times";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, splitTimes: number[]);
    execute(): void;
    undo(): void;
}
export declare class ApplyShakeStabilizationCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly stabilizationUpdate;
    readonly description = "Apply shake stabilization";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, stabilizationUpdate: Partial<ClipStabilization>);
    execute(): void;
    undo(): void;
}
export declare class ApplyPipPlacementCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly suggestedCorner;
    readonly description = "Apply PiP placement suggestion";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, suggestedCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right');
    execute(): void;
    undo(): void;
}
export declare class ApplyPlatformFitCommand implements Command {
    private readonly accessor;
    private readonly suggestion;
    readonly description = "Apply platform fit suggestion";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, suggestion: ProjectPlatformFitSuggestion);
    execute(): void;
    undo(): void;
}
export declare class RestorePlatformFitClipCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    readonly description = "Restore a platform-fit removed clip";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=clip-split-commands.d.ts.map