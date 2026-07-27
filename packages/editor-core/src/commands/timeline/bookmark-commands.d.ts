import type { ProjectAccessor } from './index';
import { BeatMarker } from '../../beats';
import { ExportRange, ProtectedRange, TimelineBookmark } from '../../model';
import { Command } from '../command';
export interface AddProjectBookmarkInput {
    id?: string;
    time: number;
    note?: string;
}
export declare class AddProjectBookmarkCommand implements Command {
    private readonly accessor;
    private readonly input;
    readonly description = "Add timeline bookmark";
    private bookmark?;
    constructor(accessor: ProjectAccessor, input: AddProjectBookmarkInput);
    execute(): void;
    undo(): void;
}
export type TimelineBookmarkPatch = Partial<Pick<TimelineBookmark, 'time' | 'note'>>;
export declare class UpdateProjectBookmarkCommand implements Command {
    private readonly accessor;
    private readonly bookmarkId;
    private readonly patch;
    readonly description = "Update timeline bookmark";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, bookmarkId: string, patch: TimelineBookmarkPatch);
    execute(): void;
    undo(): void;
}
export declare class RemoveProjectBookmarkCommand implements Command {
    private readonly accessor;
    private readonly bookmarkId;
    readonly description = "Remove timeline bookmark";
    private removed?;
    private index;
    constructor(accessor: ProjectAccessor, bookmarkId: string);
    execute(): void;
    undo(): void;
}
export declare class UpdateProjectBookmarksCommand implements Command {
    private readonly accessor;
    private readonly bookmarks;
    readonly description = "Update timeline bookmarks";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, bookmarks: TimelineBookmark[]);
    execute(): void;
    undo(): void;
}
export declare class UpdateProjectBeatMarkersCommand implements Command {
    private readonly accessor;
    private readonly markers;
    readonly description = "Update beat markers";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, markers: BeatMarker[]);
    execute(): void;
    undo(): void;
}
export declare class UpdateProjectExportRangesCommand implements Command {
    private readonly accessor;
    private readonly ranges;
    readonly description = "Update export ranges";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, ranges: ExportRange[]);
    execute(): void;
    undo(): void;
}
export declare class UpdateProjectProtectedRangesCommand implements Command {
    private readonly accessor;
    private readonly ranges;
    readonly description = "Update protected ranges";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, ranges: ProtectedRange[]);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=bookmark-commands.d.ts.map