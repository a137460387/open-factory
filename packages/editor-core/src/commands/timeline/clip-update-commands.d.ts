import type { TimelineAccessor } from './index';
import { Command } from '../command';
import { ClipPatch } from './clip-edit-commands';
export declare class UpdateClipCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly patch;
    readonly description = "Update clip";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, patch: ClipPatch);
    execute(): void;
    undo(): void;
}
export interface BatchUpdateClipCommandItem {
    clipId: string;
    patch: ClipPatch;
}
export declare class BatchUpdateClipCommand implements Command {
    private readonly accessor;
    private readonly updates;
    readonly description = "Batch update clips";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, updates: BatchUpdateClipCommandItem[]);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=clip-update-commands.d.ts.map