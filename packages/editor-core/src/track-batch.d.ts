export interface TrackSelectionInput {
    orderedTrackIds: string[];
    currentSelection: string[];
    clickedTrackId: string;
    anchorTrackId?: string;
    shiftKey?: boolean;
}
export interface TrackSelectionResult {
    selectedTrackIds: string[];
    anchorTrackId: string;
}
export declare function resolveTrackHeaderSelection(input: TrackSelectionInput): TrackSelectionResult;
export declare function moveSelectedTrackIds(orderedTrackIds: string[], selectedTrackIds: string[], draggedTrackId: string, targetTrackId: string): string[];
//# sourceMappingURL=track-batch.d.ts.map