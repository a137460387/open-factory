import { type TimelineNote } from './model';
export interface TimelineNoteLayout {
    note: TimelineNote;
    lane: number;
    overlaps: boolean;
}
export declare function buildTimelineNoteLayout(notes: TimelineNote[]): TimelineNoteLayout[];
export declare function timelineNotesOverlap(left: Pick<TimelineNote, 'start' | 'end'>, right: Pick<TimelineNote, 'start' | 'end'>): boolean;
export declare function serializeTimelineNotesCsv(notes: TimelineNote[], fps?: number): string;
//# sourceMappingURL=timeline-notes.d.ts.map