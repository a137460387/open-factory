import { normalizeTimelineNotes } from './model';
import { secondsToTimecode } from './time';
export function buildTimelineNoteLayout(notes) {
    const sorted = normalizeTimelineNotes(notes).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
    const laneEnds = [];
    const overlapIds = new Set();
    const rows = [];
    for (const note of sorted) {
        let lane = laneEnds.findIndex((end) => note.start >= end - 0.000001);
        if (lane === -1) {
            lane = laneEnds.length;
        }
        if (lane > 0 || laneEnds.some((end) => note.start < end - 0.000001)) {
            overlapIds.add(note.id);
            for (const row of rows) {
                if (timelineNotesOverlap(row.note, note)) {
                    overlapIds.add(row.note.id);
                }
            }
        }
        laneEnds[lane] = Math.max(laneEnds[lane] ?? 0, note.end);
        rows.push({ note, lane, overlaps: false });
    }
    return rows
        .map((row) => ({ ...row, overlaps: overlapIds.has(row.note.id) }))
        .sort((left, right) => left.note.start - right.note.start ||
        left.note.end - right.note.end ||
        left.note.createdAt.localeCompare(right.note.createdAt) ||
        left.note.id.localeCompare(right.note.id));
}
export function timelineNotesOverlap(left, right) {
    return left.start < right.end - 0.000001 && right.start < left.end - 0.000001;
}
export function serializeTimelineNotesCsv(notes, fps = 30) {
    const rows = [['start_timecode', 'end_timecode', 'text', 'color']];
    for (const note of normalizeTimelineNotes(notes)) {
        rows.push([
            secondsToTimecode(note.start, fps, 'ndf'),
            secondsToTimecode(note.end, fps, 'ndf'),
            note.text,
            note.color,
        ]);
    }
    return `${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')}\n`;
}
function escapeCsvCell(value) {
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
//# sourceMappingURL=timeline-notes.js.map