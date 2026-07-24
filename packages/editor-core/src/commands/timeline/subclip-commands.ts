import type { TimelineAccessor, ProjectAccessor } from "./index";
import { Project, Subclip } from '../../model';
import { BeatSnapSuggestion, MediaCollection, MulticamClip } from '../../model-types';
import { TimelineLabelColor } from '../../timeline-color-labels';
import { Command } from '../command';
import { ProjectAccessor, touchProject } from './utils';

export class AddSubclipCommand implements Command {
  readonly description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly subclip: Subclip,
  ) {
    this.description = `Add subclip "${subclip.name}"`;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject({
      ...project,
      subclips: [...(project.subclips ?? []), this.subclip],
      updatedAt: new Date().toISOString(),
    });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export interface SubclipPatch {
  name?: string;
  inPoint?: number;
  outPoint?: number;
  color?: TimelineLabelColor | null;
  description?: string;
}

export class UpdateSubclipCommand implements Command {
  readonly description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly subclipId: string,
    private readonly patch: SubclipPatch,
  ) {
    this.description = `Update subclip`;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    const subclips = (project.subclips ?? []).map((s) => {
      if (s.id !== this.subclipId) return s;
      return {
        ...s,
        ...(this.patch.name !== undefined ? { name: this.patch.name } : {}),
        ...(this.patch.inPoint !== undefined ? { inPoint: Math.max(0, this.patch.inPoint) } : {}),
        ...(this.patch.outPoint !== undefined ? { outPoint: Math.max(s.inPoint, this.patch.outPoint) } : {}),
        ...(this.patch.color !== undefined ? { color: this.patch.color } : {}),
        ...(this.patch.description !== undefined ? { description: this.patch.description } : {}),
      };
    });
    this.accessor.setProject({ ...project, subclips, updatedAt: new Date().toISOString() });
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class DeleteSubclipCommand implements Command {
  readonly description: string;
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly subclipId: string,
  ) {
    this.description = `Delete subclip`;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    const project = this.accessor.getProject();
    this.accessor.setProject({
      ...project,
      subclips: (project.subclips ?? []).filter((s) => s.id !== this.subclipId),
      updatedAt: new Date().toISOString(),
    });
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

// ── Independent MulticamClip commands ──

/**
 * 创建独立多机位片段命令
 */
