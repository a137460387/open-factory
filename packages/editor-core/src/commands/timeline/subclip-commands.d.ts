import type { ProjectAccessor } from './index';
import { Subclip } from '../../model';
import { BeatSnapSuggestion, MediaCollection } from '../../model-types';
import { TimelineLabelColor } from '../../timeline-color-labels';
import { Command } from '../command';
export declare class AddSubclipCommand implements Command {
    private readonly accessor;
    private readonly subclip;
    readonly description: string;
    private before?;
    constructor(accessor: ProjectAccessor, subclip: Subclip);
    execute(): void;
    undo(): void;
}
export interface SubclipPatch {
    name?: string;
    inPoint?: number;
    outPoint?: number;
    color?: TimelineLabelColor | null;
    description?: string;
}
export declare class UpdateSubclipCommand implements Command {
    private readonly accessor;
    private readonly subclipId;
    private readonly patch;
    readonly description: string;
    private before?;
    constructor(accessor: ProjectAccessor, subclipId: string, patch: SubclipPatch);
    execute(): void;
    undo(): void;
}
export declare class DeleteSubclipCommand implements Command {
    private readonly accessor;
    private readonly subclipId;
    readonly description: string;
    private before?;
    constructor(accessor: ProjectAccessor, subclipId: string);
    execute(): void;
    undo(): void;
}
export declare class UpdateProjectBeatSnapSuggestionsCommand implements Command {
    private readonly accessor;
    private readonly suggestions;
    readonly description = "Update beat snap suggestions";
    private before?;
    constructor(accessor: ProjectAccessor, suggestions: BeatSnapSuggestion[]);
    execute(): void;
    undo(): void;
}
export declare class UpdateProjectMediaCollectionsCommand implements Command {
    private readonly accessor;
    private readonly collections;
    readonly description = "Update media collections";
    private before?;
    constructor(accessor: ProjectAccessor, collections: MediaCollection[]);
    execute(): void;
    undo(): void;
}
/**
 * 创建独立多机位片段命令
 */
//# sourceMappingURL=subclip-commands.d.ts.map