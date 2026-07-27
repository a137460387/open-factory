import type { TimelineAccessor } from './index';
import { ClipMask } from '../../model';
import { Command } from '../command';
export declare class AddMaskCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly input;
    readonly description = "Add mask";
    private before?;
    private after?;
    private mask?;
    constructor(accessor: TimelineAccessor, clipId: string, input?: Partial<ClipMask>);
    execute(): void;
    undo(): void;
}
export declare class RemoveMaskCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly maskId;
    readonly description = "Remove mask";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, maskId: string);
    execute(): void;
    undo(): void;
}
export type MaskPatch = Partial<Omit<ClipMask, 'id'>>;
export declare class UpdateMaskCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly maskId;
    private readonly patch;
    readonly description = "Update mask";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, maskId: string, patch: MaskPatch);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=mask-commands.d.ts.map