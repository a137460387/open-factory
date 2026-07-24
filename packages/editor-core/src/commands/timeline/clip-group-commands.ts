import type { TimelineAccessor, ProjectAccessor } from "./index";
import { ClipGroupBatchPatch, createClipGroup, normalizeClipGroups, removeClipIdsFromGroups } from '../../clip-groups';
import { Clip, ClipGroup, ClipGroupColor, Project, Timeline, replaceProjectActiveTimeline } from '../../model';
import { ApplyStyleTransferOptions, StyleSummary, applyStyleToClip } from '../../style-transfer';
import { Command } from '../command';
import { ProjectAccessor, TimelineAccessor, applyClipGroupBatchPatch, getProjectActiveClipIds, removeClipsFromTimeline, timelineHasOverlaps, touchProject } from './utils';

export interface CreateClipGroupOptions {
  id?: string;
  name?: string;
  color?: ClipGroupColor;
}

export class CreateClipGroupCommand implements Command {
  readonly description = 'Create clip group';
  private before?: Project;
  group?: ClipGroup;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipIds: string[],
    private readonly options: CreateClipGroupOptions = {},
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const uniqueClipIds = Array.from(new Set(this.clipIds)).filter((clipId) => activeClipIds.includes(clipId));
    this.group ??= createClipGroup({ ...this.options, clipIds: uniqueClipIds }, activeClipIds);
    const withoutGroupedClips = removeClipIdsFromGroups(project.clipGroups, this.group.clipIds);
    this.accessor.setProject(
      touchProject({
        ...project,
        clipGroups: normalizeClipGroups([...withoutGroupedClips, this.group], activeClipIds),
      }),
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UpdateClipGroupCommand implements Command {
  readonly description = 'Update clip group';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly groupId: string,
    private readonly patch: Partial<Pick<ClipGroup, 'name' | 'color'>>,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
    if (!groups.some((group) => group.id === this.groupId)) {
      throw new Error(`Clip group ${this.groupId} not found`);
    }
    this.accessor.setProject(
      touchProject({
        ...project,
        clipGroups: normalizeClipGroups(
          groups.map((group) => (group.id === this.groupId ? { ...group, ...this.patch } : group)),
          activeClipIds,
        ),
      }),
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class UngroupCommand implements Command {
  readonly description = 'Ungroup clips';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly groupId: string,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
    if (!groups.some((group) => group.id === this.groupId)) {
      throw new Error(`Clip group ${this.groupId} not found`);
    }
    this.accessor.setProject(
      touchProject({
        ...project,
        clipGroups: groups.filter((group) => group.id !== this.groupId),
      }),
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class DeleteGroupCommand implements Command {
  readonly description = 'Delete clip group';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly groupId: string,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
    const group = groups.find((item) => item.id === this.groupId);
    if (!group) {
      throw new Error(`Clip group ${this.groupId} not found`);
    }
    const ids = new Set(group.clipIds);
    const timeline = removeClipsFromTimeline(project.timeline, ids);
    this.accessor.setProject(
      touchProject({
        ...replaceProjectActiveTimeline(project, timeline),
        clipGroups: groups.filter((item) => item.id !== group.id),
      }),
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class BatchUpdateClipGroupClipsCommand implements Command {
  readonly description = 'Batch update clip group clips';
  private before?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly groupId: string,
    private readonly patch: ClipGroupBatchPatch,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= project;
    const activeClipIds = getProjectActiveClipIds(project);
    const groups = normalizeClipGroups(project.clipGroups, activeClipIds);
    const group = groups.find((item) => item.id === this.groupId);
    if (!group) {
      throw new Error(`Clip group ${this.groupId} not found`);
    }
    const ids = new Set(group.clipIds);
    const nextTimeline: Timeline = {
      ...project.timeline,
      tracks: project.timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => (ids.has(clip.id) ? applyClipGroupBatchPatch(clip, this.patch) : clip)),
      })),
    };
    if (timelineHasOverlaps(nextTimeline)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setProject(
      touchProject({
        ...replaceProjectActiveTimeline(project, nextTimeline),
        clipGroups: groups,
      }),
    );
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export interface ApplyStyleCommandOptions extends ApplyStyleTransferOptions {
  clipIds?: string[];
}

export class ApplyStyleCommand implements Command {
  readonly description = 'Apply style transfer';
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly summary: StyleSummary,
    private readonly options: ApplyStyleCommandOptions,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    const targetIds = this.options.clipIds?.length ? new Set(this.options.clipIds) : undefined;
    let applied = 0;
    const nextTimeline: Timeline = {
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (targetIds && !targetIds.has(clip.id)) {
            return clip;
          }
          applied += 1;
          return applyStyleToClip(clip, this.summary, this.options);
        }),
      })),
    };
    if (targetIds && applied === 0) {
      throw new Error('No clips match style transfer target');
    }
    this.accessor.setTimeline(nextTimeline);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}
