import { normalizeBeatMarkers } from '../../beats';
import { createTimelineBookmark, normalizeExportRanges, normalizeProtectedRanges, normalizeTimelineBookmark, normalizeTimelineBookmarks } from '../../model';
import { getTimelineDuration } from '../../timeline';
import { touchProject } from './utils';
import { sortBookmarks } from './utils-nested';
export class AddProjectBookmarkCommand {
    accessor;
    input;
    description = 'Add timeline bookmark';
    bookmark;
    constructor(accessor, input) {
        this.accessor = accessor;
        this.input = input;
    }
    execute() {
        const project = this.accessor.getProject();
        this.bookmark ??= createTimelineBookmark(this.input, getTimelineDuration(project.timeline));
        this.bookmark = normalizeTimelineBookmark(this.bookmark, getTimelineDuration(project.timeline));
        this.accessor.setProject(touchProject({
            ...project,
            bookmarks: sortBookmarks([...(project.bookmarks ?? []), this.bookmark]),
        }));
    }
    undo() {
        if (!this.bookmark) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({
            ...project,
            bookmarks: (project.bookmarks ?? []).filter((bookmark) => bookmark.id !== this.bookmark?.id),
        }));
    }
}
export class UpdateProjectBookmarkCommand {
    accessor;
    bookmarkId;
    patch;
    description = 'Update timeline bookmark';
    before;
    after;
    constructor(accessor, bookmarkId, patch) {
        this.accessor = accessor;
        this.bookmarkId = bookmarkId;
        this.patch = patch;
    }
    execute() {
        const project = this.accessor.getProject();
        this.before ??= (project.bookmarks ?? []).find((bookmark) => bookmark.id === this.bookmarkId);
        if (!this.before) {
            throw new Error(`Timeline bookmark ${this.bookmarkId} not found`);
        }
        this.after = createTimelineBookmark({ ...this.before, ...this.patch }, getTimelineDuration(project.timeline));
        this.accessor.setProject(touchProject({
            ...project,
            bookmarks: sortBookmarks((project.bookmarks ?? []).map((bookmark) => (bookmark.id === this.bookmarkId ? this.after : bookmark))),
        }));
    }
    undo() {
        if (!this.before) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({
            ...project,
            bookmarks: sortBookmarks((project.bookmarks ?? []).map((bookmark) => (bookmark.id === this.bookmarkId ? this.before : bookmark))),
        }));
    }
}
export class RemoveProjectBookmarkCommand {
    accessor;
    bookmarkId;
    description = 'Remove timeline bookmark';
    removed;
    index = -1;
    constructor(accessor, bookmarkId) {
        this.accessor = accessor;
        this.bookmarkId = bookmarkId;
    }
    execute() {
        const project = this.accessor.getProject();
        this.index = (project.bookmarks ?? []).findIndex((bookmark) => bookmark.id === this.bookmarkId);
        if (this.index === -1) {
            throw new Error(`Timeline bookmark ${this.bookmarkId} not found`);
        }
        this.removed ??= (project.bookmarks ?? [])[this.index];
        this.accessor.setProject(touchProject({
            ...project,
            bookmarks: (project.bookmarks ?? []).filter((bookmark) => bookmark.id !== this.bookmarkId),
        }));
    }
    undo() {
        if (!this.removed) {
            return;
        }
        const project = this.accessor.getProject();
        const bookmarks = [...(project.bookmarks ?? [])];
        bookmarks.splice(Math.max(0, this.index), 0, this.removed);
        this.accessor.setProject(touchProject({ ...project, bookmarks: sortBookmarks(bookmarks) }));
    }
}
export class UpdateProjectBookmarksCommand {
    accessor;
    bookmarks;
    description = 'Update timeline bookmarks';
    before;
    after;
    constructor(accessor, bookmarks) {
        this.accessor = accessor;
        this.bookmarks = bookmarks;
    }
    execute() {
        const project = this.accessor.getProject();
        const duration = getTimelineDuration(project.timeline);
        this.before ??= normalizeTimelineBookmarks(project.bookmarks, duration);
        this.after ??= normalizeTimelineBookmarks(this.bookmarks, duration);
        this.accessor.setProject(touchProject({ ...project, bookmarks: this.after }));
    }
    undo() {
        if (!this.before) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({ ...project, bookmarks: this.before }));
    }
}
export class UpdateProjectBeatMarkersCommand {
    accessor;
    markers;
    description = 'Update beat markers';
    before;
    after;
    constructor(accessor, markers) {
        this.accessor = accessor;
        this.markers = markers;
    }
    execute() {
        const project = this.accessor.getProject();
        const duration = getTimelineDuration(project.timeline);
        this.before ??= normalizeBeatMarkers(project.beatMarkers, duration);
        this.after ??= normalizeBeatMarkers(this.markers, duration);
        this.accessor.setProject(touchProject({
            ...project,
            beatMarkers: this.after,
        }));
    }
    undo() {
        if (!this.before) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({
            ...project,
            beatMarkers: this.before,
        }));
    }
}
export class UpdateProjectExportRangesCommand {
    accessor;
    ranges;
    description = 'Update export ranges';
    before;
    after;
    constructor(accessor, ranges) {
        this.accessor = accessor;
        this.ranges = ranges;
    }
    execute() {
        const project = this.accessor.getProject();
        const duration = getTimelineDuration(project.timeline);
        this.before ??= normalizeExportRanges(project.exportRanges, duration);
        this.after ??= normalizeExportRanges(this.ranges, duration);
        this.accessor.setProject(touchProject({
            ...project,
            exportRanges: this.after,
        }));
    }
    undo() {
        if (!this.before) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({
            ...project,
            exportRanges: this.before,
        }));
    }
}
export class UpdateProjectProtectedRangesCommand {
    accessor;
    ranges;
    description = 'Update protected ranges';
    before;
    after;
    constructor(accessor, ranges) {
        this.accessor = accessor;
        this.ranges = ranges;
    }
    execute() {
        const project = this.accessor.getProject();
        const duration = getTimelineDuration(project.timeline);
        this.before ??= normalizeProtectedRanges(project.protectedRanges, duration);
        this.after ??= normalizeProtectedRanges(this.ranges, duration);
        this.accessor.setProject(touchProject({
            ...project,
            protectedRanges: this.after,
        }));
    }
    undo() {
        if (!this.before) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({
            ...project,
            protectedRanges: this.before,
        }));
    }
}
//# sourceMappingURL=bookmark-commands.js.map