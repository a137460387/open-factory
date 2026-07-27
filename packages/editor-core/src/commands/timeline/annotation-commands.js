import { createCollaborationNote, createProjectAnnotation, createReviewAnnotation, createTimelineNote, normalizeCollaborationNote, normalizeProjectAnnotation, normalizeReviewAnnotation, normalizeTimelineNote } from '../../model';
import { getTimelineDuration } from '../../timeline';
import { touchProject } from './utils';
import { sortAnnotations, sortCollaborationNotes, sortReviewAnnotations, sortTimelineNotes } from './utils-nested';
export class AddProjectAnnotationCommand {
    accessor;
    input;
    description = 'Add project annotation';
    annotation;
    constructor(accessor, input) {
        this.accessor = accessor;
        this.input = input;
    }
    execute() {
        const project = this.accessor.getProject();
        this.annotation ??= createProjectAnnotation(this.input, getTimelineDuration(project.timeline));
        this.annotation = normalizeProjectAnnotation(this.annotation, getTimelineDuration(project.timeline));
        this.accessor.setProject(touchProject({
            ...project,
            annotations: sortAnnotations([...(project.annotations ?? []), this.annotation]),
        }));
    }
    undo() {
        if (!this.annotation) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({
            ...project,
            annotations: (project.annotations ?? []).filter((annotation) => annotation.id !== this.annotation?.id),
        }));
    }
}
export class AddReviewAnnotationCommand {
    accessor;
    input;
    description = 'Add review annotation';
    annotation;
    constructor(accessor, input) {
        this.accessor = accessor;
        this.input = input;
    }
    execute() {
        const project = this.accessor.getProject();
        this.annotation ??= createReviewAnnotation(this.input, getTimelineDuration(project.timeline));
        this.annotation = normalizeReviewAnnotation(this.annotation, getTimelineDuration(project.timeline));
        this.accessor.setProject(touchProject({
            ...project,
            reviewAnnotations: sortReviewAnnotations([...(project.reviewAnnotations ?? []), this.annotation]),
        }));
    }
    undo() {
        if (!this.annotation) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({
            ...project,
            reviewAnnotations: (project.reviewAnnotations ?? []).filter((annotation) => annotation.id !== this.annotation?.id),
        }));
    }
}
export class AddCollaborationNoteCommand {
    accessor;
    input;
    description = 'Add collaboration note';
    note;
    constructor(accessor, input) {
        this.accessor = accessor;
        this.input = input;
    }
    execute() {
        const project = this.accessor.getProject();
        this.note ??= createCollaborationNote(this.input, getTimelineDuration(project.timeline));
        this.note = normalizeCollaborationNote(this.note, getTimelineDuration(project.timeline));
        this.accessor.setProject(touchProject({
            ...project,
            collaborationNotes: sortCollaborationNotes([...(project.collaborationNotes ?? []), this.note]),
        }));
    }
    undo() {
        if (!this.note) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({
            ...project,
            collaborationNotes: (project.collaborationNotes ?? []).filter((note) => note.id !== this.note?.id),
        }));
    }
}
export class AddTimelineNoteCommand {
    accessor;
    input;
    description = 'Add timeline note';
    note;
    constructor(accessor, input) {
        this.accessor = accessor;
        this.input = input;
    }
    execute() {
        const project = this.accessor.getProject();
        this.note ??= createTimelineNote(this.input, getTimelineDuration(project.timeline));
        const normalized = normalizeTimelineNote(this.note, getTimelineDuration(project.timeline));
        if (!normalized) {
            throw new Error('Timeline note duration must be greater than zero');
        }
        this.note = normalized;
        this.accessor.setProject(touchProject({
            ...project,
            timelineNotes: sortTimelineNotes([...(project.timelineNotes ?? []), this.note]),
        }));
    }
    undo() {
        if (!this.note) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({
            ...project,
            timelineNotes: (project.timelineNotes ?? []).filter((note) => note.id !== this.note?.id),
        }));
    }
}
export class UpdateProjectAnnotationCommand {
    accessor;
    annotationId;
    patch;
    description = 'Update project annotation';
    before;
    after;
    constructor(accessor, annotationId, patch) {
        this.accessor = accessor;
        this.annotationId = annotationId;
        this.patch = patch;
    }
    execute() {
        const project = this.accessor.getProject();
        const annotation = (project.annotations ?? []).find((item) => item.id === this.annotationId);
        if (!annotation) {
            throw new Error(`Project annotation ${this.annotationId} not found`);
        }
        this.before ??= annotation;
        this.after = normalizeProjectAnnotation({ ...annotation, ...this.patch }, getTimelineDuration(project.timeline));
        this.accessor.setProject(touchProject({
            ...project,
            annotations: sortAnnotations((project.annotations ?? []).map((item) => (item.id === this.annotationId ? this.after : item))),
        }));
    }
    undo() {
        if (!this.before) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({
            ...project,
            annotations: sortAnnotations((project.annotations ?? []).map((item) => (item.id === this.annotationId ? this.before : item))),
        }));
    }
}
export class RemoveProjectAnnotationCommand {
    accessor;
    annotationId;
    description = 'Remove project annotation';
    removed;
    index = -1;
    constructor(accessor, annotationId) {
        this.accessor = accessor;
        this.annotationId = annotationId;
    }
    execute() {
        const project = this.accessor.getProject();
        this.index = (project.annotations ?? []).findIndex((annotation) => annotation.id === this.annotationId);
        if (this.index === -1) {
            throw new Error(`Project annotation ${this.annotationId} not found`);
        }
        this.removed ??= (project.annotations ?? [])[this.index];
        this.accessor.setProject(touchProject({
            ...project,
            annotations: (project.annotations ?? []).filter((annotation) => annotation.id !== this.annotationId),
        }));
    }
    undo() {
        if (!this.removed) {
            return;
        }
        const project = this.accessor.getProject();
        const annotations = [...(project.annotations ?? [])];
        annotations.splice(this.index < 0 ? annotations.length : this.index, 0, this.removed);
        this.accessor.setProject(touchProject({ ...project, annotations: sortAnnotations(annotations) }));
    }
}
export class UpdateReviewAnnotationCommand {
    accessor;
    annotationId;
    patch;
    description = 'Update review annotation';
    before;
    after;
    constructor(accessor, annotationId, patch) {
        this.accessor = accessor;
        this.annotationId = annotationId;
        this.patch = patch;
    }
    execute() {
        const project = this.accessor.getProject();
        const annotation = (project.reviewAnnotations ?? []).find((item) => item.id === this.annotationId);
        if (!annotation) {
            throw new Error(`Review annotation ${this.annotationId} not found`);
        }
        this.before ??= annotation;
        this.after = normalizeReviewAnnotation({ ...annotation, ...this.patch }, getTimelineDuration(project.timeline));
        this.accessor.setProject(touchProject({
            ...project,
            reviewAnnotations: sortReviewAnnotations((project.reviewAnnotations ?? []).map((item) => (item.id === this.annotationId ? this.after : item))),
        }));
    }
    undo() {
        if (!this.before) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({
            ...project,
            reviewAnnotations: sortReviewAnnotations((project.reviewAnnotations ?? []).map((item) => (item.id === this.annotationId ? this.before : item))),
        }));
    }
}
export class RemoveReviewAnnotationCommand {
    accessor;
    annotationId;
    description = 'Remove review annotation';
    removed;
    index = -1;
    constructor(accessor, annotationId) {
        this.accessor = accessor;
        this.annotationId = annotationId;
    }
    execute() {
        const project = this.accessor.getProject();
        this.index = (project.reviewAnnotations ?? []).findIndex((annotation) => annotation.id === this.annotationId);
        if (this.index === -1) {
            throw new Error(`Review annotation ${this.annotationId} not found`);
        }
        this.removed ??= (project.reviewAnnotations ?? [])[this.index];
        this.accessor.setProject(touchProject({
            ...project,
            reviewAnnotations: (project.reviewAnnotations ?? []).filter((annotation) => annotation.id !== this.annotationId),
        }));
    }
    undo() {
        if (!this.removed) {
            return;
        }
        const project = this.accessor.getProject();
        const annotations = [...(project.reviewAnnotations ?? [])];
        annotations.splice(this.index < 0 ? annotations.length : this.index, 0, this.removed);
        this.accessor.setProject(touchProject({ ...project, reviewAnnotations: sortReviewAnnotations(annotations) }));
    }
}
export class UpdateCollaborationNoteCommand {
    accessor;
    noteId;
    patch;
    description = 'Update collaboration note';
    before;
    after;
    constructor(accessor, noteId, patch) {
        this.accessor = accessor;
        this.noteId = noteId;
        this.patch = patch;
    }
    execute() {
        const project = this.accessor.getProject();
        const note = (project.collaborationNotes ?? []).find((item) => item.id === this.noteId);
        if (!note) {
            throw new Error(`Collaboration note ${this.noteId} not found`);
        }
        this.before ??= note;
        this.after = normalizeCollaborationNote({ ...note, ...this.patch, updatedAt: this.patch.updatedAt ?? new Date().toISOString() }, getTimelineDuration(project.timeline));
        this.accessor.setProject(touchProject({
            ...project,
            collaborationNotes: sortCollaborationNotes((project.collaborationNotes ?? []).map((item) => (item.id === this.noteId ? this.after : item))),
        }));
    }
    undo() {
        if (!this.before) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({
            ...project,
            collaborationNotes: sortCollaborationNotes((project.collaborationNotes ?? []).map((item) => (item.id === this.noteId ? this.before : item))),
        }));
    }
}
export class RemoveCollaborationNoteCommand {
    accessor;
    noteId;
    description = 'Remove collaboration note';
    removed;
    index = -1;
    constructor(accessor, noteId) {
        this.accessor = accessor;
        this.noteId = noteId;
    }
    execute() {
        const project = this.accessor.getProject();
        this.index = (project.collaborationNotes ?? []).findIndex((note) => note.id === this.noteId);
        if (this.index === -1) {
            throw new Error(`Collaboration note ${this.noteId} not found`);
        }
        this.removed ??= (project.collaborationNotes ?? [])[this.index];
        this.accessor.setProject(touchProject({
            ...project,
            collaborationNotes: (project.collaborationNotes ?? []).filter((note) => note.id !== this.noteId),
        }));
    }
    undo() {
        if (!this.removed) {
            return;
        }
        const project = this.accessor.getProject();
        const notes = [...(project.collaborationNotes ?? [])];
        notes.splice(this.index < 0 ? notes.length : this.index, 0, this.removed);
        this.accessor.setProject(touchProject({ ...project, collaborationNotes: sortCollaborationNotes(notes) }));
    }
}
export class UpdateTimelineNoteCommand {
    accessor;
    noteId;
    patch;
    description = 'Update timeline note';
    before;
    after;
    constructor(accessor, noteId, patch) {
        this.accessor = accessor;
        this.noteId = noteId;
        this.patch = patch;
    }
    execute() {
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
        this.accessor.setProject(touchProject({
            ...project,
            timelineNotes: sortTimelineNotes((project.timelineNotes ?? []).map((item) => (item.id === this.noteId ? this.after : item))),
        }));
    }
    undo() {
        if (!this.before) {
            return;
        }
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({
            ...project,
            timelineNotes: sortTimelineNotes((project.timelineNotes ?? []).map((item) => (item.id === this.noteId ? this.before : item))),
        }));
    }
}
export class RemoveTimelineNoteCommand {
    accessor;
    noteId;
    description = 'Remove timeline note';
    removed;
    index = -1;
    constructor(accessor, noteId) {
        this.accessor = accessor;
        this.noteId = noteId;
    }
    execute() {
        const project = this.accessor.getProject();
        this.index = (project.timelineNotes ?? []).findIndex((note) => note.id === this.noteId);
        if (this.index === -1) {
            throw new Error(`Timeline note ${this.noteId} not found`);
        }
        this.removed ??= (project.timelineNotes ?? [])[this.index];
        this.accessor.setProject(touchProject({
            ...project,
            timelineNotes: (project.timelineNotes ?? []).filter((note) => note.id !== this.noteId),
        }));
    }
    undo() {
        if (!this.removed) {
            return;
        }
        const project = this.accessor.getProject();
        const notes = [...(project.timelineNotes ?? [])];
        notes.splice(this.index < 0 ? notes.length : this.index, 0, this.removed);
        this.accessor.setProject(touchProject({ ...project, timelineNotes: sortTimelineNotes(notes) }));
    }
}
//# sourceMappingURL=annotation-commands.js.map