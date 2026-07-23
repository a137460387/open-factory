import {
  createCollaborationNote,
  createTimelineNote,
  createTimelineBookmark,
  createTimelineMarker,
  createProjectAnnotation,
  createReviewAnnotation,
  normalizeCollaborationNote,
  normalizeProjectAnnotation,
  normalizeReviewAnnotation,
  normalizeTimelineNote,
  normalizeTimelineBookmark,
  normalizeTimelineBookmarks,
  normalizeTimelineMarker,
  normalizeExportRanges,
  normalizeProtectedRanges,
  type CollaborationNote,
  type ProjectAnnotation,
  type ReviewAnnotation,
  type TimelineNote,
  type TimelineBookmark,
  type TimelineMarker,
  type ExportRange,
  type ProtectedRange,
  type Timeline,
} from '../model';
import { getTimelineDuration } from '../timeline';
import { normalizeBeatMarkers, type BeatMarker } from '../beats';
import type { Command } from './command';
import {
  type TimelineAccessor,
  type ProjectAccessor,
  touchProject,
  sortMarkers,
  sortAnnotations,
  sortReviewAnnotations,
  sortCollaborationNotes,
  sortTimelineNotes,
  sortBookmarks,
} from './helpers';

export interface AddTimelineMarkerInput {
  id?: string;
  time: number;
  label?: string;
  color?: string;
}

export class AddTimelineMarkerCommand implements Command {
  readonly description = 'Add timeline marker';
  private marker?: TimelineMarker;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly input: AddTimelineMarkerInput,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.marker ??= createTimelineMarker(this.input, getTimelineDuration(timeline));
    this.marker = normalizeTimelineMarker(this.marker, getTimelineDuration(timeline));
    this.accessor.setTimeline({
      ...timeline,
      markers: sortMarkers([...(timeline.markers ?? []), this.marker]),
    });
  }

  undo(): void {
    if (!this.marker) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({
      ...timeline,
      markers: (timeline.markers ?? []).filter((marker) => marker.id !== this.marker?.id),
    });
  }
}

export type TimelineMarkerPatch = Partial<Pick<TimelineMarker, 'time' | 'label' | 'color'>>;

export class UpdateTimelineMarkerCommand implements Command {
  readonly description = 'Update timeline marker';
  private before?: TimelineMarker;
  private after?: TimelineMarker;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly markerId: string,
    private readonly patch: TimelineMarkerPatch,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= (timeline.markers ?? []).find((marker) => marker.id === this.markerId);
    if (!this.before) {
      throw new Error(`Timeline marker ${this.markerId} not found`);
    }
    this.after = createTimelineMarker({ ...this.before, ...this.patch }, getTimelineDuration(timeline));
    this.accessor.setTimeline({
      ...timeline,
      markers: sortMarkers(
        (timeline.markers ?? []).map((marker) => (marker.id === this.markerId ? this.after! : marker)),
      ),
    });
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({
      ...timeline,
      markers: sortMarkers(
        (timeline.markers ?? []).map((marker) => (marker.id === this.markerId ? this.before! : marker)),
      ),
    });
  }
}

export class RemoveTimelineMarkerCommand implements Command {
  readonly description = 'Remove timeline marker';
  private removed?: TimelineMarker;
  private index = -1;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly markerId: string,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.index = (timeline.markers ?? []).findIndex((marker) => marker.id === this.markerId);
    if (this.index === -1) {
      throw new Error(`Timeline marker ${this.markerId} not found`);
    }
    this.removed ??= (timeline.markers ?? [])[this.index];
    this.accessor.setTimeline({
      ...timeline,
      markers: (timeline.markers ?? []).filter((marker) => marker.id !== this.markerId),
    });
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    const markers = [...(timeline.markers ?? [])];
    markers.splice(Math.max(0, this.index), 0, this.removed);
    this.accessor.setTimeline({ ...timeline, markers: sortMarkers(markers) });
  }

