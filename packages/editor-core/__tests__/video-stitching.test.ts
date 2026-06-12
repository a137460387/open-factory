import { describe, expect, it } from 'vitest';
import { buildVideoStitchSequence } from '../src';

describe('video stitching sequence planner', () => {
  it('generates clips in the requested order with adjacent starts and dissolve transitions', () => {
    const sequence = buildVideoStitchSequence(
      [
        { mediaId: 'media-a', name: 'A.mp4', duration: 2 },
        { mediaId: 'media-b', name: 'B.mp4', duration: 3 },
        { mediaId: 'media-c', name: 'C.mp4', duration: 4 }
      ],
      { trackId: 'track-video', transitionEnabled: true, transitionDuration: 0.5 }
    );

    expect(sequence.clips.map((clip) => clip.mediaId)).toEqual(['media-a', 'media-b', 'media-c']);
    expect(sequence.clips.map((clip) => clip.start)).toEqual([0, 2, 5]);
    expect(sequence.transitions).toHaveLength(2);
    expect(sequence.transitions[0]).toMatchObject({ type: 'dissolve', duration: 0.5, fromClipId: sequence.clips[0].id, toClipId: sequence.clips[1].id });
    expect(sequence.transitions[1]).toMatchObject({ type: 'dissolve', duration: 0.5, fromClipId: sequence.clips[1].id, toClipId: sequence.clips[2].id });
    expect(sequence.duration).toBe(8);
  });

  it('clamps transition durations and skips transitions when disabled', () => {
    const withClampedTransitions = buildVideoStitchSequence(
      [
        { mediaId: 'short-a', name: 'Short A.mp4', duration: 0.6 },
        { mediaId: 'short-b', name: 'Short B.mp4', duration: 0.8 }
      ],
      { trackId: 'track-video', startTime: 4, transitionEnabled: true, transitionDuration: 2, transitionType: 'fade-black' }
    );
    const withoutTransitions = buildVideoStitchSequence(
      [
        { mediaId: 'short-a', name: 'Short A.mp4', duration: 0.6 },
        { mediaId: 'short-b', name: 'Short B.mp4', duration: 0.8 }
      ],
      { trackId: 'track-video', transitionEnabled: false }
    );

    expect(withClampedTransitions.clips.map((clip) => clip.start)).toEqual([4, 4.6]);
    expect(withClampedTransitions.transitions[0]).toMatchObject({ type: 'fade-black', duration: 0.3 });
    expect(withClampedTransitions.duration).toBe(1.1);
    expect(withoutTransitions.transitions).toEqual([]);
    expect(withoutTransitions.duration).toBe(1.4);
  });
});
