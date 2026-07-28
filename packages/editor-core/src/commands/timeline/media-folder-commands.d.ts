import type { ProjectAccessor } from './index';
import { MediaFolderInput } from '../../media-folders';
import { MediaFolder } from '../../model';
import { Command } from '../command';
export declare class AddMediaFolderCommand implements Command {
    private readonly accessor;
    private readonly input;
    readonly description = "Add media folder";
    private before?;
    private after?;
    private createdFolder?;
    constructor(accessor: ProjectAccessor, input?: MediaFolderInput);
    get folder(): MediaFolder | undefined;
    execute(): void;
    undo(): void;
}
export declare class RenameMediaFolderCommand implements Command {
    private readonly accessor;
    private readonly folderId;
    private readonly name;
    readonly description = "Rename media folder";
    private before?;
    constructor(accessor: ProjectAccessor, folderId: string, name: string);
    execute(): void;
    undo(): void;
}
export declare class SetMediaFolderCollapsedCommand implements Command {
    private readonly accessor;
    private readonly folderId;
    private readonly collapsed;
    readonly description = "Set media folder collapsed";
    private before?;
    constructor(accessor: ProjectAccessor, folderId: string, collapsed: boolean);
    execute(): void;
    undo(): void;
}
export declare class DeleteMediaFolderCommand implements Command {
    private readonly accessor;
    private readonly folderId;
    readonly description = "Delete media folder";
    private before?;
    constructor(accessor: ProjectAccessor, folderId: string);
    execute(): void;
    undo(): void;
}
export declare class MoveMediaToFolderCommand implements Command {
    private readonly accessor;
    private readonly assetIds;
    private readonly folderId?;
    readonly description = "Move media to folder";
    private before?;
    constructor(accessor: ProjectAccessor, assetIds: string[], folderId?: string | null | undefined);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=media-folder-commands.d.ts.map