export class AddProjectAnnotationCommand implements Command {
  readonly description = 'Add project annotation';
  private annotation?: ProjectAnnotation;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly input: Omit<ProjectAnnotation, 'id'> & Partial<Pick<ProjectAnnotation, 'id'>>,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.annotation ??= createProjectAnnotation(this.input, getTimelineDuration(project.timeline));
    this.annotation = normalizeProjectAnnotation(this.annotation, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        annotations: sortAnnotations([...(project.annotations ?? []), this.annotation]),
      }),
    );
  }

  undo(): void {
    if (!this.annotation) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        annotations: (project.annotations ?? []).filter((annotation) => annotation.id !== this.annotation?.id),
      }),
    );
  }
}

export class AddReviewAnnotationCommand implements Command {
  readonly description = 'Add review annotation';
  private annotation?: ReviewAnnotation;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly input: Omit<ReviewAnnotation, 'id'> & Partial<Pick<ReviewAnnotation, 'id'>>,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.annotation ??= createReviewAnnotation(this.input, getTimelineDuration(project.timeline));
    this.annotation = normalizeReviewAnnotation(this.annotation, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        reviewAnnotations: sortReviewAnnotations([...(project.reviewAnnotations ?? []), this.annotation]),
      }),
    );
  }

  undo(): void {
    if (!this.annotation) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        reviewAnnotations: (project.reviewAnnotations ?? []).filter(
          (annotation) => annotation.id !== this.annotation?.id,
        ),
      }),
    );
  }
}

export class AddCollaborationNoteCommand implements Command {
  readonly description = 'Add collaboration note';
  private note?: CollaborationNote;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly input: Omit<CollaborationNote, 'id' | 'createdAt'> &
      Partial<Pick<CollaborationNote, 'id' | 'createdAt'>>,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.note ??= createCollaborationNote(this.input, getTimelineDuration(project.timeline));
    this.note = normalizeCollaborationNote(this.note, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        collaborationNotes: sortCollaborationNotes([...(project.collaborationNotes ?? []), this.note]),
      }),
    );
  }

  undo(): void {
    if (!this.note) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        collaborationNotes: (project.collaborationNotes ?? []).filter((note) => note.id !== this.note?.id),
      }),
    );
  }
}

export class AddTimelineNoteCommand implements Command {
  readonly description = 'Add timeline note';
  private note?: TimelineNote;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly input: Omit<TimelineNote, 'id' | 'createdAt'> & Partial<Pick<TimelineNote, 'id' | 'createdAt'>>,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.note ??= createTimelineNote(this.input, getTimelineDuration(project.timeline));
    const normalized = normalizeTimelineNote(this.note, getTimelineDuration(project.timeline));
    if (!normalized) {
      throw new Error('Timeline note duration must be greater than zero');
    }
    this.note = normalized;
    this.accessor.setProject(
      touchProject({
        ...project,
        timelineNotes: sortTimelineNotes([...(project.timelineNotes ?? []), this.note]),
      }),
    );
  }

  undo(): void {
    if (!this.note) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        timelineNotes: (project.timelineNotes ?? []).filter((note) => note.id !== this.note?.id),
      }),
    );
  }
}

export interface AddProjectBookmarkInput {
  id?: string;
  time: number;
  note?: string;
}

export class AddProjectBookmarkCommand implements Command {
  readonly description = 'Add timeline bookmark';
  private bookmark?: TimelineBookmark;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly input: AddProjectBookmarkInput,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.bookmark ??= createTimelineBookmark(this.input, getTimelineDuration(project.timeline));
    this.bookmark = normalizeTimelineBookmark(this.bookmark, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: sortBookmarks([...(project.bookmarks ?? []), this.bookmark]),
      }),
    );
  }

  undo(): void {
    if (!this.bookmark) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: (project.bookmarks ?? []).filter((bookmark) => bookmark.id !== this.bookmark?.id),
      }),
    );
  }
}

export type TimelineBookmarkPatch = Partial<Pick<TimelineBookmark, 'time' | 'note'>>;

