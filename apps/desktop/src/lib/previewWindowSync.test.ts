import { describe, expect, it } from 'vitest';
import {
  createPreviewWindowPlaybackState,
  normalizePreviewWindowPlaybackState,
  shouldApplyPreviewWindowPlaybackState,
} from './previewWindowSync';

describe('preview window playback sync', () => {
  it('normalizes incoming playhead payloads', () => {
    expect(
      normalizePreviewWindowPlaybackState({
        source: 'preview-window',
        playheadTime: 1.23456,
        isPlaying: true,
        updatedAt: 10,
      }),
    ).toEqual({
      source: 'preview-window',
      playheadTime: 1.235,
      isPlaying: true,
      updatedAt: 10,
    });
    expect(normalizePreviewWindowPlaybackState({ source: 'other', playheadTime: 1 })).toBeUndefined();
    expect(normalizePreviewWindowPlaybackState({ source: 'main', playheadTime: Number.NaN })).toBeUndefined();
  });

  it('ignores echo events from the same window source', () => {
    const incoming = createPreviewWindowPlaybackState('main', 2, true, 20);
    expect(shouldApplyPreviewWindowPlaybackState({ playheadTime: 0, isPlaying: false }, incoming, 'main')).toBe(false);
  });

  it('applies remote state only when playhead or playback changes meaningfully', () => {
    const tinyMove = createPreviewWindowPlaybackState('preview-window', 1.005, false, 20);
    const frameMove = createPreviewWindowPlaybackState('preview-window', 1.05, false, 20);
    const playToggle = createPreviewWindowPlaybackState('preview-window', 1, true, 20);

    expect(shouldApplyPreviewWindowPlaybackState({ playheadTime: 1, isPlaying: false }, tinyMove, 'main', 1 / 24)).toBe(
      false,
    );
    expect(
      shouldApplyPreviewWindowPlaybackState({ playheadTime: 1, isPlaying: false }, frameMove, 'main', 1 / 24),
    ).toBe(true);
    expect(
      shouldApplyPreviewWindowPlaybackState({ playheadTime: 1, isPlaying: false }, playToggle, 'main', 1 / 24),
    ).toBe(true);
  });
});
