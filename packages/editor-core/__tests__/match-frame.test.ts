import { describe, expect, it } from 'vitest';
import {
  calculateSourceTime,
  getClipMediaId,
  matchFrameFromClip,
  revealInTimeline,
  getMediaInstanceNavigation,
  navigateToNextInstance,
  type MatchFramePenetrationMode,
} from '../src/match-frame';
import type { Clip, NestedSequenceClip, Sequence, Timeline, Track, VideoClip, ImageClip, AudioClip } from '../src/model';

function makeVideoClip(overrides: Partial<VideoClip> = {}): VideoClip {
  return {
    id: 'clip-1',
    type: 'video',
    name: 'Test Clip',
    trackId: 'track-v',
    start: 0,
    duration: 10,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    mediaId: 'media-1',
    volume: 1,
    colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    ...overrides,
  };
}

function makeImageClip(overrides: Partial<ImageClip> = {}): ImageClip {
  return {
    id: 'img-1',
    type: 'image',
    name: 'Test Image',
    trackId: 'track-v',
    start: 0,
    duration: 5,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    mediaId: 'media-img',
    colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    ...overrides,
  };
}

function makeNestedClip(overrides: Partial<NestedSequenceClip> = {}): NestedSequenceClip {
  return {
    id: 'nested-1',
    type: 'nested-sequence',
    name: 'Nested',
    trackId: 'track-v',
    start: 0,
    duration: 10,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    sequenceId: 'seq-nested',
    volume: 1,
    colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    ...overrides,
  };
}

function makeTimeline(tracks: Track[]): Timeline {
  return { tracks, transitions: [], markers: [] };
}

describe('calculateSourceTime', () => {
  it('playhead at clip start returns trimStart', () => {
    expect(calculateSourceTime(0, 0, 1, 0)).toBe(0);
  });

  it('playhead at 5s with trimStart=0, speed=1 returns 5', () => {
    expect(calculateSourceTime(0, 0, 1, 5)).toBe(5);
  });

  it('trimStart=1s, playhead at clip start returns 1', () => {
    expect(calculateSourceTime(0, 1, 1, 0)).toBe(1);
  });

  it('speed=2x: playhead at 4s returns trimStart + 2', () => {
    expect(calculateSourceTime(0, 0, 2, 4)).toBe(2);
  });

  it('speed=2x with trimStart=1s', () => {
    expect(calculateSourceTime(0, 1, 2, 4)).toBe(3);
  });

  it('playhead before clip start clamps to 0', () => {
    expect(calculateSourceTime(5, 0, 1, 3)).toBe(0);
  });

  it('handles zero speed safely (treated as 1)', () => {
    expect(calculateSourceTime(0, 0, 0, 5)).toBe(5);
  });

  it('negative speed treated as 1', () => {
    expect(calculateSourceTime(0, 0, -1, 5)).toBe(5);
  });
});

describe('getClipMediaId', () => {
  it('returns mediaId for video clip', () => {
    expect(getClipMediaId(makeVideoClip())).toBe('media-1');
  });

  it('returns mediaId for image clip', () => {
    expect(getClipMediaId(makeImageClip())).toBe('media-img');
  });

  it('returns undefined for text clip', () => {
    const textClip: Clip = {
      id: 't1', type: 'text', name: 'Text', trackId: 't',
      start: 0, duration: 3, trimStart: 0, trimEnd: 0, speed: 1,
      colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      content: 'Hello', fontSize: 24, fontColor: '#fff', fontFamily: 'sans-serif',
    };
    expect(getClipMediaId(textClip)).toBeUndefined();
  });
});

