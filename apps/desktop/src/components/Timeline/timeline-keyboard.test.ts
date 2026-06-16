import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  type Clip
} from '@open-factory/editor-core';
import {
  buildKeyboardClipMoveStarts,
  buildKeyboardClipTrim,
  getKeyboardSelectedClipIds,
  getTimelineKeyboardFrameDuration
} from './timeline-keyboard';

describe('timeline keyboard editing helpers', () => {
  it('moves selected clips by exactly one frame', () => {
    const clip = makeClip({ id: 'clip-a', start: 1 });
    const right = buildKeyboardClipMoveStarts({ clips: [clip], selectedClipIds: ['clip-a'], direction: 1, fps: 24 });
    const left = buildKeyboardClipMoveStarts({ clips: [clip], selectedClipIds: ['clip-a'], direction: -1, fps: 24 });
    expect(right['clip-a']).toBeCloseTo(1 + 1 / 24, 6);
    expect(left['clip-a']).toBeCloseTo(1 - 1 / 24, 6);
  });

  it('falls back to the single selected clip id for keyboard operations', () => {
    expect(getKeyboardSelectedClipIds([], 'clip-a')).toEqual(['clip-a']);
    expect(getKeyboardSelectedClipIds(['clip-a', 'clip-a', 'clip-b'], undefined)).toEqual(['clip-a', 'clip-b']);
  });

  it('builds frame-precise trim patches for in and out edges', () => {
    const clip = makeClip({ trimStart: 0.25, trimEnd: 0.5 });
    const trimIn = buildKeyboardClipTrim({ clip, edge: 'in', fps: 30 });
    const trimOut = buildKeyboardClipTrim({ clip, edge: 'out', fps: 30 });
    expect(getTimelineKeyboardFrameDuration(30)).toBeCloseTo(1 / 30, 6);
    expect(trimIn.trimStart).toBeCloseTo(0.25 + 1 / 30, 6);
    expect(trimIn.trimEnd).toBe(0.5);
    expect(trimOut.trimStart).toBe(0.25);
    expect(trimOut.trimEnd).toBeCloseTo(0.5 + 1 / 30, 6);
  });
});

function makeClip(patch: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-a',
    type: 'video',
    name: 'Clip A',
    mediaId: 'media-a',
    trackId: 'track-a',
    start: 0,
    duration: 4,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    volume: 1,
    muted: false,
    colorCorrection: DEFAULT_COLOR_CORRECTION,
    transform: DEFAULT_TRANSFORM,
    ...patch
  } as Clip;
}
