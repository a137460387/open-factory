// 覆盖目标：apps/desktop/src/components/SmartRoughCut/smart-rough-cut-utils.ts
// 策略：纯函数直调，fixture 复用 Timeline hooks test-fixtures。
// 重点锁定：buildSceneCandidates 去重/钳制/1e-6 边界过滤/splitTime 仅非末段；
// buildBrollCandidates 排除选中 mediaId + missing、preferred 空时 fallback 放开；
// getRhythmBeatTimes project.beatMarkers≥2 短路 vs clip 级偏移排序。
import { describe, expect, it } from 'vitest';
import type { SmartRoughCutVisualClip } from '@open-factory/editor-core';
import {
  makeAsset,
  makeClip,
  makeProject,
  makeTrack,
} from '../Timeline/hooks/timeline/__tests__/test-fixtures';
import {
  buildBrollCandidates,
  buildSceneCandidates,
  formatSeconds,
  getClipMediaAsset,
  getPrimaryVisualClips,
  getRhythmBeatTimes,
  getTimelineClips,
  isVisualClip,
  sumSilentDuration,
} from './smart-rough-cut-utils';

function makeSilentRange(start: number, end: number): { start: number; end: number; duration: number } {
  return { start, end, duration: end - start };
}

describe('buildSceneCandidates', () => {
  it('returns a single segment without splitTime when no cuts are given', () => {
    const items = buildSceneCandidates([], 3);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'scene-0', start: 0, end: 3, splitTime: undefined, thumbnail: undefined });
  });

  it('builds one segment per cut point with splitTime only on non-final segments', () => {
    const items = buildSceneCandidates([1, 2], 3);
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.start)).toEqual([0, 1, 2]);
    expect(items.map((item) => item.end)).toEqual([1, 2, 3]);
    expect(items[0].splitTime).toBe(1);
    expect(items[1].splitTime).toBe(2);
    expect(items[2].splitTime).toBeUndefined();
  });

  it('deduplicates cut points that round to the same value', () => {
    const items = buildSceneCandidates([1, 1.0000000001, 2], 3);
    expect(items).toHaveLength(3);
    expect(items[0].splitTime).toBe(1);
    expect(items[1].splitTime).toBe(2);
  });

  it('clamps out-of-range cuts and filters them via the 1e-6 boundary rule', () => {
    const items = buildSceneCandidates([-5, 0, 0.000001, 3, 10], 3);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ start: 0, end: 3 });
  });

  it('sorts unordered cut points before building segments', () => {
    const items = buildSceneCandidates([2, 1], 3);
    expect(items.map((item) => item.start)).toEqual([0, 1, 2]);
  });

  it('passes thumbnail through to every candidate', () => {
    const items = buildSceneCandidates([1], 3, 'thumb.png');
    expect(items.every((item) => item.thumbnail === 'thumb.png')).toBe(true);
  });
});

describe('buildBrollCandidates', () => {
  it('excludes assets already referenced by selected clips', () => {
    const selected = makeClip({ id: 'c1', mediaId: 'media-a' });
    const media = [makeAsset({ id: 'media-a' }), makeAsset({ id: 'media-b' })];
    const candidates = buildBrollCandidates(media, [selected]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ kind: 'media' });
    expect(candidates[0].kind === 'media' && candidates[0].asset.id).toBe('media-b');
  });

  it('excludes missing assets from the preferred set', () => {
    const media = [makeAsset({ id: 'media-a', missing: true }), makeAsset({ id: 'media-b' })];
    const candidates = buildBrollCandidates(media, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].kind === 'media' && candidates[0].asset.id).toBe('media-b');
  });

  it('falls back to all non-missing assets (including selected) when preferred is empty', () => {
    const selected = makeClip({ id: 'c1', mediaId: 'media-a' });
    const media = [makeAsset({ id: 'media-a' }), makeAsset({ id: 'media-b', missing: true })];
    const candidates = buildBrollCandidates(media, [selected]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].kind === 'media' && candidates[0].asset.id).toBe('media-a');
  });

  it('keeps filtering missing assets in the fallback set', () => {
    const selected = makeClip({ id: 'c1', mediaId: 'media-a' });
    const media = [
      makeAsset({ id: 'media-a', missing: true }),
      makeAsset({ id: 'media-b', missing: true }),
    ];
    expect(buildBrollCandidates(media, [selected])).toEqual([]);
  });

  it('filters out non-visual asset types', () => {
    const media = [makeAsset({ id: 'media-aud', type: 'audio' }), makeAsset({ id: 'media-img', type: 'image' })];
    const candidates = buildBrollCandidates(media, []);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].kind === 'media' && candidates[0].asset.id).toBe('media-img');
  });
});