export class UpdateProjectBookmarkCommand implements Command {
  readonly description = 'Update timeline bookmark';
  private before?: TimelineBookmark;
  private after?: TimelineBookmark;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly bookmarkId: string,
    private readonly patch: TimelineBookmarkPatch,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= (project.bookmarks ?? []).find((bookmark) => bookmark.id === this.bookmarkId);
    if (!this.before) {
      throw new Error(`Timeline bookmark ${this.bookmarkId} not found`);
    }
    this.after = createTimelineBookmark({ ...this.before, ...this.patch }, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: sortBookmarks(
          (project.bookmarks ?? []).map((bookmark) => (bookmark.id === this.bookmarkId ? this.after! : bookmark)),
        ),
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: sortBookmarks(
          (project.bookmarks ?? []).map((bookmark) => (bookmark.id === this.bookmarkId ? this.before! : bookmark)),
        ),
      }),
    );
  }
}

export class RemoveProjectBookmarkCommand implements Command {
  readonly description = 'Remove timeline bookmark';
  private removed?: TimelineBookmark;
  private index = -1;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly bookmarkId: string,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.index = (project.bookmarks ?? []).findIndex((bookmark) => bookmark.id === this.bookmarkId);
    if (this.index === -1) {
      throw new Error(`Timeline bookmark ${this.bookmarkId} not found`);
    }
    this.removed ??= (project.bookmarks ?? [])[this.index];
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: (project.bookmarks ?? []).filter((bookmark) => bookmark.id !== this.bookmarkId),
      }),
    );
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const project = this.accessor.getProject();
    const bookmarks = [...(project.bookmarks ?? [])];
    bookmarks.splice(Math.max(0, this.index), 0, this.removed);
    this.accessor.setProject(touchProject({ ...project, bookmarks: sortBookmarks(bookmarks) }));
  }
}

export class UpdateProjectBookmarksCommand implements Command {
  readonly description = 'Update timeline bookmarks';
  private before?: TimelineBookmark[];
  private after?: TimelineBookmark[];

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly bookmarks: TimelineBookmark[],
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeTimelineBookmarks(project.bookmarks, duration);
    this.after ??= normalizeTimelineBookmarks(this.bookmarks, duration);
    this.accessor.setProject(touchProject({ ...project, bookmarks: this.after }));
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(touchProject({ ...project, bookmarks: this.before }));
  }
}

export class UpdateProjectBeatMarkersCommand implements Command {
  readonly description = 'Update beat markers';
  private before?: BeatMarker[];
  private after?: BeatMarker[];

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly markers: BeatMarker[],
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeBeatMarkers(project.beatMarkers, duration);
    this.after ??= normalizeBeatMarkers(this.markers, duration);
    this.accessor.setProject(
      touchProject({
        ...project,
        beatMarkers: this.after,
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        beatMarkers: this.before,
      }),
    );
  }
}

export class UpdateProjectExportRangesCommand implements Command {
  readonly description = 'Update export ranges';
  private before?: ExportRange[];
  private after?: ExportRange[];

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly ranges: ExportRange[],
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeExportRanges(project.exportRanges, duration);
    this.after ??= normalizeExportRanges(this.ranges, duration);
    this.accessor.setProject(
      touchProject({
        ...project,
        exportRanges: this.after,
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        exportRanges: this.before,
      }),
    );
  }
}

export class UpdateProjectProtectedRangesCommand implements Command {
  readonly description = 'Update protected ranges';
  private before?: ProtectedRange[];
  private after?: ProtectedRange[];

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly ranges: ProtectedRange[],
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeProtectedRanges(project.protectedRanges, duration);
    this.after ??= normalizeProtectedRanges(this.ranges, duration);
    this.accessor.setProject(
      touchProject({
        ...project,
        protectedRanges: this.after,
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        protectedRanges: this.before,
      }),
    );
  }
}

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

export class UpdateProjectAnnotationCommand implements Command {
  readonly description = 'Update project annotation';
  private before?: ProjectAnnotation;
  private after?: ProjectAnnotation;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly annotationId: string,
    private readonly patch: Partial<Omit<ProjectAnnotation, 'id'>>,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const annotation = (project.annotations ?? []).find((item) => item.id === this.annotationId);
    if (!annotation) {
      throw new Error(`Project annotation ${this.annotationId} not found`);
    }
    this.before ??= annotation;
    this.after = normalizeProjectAnnotation({ ...annotation, ...this.patch }, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        annotations: sortAnnotations(
          (project.annotations ?? []).map((item) => (item.id === this.annotationId ? this.after! : item)),
        ),
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        annotations: sortAnnotations(
          (project.annotations ?? []).map((item) => (item.id === this.annotationId ? this.before! : item)),
        ),
      }),
    );
  }
}

