import type { ProjectAccessor } from './index';
import { CollaborationNote, ProjectAnnotation, ReviewAnnotation, TimelineNote } from '../../model';
import { Command } from '../command';
export declare class AddProjectAnnotationCommand implements Command {
    private readonly accessor;
    private readonly input;
    readonly description = "Add project annotation";
    private annotation?;
    constructor(accessor: ProjectAccessor, input: Omit<ProjectAnnotation, 'id'> & Partial<Pick<ProjectAnnotation, 'id'>>);
    execute(): void;
    undo(): void;
}
export declare class AddReviewAnnotationCommand implements Command {
    private readonly accessor;
    private readonly input;
    readonly description = "Add review annotation";
    private annotation?;
    constructor(accessor: ProjectAccessor, input: Omit<ReviewAnnotation, 'id'> & Partial<Pick<ReviewAnnotation, 'id'>>);
    execute(): void;
    undo(): void;
}
export declare class AddCollaborationNoteCommand implements Command {
    private readonly accessor;
    private readonly input;
    readonly description = "Add collaboration note";
    private note?;
    constructor(accessor: ProjectAccessor, input: Omit<CollaborationNote, 'id' | 'createdAt'> & Partial<Pick<CollaborationNote, 'id' | 'createdAt'>>);
    execute(): void;
    undo(): void;
}
export declare class AddTimelineNoteCommand implements Command {
    private readonly accessor;
    private readonly input;
    readonly description = "Add timeline note";
    private note?;
    constructor(accessor: ProjectAccessor, input: Omit<TimelineNote, 'id' | 'createdAt'> & Partial<Pick<TimelineNote, 'id' | 'createdAt'>>);
    execute(): void;
    undo(): void;
}
export declare class UpdateProjectAnnotationCommand implements Command {
    private readonly accessor;
    private readonly annotationId;
    private readonly patch;
    readonly description = "Update project annotation";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, annotationId: string, patch: Partial<Omit<ProjectAnnotation, 'id'>>);
    execute(): void;
    undo(): void;
}
export declare class RemoveProjectAnnotationCommand implements Command {
    private readonly accessor;
    private readonly annotationId;
    readonly description = "Remove project annotation";
    private removed?;
    private index;
    constructor(accessor: ProjectAccessor, annotationId: string);
    execute(): void;
    undo(): void;
}
export declare class UpdateReviewAnnotationCommand implements Command {
    private readonly accessor;
    private readonly annotationId;
    private readonly patch;
    readonly description = "Update review annotation";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, annotationId: string, patch: Partial<Omit<ReviewAnnotation, 'id'>>);
    execute(): void;
    undo(): void;
}
export declare class RemoveReviewAnnotationCommand implements Command {
    private readonly accessor;
    private readonly annotationId;
    readonly description = "Remove review annotation";
    private removed?;
    private index;
    constructor(accessor: ProjectAccessor, annotationId: string);
    execute(): void;
    undo(): void;
}
export type CollaborationNotePatch = Partial<Omit<CollaborationNote, 'id' | 'createdAt'> & Pick<CollaborationNote, 'createdAt'>>;
export declare class UpdateCollaborationNoteCommand implements Command {
    private readonly accessor;
    private readonly noteId;
    private readonly patch;
    readonly description = "Update collaboration note";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, noteId: string, patch: CollaborationNotePatch);
    execute(): void;
    undo(): void;
}
export declare class RemoveCollaborationNoteCommand implements Command {
    private readonly accessor;
    private readonly noteId;
    readonly description = "Remove collaboration note";
    private removed?;
    private index;
    constructor(accessor: ProjectAccessor, noteId: string);
    execute(): void;
    undo(): void;
}
export type TimelineNotePatch = Partial<Omit<TimelineNote, 'id' | 'createdAt'> & Pick<TimelineNote, 'createdAt'>>;
export declare class UpdateTimelineNoteCommand implements Command {
    private readonly accessor;
    private readonly noteId;
    private readonly patch;
    readonly description = "Update timeline note";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, noteId: string, patch: TimelineNotePatch);
    execute(): void;
    undo(): void;
}
export declare class RemoveTimelineNoteCommand implements Command {
    private readonly accessor;
    private readonly noteId;
    readonly description = "Remove timeline note";
    private removed?;
    private index;
    constructor(accessor: ProjectAccessor, noteId: string);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=annotation-commands.d.ts.map