import type { TimelineAccessor, ProjectAccessor } from "./index";
import { Clip, ClipStabilization, DEFAULT_NESTED_SEQUENCE_NAME, Project, Timeline, normalizeStabilization, normalizeTransform, replaceProjectActiveTimeline } from '../../model';
import { ProjectPlatformFitSuggestion } from '../../model-types';
import { removeClip, replaceClip, splitClip } from '../../timeline';
import { Command } from '../command';
import { ProjectAccessor, TimelineAccessor, assertClipsNotOnLockedTrack, buildSplitRanges, findClip, findTrack, insertClip, replaceClipWithSlices } from './utils';
import { packNestedSequence } from './utils-nested';

export class PackNestedSequenceCommand implements Command {
  readonly description = 'Pack nested sequence';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipIds: string[],
    private readonly sequenceName = DEFAULT_NESTED_SEQUENCE_NAME,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.after ??= packNestedSequence(this.before, this.clipIds, this.sequenceName);
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class SplitClipCommand implements Command {
  readonly description = 'Split clip';
  private original?: Clip;
  private left?: Clip;
  private right?: Clip;
  private originalIndex = -1;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly splitTime: number,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    assertClipsNotOnLockedTrack(timeline, [this.clipId]);
    this.original ??= findClip(timeline, this.clipId);
    const track = findTrack(timeline, this.original.trackId);
    this.originalIndex = track.clips.findIndex((clip) => clip.id === this.clipId);
    [this.left, this.right] = splitClip(this.original, this.splitTime);
    const withoutOriginal = removeClip(timeline, this.original.id).timeline;
    this.accessor.setTimeline(
      insertClip(insertClip(withoutOriginal, this.left, this.originalIndex), this.right, this.originalIndex + 1),
    );
  }

  undo(): void {
    if (!this.original || !this.left || !this.right) {
      return;
    }
    let timeline = removeClip(this.accessor.getTimeline(), this.left.id).timeline;
    timeline = removeClip(timeline, this.right.id).timeline;
    this.accessor.setTimeline(insertClip(timeline, this.original, this.originalIndex));
  }
}

export class SplitClipAtTimesCommand implements Command {
  readonly description = 'Split clip at times';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly splitTimes: number[],
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    if (!this.after) {
      const clip = findClip(timeline, this.clipId);
      const ranges = buildSplitRanges(clip.duration, this.splitTimes);
      if (ranges.length <= 1) {
        throw new Error('No valid split points inside clip bounds');
      }
      this.after = replaceClipWithSlices(timeline, this.clipId, ranges, false);
    }
    this.accessor.setTimeline(this.after);
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    this.accessor.setTimeline(this.before);
  }
}

export class ApplyShakeStabilizationCommand implements Command {
  readonly description = 'Apply shake stabilization';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly stabilizationUpdate: Partial<ClipStabilization>,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const timeline = this.before.timeline;
      const clip = findClip(timeline, this.clipId);
      const prev = clip.stabilization ?? normalizeStabilization({});
      const updated: ClipStabilization = normalizeStabilization({
        ...prev,
        ...this.stabilizationUpdate,
        enabled: true,
        analyzed: true,
      });
      const updatedClip = { ...clip, stabilization: updated };
      this.after = replaceProjectActiveTimeline(this.before, replaceClip(timeline, updatedClip));
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) this.accessor.setProject(this.before);
  }
}

export class ApplyPipPlacementCommand implements Command {
  readonly description = 'Apply PiP placement suggestion';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly suggestedCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const timeline = this.before.timeline;
      const clip = findClip(timeline, this.clipId);
      const currentTransform = clip.transform ?? normalizeTransform({});
      const updatedTransform = { ...currentTransform };
      switch (this.suggestedCorner) {
        case 'top-left':
          updatedTransform.x = -0.5;
          updatedTransform.y = 0.5;
          break;
        case 'top-right':
          updatedTransform.x = 0.5;
          updatedTransform.y = 0.5;
          break;
        case 'bottom-left':
          updatedTransform.x = -0.5;
          updatedTransform.y = -0.5;
          break;
        case 'bottom-right':
        default:
          updatedTransform.x = 0.5;
          updatedTransform.y = -0.5;
          break;
      }
      const updatedClip = { ...clip, transform: updatedTransform };
      this.after = replaceProjectActiveTimeline(this.before, replaceClip(timeline, updatedClip));
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) this.accessor.setProject(this.before);
  }
}

export class ApplyPlatformFitCommand implements Command {
  readonly description = 'Apply platform fit suggestion';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly suggestion: ProjectPlatformFitSuggestion,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const removedIds = new Set(this.suggestion.removedSegments.map((s) => s.clipId));
      let project: Project = { ...this.before, platformFitSuggestion: this.suggestion };
      const timeline = project.timeline;
      const updatedTracks = timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (removedIds.has(clip.id)) {
            return { ...clip, platformFitRemoved: true };
          }
          const { platformFitRemoved, ...rest } = clip as typeof clip & { platformFitRemoved?: boolean };
          return rest;
        }),
      }));
      project = replaceProjectActiveTimeline(project, { ...timeline, tracks: updatedTracks });
      this.after = project;
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) this.accessor.setProject(this.before);
  }
}

export class RestorePlatformFitClipCommand implements Command {
  readonly description = 'Restore a platform-fit removed clip';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      let project = this.before;
      if (project.platformFitSuggestion) {
        const kept = project.platformFitSuggestion.removedSegments.find((s) => s.clipId === this.clipId);
        if (kept) {
          const newSuggestion = {
            ...project.platformFitSuggestion,
            removedSegments: project.platformFitSuggestion.removedSegments.filter((s) => s.clipId !== this.clipId),
            keptSegments: [...project.platformFitSuggestion.keptSegments, kept].sort((a, b) => a.start - b.start),
          };
          project = { ...project, platformFitSuggestion: newSuggestion };
        }
      }
      const timeline = project.timeline;
      const updatedTracks = timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id === this.clipId) {
            const { platformFitRemoved, ...rest } = clip as typeof clip & { platformFitRemoved?: boolean };
            return rest;
          }
          return clip;
        }),
      }));
      this.after = replaceProjectActiveTimeline(project, { ...timeline, tracks: updatedTracks });
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) this.accessor.setProject(this.before);
  }
}
