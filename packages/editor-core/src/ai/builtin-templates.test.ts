import { describe, it, expect } from 'vitest';
import {
  BUILTIN_VLOG_TEMPLATE,
  BUILTIN_TUTORIAL_TEMPLATE,
  BUILTIN_PRODUCT_DEMO_TEMPLATE,
  BUILTIN_TEMPLATES,
  getBuiltinTemplate,
  getTemplatesByCategory,
} from './builtin-templates';
import { validateTemplate } from '../models/template-schema';

describe('Built-in Templates', () => {
  describe('Vlog Template', () => {
    it('is valid', () => {
      const result = validateTemplate(BUILTIN_VLOG_TEMPLATE);
      expect(result.valid).toBe(true);
    });

    it('has correct metadata', () => {
      expect(BUILTIN_VLOG_TEMPLATE.metadata.id).toBe('builtin-vlog-fast');
      expect(BUILTIN_VLOG_TEMPLATE.metadata.category).toBe('vlog');
      expect(BUILTIN_VLOG_TEMPLATE.metadata.aspectRatio).toBe('16:9');
    });

    it('has video track with clips', () => {
      const videoTrack = BUILTIN_VLOG_TEMPLATE.tracks.find((t) => t.type === 'video');
      expect(videoTrack).toBeDefined();
      expect(videoTrack!.clips.length).toBeGreaterThan(0);
    });

    it('has transitions', () => {
      const videoTrack = BUILTIN_VLOG_TEMPLATE.tracks.find((t) => t.type === 'video');
      expect(videoTrack!.transitions.length).toBeGreaterThan(0);
    });

    it('has audio layout', () => {
      expect(BUILTIN_VLOG_TEMPLATE.audioLayout.tracks.length).toBeGreaterThan(0);
      expect(BUILTIN_VLOG_TEMPLATE.audioLayout.masterLimiter).toBe(true);
    });
  });

  describe('Tutorial Template', () => {
    it('is valid', () => {
      const result = validateTemplate(BUILTIN_TUTORIAL_TEMPLATE);
      expect(result.valid).toBe(true);
    });

    it('has correct metadata', () => {
      expect(BUILTIN_TUTORIAL_TEMPLATE.metadata.id).toBe('builtin-tutorial-knowledge');
      expect(BUILTIN_TUTORIAL_TEMPLATE.metadata.category).toBe('tutorial');
    });

    it('has text track', () => {
      const textTrack = BUILTIN_TUTORIAL_TEMPLATE.tracks.find((t) => t.type === 'text');
      expect(textTrack).toBeDefined();
      expect(textTrack!.clips.length).toBeGreaterThan(0);
    });

    it('has subtitle track', () => {
      const subtitleTrack = BUILTIN_TUTORIAL_TEMPLATE.tracks.find((t) => t.type === 'subtitle');
      expect(subtitleTrack).toBeDefined();
    });

    it('has chapter variables', () => {
      const chapterVars = BUILTIN_TUTORIAL_TEMPLATE.variables.filter((v) => v.id.startsWith('chapter'));
      expect(chapterVars.length).toBe(3);
    });
  });

  describe('Product Demo Template', () => {
    it('is valid', () => {
      const result = validateTemplate(BUILTIN_PRODUCT_DEMO_TEMPLATE);
      expect(result.valid).toBe(true);
    });

    it('has correct metadata', () => {
      expect(BUILTIN_PRODUCT_DEMO_TEMPLATE.metadata.id).toBe('builtin-product-demo');
      expect(BUILTIN_PRODUCT_DEMO_TEMPLATE.metadata.category).toBe('product-demo');
    });

    it('has overlay track for split screen', () => {
      const overlayTrack = BUILTIN_PRODUCT_DEMO_TEMPLATE.tracks.find((t) => t.name === 'Overlay / Comparison');
      expect(overlayTrack).toBeDefined();
      expect(overlayTrack!.type).toBe('video');
    });

    it('has feature callout variables', () => {
      const featureVars = BUILTIN_PRODUCT_DEMO_TEMPLATE.variables.filter((v) => v.id.startsWith('feature'));
      expect(featureVars.length).toBe(2);
    });
  });

  describe('Template Library', () => {
    it('has 3 built-in templates', () => {
      expect(BUILTIN_TEMPLATES.length).toBe(3);
    });

    it('getBuiltinTemplate finds by ID', () => {
      expect(getBuiltinTemplate('builtin-vlog-fast')).toBe(BUILTIN_VLOG_TEMPLATE);
      expect(getBuiltinTemplate('nonexistent')).toBeUndefined();
    });

    it('getTemplatesByCategory filters correctly', () => {
      const vlogs = getTemplatesByCategory('vlog');
      expect(vlogs.length).toBe(1);
      expect(vlogs[0].metadata.category).toBe('vlog');
    });
  });
});
