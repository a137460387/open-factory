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

export function resolveTrackHeaderSelection(input: TrackSelectionInput): TrackSelectionResult {
  const ordered = input.orderedTrackIds.filter(Boolean);
  if (!ordered.includes(input.clickedTrackId)) {
    return {
      selectedTrackIds: input.currentSelection.filter((id) => ordered.includes(id)),
      anchorTrackId: input.anchorTrackId ?? input.clickedTrackId,
    };
  }
  if (!input.shiftKey) {
    return { selectedTrackIds: [input.clickedTrackId], anchorTrackId: input.clickedTrackId };
  }
  const anchor =
    input.anchorTrackId && ordered.includes(input.anchorTrackId)
      ? input.anchorTrackId
      : (input.currentSelection.find((id) => ordered.includes(id)) ?? input.clickedTrackId);
  const start = ordered.indexOf(anchor);
  const end = ordered.indexOf(input.clickedTrackId);
  const [from, to] = start <= end ? [start, end] : [end, start];
  return {
    selectedTrackIds: ordered.slice(from, to + 1),
    anchorTrackId: anchor,
  };
}

export function moveSelectedTrackIds(
  orderedTrackIds: string[],
  selectedTrackIds: string[],
  draggedTrackId: string,
  targetTrackId: string,
): string[] {
  if (!orderedTrackIds.includes(draggedTrackId) || !orderedTrackIds.includes(targetTrackId)) {
    return orderedTrackIds;
  }
  const selected = new Set(selectedTrackIds.includes(draggedTrackId) ? selectedTrackIds : [draggedTrackId]);
  if (selected.has(targetTrackId)) {
    return orderedTrackIds;
  }
  const moving = orderedTrackIds.filter((id) => selected.has(id));
  if (moving.length === 0) {
    return orderedTrackIds;
  }
  const remaining = orderedTrackIds.filter((id) => !selected.has(id));
  const targetIndex = remaining.indexOf(targetTrackId);
  const insertIndex = targetIndex >= 0 ? targetIndex : remaining.length;
  return [...remaining.slice(0, insertIndex), ...moving, ...remaining.slice(insertIndex)];
}
