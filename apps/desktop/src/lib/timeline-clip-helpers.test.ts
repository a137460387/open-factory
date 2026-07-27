import { describe, it, expect } from 'vitest';
import {
  isPiPVisualClip,
  isSceneReorderClip,
  collectClipKeyframeRefs,
  getSubtitleDataImportTargetTrackId,
  getClipSourceDimensions,
} from '../timeline-clip-helpers';
import type { Clip, Track, Timeline, Project } from '@open-factory/editor-core';

function makeVideoClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    type: 'video',
    start: 0,
    duration: 5,
    trimStart: 0,
    mediaId: 'media-1',
    volume: 1,
    keyframes: {},
    ...overrides,
  } as Clip;
}

function makeImageClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-img',
    type: 'image',
    start: 0,
    duration: 3,
    trimStart: 0,
    mediaId: 'media-img',
    keyframes: {},
    ...overrides,
  } as Clip;
}

function makeAudioClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-audio',
    type: 'audio',
    start: 0,
    duration: 5,
    trimStart: 0,
    mediaId: 'media-audio',
    volume: 1,
    keyframes: {},
    ...overrides,
  } as Clip;
}

function makeSubtitleClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-sub',
    type: 'subtitle',
    start: 0,
    duration: 2,
    trimStart: 0,
    text: 'hello',
    keyframes: {},
    ...overrides,
  } as Clip;
}

function makeNestedSequenceClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-nested',
    type: 'nested-sequence',
    start: 0,
    duration: 5,
    trimStart: 0,
    keyframes: {},
    ...overrides,
  } as Clip;
}

describe('timeline-clip-helpers', () => {
  describe('isPiPVisualClip', () => {
    it('returns true for video clips', () => {
      expect(isPiPVisualClip(makeVideoClip())).toBe(true);
    });

    it('returns true for image clips', () => {
      expect(isPiPVisualClip(makeImageClip())).toBe(true);
    });

    it('returns true for nested-sequence clips', () => {
      expect(isPiPVisualClip(makeNestedSequenceClip())).toBe(true);
    });

    it('returns false for audio clips', () => {
      expect(isPiPVisualClip(makeAudioClip())).toBe(false);
    });

    it('returns false for subtitle clips', () => {
      expect(isPiPVisualClip(makeSubtitleClip())).toBe(false);
    });
  });

  describe('isSceneReorderClip', () => {
    it('returns true for video clips', () => {
      expect(isSceneReorderClip(makeVideoClip())).toBe(true);
    });

    it('returns true for image clips', () => {
      expect(isSceneReorderClip(makeImageClip())).toBe(true);
    });

    it('returns false for audio clips', () => {
      expect(isSceneReorderClip(makeAudioClip())).toBe(false);
    });

    it('returns false for nested-sequence clips', () => {
      expect(isSceneReorderClip(makeNestedSequenceClip())).toBe(false);
    });
  });

  describe('collectClipKeyframeRefs', () => {
    it('returns empty array when no keyframes', () => {
      const clip = makeVideoClip({ keyframes: {} });
      expect(collectClipKeyframeRefs(clip)).toEqual([]);
    });

    it('returns refs for keyframes', () => {
      const clip = makeVideoClip({
        keyframes: {
          opacity: [
            { id: 'kf-1', time: 0, value: 1 } as any,
            { id: 'kf-2', time: 1, value: 0.5 } as any,
          ],
          scale: [
            { id: 'kf-3', time: 0, value: 1 } as any,
          ],
        },
      });
      const refs = collectClipKeyframeRefs(clip);
      expect(refs).toHaveLength(3);
      expect(refs[0]).toEqual({ clipId: 'clip-1', property: 'opacity', keyframeId: 'kf-1' });
      expect(refs[1]).toEqual({ clipId: 'clip-1', property: 'opacity', keyframeId: 'kf-2' });
      expect(refs[2]).toEqual({ clipId: 'clip-1', property: 'scale', keyframeId: 'kf-3' });
    });

    it('handles undefined keyframes gracefully', () => {
      const clip = { id: 'c1', type: 'video' as const, start: 0, duration: 1, trimStart: 0 } as Clip;
      expect(collectClipKeyframeRefs(clip)).toEqual([]);
    });
  });

  describe('getSubtitleDataImportTargetTrackId', () => {
    it('returns undefined for new-track mode', () => {
      const timeline = { tracks: [] } as unknown as Timeline;
      expect(getSubtitleDataImportTargetTrackId(timeline, 'new-track', [])).toBeUndefined();
    });

    it('returns selected subtitle track when clips are selected', () => {
      const timeline = {
        tracks: [
          { id: 'track-1', type: 'subtitle', clips: [{ id: 'clip-1' }] },
          { id: 'track-2', type: 'subtitle', clips: [{ id: 'clip-2' }] },
        ],
      } as unknown as Timeline;
      expect(getSubtitleDataImportTargetTrackId(timeline, 'existing-track', ['clip-2'])).toBe('track-2');
    });

    it('falls back to first subtitle track when no selection matches', () => {
      const timeline = {
        tracks: [
          { id: 'track-video', type: 'video', clips: [] },
          { id: 'track-sub', type: 'subtitle', clips: [{ id: 'clip-sub' }] },
        ],
      } as unknown as Timeline;
      expect(getSubtitleDataImportTargetTrackId(timeline, 'existing-track', ['nonexistent'])).toBe('track-sub');
    });

    it('returns undefined when no subtitle tracks exist', () => {
      const timeline = {
        tracks: [
          { id: 'track-video', type: 'video', clips: [] },
        ],
      } as unknown as Timeline;
      expect(getSubtitleDataImportTargetTrackId(timeline, 'existing-track', [])).toBeUndefined();
    });
  });

  describe('getClipSourceDimensions', () => {
    const project = {
      settings: { width: 1920, height: 1080 },
      media: [
        { id: 'media-1', width: 3840, height: 2160 },
        { id: 'media-2', width: 0, height: 0 },
      ],
    } as unknown as Project;

    it('returns project dimensions for nested-sequence', () => {
      const clip = makeNestedSequenceClip();
      expect(getClipSourceDimensions(project, clip)).toEqual({ width: 1920, height: 1080 });
    });

    it('returns media dimensions for video clip with matching asset', () => {
      const clip = makeVideoClip({ mediaId: 'media-1' });
      expect(getClipSourceDimensions(project, clip)).toEqual({ width: 3840, height: 2160 });
    });

    it('falls back to project dimensions when media not found', () => {
      const clip = makeVideoClip({ mediaId: 'nonexistent' });
      expect(getClipSourceDimensions(project, clip)).toEqual({ width: 1920, height: 1080 });
    });

    it('uses project dimensions as minimum when media has zero dimensions', () => {
      const clip = makeVideoClip({ mediaId: 'media-2' });
      expect(getClipSourceDimensions(project, clip)).toEqual({ width: 1920, height: 1080 });
    });
  });
});