describe('getRhythmBeatTimes', () => {
  it('short-circuits to project beat markers when at least two exist', () => {
    const project = makeProject();
    (project as { beatMarkers?: Array<{ id: string; time: number }> }).beatMarkers = [
      { id: 'b1', time: 1 },
      { id: 'b2', time: 2 },
      { id: 'b3', time: 4 },
    ];
    const clips = [makeClip({ id: 'c1', start: 100, beatMarkers: [{ id: 'cb1', time: 50 }] })];
    expect(getRhythmBeatTimes(project, clips)).toEqual([1, 2, 4]);
  });

  it('derives clip-level beats with clip.start offset when project markers are insufficient', () => {
    const project = makeProject();
    const clips = [
      makeClip({ id: 'c1', start: 10, beatMarkers: [{ id: 'cb1', time: 1 }, { id: 'cb2', time: 2 }] }),
      makeClip({ id: 'c2', start: 0, beatMarkers: [{ id: 'cb3', time: 0.5 }] }),
    ];
    expect(getRhythmBeatTimes(project, clips)).toEqual([0.5, 11, 12]);
  });

  it('sorts clip-level beats across clips', () => {
    const project = makeProject();
    const clips = [
      makeClip({ id: 'c1', start: 5, beatMarkers: [{ id: 'cb1', time: 3 }] }),
      makeClip({ id: 'c2', start: 0, beatMarkers: [{ id: 'cb2', time: 2 }] }),
    ];
    expect(getRhythmBeatTimes(project, clips)).toEqual([2, 8]);
  });

  it('treats missing project beatMarkers as empty', () => {
    const project = makeProject();
    expect('beatMarkers' in project).toBe(false);
    expect(getRhythmBeatTimes(project, [])).toEqual([]);
  });
});

describe('sumSilentDuration', () => {
  it('returns 0 for empty ranges', () => {
    expect(sumSilentDuration([])).toBe(0);
  });

  it('accumulates durations with rounding', () => {
    expect(sumSilentDuration([makeSilentRange(0, 1.25), makeSilentRange(2, 2.75)])).toBe(2);
  });
});

describe('getPrimaryVisualClips', () => {
  it('returns the selected visual clips unchanged when provided', () => {
    const selected = [makeClip({ id: 'c1', type: 'video' })] as SmartRoughCutVisualClip[];
    const timeline = makeProject().timeline;
    expect(getPrimaryVisualClips(timeline, selected)).toBe(selected);
  });

  it('falls back to visual clips of the first video track when nothing is selected', () => {
    const videoClip = makeClip({ id: 'c1', type: 'video' });
    const imageClip = makeClip({ id: 'c2', type: 'image' });
    const audioClip = makeClip({ id: 'c3', type: 'audio' });
    const timeline = makeProject({
      tracks: [
        makeTrack({ id: 'track-audio', type: 'audio', clips: [audioClip] }),
        makeTrack({ id: 'track-video', type: 'video', clips: [videoClip, imageClip] }),
      ],
    }).timeline;
    const result = getPrimaryVisualClips(timeline, []);
    expect(result.map((clip) => clip.id)).toEqual(['c1', 'c2']);
  });

  it('returns an empty array when there is no video track', () => {
    const timeline = makeProject({
      tracks: [makeTrack({ id: 'track-audio', type: 'audio' })],
    }).timeline;
    expect(getPrimaryVisualClips(timeline, [])).toEqual([]);
  });
});

describe('getTimelineClips', () => {
  it('flattens clips across all tracks', () => {
    const timeline = makeProject({
      tracks: [
        makeTrack({ id: 't1', clips: [makeClip({ id: 'c1' })] }),
        makeTrack({ id: 't2', clips: [makeClip({ id: 'c2' }), makeClip({ id: 'c3' })] }),
      ],
    }).timeline;
    expect(getTimelineClips(timeline).map((clip) => clip.id)).toEqual(['c1', 'c2', 'c3']);
  });
});

describe('isVisualClip', () => {
  it('accepts video and image clips', () => {
    expect(isVisualClip(makeClip({ type: 'video' }))).toBe(true);
    expect(isVisualClip(makeClip({ type: 'image' }))).toBe(true);
  });

  it('rejects audio and text clips', () => {
    expect(isVisualClip(makeClip({ type: 'audio' }))).toBe(false);
    expect(isVisualClip(makeClip({ type: 'text' }))).toBe(false);
  });
});

describe('getClipMediaAsset', () => {
  it('resolves the asset matching the clip mediaId', () => {
    const media = [makeAsset({ id: 'media-a' }), makeAsset({ id: 'media-b' })];
    const clip = makeClip({ id: 'c1', mediaId: 'media-b' });
    expect(getClipMediaAsset(clip, media)?.id).toBe('media-b');
  });

  it('returns undefined when the clip has no mediaId (e.g. text clip)', () => {
    const media = [makeAsset({ id: 'media-a' })];
    const clip = makeClip({ id: 'c1' });
    delete (clip as { mediaId?: string }).mediaId;
    expect(getClipMediaAsset(clip, media)).toBeUndefined();
  });

  it('returns undefined when no asset matches or clip is missing', () => {
    expect(getClipMediaAsset(makeClip({ id: 'c1', mediaId: 'media-x' }), [])).toBeUndefined();
    expect(getClipMediaAsset(undefined, [])).toBeUndefined();
  });
});

describe('formatSeconds', () => {
  it('formats with two decimals and an s suffix', () => {
    expect(formatSeconds(1.23456)).toBe('1.23s');
    expect(formatSeconds(0)).toBe('0.00s');
  });
});
