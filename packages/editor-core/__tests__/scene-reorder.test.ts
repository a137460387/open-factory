import { describe, expect, it } from 'vitest';
import {
  BatchReorderClipsCommand,
  CommandManager,
  buildSceneReorderStarts,
  buildSceneReorderClipIds,
  createFallbackSceneClipFeatures,
  extractSceneClipFeatures,
  orderSceneClipFeatures
} from '../src';
import { makeAccessor, makeTimeline, makeVideoClip } from './test-utils';

describe('scene reorder', () => {
  it('extracts normalized color histogram, brightness, and motion features from frame samples', () => {
    const feature = extractSceneClipFeatures({
      clipId: 'clip-a',
      duration: 2,
      frames: [
        {
          pixels: [
            [0, 0, 0],
            [255, 255, 255]
          ]
        },
        {
          pixels: [[255, 0, 0]],
          motionFromPrevious: 0.4
        }
      ]
    });

    expect(feature.analyzed).toBe(true);
    expect(feature.histogram.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 6);
    expect(feature.histogram[3]).toBeCloseTo(2 / 9, 6);
    expect(feature.brightness).toBeGreaterThan(0.3);
    expect(feature.motion).toBeCloseTo(0.4, 6);
  });

  it('orders clips with greedy nearest-neighbor color similarity', () => {
    const ordered = orderSceneClipFeatures(
      [
        createFallbackSceneClipFeatures({ clipId: 'red-a', duration: 1, color: [240, 20, 20] }),
        createFallbackSceneClipFeatures({ clipId: 'green-a', duration: 1, color: [20, 240, 20] }),
        createFallbackSceneClipFeatures({ clipId: 'red-b', duration: 1, color: [230, 25, 25] }),
        createFallbackSceneClipFeatures({ clipId: 'green-b', duration: 1, color: [25, 230, 25] })
      ],
      'color-similar'
    );

    expect(ordered.map((feature) => feature.clipId)).toEqual(['red-a', 'red-b', 'green-a', 'green-b']);
  });

  it('keeps brightness ordering stable in both directions', () => {
    const features = [
      createFallbackSceneClipFeatures({ clipId: 'middle-a', duration: 1, brightness: 0.5 }),
      createFallbackSceneClipFeatures({ clipId: 'dark', duration: 1, brightness: 0.1 }),
      createFallbackSceneClipFeatures({ clipId: 'middle-b', duration: 1, brightness: 0.5 }),
      createFallbackSceneClipFeatures({ clipId: 'bright', duration: 1, brightness: 0.9 })
    ];

    expect(orderSceneClipFeatures(features, 'brightness-asc').map((feature) => feature.clipId)).toEqual(['dark', 'middle-a', 'middle-b', 'bright']);
    expect(orderSceneClipFeatures(features, 'brightness-desc').map((feature) => feature.clipId)).toEqual(['bright', 'middle-a', 'middle-b', 'dark']);
  });

  it('places low-motion clips at the ends for motion rhythm', () => {
    const ordered = orderSceneClipFeatures(
      [
        createFallbackSceneClipFeatures({ clipId: 'calm-a', duration: 1, motion: 0.05 }),
        createFallbackSceneClipFeatures({ clipId: 'active', duration: 1, motion: 0.9 }),
        createFallbackSceneClipFeatures({ clipId: 'medium', duration: 1, motion: 0.45 }),
        createFallbackSceneClipFeatures({ clipId: 'calm-b', duration: 1, motion: 0.1 }),
        createFallbackSceneClipFeatures({ clipId: 'peak', duration: 1, motion: 1 })
      ],
      'motion-rhythm'
    );

    expect(ordered.map((feature) => feature.clipId)).toEqual(['calm-a', 'medium', 'peak', 'active', 'calm-b']);
  });

  it('alternates long and short clips for duration balance', () => {
    const ordered = orderSceneClipFeatures(
      [
        createFallbackSceneClipFeatures({ clipId: 'medium', duration: 5 }),
        createFallbackSceneClipFeatures({ clipId: 'short', duration: 1 }),
        createFallbackSceneClipFeatures({ clipId: 'long', duration: 8 }),
        createFallbackSceneClipFeatures({ clipId: 'mid-short', duration: 2 })
      ],
      'duration-balance'
    );

    expect(ordered.map((feature) => feature.clipId)).toEqual(['long', 'short', 'medium', 'mid-short']);
  });

  it('maps ordered selected ids into their current storyboard slots', () => {
    expect(buildSceneReorderClipIds(['a', 'b', 'c', 'd'], ['b', 'd'], ['d', 'b'])).toEqual(['a', 'd', 'c', 'b']);
    expect(buildSceneReorderClipIds(['a', 'b', 'c'], ['b', 'c'], ['c'])).toEqual(['a', 'b', 'c']);
  });

  it('normalizes empty and fallback feature inputs defensively', () => {
    const empty = extractSceneClipFeatures({
      clipId: 'empty',
      duration: -1,
      frames: [{ pixels: [] }]
    });
    expect(empty).toMatchObject({ clipId: 'empty', brightness: 0, motion: 0, duration: 0, analyzed: false });

    const fallback = createFallbackSceneClipFeatures({
      clipId: 'fallback',
      duration: -3,
      brightness: 4,
      motion: -2,
      color: [999, -10, Number.NaN]
    });
    expect(fallback.brightness).toBe(1);
    expect(fallback.motion).toBe(0);
    expect(fallback.duration).toBe(0);
    expect(fallback.histogram.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 6);
  });

  it('reorders selected storyboard clips as one undoable command', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'clip-a', start: 0, duration: 1 }),
        makeVideoClip({ id: 'clip-b', start: 1, duration: 1 }),
        makeVideoClip({ id: 'clip-c', start: 2, duration: 1 }),
        makeVideoClip({ id: 'clip-d', start: 3, duration: 1 })
      ])
    );
    const manager = new CommandManager();
    const starts = buildSceneReorderStarts(accessor.current(), ['clip-a', 'clip-b', 'clip-c', 'clip-d'], ['clip-d', 'clip-c', 'clip-b', 'clip-a']);

    manager.execute(new BatchReorderClipsCommand(accessor, starts));
    expect(timelineOrder(accessor.current())).toEqual(['clip-d', 'clip-c', 'clip-b', 'clip-a']);

    manager.undo();
    expect(timelineOrder(accessor.current())).toEqual(['clip-a', 'clip-b', 'clip-c', 'clip-d']);
  });
});

function timelineOrder(timeline: ReturnType<ReturnType<typeof makeAccessor>['current']>): string[] {
  return [...timeline.tracks[0].clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id)).map((clip) => clip.id);
}
