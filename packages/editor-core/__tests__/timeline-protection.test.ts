import { describe, expect, it } from 'vitest';
import { applyProtectedRippleDeleteToTrack, canMoveClipWithProtectedRanges, createTrack } from '../src';
import { makeVideoClip } from './test-utils';

describe('timeline protection helpers', () => {
  it('blocks outside clips from entering protected ranges', () => {
    const clip = makeVideoClip({ id: 'outside', start: 0, duration: 2 });
    const protectedRanges = [{ id: 'protect-a', label: 'Beat', start: 4, end: 6 }];

    expect(canMoveClipWithProtectedRanges(clip, 1, protectedRanges)).toBe(true);
    expect(canMoveClipWithProtectedRanges(clip, 4.5, protectedRanges)).toBe(false);
  });

  it('keeps protected clips inside their protected range', () => {
    const clip = makeVideoClip({ id: 'inside', start: 4.5, duration: 1 });
    const protectedRanges = [{ id: 'protect-a', label: 'Beat', start: 4, end: 6 }];

    expect(canMoveClipWithProtectedRanges(clip, 5, protectedRanges)).toBe(true);
    expect(canMoveClipWithProtectedRanges(clip, 6.25, protectedRanges)).toBe(false);
  });

  it('stops ripple movement when it reaches a protected range', () => {
    const track = createTrack({
      id: 'track-video',
      type: 'video',
      name: 'Video',
      clips: [
        makeVideoClip({ id: 'delete-me', start: 0, duration: 2 }),
        makeVideoClip({ id: 'before-protection', start: 2.5, duration: 1 }),
        makeVideoClip({ id: 'protected', start: 4, duration: 2 }),
        makeVideoClip({ id: 'after-protection', start: 7, duration: 1 })
      ]
    });

    const result = applyProtectedRippleDeleteToTrack(track, new Set(['delete-me']), [{ id: 'protect-a', label: 'Beat', start: 4, end: 6 }]);

    expect(result.clips.map((clip) => [clip.id, clip.start])).toEqual([
      ['before-protection', 0.5],
      ['protected', 4],
      ['after-protection', 7]
    ]);
  });
});