export class RemoveProjectAnnotationCommand implements Command {
  readonly description = 'Remove project annotation';
  private removed?: ProjectAnnotation;
  private index = -1;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly annotationId: string,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.index = (project.annotations ?? []).findIndex((annotation) => annotation.id === this.annotationId);
    if (this.index === -1) {
      throw new Error(`Project annotation ${this.annotationId} not found`);
    }
    this.removed ??= (project.annotations ?? [])[this.index];
    this.accessor.setProject(
      touchProject({
        ...project,
        annotations: (project.annotations ?? []).filter((annotation) => annotation.id !== this.annotationId),
      }),
    );
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const project = this.accessor.getProject();
    const annotations = [...(project.annotations ?? [])];
    annotations.splice(this.index < 0 ? annotations.length : this.index, 0, this.removed);
    this.accessor.setProject(touchProject({ ...project, annotations: sortAnnotations(annotations) }));
  }
}

export class UpdateReviewAnnotationCommand implements Command {
  readonly description = 'Update review annotation';
  private before?: ReviewAnnotation;
  private after?: ReviewAnnotation;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly annotationId: string,
    private readonly patch: Partial<Omit<ReviewAnnotation, 'id'>>,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const annotation = (project.reviewAnnotations ?? []).find((item) => item.id === this.annotationId);
    if (!annotation) {
      throw new Error(`Review annotation ${this.annotationId} not found`);
    }
    this.before ??= annotation;
    this.after = normalizeReviewAnnotation({ ...annotation, ...this.patch }, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        reviewAnnotations: sortReviewAnnotations(
          (project.reviewAnnotations ?? []).map((item) => (item.id === this.annotationId ? this.after! : item)),
        ),
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        reviewAnnotations: sortReviewAnnotations(
          (project.reviewAnnotations ?? []).map((item) => (item.id === this.annotationId ? this.before! : item)),
        ),
      }),
    );
  }
}

export class RemoveReviewAnnotationCommand implements Command {
  readonly description = 'Remove review annotation';
  private removed?: ReviewAnnotation;
  private index = -1;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly annotationId: string,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.index = (project.reviewAnnotations ?? []).findIndex((annotation) => annotation.id === this.annotationId);
    if (this.index === -1) {
      throw new Error(`Review annotation ${this.annotationId} not found`);
    }
    this.removed ??= (project.reviewAnnotations ?? [])[this.index];
    this.accessor.setProject(
      touchProject({
        ...project,
        reviewAnnotations: (project.reviewAnnotations ?? []).filter(
          (annotation) => annotation.id !== this.annotationId,
        ),
      }),
    );
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const project = this.accessor.getProject();
    const annotations = [...(project.reviewAnnotations ?? [])];
    annotations.splice(this.index < 0 ? annotations.length : this.index, 0, this.removed);
    this.accessor.setProject(touchProject({ ...project, reviewAnnotations: sortReviewAnnotations(annotations) }));
  }

export type CollaborationNotePatch = Partial<
  Omit<CollaborationNote, 'id' | 'createdAt'> & Pick<CollaborationNote, 'createdAt'>
>;

export class UpdateCollaborationNoteCommand implements Command {
  readonly description = 'Update collaboration note';
  private before?: CollaborationNote;
  private after?: CollaborationNote;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly noteId: string,
    private readonly patch: CollaborationNotePatch,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const note = (project.collaborationNotes ?? []).find((item) => item.id === this.noteId);
    if (!note) {
      throw new Error(`Collaboration note ${this.noteId} not found`);
    }
    this.before ??= note;
    this.after = normalizeCollaborationNote(
      { ...note, ...this.patch, updatedAt: this.patch.updatedAt ?? new Date().toISOString() },
      getTimelineDuration(project.timeline),
    );
    this.accessor.setProject(
      touchProject({
        ...project,
        collaborationNotes: sortCollaborationNotes(
          (project.collaborationNotes ?? []).map((item) => (item.id === this.noteId ? this.after! : item)),
        ),
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        collaborationNotes: sortCollaborationNotes(
          (project.collaborationNotes ?? []).map((item) => (item.id === this.noteId ? this.before! : item)),
        ),
      }),
    );
  }
}

