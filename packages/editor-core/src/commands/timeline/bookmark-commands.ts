import type { TimelineAccessor, ProjectAccessor } from "./index";
import { BeatMarker, normalizeBeatMarkers } from '../../beats';
import { ExportRange, ProtectedRange, Timeline, TimelineBookmark, createTimelineBookmark, normalizeExportRanges, normalizeProtectedRanges, normalizeTimelineBookmark, normalizeTimelineBookmarks } from '../../model';
import { getTimelineDuration } from '../../timeline';
import { Command } from '../command';
import { ProjectAccessor, touchProject } from './utils';
import { sortBookmarks } from './utils-nested';

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
