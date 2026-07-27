import { describe, expect, it, vi } from 'vitest';
import {
  createClipFromAsset,
  createTextClip,
  createCreditsClip,
  createAdjustmentLayerClip,
  createMotionGraphicClip,
  findPreferredTrack,
} from '../clipFactory';
import type { MediaAsset, Track, Timeline } from '@open-factory/editor-core';

vi.mock('@open-factory/editor-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@open-factory/editor-core')>();
  return {
    ...actual,
    createId: () => 'test-clip-id',
  };
});

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track1',
    type: 'video',
    name: 'V1',
    clips: [],
    ...overrides,
  } as Track;
}

function makeTimeline(tracks: Track[] = [makeTrack()]): Timeline {
  return { tracks, duration: 0, transitions: [] } as Timeline;
}

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'asset1',
    name: 'test.mp4',
    type: 'video',
    path: '/test.mp4',
    duration: 10,
    width: 1920,
    height: 1080,
    ...overrides,
  } as MediaAsset;
}

describe('clipFactory', () => {
  describe('createClipFromAsset', () => {
    it('creates video clip from video asset', () => {
      const asset = makeAsset({ type: 'video', duration: 10 });
      const track = makeTrack();
      const timeline = makeTimeline();
      const clip = createClipFromAsset(asset, track, timeline);
      expect(clip.type).toBe('video');
      expect(clip.duration).toBe(10);
      expect(clip.name).toBe('test.mp4');
      expect(clip.trackId).toBe('track1');
    });

    it('creates audio clip from audio asset', () => {
      const asset = makeAsset({ type: 'audio', duration: 15 });
      const track = makeTrack({ type: 'audio' } as Partial<Track>);
      const timeline = makeTimeline([track]);
      const clip = createClipFromAsset(asset, track, timeline);
      expect(clip.type).toBe('audio');
      expect(clip.duration).toBe(15);
    });

    it('creates image clip with default 5s duration', () => {
      const asset = makeAsset({ type: 'image' });
      const track = makeTrack();
      const timeline = makeTimeline();
      const clip = createClipFromAsset(asset, track, timeline);
      expect(clip.type).toBe('image');
      expect(clip.duration).toBe(5);
    });

    it('uses subclip options when provided', () => {
      const asset = makeAsset({ type: 'video' });
      const track = makeTrack();
      const timeline = makeTimeline();
      const clip = createClipFromAsset(asset, track, timeline, {
        subclip: { id: 'sub1', inPoint: 2, outPoint: 8, name: 'Sub', mediaId: 'asset1' } as any,
        subclipName: 'My Subclip',
      });
      expect(clip.trimStart).toBe(2);
      expect(clip.duration).toBe(6);
      expect(clip.name).toBe('My Subclip');
    });

    it('appends after existing clips', () => {
      const existingClip = { id: 'c1', start: 0, duration: 10 } as any;
      const track = makeTrack({ clips: [existingClip] });
      const timeline = makeTimeline([track]);
      const asset = makeAsset();
      const clip = createClipFromAsset(asset, track, timeline);
      expect(clip.start).toBe(10);
    });
  });

  describe('createTextClip', () => {
    it('creates text clip with default properties', () => {
      const track = makeTrack();
      const timeline = makeTimeline();
      const clip = createTextClip(track, timeline);
      expect(clip.type).toBe('text');
      expect(clip.duration).toBe(5);
      expect(clip.trackId).toBe('track1');
    });
  });

  describe('createCreditsClip', () => {
    it('creates credits clip', () => {
      const track = makeTrack();
      const timeline = makeTimeline();
      const clip = createCreditsClip(track, timeline);
      expect(clip.type).toBe('credits');
      expect(clip.duration).toBe(8);
    });

    it('uses custom text', () => {
      const track = makeTrack();
      const timeline = makeTimeline();
      const clip = createCreditsClip(track, timeline, 'Custom Credits');
      expect(clip.type).toBe('credits');
    });

    it('uses custom start', () => {
      const track = makeTrack();
      const timeline = makeTimeline();
      const clip = createCreditsClip(track, timeline, undefined, 5);
      expect(clip.start).toBe(5);
    });
  });

  describe('createAdjustmentLayerClip', () => {
    it('creates adjustment clip', () => {
      const track = makeTrack();
      const timeline = makeTimeline();
      const clip = createAdjustmentLayerClip(track, timeline);
      expect(clip.type).toBe('adjustment');
    });
  });

  describe('createMotionGraphicClip', () => {
    it('creates motion graphic clip with countdown template', () => {
      const track = makeTrack();
      const timeline = makeTimeline();
      const clip = createMotionGraphicClip(track, timeline);
      expect(clip.type).toBe('motion-graphic');
      expect(clip.duration).toBe(5);
    });
  });

  describe('findPreferredTrack', () => {
    it('finds video track for video asset', () => {
      const timeline = makeTimeline([makeTrack({ type: 'video' }), makeTrack({ id: 'a1', type: 'audio' })]);
      const asset = makeAsset({ type: 'video' });
      const track = findPreferredTrack(timeline, asset);
      expect(track?.type).toBe('video');
    });

    it('finds audio track for audio asset', () => {
      const timeline = makeTimeline([makeTrack({ type: 'video' }), makeTrack({ id: 'a1', type: 'audio' })]);
      const asset = makeAsset({ type: 'audio' });
      const track = findPreferredTrack(timeline, asset);
      expect(track?.type).toBe('audio');
    });

    it('returns undefined when no matching track', () => {
      const timeline = makeTimeline([makeTrack({ type: 'video' })]);
      const asset = makeAsset({ type: 'audio' });
      const track = findPreferredTrack(timeline, asset);
      expect(track).toBeUndefined();
    });
  });
});
