import { addMediaFolderToProject, deleteMediaFolder, moveMediaAssetsToFolder, renameMediaFolder, setMediaFolderCollapsed } from '../../media-folders';
export class AddMediaFolderCommand {
    accessor;
    input;
    description = 'Add media folder';
    before;
    after;
    createdFolder;
    constructor(accessor, input = {}) {
        this.accessor = accessor;
        this.input = input;
    }
    get folder() {
        return this.createdFolder;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            const result = addMediaFolderToProject(this.before, this.input);
            this.after = result.project;
            this.createdFolder = result.folder;
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class RenameMediaFolderCommand {
    accessor;
    folderId;
    name;
    description = 'Rename media folder';
    before;
    constructor(accessor, folderId, name) {
        this.accessor = accessor;
        this.folderId = folderId;
        this.name = name;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        this.accessor.setProject(renameMediaFolder(this.accessor.getProject(), this.folderId, this.name));
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class SetMediaFolderCollapsedCommand {
    accessor;
    folderId;
    collapsed;
    description = 'Set media folder collapsed';
    before;
    constructor(accessor, folderId, collapsed) {
        this.accessor = accessor;
        this.folderId = folderId;
        this.collapsed = collapsed;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        this.accessor.setProject(setMediaFolderCollapsed(this.accessor.getProject(), this.folderId, this.collapsed));
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class DeleteMediaFolderCommand {
    accessor;
    folderId;
    description = 'Delete media folder';
    before;
    constructor(accessor, folderId) {
        this.accessor = accessor;
        this.folderId = folderId;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        this.accessor.setProject(deleteMediaFolder(this.accessor.getProject(), this.folderId));
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class MoveMediaToFolderCommand {
    accessor;
    assetIds;
    folderId;
    description = 'Move media to folder';
    before;
    constructor(accessor, assetIds, folderId) {
        this.accessor = accessor;
        this.assetIds = assetIds;
        this.folderId = folderId;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        this.accessor.setProject(moveMediaAssetsToFolder(this.accessor.getProject(), this.assetIds, this.folderId));
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
//# sourceMappingURL=media-folder-commands.js.map