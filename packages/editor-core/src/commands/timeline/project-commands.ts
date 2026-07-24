import type { TimelineAccessor, ProjectAccessor } from "./index";
import { FcpXmlImportOptions, FcpXmlImportResult, applyFcpXmlImport, buildFcpXmlImport } from '../../export/fcpxml-import';
import { Cmx3600EdlImportOptions, Cmx3600EdlImportResult, applyCmx3600EdlImport, buildCmx3600EdlImport } from '../../export/timeline-import';
import { Project, ProjectDocumentation, ProjectSettings, ProjectSpeaker, normalizeMasterVolume, normalizeProjectSettings, normalizeProjectSpeakers } from '../../model';
import { SequenceSettings } from '../../model-types';
import { ConformMediaReplacement, applyConformMedia } from '../../project/conform-media';
import { normalizeProjectDocumentation } from '../../project/documentation';
import { normalizeProjectReleaseVersion } from '../../project/release-workflow';
import { recalculateClipStartsForFrameRate } from '../../sequence-settings';
import { clampTrackHeight } from '../../track-height';
import { Command } from '../command';
import { ProjectAccessor } from './utils';

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

/** 更新序列独立设置（帧率/分辨率/时长） */

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

/** 批量设置所有轨道高度 */

export class BatchUpdateTrackHeightCommand implements Command {
  readonly description: string;
  private before?: Project;
  private readonly height: number;

  constructor(
    private readonly accessor: ProjectAccessor,
    height: number,
  ) {
    this.description = 'Batch update track height';
    this.height = clampTrackHeight(height);
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    const tracks = project.timeline.tracks.map((track) => ({
      ...track,
      displayHeight: this.height,
    }));
    this.accessor.setProject({
      ...project,
      timeline: { ...project.timeline, tracks },
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

export type ProjectAudioPatch = Partial<Pick<Project, 'masterVolume'>>;

export class UpdateProjectAudioCommand implements Command {
  readonly description = 'Update project audio';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly patch: ProjectAudioPatch,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    this.after = {
      ...this.before,
      ...this.patch,
      masterVolume:
        this.patch.masterVolume === undefined
          ? this.before.masterVolume
          : normalizeMasterVolume(this.patch.masterVolume),
      updatedAt: new Date().toISOString(),
    };
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    this.accessor.setProject(this.before);
  }
}
