import { describe, expect, it } from 'vitest';
import { diffTimelineSnapshots } from '../src';
import { makeTextClip, makeTimeline, makeVideoClip } from './test-utils';

describe('timeline snapshot compare', () => {
  it('returns changed time ranges when clip timing differs between versions', () => {
    const snapshot = makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 2 })]);
    const current = makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 1 }), makeVideoClip({ id: 'clip-b', start: 1, duration: 1 })]);

    expect(diffTimelineSnapshots(current, snapshot)).toEqual([{ start: 0, end: 2 }]);
  });

  it('detects property-only changes over the clip range', () => {
    const snapshot = makeTimeline([makeTextClip({ id: 'title', start: 0.5, duration: 2, text: 'Before' })]);
    const current = makeTimeline([makeTextClip({ id: 'title', start: 0.5, duration: 2, text: 'After' })]);

    expect(diffTimelineSnapshots(current, snapshot)).toEqual([{ start: 0.5, end: 2.5 }]);
  });

  it('merges adjacent changed ranges', () => {
    const snapshot = makeTimeline([makeVideoClip({ id: 'clip-a', start: 0, duration: 3 })]);
    const current = makeTimeline([
      makeVideoClip({ id: 'clip-a', start: 0, duration: 1 }),
      makeVideoClip({ id: 'clip-b', start: 1, duration: 1 }),
      makeVideoClip({ id: 'clip-c', start: 2, duration: 1 })
    ]);

    expect(diffTimelineSnapshots(current, snapshot)).toEqual([{ start: 0, end: 3 }]);
  });
});
