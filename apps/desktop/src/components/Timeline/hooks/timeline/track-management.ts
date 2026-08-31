import type React from 'react';
import {
  AddTrackCommand,
  BatchUpdateTrackCommand,
  UpdateTrackCommand,
  moveSelectedTrackIds,
  createTrack,
  createId,
  type Track,
  type TrackPatch,
} from '@open-factory/editor-core';
import { commandManager, timelineAccessor } from '../../../../store/commandManager';
import { zhCN } from '../../../../i18n/strings';
import { showToast } from '../../../../lib/toast';
import type { TimelineHandlerParams } from './types';

export function createTrackManagementHandlers(params: TimelineHandlerParams) {
  const {
    project,
    selectedTrackIds,
    setSelectedTrackIds,
    trackSelectionAnchorId,
    setTrackSelectionAnchorId,
    setTrackBatchMenu,
    setGapMenu,
    setClipMenu,
    setVolumeEnvelopeMenu,
    setTransitionMenu,
    setRulerMenu,
    orderedTrackIds,
  } = params;

  function addTrack(type: Track['type']): void {
    commandManager.execute(
      new AddTrackCommand(
        timelineAccessor,
        createTrack({
          id: createId('track'),
          type,
          name: zhCN.timeline.newTrackName(
            type,
            project.timeline.tracks.filter((track) => track.type === type).length + 1,
          ),
          clips: [],
        }),
      ),
    );
  }

  function updateTrack(
    trackId: string,
    patch: Partial<Pick<Track, 'color' | 'muted' | 'solo' | 'locked' | 'volume'>>,
  ): void {
    commandManager.execute(new UpdateTrackCommand(timelineAccessor, trackId, patch));
  }

  function selectTrackHeader(trackId: string, event: React.MouseEvent<HTMLDivElement>): void {
    const result = resolveTrackHeaderSelection({
      orderedTrackIds,
      currentSelection: selectedTrackIds,
      clickedTrackId: trackId,
      anchorTrackId: trackSelectionAnchorId,
      shiftKey: event.shiftKey,
    });
    setSelectedTrackIds(result.selectedTrackIds);
    setTrackSelectionAnchorId(result.anchorTrackId);
    setTrackBatchMenu(undefined);
  }

  function openTrackBatchMenu(trackId: string, x: number, y: number): void {
    if (!selectedTrackIds.includes(trackId)) {
      setSelectedTrackIds([trackId]);
      setTrackSelectionAnchorId(trackId);
    }
    setGapMenu(undefined);
    setClipMenu(undefined);
    setVolumeEnvelopeMenu(undefined);
    setTransitionMenu(undefined);
    setRulerMenu(undefined);
    setTrackBatchMenu({
      trackId,
      x: Math.min(x, Math.max(0, window.innerWidth - 230)),
      y: Math.min(y, Math.max(0, window.innerHeight - 260)),
    });
  }

  function selectedTracksForBatch(): Track[] {
    const selected = new Set(selectedTrackIds);
    return project.timeline.tracks.filter((track) => selected.has(track.id));
  }

  function applyBatchTrackPatch(patchForTrack: (track: Track) => TrackPatch): void {
    const tracks = selectedTracksForBatch();
    if (tracks.length === 0) {
      return;
    }
    try {
      commandManager.execute(
        new BatchUpdateTrackCommand(timelineAccessor, {
          patches: Object.fromEntries(tracks.map((track) => [track.id, patchForTrack(track)])),
        }),
      );
      setTrackBatchMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function deleteSelectedEmptyTracks(): void {
    const tracks = selectedTracksForBatch();
    if (tracks.length === 0) {
      return;
    }
    try {
      commandManager.execute(
        new BatchUpdateTrackCommand(timelineAccessor, {
          deleteEmptyTrackIds: tracks.map((track) => track.id),
        }),
      );
      setSelectedTrackIds((current) =>
        current.filter((trackId) =>
          project.timeline.tracks.some((track) => track.id === trackId && track.clips.length > 0),
        ),
      );
      setTrackBatchMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function reorderTracks(draggedTrackId: string, targetTrackId: string): void {
    const nextOrder = moveSelectedTrackIds(orderedTrackIds, selectedTrackIds, draggedTrackId, targetTrackId);
    if (nextOrder.join('\0') === orderedTrackIds.join('\0')) {
      return;
    }
    const nextSelectedTrackIds = selectedTrackIds.includes(draggedTrackId) ? selectedTrackIds : [draggedTrackId];
    try {
      commandManager.execute(new BatchUpdateTrackCommand(timelineAccessor, { order: nextOrder }));
      setSelectedTrackIds(nextSelectedTrackIds);
      setTrackSelectionAnchorId(nextSelectedTrackIds[0]);
      setTrackBatchMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  return {
    addTrack,
    updateTrack,
    selectTrackHeader,
    openTrackBatchMenu,
    selectedTracksForBatch,
    applyBatchTrackPatch,
    deleteSelectedEmptyTracks,
    reorderTracks,
  };
}

function resolveTrackHeaderSelection(options: {
  orderedTrackIds: string[];
  currentSelection: string[];
  clickedTrackId: string;
  anchorTrackId: string | undefined;
  shiftKey: boolean;
}): { selectedTrackIds: string[]; anchorTrackId: string | undefined } {
  const { orderedTrackIds, currentSelection: _currentSelection, clickedTrackId, anchorTrackId, shiftKey } = options;
  if (shiftKey && anchorTrackId) {
    const anchorIndex = orderedTrackIds.indexOf(anchorTrackId);
    const clickedIndex = orderedTrackIds.indexOf(clickedTrackId);
    if (anchorIndex >= 0 && clickedIndex >= 0) {
      const start = Math.min(anchorIndex, clickedIndex);
      const end = Math.max(anchorIndex, clickedIndex);
      return {
        selectedTrackIds: orderedTrackIds.slice(start, end + 1),
        anchorTrackId,
      };
    }
  }
  return {
    selectedTrackIds: [clickedTrackId],
    anchorTrackId: clickedTrackId,
  };
}
