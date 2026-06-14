import { describe, expect, it } from 'vitest';
import {
  ApplySplitLayoutCommand,
  BUILT_IN_SPLIT_LAYOUTS,
  calculateSplitLayoutTransforms,
  createMainSideSplitLayout,
  normalizeSplitLayoutDefinition,
  type Timeline
} from '../src';
import { makeAudioClip, makeTimeline, makeVideoClip } from './test-utils';

describe('split-screen layouts', () => {
  it('calculates side-by-side coordinates for equal-sized sources', () => {
    const transforms = calculateSplitLayoutTransforms({
      layout: BUILT_IN_SPLIT_LAYOUTS['side-by-side'],
      canvasWidth: 1280,
      canvasHeight: 720,
      clips: [
        { clipId: 'left', sourceWidth: 1280, sourceHeight: 720 },
        { clipId: 'right', sourceWidth: 1280, sourceHeight: 720 }
      ]
    });

    expect(transforms.map((item) => item.transform)).toMatchObject([
      { x: -320, y: 0, scaleX: 0.5, scaleY: 1 },
      { x: 320, y: 0, scaleX: 0.5, scaleY: 1 }
    ]);
  });

  it('calculates quad and three-column scale values', () => {
    const quad = calculateSplitLayoutTransforms({
      layout: BUILT_IN_SPLIT_LAYOUTS.quad,
      canvasWidth: 1280,
      canvasHeight: 720,
      clips: ['a', 'b', 'c', 'd'].map((clipId) => ({ clipId, sourceWidth: 1280, sourceHeight: 720 }))
    });
    expect(quad.map((item) => item.transform.scaleX)).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(quad.map((item) => item.transform.scaleY)).toEqual([0.5, 0.5, 0.5, 0.5]);

    const three = calculateSplitLayoutTransforms({
      layout: BUILT_IN_SPLIT_LAYOUTS['three-columns'],
      canvasWidth: 1200,
      canvasHeight: 600,
      clips: ['a', 'b', 'c'].map((clipId) => ({ clipId, sourceWidth: 1200, sourceHeight: 600 }))
    });
    expect(three.map((item) => item.transform.x)).toEqual([-400, 0, 400]);
    expect(three.map((item) => item.transform.scaleX)).toEqual([0.333, 0.333, 0.333]);
  });

  it('serializes custom main-side layouts with clamped ratios', () => {
    expect(createMainSideSplitLayout(' custom ', '  Review ', 0.9)).toEqual({
      id: 'custom',
      name: 'Review',
      cells: [
        { x: 0, y: 0, width: 0.8, height: 1 },
        { x: 0.8, y: 0, width: 0.2, height: 0.5 },
        { x: 0.8, y: 0.5, width: 0.2, height: 0.5 }
      ]
    });

    expect(
      normalizeSplitLayoutDefinition({
        id: ' saved ',
        name: ' Saved Layout ',
        cells: [
          { x: 0, y: 0, width: 0.5, height: 1 },
          { x: 0.5, y: 0, width: 0.7, height: 1 }
        ]
      })
    ).toEqual({
      id: 'saved',
      name: 'Saved Layout',
      cells: [
        { x: 0, y: 0, width: 0.5, height: 1 },
        { x: 0.5, y: 0, width: 0.5, height: 1 }
      ]
    });
  });

  it('applies layout through a command and undoes every transform', () => {
    let timeline: Timeline = makeTimeline([
      makeVideoClip({ id: 'clip-a', transform: { x: 10, scaleX: 1.2 } }),
      makeVideoClip({ id: 'clip-b', transform: { x: 20, scaleX: 1.2 } }),
      makeVideoClip({ id: 'clip-c', transform: { x: 30, scaleX: 1.2 } }),
      makeVideoClip({ id: 'clip-d', transform: { x: 40, scaleX: 1.2 } })
    ]);
    const command = new ApplySplitLayoutCommand(
      {
        getTimeline: () => timeline,
        setTimeline: (next) => {
          timeline = next;
        }
      },
      ['clip-a', 'clip-b', 'clip-c', 'clip-d'],
      {
        layout: BUILT_IN_SPLIT_LAYOUTS.quad,
        canvasWidth: 1280,
        canvasHeight: 720,
        sources: Object.fromEntries(['clip-a', 'clip-b', 'clip-c', 'clip-d'].map((id) => [id, { width: 1280, height: 720 }]))
      }
    );

    command.execute();
    expect(timeline.tracks[0].clips.map((clip) => clip.transform.scaleX)).toEqual([0.5, 0.5, 0.5, 0.5]);
    command.undo();
    expect(timeline.tracks[0].clips.map((clip) => clip.transform.x)).toEqual([10, 20, 30, 40]);
  });

  it('rejects non-visual clips', () => {
    let timeline: Timeline = makeTimeline([makeVideoClip({ id: 'clip-a' })]);
    timeline.tracks[1].clips = [makeAudioClip({ id: 'clip-audio', trackId: 'track-audio' })];
    const command = new ApplySplitLayoutCommand(
      {
        getTimeline: () => timeline,
        setTimeline: (next) => {
          timeline = next;
        }
      },
      ['clip-a', 'clip-audio'],
      { layout: BUILT_IN_SPLIT_LAYOUTS['side-by-side'], canvasWidth: 1280, canvasHeight: 720 }
    );

    expect(() => command.execute()).toThrow('visual clips');
  });
});
