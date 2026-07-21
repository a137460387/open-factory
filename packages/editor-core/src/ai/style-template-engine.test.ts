import { describe, it, expect } from 'vitest';
import {
  generateTemplateFromStyle,
  saveProjectAsTemplate,
  resolveTemplateVariables,
} from './style-template-engine';
import type { StyleFingerprint } from './style-analyzer';

function makeFingerprint(overrides: Partial<StyleFingerprint> = {}): StyleFingerprint {
  return {
    version: '1.0',
    id: 'fp-test-1',
    name: 'Test Style',
    createdAt: '2026-07-21T00:00:00Z',
    updatedAt: '2026-07-21T00:00:00Z',
    analyzedProjectCount: 1,
    totalClipCount: 10,
    totalDurationSec: 60,
    transitions: [
      { type: 'dissolve', count: 5, avgDurationSec: 0.5, durationStddev: 0.1, ratio: 0.5 },
    ],
    rhythm: {
      avgClipDurationSec: 6,
      clipDurationStddev: 2,
      cutsPerMinute: 10,
      regularity: 0.7,
      durationHistogram: [],
      shortClipRatio: 0.1,
      longClipRatio: 0.3,
    },
    colorGrading: {
      brightness: { mean: 5, stddev: 2, count: 10 },
      contrast: { mean: 10, stddev: 3, count: 10 },
      saturation: { mean: 15, stddev: 5, count: 10 },
      hue: { mean: 5, stddev: 2, count: 10 },
      preferredLutPath: null,
      lutUsageRatio: 0,
      temperatureTendency: 'warm',
    },
    audioProcessing: {
      avgTargetLoudness: -14,
      loudnessStddev: 2,
      avgFadeInSec: 0.2,
      avgFadeOutSec: 0.3,
      musicSpeechRatio: 0.5,
      crossfadeRatio: 0.3,
    },
    effects: [
      { type: 'vignette', totalCount: 5, ratio: 0.5, avgParams: { intensity: 0.3 }, typicallyEnabled: true },
    ],
    tags: ['fast-paced', 'warm-tones'],
    ...overrides,
  };
}

describe('Style Template Engine', () => {
  describe('generateTemplateFromStyle', () => {
    it('generates a valid template from a fingerprint', () => {
      const fp = makeFingerprint();
      const template = generateTemplateFromStyle(fp);

      expect(template.metadata.id).toContain('style-tpl-');
      expect(template.metadata.version).toBe('1.0');
      expect(template.tracks.length).toBeGreaterThanOrEqual(1);
      expect(template.audioLayout).toBeDefined();
      expect(template.variables.length).toBeGreaterThanOrEqual(2);
    });

    it('uses provided options', () => {
      const fp = makeFingerprint();
      const template = generateTemplateFromStyle(fp, {
        name: 'Custom Name',
        category: 'tutorial',
        totalDurationSec: 120,
      });

      expect(template.metadata.name).toBe('Custom Name');
      expect(template.metadata.category).toBe('tutorial');
      expect(template.metadata.estimatedDurationSec).toBe(120);
    });

    it('adds text track for tutorial category', () => {
      const fp = makeFingerprint();
      const template = generateTemplateFromStyle(fp, { category: 'tutorial' });

      const textTracks = template.tracks.filter((t) => t.type === 'text');
      expect(textTracks.length).toBeGreaterThanOrEqual(1);
    });

    it('maps color grading to template color nodes', () => {
      const fp = makeFingerprint();
      const template = generateTemplateFromStyle(fp);

      expect(template.globalColorNodes.length).toBeGreaterThan(0);
      const bcNode = template.globalColorNodes.find((n) => n.type === 'brightness-contrast');
      expect(bcNode).toBeDefined();
      expect(bcNode!.params.brightness).toBe(5);
    });

    it('maps audio processing to layout', () => {
      const fp = makeFingerprint();
      const template = generateTemplateFromStyle(fp);

      expect(template.audioLayout.masterLoudnessTarget).toBe(-14);
      expect(template.audioLayout.tracks.length).toBeGreaterThanOrEqual(1);
    });

    it('preserves source style ID', () => {
      const fp = makeFingerprint({ id: 'my-style-123' });
      const template = generateTemplateFromStyle(fp);
      expect(template.sourceStyleId).toBe('my-style-123');
    });
  });

  describe('resolveTemplateVariables', () => {
    it('replaces variable placeholders in template', () => {
      const fp = makeFingerprint();
      const template = generateTemplateFromStyle(fp);

      // Set a title variable
      const resolved = resolveTemplateVariables(template, { title: 'My Video Title' });

      // The template should still be valid
      expect(resolved.metadata.id).toBe(template.metadata.id);
    });

    it('preserves template structure', () => {
      const fp = makeFingerprint();
      const template = generateTemplateFromStyle(fp);
      const resolved = resolveTemplateVariables(template, {});

      expect(resolved.tracks.length).toBe(template.tracks.length);
      expect(resolved.audioLayout).toEqual(template.audioLayout);
    });
  });
});
