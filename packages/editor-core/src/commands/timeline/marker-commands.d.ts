import type { TimelineAccessor } from './index';
import { TimelineMarker } from '../../model';
import { Command } from '../command';
export interface AddTimelineMarkerInput {
    id?: string;
    time: number;
    label?: string;
    color?: string;
}
export declare class AddTimelineMarkerCommand implements Command {
    private readonly accessor;
    private readonly input;
    readonly description = "Add timeline marker";
    private marker?;
    constructor(accessor: TimelineAccessor, input: AddTimelineMarkerInput);
    execute(): void;
    undo(): void;
}
export type TimelineMarkerPatch = Partial<Pick<TimelineMarker, 'time' | 'label' | 'color'>>;
export declare class UpdateTimelineMarkerCommand implements Command {
    private readonly accessor;
    private readonly markerId;
    private readonly patch;
    readonly description = "Update timeline marker";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, markerId: string, patch: TimelineMarkerPatch);
    execute(): void;
    undo(): void;
}
export declare class RemoveTimelineMarkerCommand implements Command {
    private readonly accessor;
    private readonly markerId;
    readonly description = "Remove timeline marker";
    private removed?;
    private index;
    constructor(accessor: TimelineAccessor, markerId: string);
    execute(): void;
    undo(): void;
}
export declare class BatchAddMarkersCommand implements Command {
    private readonly accessor;
    private readonly inputs;
    readonly description = "Add timeline markers";
    private before?;
    private markers?;
    constructor(accessor: TimelineAccessor, inputs: AddTimelineMarkerInput[]);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=marker-commands.d.ts.map