import { describe, it, expect } from 'vitest';
import {
  validateTemplate,
  TEMPLATE_SCHEMA_VERSION,
  TEMPLATE_FILE_EXTENSION,
  type EditingTemplate,
  type TemplateMetadata,
  type TemplateClip,
  type TemplateTrack,
} from '../models/template-schema';

function makeMetadata(overrides: Partial<TemplateMetadata> = {}): TemplateMetadata {
  return {
    id: 'test-template-1',
    version: TEMPLATE_SCHEMA_VERSION,
    name: 'Test Template',
    description: 'A test template',
    category: 'vlog',
    tags: ['test'],
    author: 'Test',
    createdAt: '2026-07-21T00:00:00Z',
    updatedAt: '2026-07-21T00:00:00Z',
    aspectRatio: '16:9',
    resolutionWidth: 1920,
    resolutionHeight: 1080,
    frameRate: 30,
    estimatedDurationSec: 60,
    difficulty: 'beginner',
    ...overrides,
  };
}

function makeClip(overrides: Partial<TemplateClip> = {}): TemplateClip {
  return {
    type: 'video',
    durationSec: 5,
    flexibleDuration: true,
    placeholder: 'user-video',
    placeholderParams: {},
    effects: [],
    keyframes: [],
    colorNodes: [],
    opacity: 1,
    speed: 1,
    volume: 1,
    ...overrides,
  };
}

function makeTrack(overrides: Partial<TemplateTrack> = {}): TemplateTrack {
  return {
    type: 'video',
    name: 'Main',
    clips: [makeClip()],
    transitions: [],
    trackEffects: [],
    muted: false,
    locked: false,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<EditingTemplate> = {}): EditingTemplate {
  return {
    metadata: makeMetadata(),
    tracks: [makeTrack()],
    audioLayout: {
      tracks: [{ role: 'voice', volumeDb: -14, pan: 0, fadeInSec: 0.1, fadeOutSec: 0.2 }],
      masterLoudnessTarget: -14,
      masterLimiter: true,
    },
    globalColorNodes: [],
    variables: [],
    ...overrides,
  };
}

describe('Template Schema', () => {
  describe('constants', () => {
    it('has correct version', () => {
      expect(TEMPLATE_SCHEMA_VERSION).toBe('1.0');
    });

    it('has correct file extension', () => {
      expect(TEMPLATE_FILE_EXTENSION).toBe('.oft');
    });
  });

  describe('validateTemplate', () => {
    it('validates a correct template', () => {
      const result = validateTemplate(makeTemplate());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('requires metadata.id', () => {
      const result = validateTemplate(makeTemplate({ metadata: makeMetadata({ id: '' }) }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('metadata.id is required');
    });

    it('requires metadata.name', () => {
      const result = validateTemplate(makeTemplate({ metadata: makeMetadata({ name: '' }) }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('metadata.name is required');
    });

    it('requires positive resolution', () => {
      const result = validateTemplate(makeTemplate({ metadata: makeMetadata({ resolutionWidth: 0 }) }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('resolutionWidth must be positive');
    });

    it('requires positive frame rate', () => {
      const result = validateTemplate(makeTemplate({ metadata: makeMetadata({ frameRate: -1 }) }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('frameRate must be positive');
    });

    it('warns on empty tracks', () => {
      const result = validateTemplate(makeTemplate({ tracks: [] }));
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Template has no tracks');
    });

    it('warns on empty track clips', () => {
      const result = validateTemplate(makeTemplate({ tracks: [makeTrack({ clips: [] })] }));
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('has no clips'))).toBe(true);
    });

    it('rejects invalid clip opacity', () => {
      const result = validateTemplate(
        makeTemplate({ tracks: [makeTrack({ clips: [makeClip({ opacity: 1.5 })] })] }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('opacity must be 0-1'))).toBe(true);
    });

    it('rejects invalid clip speed', () => {
      const result = validateTemplate(
        makeTemplate({ tracks: [makeTrack({ clips: [makeClip({ speed: -1 })] })] }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('speed must be positive'))).toBe(true);
    });

    it('rejects zero duration non-flexible clip', () => {
      const result = validateTemplate(
        makeTemplate({
          tracks: [makeTrack({ clips: [makeClip({ durationSec: 0, flexibleDuration: false })] })],
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('invalid duration'))).toBe(true);
    });

    it('allows zero duration flexible clip', () => {
      const result = validateTemplate(
        makeTemplate({
          tracks: [makeTrack({ clips: [makeClip({ durationSec: 0, flexibleDuration: true })] })],
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('warns on positive loudness target', () => {
      const result = validateTemplate(
        makeTemplate({
          audioLayout: {
            tracks: [],
            masterLoudnessTarget: 5,
            masterLimiter: true,
          },
        }),
      );
      expect(result.warnings.some((w) => w.includes('loudness target should be negative'))).toBe(true);
    });

    it('rejects duplicate variable IDs', () => {
      const result = validateTemplate(
        makeTemplate({
          variables: [
            { id: 'title', label: 'Title', type: 'text', defaultValue: 'A' },
            { id: 'title', label: 'Title 2', type: 'text', defaultValue: 'B' },
          ],
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate variable ID: title');
    });
  });
});
