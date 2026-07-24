import type { TimelineAccessor, ProjectAccessor } from "./index";
import { MediaFolderInput, addMediaFolderToProject, deleteMediaFolder, moveMediaAssetsToFolder, renameMediaFolder, setMediaFolderCollapsed } from '../../media-folders';
import { MediaFolder, Project } from '../../model';
import { Command } from '../command';
import { ProjectAccessor } from './utils';

export class AddMediaFolderCommand implements Command {
  readonly description = 'Add media folder';
  private before?: Project;
  private after?: Project;
  private createdFolder?: MediaFolder;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly input: MediaFolderInput = {},
  ) {}

  get folder(): MediaFolder | undefined {
    return this.createdFolder;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const result = addMediaFolderToProject(this.before, this.input);
      this.after = result.project;
      this.createdFolder = result.folder;
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class RenameMediaFolderCommand implements Command {
  readonly description = 'Rename media folder';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly folderId: string,
    private readonly name: string,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.accessor.setProject(renameMediaFolder(this.accessor.getProject(), this.folderId, this.name));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class SetMediaFolderCollapsedCommand implements Command {
  readonly description = 'Set media folder collapsed';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly folderId: string,
    private readonly collapsed: boolean,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.accessor.setProject(setMediaFolderCollapsed(this.accessor.getProject(), this.folderId, this.collapsed));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class DeleteMediaFolderCommand implements Command {
  readonly description = 'Delete media folder';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly folderId: string,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.accessor.setProject(deleteMediaFolder(this.accessor.getProject(), this.folderId));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class MoveMediaToFolderCommand implements Command {
  readonly description = 'Move media to folder';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly assetIds: string[],
    private readonly folderId?: string | null,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.accessor.setProject(moveMediaAssetsToFolder(this.accessor.getProject(), this.assetIds, this.folderId));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}
