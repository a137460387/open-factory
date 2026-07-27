import type { TimelineAccessor, ProjectAccessor } from './index';
import { ClipGroupBatchPatch } from '../../clip-groups';
import { ClipGroup, ClipGroupColor } from '../../model';
import { ApplyStyleTransferOptions, StyleSummary } from '../../style-transfer';
import { Command } from '../command';
export interface CreateClipGroupOptions {
    id?: string;
    name?: string;
    color?: ClipGroupColor;
}
export declare class CreateClipGroupCommand implements Command {
    private readonly accessor;
    private readonly clipIds;
    private readonly options;
    readonly description = "Create clip group";
    private before?;
    group?: ClipGroup;
    constructor(accessor: ProjectAccessor, clipIds: string[], options?: CreateClipGroupOptions);
    execute(): void;
    undo(): void;
}
export declare class UpdateClipGroupCommand implements Command {
    private readonly accessor;
    private readonly groupId;
    private readonly patch;
    readonly description = "Update clip group";
    private before?;
    constructor(accessor: ProjectAccessor, groupId: string, patch: Partial<Pick<ClipGroup, 'name' | 'color'>>);
    execute(): void;
    undo(): void;
}
export declare class UngroupCommand implements Command {
    private readonly accessor;
    private readonly groupId;
    readonly description = "Ungroup clips";
    private before?;
    constructor(accessor: ProjectAccessor, groupId: string);
    execute(): void;
    undo(): void;
}
export declare class DeleteGroupCommand implements Command {
    private readonly accessor;
    private readonly groupId;
    readonly description = "Delete clip group";
    private before?;
    constructor(accessor: ProjectAccessor, groupId: string);
    execute(): void;
    undo(): void;
}
export declare class BatchUpdateClipGroupClipsCommand implements Command {
    private readonly accessor;
    private readonly groupId;
    private readonly patch;
    readonly description = "Batch update clip group clips";
    private before?;
    constructor(accessor: ProjectAccessor, groupId: string, patch: ClipGroupBatchPatch);
    execute(): void;
    undo(): void;
}
export interface ApplyStyleCommandOptions extends ApplyStyleTransferOptions {
    clipIds?: string[];
}
export declare class ApplyStyleCommand implements Command {
    private readonly accessor;
    private readonly summary;
    private readonly options;
    readonly description = "Apply style transfer";
    private before?;
    constructor(accessor: TimelineAccessor, summary: StyleSummary, options: ApplyStyleCommandOptions);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=clip-group-commands.d.ts.map