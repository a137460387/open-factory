import { describe, expect, it } from 'vitest';
import {
  TimelineRenderFrameCache,
  buildTimelineRenderFrameKey,
  buildTimelineRenderFrameRequests,
  getTimelineRenderInvalidationRanges,
  mergeTimelineRenderRanges
} from '../src';
import { makeAudioClip, makeProject, makeSubtitleClip, makeTextClip, makeTimeline, makeVideoClip } from './test-utils';

describe('timeline render cache', () => {
  it('builds stable frame keys that change with frame, media identity, timeline edits, and canvas size', () => {
    const project = makeProject();
    const base = {
      timeline: project.timeline,
      media: project.media,
      frame: 12,
      fps: 30,
      width: 1280,
      height: 720
    };
    const key = buildTimelineRenderFrameKey(base);

    expect(buildTimelineRenderFrameKey(base)).toBe(key);
    expect(buildTimelineRenderFrameKey({ ...base, frame: 13 })).not.toBe(key);
    expect(buildTimelineRenderFrameKey({ ...base, width: 640 })).not.toBe(key);
    expect(buildTimelineRenderFrameKey({ ...base, media: [{ ...project.media[0], mtimeMs: 2000 }] })).not.toBe(key);
    expect(
      buildTimelineRenderFrameKey({
        ...base,
        timeline: makeTimeline([makeVideoClip({ transform: { opacity: 0.5 } })])
      })
    ).not.toBe(key);
  });

  it('plans a five-second prerender window on both sides of the playhead', () => {
    const project = makeProject();
    const requests = buildTimelineRenderFrameRequests({
      timeline: project.timeline,
      media: project.media,
      playheadTime: 6,
      duration: 20,
      fps: 2,
      width: 1280,
      height: 720
    });

    expect(requests[0]).toMatchObject({ frame: 2, time: 1 });
    expect(requests.at(-1)).toMatchObject({ frame: 22, time: 11 });
    expect(new Set(requests.map((request) => request.key)).size).toBe(requests.length);
  });

  it('clamps frame request windows and normalizes invalid dimensions and frame rates', () => {
    const project = makeProject();
    const requests = buildTimelineRenderFrameRequests({
      timeline: project.timeline,
      media: project.media,
      playheadTime: 99,
      duration: 1,
      fps: Number.NaN,
      width: -1,
      height: 0,
      beforeSeconds: 0,
      afterSeconds: 0
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].frame).toBe(30);
    expect(requests[0].key).toContain(':1280x720:30:30');
    expect(
      buildTimelineRenderFrameKey({
        timeline: project.timeline,
        media: project.media,
        frame: -1,
        fps: 0,
        width: 0,
        height: -100
      })
    ).toContain(':1280x720:30:0');
  });

  it('includes sequence signatures and active sequence id in frame keys', () => {
    const project = makeProject();
    const base = {
      timeline: project.timeline,
      media: project.media,
      frame: 1,
      fps: 30,
      width: 1280,
      height: 720,
      activeSequenceId: 'sequence-main',
      sequences: [{ id: 'sequence-main', name: 'Main', timeline: project.timeline }]
    };
    const key = buildTimelineRenderFrameKey(base);

    expect(buildTimelineRenderFrameKey({ ...base, activeSequenceId: 'sequence-alt' })).not.toBe(key);
    expect(
      buildTimelineRenderFrameKey({
        ...base,
        sequences: [{ id: 'sequence-main', name: 'Main', timeline: makeTimeline([makeTextClip({ text: 'Nested edit' })]) }]
      })
    ).not.toBe(key);
  });

  it('evicts outside the ten-second retain window and prunes least-recently-used frames over budget', () => {
    const disposed: string[] = [];
    const cache = new TimelineRenderFrameCache<string>({ maxBytes: 10, disposeBitmap: (value) => disposed.push(value) });

    cache.put({ key: 'a', bitmap: 'bitmap-a', time: 0, duration: 0.1, bytes: 4 }, 1);
    cache.put({ key: 'b', bitmap: 'bitmap-b', time: 1, duration: 0.1, bytes: 4 }, 2);
    cache.get('a', 10);
    cache.put({ key: 'c', bitmap: 'bitmap-c', time: 2, duration: 0.1, bytes: 4 }, 3);

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
    expect(disposed).toContain('bitmap-b');

    cache.retainAround(20, 10);
    expect(cache.size).toBe(0);
    expect(disposed).toEqual(expect.arrayContaining(['bitmap-a', 'bitmap-c']));
  });

  it('replaces duplicate keys, normalizes entry values, invalidates reversed ranges, and clears frames', () => {
    const disposed: string[] = [];
    const cache = new TimelineRenderFrameCache<string>({ maxBytes: 100, disposeBitmap: (value) => disposed.push(value) });

    expect(cache.get('missing')).toBeUndefined();
    cache.put({ key: 'same', bitmap: 'old', time: -1, duration: -1, bytes: 0 });
    cache.put({ key: 'same', bitmap: 'new', time: 3, duration: 0, bytes: 2 });
    cache.put({ key: 'later', bitmap: 'later', time: 8, duration: 1, bytes: 2 });

    expect(cache.sizeBytes).toBe(4);
    expect(disposed).toContain('old');
    expect(cache.snapshot().ranges).toEqual([
      { start: 3, end: 3.000001 },
      { start: 8, end: 9 }
    ]);

    cache.invalidateRange(9, 7);
    expect(cache.has('later')).toBe(false);
    expect(cache.has('same')).toBe(true);
    expect(cache.clear()).toEqual({ ranges: [], bytes: 0, count: 0 });
    expect(cache.sizeBytes).toBe(0);
  });

  it('invalidates only changed clip segments and merges overlapping ranges', () => {
    const previous = makeTimeline([
      makeVideoClip({ id: 'clip-a', start: 0, duration: 5 }),
      makeTextClip({ id: 'clip-b', start: 4, duration: 3 })
    ]);
    const next = makeTimeline([
      makeVideoClip({ id: 'clip-a', start: 0, duration: 5, transform: { opacity: 0.5 } }),
      makeTextClip({ id: 'clip-b', start: 4, duration: 3, text: 'Changed' })
    ]);

    expect(getTimelineRenderInvalidationRanges(previous, next)).toEqual([{ start: 0, end: 7 }]);
    expect(getTimelineRenderInvalidationRanges(previous, previous)).toEqual([]);
  });

  it('invalidates added, removed, and transition-mutated regions', () => {
    const previous = makeTimeline([
      makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }),
      makeAudioClip({ id: 'clip-audio', start: 5, duration: 2 })
    ]);
    const next = {
      ...makeTimeline([makeVideoClip({ id: 'clip-b', start: 3, duration: 2 })]),
      transitions: [{ id: 'transition-a', type: 'dissolve' as const, duration: 0.5, fromClipId: 'clip-a', toClipId: 'clip-b' }]
    };

    expect(getTimelineRenderInvalidationRanges(previous, next)).toEqual([{ start: 0, end: 7 }]);
  });

  it('builds signatures for every renderable clip subtype', () => {
    const project = makeProject();
    const timeline = makeTimeline([
      makeVideoClip({ id: 'clip-video', start: 0, duration: 1 }),
      makeAudioClip({ id: 'clip-audio', start: 1, duration: 1 }),
      makeTextClip({ id: 'clip-text', start: 2, duration: 1 }),
      makeSubtitleClip({ id: 'clip-subtitle', start: 3, duration: 1 })
    ]);
    const key = buildTimelineRenderFrameKey({
      timeline,
      media: project.media,
      frame: 1,
      fps: 30,
      width: 1280,
      height: 720
    });

    expect(key).toMatch(/^timeline-render:/);
    expect(
      buildTimelineRenderFrameKey({
        timeline: makeTimeline([makeSubtitleClip({ id: 'clip-subtitle', start: 3, duration: 1, subtitleMode: 'soft-sub' })]),
        media: project.media,
        frame: 1,
        fps: 30,
        width: 1280,
        height: 720
      })
    ).not.toBe(key);
  });

  it('merges reversed, adjacent, and overlapping ranges while dropping empty ranges', () => {
    expect(
      mergeTimelineRenderRanges([
        { start: 5, end: 3 },
        { start: 0, end: 0 },
        { start: 3, end: 4 },
        { start: 4, end: 4.5 },
        { start: 10, end: 11 }
      ])
    ).toEqual([
      { start: 3, end: 5 },
      { start: 10, end: 11 }
    ]);
  });
});
