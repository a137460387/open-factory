import { describe, it, expect } from 'vitest';
import { analyzeMedia, analyzeMediaBatch, adaptTemplateToContent, createSmartAdaptation } from './template-adapter';
import type { MediaAsset } from '../model-types';
import type { EditingTemplate } from '../models/template-schema';

function makeMedia(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'media-1', type: 'video', name: 'clip.mp4', path: '/clip.mp4',
    duration: 30, width: 1920, height: 1080, frameRate: 30, hasAudio: true,
    ...overrides,
  };
}

function makeClip(dur = 10) {
  return {
    type: 'video' as const, durationSec: dur, flexibleDuration: true,
    placeholder: 'user-video' as const, placeholderParams: {},
    effects: [], keyframes: [], colorNodes: [],
    opacity: 1, speed: 1, volume: 1,
  };
}

function makeTemplate(overrides: Partial<EditingTemplate> = {}): EditingTemplate {
  return {
    metadata: {
      id: 'tpl-1', version: '1.0', name: 'Test Template', description: '',
      category: 'vlog', tags: [], author: 'test',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      aspectRatio: '16:9', resolutionWidth: 1920, resolutionHeight: 1080,
      frameRate: 30, estimatedDurationSec: 20, difficulty: 'beginner',
    },
    tracks: [{
      type: 'video', name: 'main', clips: [makeClip(10), makeClip(10)],
      transitions: [], trackEffects: [], muted: false, locked: false,
    }],
    audioLayout: {
      tracks: [{ role: 'music', volumeDb: -18, pan: 0, fadeInSec: 0.5, fadeOutSec: 0.5 }],
      masterLoudnessTarget: -14, masterLimiter: true,
    },
    globalColorNodes: [], variables: [], ...overrides,
  };
}

describe('Template Adapter', () => {
  describe('analyzeMedia', () => {
    it('extracts duration and dimensions from video', () => {
      const result = analyzeMedia(makeMedia({ duration: 45, width: 3840, height: 2160 }));
      expect(result.mediaId).toBe('media-1');
      expect(result.durationSec).toBe(45);
      expect(result.width).toBe(3840);
      expect(result.height).toBe(2160);
      expect(result.hasAudio).toBe(true);
    });

    it('returns null visualComplexity for audio-only media', () => {
      const result = analyzeMedia(makeMedia({ type: 'audio', width: 0, height: 0 }));
      expect(result.visualComplexity).toBeNull();
      expect(result.audioFeatures).not.toBeNull();
    });

    it('detects hasAudio from hasAudio flag or type', () => {
      expect(analyzeMedia(makeMedia({ type: 'video', hasAudio: false })).hasAudio).toBe(false);
      expect(analyzeMedia(makeMedia({ type: 'audio', hasAudio: undefined })).hasAudio).toBe(true);
    });
  });

  describe('analyzeMediaBatch', () => {
    it('analyzes multiple assets in order', () => {
      const assets = [makeMedia({ id: 'a1', duration: 10 }), makeMedia({ id: 'a2', duration: 20 })];
      const results = analyzeMediaBatch(assets);
      expect(results).toHaveLength(2);
      expect(results[0].mediaId).toBe('a1');
      expect(results[1].mediaId).toBe('a2');
    });

    it('returns empty array for empty input', () => {
      expect(analyzeMediaBatch([])).toEqual([]);
    });
  });

  describe('adaptTemplateToContent', () => {
    it('adapts flexible clip durations to match media length', () => {
      const analysis = analyzeMedia(makeMedia({ duration: 30 }));
      const result = adaptTemplateToContent(makeTemplate(), analysis);
      expect(result.adaptedDurationSec).toBe(30);
      expect(result.template.tracks[0].clips[0].durationSec).not.toBe(10);
    });

    it('produces no duration changes when clips already match', () => {
      const tpl = makeTemplate({ tracks: [{
        type: 'video', name: 'main', clips: [makeClip(15), makeClip(15)],
        transitions: [], trackEffects: [], muted: false, locked: false,
      }]});
      const result = adaptTemplateToContent(tpl, analyzeMedia(makeMedia({ duration: 30 })));
      expect(result.changes.filter((c) => c.field === 'durationSec')).toHaveLength(0);
    });

    it('updates metadata with adapted duration', () => {
      const result = adaptTemplateToContent(makeTemplate(), analyzeMedia(makeMedia({ duration: 60 })));
      expect(result.template.metadata.estimatedDurationSec).toBe(60);
    });
  });

  describe('createSmartAdaptation', () => {
    it('selects video as primary media and adapts template', () => {
      const project = { media: [makeMedia({ id: 'v1', type: 'video' as const, duration: 40 })] } as any;
      const result = createSmartAdaptation(project, makeTemplate());
      expect(result).not.toBeNull();
      expect(result!.adaptedDurationSec).toBe(40);
    });

    it('returns null when no media exists', () => {
      expect(createSmartAdaptation({ media: [] } as any, makeTemplate())).toBeNull();
    });

    it('prefers video over image and audio', () => {
      const project = { media: [
        makeMedia({ id: 'img', type: 'image' as const, duration: 5 }),
        makeMedia({ id: 'vid', type: 'video' as const, duration: 25 }),
      ]} as any;
      const result = createSmartAdaptation(project, makeTemplate());
      expect(result).not.toBeNull();
      expect(result!.adaptedDurationSec).toBe(25);
    });
  });
});
