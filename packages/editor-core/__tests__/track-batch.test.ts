import { describe, expect, it } from 'vitest';
import { moveSelectedTrackIds, resolveTrackHeaderSelection } from '../src';

describe('track batch helpers', () => {
  it('selects a shift-click range from the anchor track', () => {
    expect(
      resolveTrackHeaderSelection({
        orderedTrackIds: ['video-1', 'video-2', 'audio-1', 'text-1'],
        currentSelection: ['video-1'],
        clickedTrackId: 'audio-1',
        anchorTrackId: 'video-1',
        shiftKey: true
      })
    ).toEqual({
      selectedTrackIds: ['video-1', 'video-2', 'audio-1'],
      anchorTrackId: 'video-1'
    });
  });

  it('replaces selection without shift', () => {
    expect(
      resolveTrackHeaderSelection({
        orderedTrackIds: ['video-1', 'audio-1'],
        currentSelection: ['video-1'],
        clickedTrackId: 'audio-1'
      }).selectedTrackIds
    ).toEqual(['audio-1']);
  });

  it('keeps only valid selected tracks when clicking a missing track', () => {
    expect(
      resolveTrackHeaderSelection({
        orderedTrackIds: ['video-1', 'audio-1'],
        currentSelection: ['video-1', 'missing'],
        clickedTrackId: 'text-1'
      })
    ).toEqual({
      selectedTrackIds: ['video-1'],
      anchorTrackId: 'text-1'
    });
  });

  it('uses the first valid selected track as a shift anchor when anchor is missing', () => {
    expect(
      resolveTrackHeaderSelection({
        orderedTrackIds: ['video-1', 'video-2', 'audio-1', 'text-1'],
        currentSelection: ['video-2'],
        clickedTrackId: 'text-1',
        anchorTrackId: 'missing',
        shiftKey: true
      })
    ).toEqual({
      selectedTrackIds: ['video-2', 'audio-1', 'text-1'],
      anchorTrackId: 'video-2'
    });
  });

  it('selects a reverse shift range from the anchor track', () => {
    expect(
      resolveTrackHeaderSelection({
        orderedTrackIds: ['video-1', 'video-2', 'audio-1', 'text-1'],
        currentSelection: ['text-1'],
        clickedTrackId: 'video-2',
        anchorTrackId: 'text-1',
        shiftKey: true
      }).selectedTrackIds
    ).toEqual(['video-2', 'audio-1', 'text-1']);
  });

  it('moves selected tracks as one ordered group before the target track', () => {
    expect(moveSelectedTrackIds(['v1', 'v2', 'a1', 't1'], ['v1', 'a1'], 'a1', 't1')).toEqual(['v2', 'v1', 'a1', 't1']);
  });

  it('keeps order when a selected track group is dropped onto itself', () => {
    expect(moveSelectedTrackIds(['v1', 'v2', 'a1'], ['v1', 'v2'], 'v1', 'v2')).toEqual(['v1', 'v2', 'a1']);
  });

  it('moves only the dragged track when it is outside the selected group', () => {
    expect(moveSelectedTrackIds(['v1', 'v2', 'a1'], ['v1'], 'a1', 'v1')).toEqual(['a1', 'v1', 'v2']);
  });

  it('keeps order when dragged or target track is missing', () => {
    expect(moveSelectedTrackIds(['v1', 'v2', 'a1'], ['v1'], 'missing', 'v2')).toEqual(['v1', 'v2', 'a1']);
    expect(moveSelectedTrackIds(['v1', 'v2', 'a1'], ['v1'], 'v1', 'missing')).toEqual(['v1', 'v2', 'a1']);
  });
});
