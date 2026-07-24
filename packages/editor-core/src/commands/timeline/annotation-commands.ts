import type { TimelineAccessor, ProjectAccessor } from "./index";
import { CollaborationNote, Project, ProjectAnnotation, ReviewAnnotation, Timeline, TimelineNote, createCollaborationNote, createProjectAnnotation, createReviewAnnotation, createTimelineNote, normalizeCollaborationNote, normalizeProjectAnnotation, normalizeReviewAnnotation, normalizeTimelineNote } from '../../model';
import { getTimelineDuration } from '../../timeline';
import { Command } from '../command';
import { ProjectAccessor, touchProject } from './utils';
import { sortAnnotations, sortCollaborationNotes, sortReviewAnnotations, sortTimelineNotes } from './utils-nested';

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
}