export class RemoveCollaborationNoteCommand implements Command {
  readonly description = 'Remove collaboration note';
  private removed?: CollaborationNote;
  private index = -1;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly noteId: string,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.index = (project.collaborationNotes ?? []).findIndex((note) => note.id === this.noteId);
    if (this.index === -1) {
      throw new Error(`Collaboration note ${this.noteId} not found`);
    }
    this.removed ??= (project.collaborationNotes ?? [])[this.index];
    this.accessor.setProject(
      touchProject({
        ...project,
        collaborationNotes: (project.collaborationNotes ?? []).filter((note) => note.id !== this.noteId),
      }),
    );
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const project = this.accessor.getProject();
    const notes = [...(project.collaborationNotes ?? [])];
    notes.splice(this.index < 0 ? notes.length : this.index, 0, this.removed);
    this.accessor.setProject(touchProject({ ...project, collaborationNotes: sortCollaborationNotes(notes) }));
  }
}

export type TimelineNotePatch = Partial<Omit<TimelineNote, 'id' | 'createdAt'> & Pick<TimelineNote, 'createdAt'>>;

export class UpdateTimelineNoteCommand implements Command {
  readonly description = 'Update timeline note';
  private before?: TimelineNote;
  private after?: TimelineNote;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly noteId: string,
    private readonly patch: TimelineNotePatch,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const note = (project.timelineNotes ?? []).find((item) => item.id === this.noteId);
    if (!note) {
      throw new Error(`Timeline note ${this.noteId} not found`);
    }
    this.before ??= note;
    const normalized = normalizeTimelineNote({ ...note, ...this.patch }, getTimelineDuration(project.timeline));
    if (!normalized) {
      throw new Error('Timeline note duration must be greater than zero');
    }
    this.after = normalized;
    this.accessor.setProject(
      touchProject({
        ...project,
        timelineNotes: sortTimelineNotes(
          (project.timelineNotes ?? []).map((item) => (item.id === this.noteId ? this.after! : item)),
        ),
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        timelineNotes: sortTimelineNotes(
          (project.timelineNotes ?? []).map((item) => (item.id === this.noteId ? this.before! : item)),
        ),
      }),
    );
  }
}

export class RemoveTimelineNoteCommand implements Command {
  readonly description = 'Remove timeline note';
  private removed?: TimelineNote;
  private index = -1;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly noteId: string,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.index = (project.timelineNotes ?? []).findIndex((note) => note.id === this.noteId);
    if (this.index === -1) {
      throw new Error(`Timeline note ${this.noteId} not found`);
    }
    this.removed ??= (project.timelineNotes ?? [])[this.index];
    this.accessor.setProject(
      touchProject({
        ...project,
        timelineNotes: (project.timelineNotes ?? []).filter((note) => note.id !== this.noteId),
      }),
    );
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const project = this.accessor.getProject();
    const notes = [...(project.timelineNotes ?? [])];
    notes.splice(this.index < 0 ? notes.length : this.index, 0, this.removed);
    this.accessor.setProject(touchProject({ ...project, timelineNotes: sortTimelineNotes(notes) }));
  }

export interface AddProjectBookmarkInput {
  id?: string;
  time: number;
  note?: string;
}

export class AddProjectBookmarkCommand implements Command {
  readonly description = 'Add timeline bookmark';
  private bookmark?: TimelineBookmark;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly input: AddProjectBookmarkInput,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.bookmark ??= createTimelineBookmark(this.input, getTimelineDuration(project.timeline));
    this.bookmark = normalizeTimelineBookmark(this.bookmark, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: sortBookmarks([...(project.bookmarks ?? []), this.bookmark]),
      }),
    );
  }

  undo(): void {
    if (!this.bookmark) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: (project.bookmarks ?? []).filter((bookmark) => bookmark.id !== this.bookmark?.id),
      }),
    );
  }
}

export type TimelineBookmarkPatch = Partial<Pick<TimelineBookmark, 'time' | 'note'>>;

