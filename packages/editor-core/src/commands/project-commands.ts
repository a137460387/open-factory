import { normalizeMasterVolume, normalizeProjectSettings, normalizeProjectSpeakers, type Project, type ProjectSpeaker, type ProjectDocumentation, type ProjectSettings, type Subclip, replaceProjectActiveTimeline } from '../model';
import type { SequenceSettings, BeatSnapSuggestion, MediaCollection } from '../model-types';
import { recalculateClipStartsForFrameRate } from '../sequence-settings';
import { clampTrackHeight } from '../track-height';
import { normalizeProjectDocumentation } from '../project/documentation';
import { applyConformMedia, type ConformMediaReplacement } from '../project/conform-media';
import { normalizeProjectReleaseVersion } from '../project/release-workflow';
import { addMediaFolderToProject, deleteMediaFolder, moveMediaAssetsToFolder, renameMediaFolder, setMediaFolderCollapsed, type MediaFolder, type MediaFolderInput } from '../media-folders';
import { applyCmx3600EdlImport, buildCmx3600EdlImport, type Cmx3600EdlImportOptions, type Cmx3600EdlImportResult } from '../export/timeline-import';
import { applyFcpXmlImport, buildFcpXmlImport, type FcpXmlImportOptions, type FcpXmlImportResult } from '../export/fcpxml-import';
import type { TimelineLabelColor } from '../timeline-color-labels';
import type { Command } from './command';
import { type ProjectAccessor, touchProject } from './helpers';

export class NewProjectCommand implements Command {
  description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly nextProject: Project,
    description = 'New project',
  ) {
    this.description = description;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.accessor.setProject(this.nextProject);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectSpeakerLabelsCommand implements Command {
  readonly description = 'Update project speaker labels';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly speakerLabels: Record<number, string>,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    this.after = {
      ...project,
      speakerLabels: { ...this.speakerLabels },
      updatedAt: new Date().toISOString(),
    };
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateSequenceSettingsCommand implements Command {
  readonly description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly sequenceId: string,
    private readonly newSettings: SequenceSettings | undefined,
  ) {
    this.description = 'Update sequence settings';
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    const oldSequence = project.sequences.find((s) => s.id === this.sequenceId);
    if (!oldSequence) return;

    const oldSettings = oldSequence.settings;
    const oldFps = oldSettings?.frameRate ?? project.settings.fps;
    const newFps = this.newSettings?.frameRate ?? project.settings.fps;

    const sequences = project.sequences.map((seq) => {
      if (seq.id !== this.sequenceId) return seq;
      return { ...seq, settings: this.newSettings };
    });

    // 帧率变更时重新对齐 clip 位置
    if (oldFps !== newFps) {
      for (const seq of sequences) {
        if (seq.id !== this.sequenceId) continue;
        recalculateClipStartsForFrameRate(seq.timeline, oldFps, newFps);
      }
    }

    // 如果当前活跃序列就是被修改的序列，同步 timeline
    let timeline = project.timeline;
    if (project.activeSequenceId === this.sequenceId) {
      const activeSeq = sequences.find((s) => s.id === this.sequenceId);
      if (activeSeq) timeline = activeSeq.timeline;
    }

    this.accessor.setProject({
      ...project,
      timeline,
      sequences,
      updatedAt: new Date().toISOString(),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class LoadProjectCommand implements Command {
  description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly nextProject: Project,
    description = 'Load project',
  ) {
    this.description = description;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.accessor.setProject(this.nextProject);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectSettingsCommand implements Command {
  readonly description = 'Update project settings';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly patch: Partial<ProjectSettings>,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject({
      ...project,
      settings: normalizeProjectSettings({ ...project.settings, ...this.patch }),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class ConformMediaCommand implements Command {
  description: string;
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly replacements: ConformMediaReplacement[],
    description = 'Conform media',
  ) {
    this.description = description;
  }

  execute(): void {
    if (this.after) {
      this.accessor.setProject(this.after);
      return;
    }
    this.before ??= this.accessor.getProject();
    this.after = {
      ...applyConformMedia(this.accessor.getProject(), this.replacements),
      updatedAt: new Date().toISOString(),
    };
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectReleaseVersionCommand implements Command {
  readonly description = 'Update project release version';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly releaseVersion: string,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject({
      ...project,
      releaseVersion: normalizeProjectReleaseVersion(this.releaseVersion),
      updatedAt: new Date().toISOString(),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectCoverCommand implements Command {
  readonly description = 'Update project cover';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly coverPath?: string,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const normalized =
      typeof this.coverPath === 'string' && this.coverPath.trim()
        ? this.coverPath.trim().replace(/\\/g, '/')
        : undefined;
    this.after = {
      ...this.before,
      coverPath: normalized,
      updatedAt: new Date().toISOString(),
    };
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectSpeakersCommand implements Command {
  readonly description = 'Update project speakers';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly speakers: ProjectSpeaker[],
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    this.after = {
      ...project,
      speakers: normalizeProjectSpeakers(this.speakers),
      updatedAt: new Date().toISOString(),
    };
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectDocumentationCommand implements Command {
  readonly description = 'Update project documentation';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly documentation: ProjectDocumentation,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    this.after = {
      ...project,
      documentation: normalizeProjectDocumentation(this.documentation),
      updatedAt: new Date().toISOString(),
    };
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class ImportEDLCommand implements Command {
  readonly description = 'Import EDL';
  private before?: Project;
  private after?: Project;
  private importResult?: Cmx3600EdlImportResult;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly contents: string,
    private readonly options: Cmx3600EdlImportOptions = {},
  ) {}

  get result(): Cmx3600EdlImportResult | undefined {
    return this.importResult;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      this.importResult = buildCmx3600EdlImport(this.before, this.contents, this.options);
      this.after = applyCmx3600EdlImport(this.before, this.importResult);
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class ImportFCPXMLCommand implements Command {
  readonly description = 'Import FCPXML';
  private before?: Project;
  private after?: Project;
  private importResult?: FcpXmlImportResult;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly contents: string,
    private readonly options: FcpXmlImportOptions = {},
  ) {}

  get result(): FcpXmlImportResult | undefined {
    return this.importResult;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      this.importResult = buildFcpXmlImport(this.before, this.contents, this.options);
      this.after = applyFcpXmlImport(this.before, this.importResult);
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

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

export class UpdateProjectBeatSnapSuggestionsCommand implements Command {
  readonly description = 'Update beat snap suggestions';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly suggestions: BeatSnapSuggestion[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject(touchProject({ ...project, beatSnapSuggestions: [...this.suggestions] }));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateProjectMediaCollectionsCommand implements Command {
  readonly description = 'Update media collections';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly collections: MediaCollection[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject(touchProject({ ...project, mediaCollections: [...this.collections] }));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}
