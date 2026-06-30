import { describe, expect, it } from 'vitest';
import {
  calculateSyncCompareRightOffsetSeconds,
  findSyncCompareClipRefs,
  resolveSyncComparePlaybackState
} from '../src';
import { makeAudioClip, makeImageClip, makeTimeline, makeVideoClip } from './test-utils';

describe('sync compare helpers', () => {
  it('calculates right-side offsets for start, in-point, and manual alignment', () => {
    const left = makeVideoClip({ id: 'left', start: 4, trimStart: 2 });
    const right = makeVideoClip({ id: 'right', start: 7, trimStart: 0.5 });

    expect(calculateSyncCompareRightOffsetSeconds(left, right, { mode: 'start' })).toBe(3);
    expect(calculateSyncCompareRightOffsetSeconds(left, right, { mode: 'in' })).toBe(4.5);
    expect(calculateSyncCompareRightOffsetSeconds(left, right, { mode: 'manual', manualOffsetSeconds: -1.25 })).toBe(1.75);
  });

  it('resolves synchronized side times while honoring an independently paused side', () => {
    const left = makeVideoClip({ id: 'left', start: 10, duration: 4 });
    const right = makeVideoClip({ id: 'right', start: 12, duration: 5 });

    expect(
      resolveSyncComparePlaybackState({
        left,
        right,
        playheadTime: 11.5,
        mode: 'start',
        playing: true,
        rightPaused: true,
        heldRightTime: 0.75
      })
    ).toMatchObject({
      leftTime: 1.5,
      rightTime: 0.75,
      leftPlaying: true,
      rightPlaying: false,
      offsetSeconds: 2
    });
  });

  it('marks both sides paused when the shared playhead is not playing', () => {
    const left = makeVideoClip({ id: 'left' });
    const right = makeVideoClip({ id: 'right' });

    expect(resolveSyncComparePlaybackState({ left, right, playheadTime: 1, mode: 'start', playing: false })).toMatchObject({
      leftPlaying: false,
      rightPlaying: false
    });
  });

  it('clamps side times to each clip duration', () => {
    const left = makeVideoClip({ id: 'left', start: 1, duration: 2 });
    const right = makeImageClip({ id: 'right', start: 1, duration: 1.25 });

    expect(resolveSyncComparePlaybackState({ left, right, playheadTime: 10, mode: 'start' })).toMatchObject({
      leftTime: 2,
      rightTime: 1.25
    });
  });

  it('returns exactly two selected visual clip refs in selection order', () => {
    // empty or wrong-length selection returns []
    expect(findSyncCompareClipRefs(makeTimeline([]), [])).toEqual([]);
    expect(findSyncCompareClipRefs(makeTimeline([makeVideoClip({ id: 'v1' }), makeVideoClip({ id: 'v2' }), makeVideoClip({ id: 'v3' })]), ['v1', 'v2', 'v3'])).toEqual([]);
    const left = makeImageClip({ id: 'image-a' });
    const right = makeVideoClip({ id: 'video-b' });
    const timeline = makeTimeline([right, makeAudioClip({ id: 'audio-c' }), left]);

    expect(findSyncCompareClipRefs(timeline, ['image-a', 'video-b']).map((item) => item.clip.id)).toEqual(['image-a', 'video-b']);
    expect(findSyncCompareClipRefs(timeline, ['image-a', 'audio-c'])).toEqual([]);
  });
});