export class UpdateProjectBookmarkCommand implements Command {
  readonly description = 'Update timeline bookmark';
  private before?: TimelineBookmark;
  private after?: TimelineBookmark;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly bookmarkId: string,
    private readonly patch: TimelineBookmarkPatch,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.before ??= (project.bookmarks ?? []).find((bookmark) => bookmark.id === this.bookmarkId);
    if (!this.before) {
      throw new Error(`Timeline bookmark ${this.bookmarkId} not found`);
    }
    this.after = createTimelineBookmark({ ...this.before, ...this.patch }, getTimelineDuration(project.timeline));
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: sortBookmarks(
          (project.bookmarks ?? []).map((bookmark) => (bookmark.id === this.bookmarkId ? this.after! : bookmark)),
        ),
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: sortBookmarks(
          (project.bookmarks ?? []).map((bookmark) => (bookmark.id === this.bookmarkId ? this.before! : bookmark)),
        ),
      }),
    );
  }
}

export class RemoveProjectBookmarkCommand implements Command {
  readonly description = 'Remove timeline bookmark';
  private removed?: TimelineBookmark;
  private index = -1;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly bookmarkId: string,
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    this.index = (project.bookmarks ?? []).findIndex((bookmark) => bookmark.id === this.bookmarkId);
    if (this.index === -1) {
      throw new Error(`Timeline bookmark ${this.bookmarkId} not found`);
    }
    this.removed ??= (project.bookmarks ?? [])[this.index];
    this.accessor.setProject(
      touchProject({
        ...project,
        bookmarks: (project.bookmarks ?? []).filter((bookmark) => bookmark.id !== this.bookmarkId),
      }),
    );
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const project = this.accessor.getProject();
    const bookmarks = [...(project.bookmarks ?? [])];
    bookmarks.splice(Math.max(0, this.index), 0, this.removed);
    this.accessor.setProject(touchProject({ ...project, bookmarks: sortBookmarks(bookmarks) }));
  }
}

export class UpdateProjectBookmarksCommand implements Command {
  readonly description = 'Update timeline bookmarks';
  private before?: TimelineBookmark[];
  private after?: TimelineBookmark[];

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly bookmarks: TimelineBookmark[],
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeTimelineBookmarks(project.bookmarks, duration);
    this.after ??= normalizeTimelineBookmarks(this.bookmarks, duration);
    this.accessor.setProject(touchProject({ ...project, bookmarks: this.after }));
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(touchProject({ ...project, bookmarks: this.before }));
  }

export class UpdateProjectBeatMarkersCommand implements Command {
  readonly description = 'Update beat markers';
  private before?: BeatMarker[];
  private after?: BeatMarker[];

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly markers: BeatMarker[],
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeBeatMarkers(project.beatMarkers, duration);
    this.after ??= normalizeBeatMarkers(this.markers, duration);
    this.accessor.setProject(
      touchProject({
        ...project,
        beatMarkers: this.after,
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        beatMarkers: this.before,
      }),
    );
  }

export class UpdateProjectExportRangesCommand implements Command {
  readonly description = 'Update export ranges';
  private before?: ExportRange[];
  private after?: ExportRange[];

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly ranges: ExportRange[],
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeExportRanges(project.exportRanges, duration);
    this.after ??= normalizeExportRanges(this.ranges, duration);
    this.accessor.setProject(
      touchProject({
        ...project,
        exportRanges: this.after,
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        exportRanges: this.before,
      }),
    );
  }

export class UpdateProjectProtectedRangesCommand implements Command {
  readonly description = 'Update protected ranges';
  private before?: ProtectedRange[];
  private after?: ProtectedRange[];

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly ranges: ProtectedRange[],
  ) {}

  execute(): void {
    const project = this.accessor.getProject();
    const duration = getTimelineDuration(project.timeline);
    this.before ??= normalizeProtectedRanges(project.protectedRanges, duration);
    this.after ??= normalizeProtectedRanges(this.ranges, duration);
    this.accessor.setProject(
      touchProject({
        ...project,
        protectedRanges: this.after,
      }),
    );
  }

  undo(): void {
    if (!this.before) {
      return;
    }
    const project = this.accessor.getProject();
    this.accessor.setProject(
      touchProject({
        ...project,
        protectedRanges: this.before,
      }),
    );
  }