describe('matchFrameFromClip', () => {
  it('returns sourceTime for a simple video clip at playhead=0', () => {
    const track: Track = { id: 'track-v', type: 'video', name: 'V1', clips: [makeVideoClip()] };
    const result = matchFrameFromClip({
      timeline: makeTimeline([track]),
      clipId: 'clip-1',
      playheadTime: 0,
    });
    expect(result).toBeDefined();
    expect(result!.sourceTime).toBe(0);
    expect(result!.mediaId).toBe('media-1');
  });

  it('returns sourceTime with trimStart=1s at playhead=0 -> 1', () => {
    const track: Track = { id: 'track-v', type: 'video', name: 'V1', clips: [makeVideoClip({ trimStart: 1 })] };
    const result = matchFrameFromClip({
      timeline: makeTimeline([track]),
      clipId: 'clip-1',
      playheadTime: 0,
    });
    expect(result!.sourceTime).toBe(1);
  });

  it('returns sourceTime with speed=2x at playhead=4 -> 2', () => {
    const track: Track = { id: 'track-v', type: 'video', name: 'V1', clips: [makeVideoClip({ speed: 2 })] };
    const result = matchFrameFromClip({
      timeline: makeTimeline([track]),
      clipId: 'clip-1',
      playheadTime: 4,
    });
    expect(result!.sourceTime).toBe(2);
  });

  it('returns undefined for non-existent clipId', () => {
    const track: Track = { id: 'track-v', type: 'video', name: 'V1', clips: [makeVideoClip()] };
    const result = matchFrameFromClip({
      timeline: makeTimeline([track]),
      clipId: 'nonexistent',
      playheadTime: 0,
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined for text clip (no mediaId)', () => {
    const textClip: Clip = {
      id: 't1', type: 'text', name: 'Text', trackId: 't',
      start: 0, duration: 3, trimStart: 0, trimEnd: 0, speed: 1,
      colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      content: 'Hello', fontSize: 24, fontColor: '#fff', fontFamily: 'sans-serif',
    };
    const track: Track = { id: 't', type: 'text', name: 'T1', clips: [textClip] };
    const result = matchFrameFromClip({
      timeline: makeTimeline([track]),
      clipId: 't1',
      playheadTime: 0,
    });
    expect(result).toBeUndefined();
  });
});

describe('matchFrameFromClip - nested penetration', () => {
  const nestedClip = makeNestedClip({ id: 'nested-1', sequenceId: 'seq-nested', start: 0, duration: 10, trimStart: 0 });
  const innerVideoClip = makeVideoClip({ id: 'inner-clip', mediaId: 'media-inner', start: 0, duration: 10, trimStart: 0 });
  const innerTrack: Track = { id: 'inner-track', type: 'video', name: 'Inner V', clips: [innerVideoClip] };
  const nestedSeq: Sequence = { id: 'seq-nested', name: 'Nested', timeline: makeTimeline([innerTrack]) };
  const outerTrack: Track = { id: 'outer-track', type: 'video', name: 'Outer V', clips: [nestedClip] };
  const outerTimeline = makeTimeline([outerTrack]);

  it('penetrationMode=nested returns nested sequence info', () => {
    const result = matchFrameFromClip({
      timeline: outerTimeline,
      clipId: 'nested-1',
      playheadTime: 5,
      sequences: [nestedSeq],
      penetrationMode: 'nested',
    });
    expect(result).toBeDefined();
    expect(result!.clipId).toBe('nested-1');
    expect(result!.sequenceId).toBe('seq-nested');
    expect(result!.sourceTime).toBe(5);
  });

  it('penetrationMode=source resolves to inner media', () => {
    const result = matchFrameFromClip({
      timeline: outerTimeline,
      clipId: 'nested-1',
      playheadTime: 5,
      sequences: [nestedSeq],
      penetrationMode: 'source',
    });
    expect(result).toBeDefined();
    expect(result!.mediaId).toBe('media-inner');
    expect(result!.clipId).toBe('inner-clip');
  });

  it('penetrationMode=source with nested trimStart adjusts inner time', () => {
    const nestedClipTrimmed = makeNestedClip({ id: 'nested-t', sequenceId: 'seq-nested', start: 0, duration: 10, trimStart: 2 });
    const outerTrackT: Track = { id: 'outer-track', type: 'video', name: 'Outer V', clips: [nestedClipTrimmed] };
    const result = matchFrameFromClip({
      timeline: makeTimeline([outerTrackT]),
      clipId: 'nested-t',
      playheadTime: 0,
      sequences: [nestedSeq],
      penetrationMode: 'source',
    });
    expect(result).toBeDefined();
    expect(result!.sourceTime).toBe(2);
  });
});

describe('revealInTimeline', () => {
  it('finds single instance of a media', () => {
    const track: Track = { id: 'track-v', type: 'video', name: 'V1', clips: [makeVideoClip({ id: 'c1', mediaId: 'media-1' })] };
    const result = revealInTimeline(makeTimeline([track]), 'media-1');
    expect(result.instances).toHaveLength(1);
    expect(result.instances[0].clipId).toBe('c1');
  });

  it('finds multiple instances of same media', () => {
    const clip1 = makeVideoClip({ id: 'c1', mediaId: 'media-1', start: 0 });
    const clip2 = makeVideoClip({ id: 'c2', mediaId: 'media-1', start: 10 });
    const track: Track = { id: 'track-v', type: 'video', name: 'V1', clips: [clip1, clip2] };
    const result = revealInTimeline(makeTimeline([track]), 'media-1');
    expect(result.instances).toHaveLength(2);
  });

  it('returns empty for unused media', () => {
    const track: Track = { id: 'track-v', type: 'video', name: 'V1', clips: [makeVideoClip({ mediaId: 'other' })] };
    const result = revealInTimeline(makeTimeline([track]), 'media-1');
    expect(result.instances).toHaveLength(0);
  });

  it('finds instances across multiple sequences', () => {
    const clip1 = makeVideoClip({ id: 'c1', mediaId: 'media-1', start: 0 });
    const track1: Track = { id: 'track-1', type: 'video', name: 'V1', clips: [clip1] };
    const clip2 = makeVideoClip({ id: 'c2', mediaId: 'media-1', start: 0 });
    const track2: Track = { id: 'track-2', type: 'video', name: 'V2', clips: [clip2] };
    const seq: Sequence = { id: 'seq-2', name: 'Seq 2', timeline: makeTimeline([track2]) };
    const result = revealInTimeline(makeTimeline([track1]), 'media-1', [seq]);
    expect(result.instances).toHaveLength(2);
  });
});

describe('getMediaInstanceNavigation', () => {
  it('returns correct index and total for 3 instances', () => {
    const clips = [
      makeVideoClip({ id: 'c1', mediaId: 'media-1', start: 0 }),
      makeVideoClip({ id: 'c2', mediaId: 'media-1', start: 10 }),
      makeVideoClip({ id: 'c3', mediaId: 'media-1', start: 20 }),
    ];
    const track: Track = { id: 'track-v', type: 'video', name: 'V1', clips };
    const nav = getMediaInstanceNavigation(makeTimeline([track]), 'media-1', 'c2');
    expect(nav.total).toBe(3);
    expect(nav.currentIndex).toBe(1);
  });

  it('returns total=0 when no instances', () => {
    const track: Track = { id: 'track-v', type: 'video', name: 'V1', clips: [] };
    const nav = getMediaInstanceNavigation(makeTimeline([track]), 'media-1', 'c1');
    expect(nav.total).toBe(0);
    expect(nav.currentIndex).toBe(0);
  });
});

describe('navigateToNextInstance', () => {
  it('navigates to next instance in circular fashion', () => {
    const clips = [
      makeVideoClip({ id: 'c1', mediaId: 'media-1', start: 0 }),
      makeVideoClip({ id: 'c2', mediaId: 'media-1', start: 10 }),
      makeVideoClip({ id: 'c3', mediaId: 'media-1', start: 20 }),
    ];
    const track: Track = { id: 'track-v', type: 'video', name: 'V1', clips };
    expect(navigateToNextInstance(makeTimeline([track]), 'media-1', 'c1')).toBe('c2');
    expect(navigateToNextInstance(makeTimeline([track]), 'media-1', 'c3')).toBe('c1');
  });

  it('returns undefined for single instance', () => {
    const track: Track = { id: 'track-v', type: 'video', name: 'V1', clips: [makeVideoClip()] };
    expect(navigateToNextInstance(makeTimeline([track]), 'media-1', 'clip-1')).toBeUndefined();
  });
});
