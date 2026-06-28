import { describe, it, expect } from 'vitest';
import {
  buildSubtitleStyleVideoContext,
  filterPortraitStyles,
  parseSubtitleStyleResponse,
  buildSubtitleStyleSystemPrompt,
  buildSubtitleStyleUserPrompt,
  SUBTITLE_STYLE_LANDSCAPE_ONLY
} from '../src/ai-subtitle-style';

describe('ai-subtitle-style', () => {
  describe('buildSubtitleStyleVideoContext', () => {
    it('returns context with resolution and portrait flag', () => {
      const ctx = buildSubtitleStyleVideoContext({ width: 1080, height: 1920, aiAnalysis: { tags: ['trendy'], scene: 'vlog', mood: 'lively' } });
      expect(ctx.width).toBe(1080);
      expect(ctx.height).toBe(1920);
      expect(ctx.isPortrait).toBe(true);
      expect(ctx.mediaTags).toEqual(['trendy']);
      expect(ctx.scene).toBe('vlog');
      expect(ctx.mood).toBe('lively');
    });

    it('defaults to 1920x1080 landscape when no media', () => {
      const ctx = buildSubtitleStyleVideoContext(undefined);
      expect(ctx.width).toBe(1920);
      expect(ctx.height).toBe(1080);
      expect(ctx.isPortrait).toBe(false);
      expect(ctx.mediaTags).toBeUndefined();
    });
  });

  describe('filterPortraitStyles', () => {
    const recommendations = [
      { templateId: 'news-lower-third', reason: 'r', confidence: 0.9 },
      { templateId: 'variety-bold', reason: 'r', confidence: 0.8 },
      { templateId: 'cinema-white', reason: 'r', confidence: 0.7 }
    ];

    it('removes landscape-only styles when isPortrait=true', () => {
      const filtered = filterPortraitStyles(recommendations, true);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((r) => r.templateId)).not.toContain('news-lower-third');
    });

    it('keeps all styles when isPortrait=false', () => {
      const filtered = filterPortraitStyles(recommendations, false);
      expect(filtered).toHaveLength(3);
    });

    it('SUBTITLE_STYLE_LANDSCAPE_ONLY contains news-lower-third', () => {
      expect(SUBTITLE_STYLE_LANDSCAPE_ONLY).toContain('news-lower-third');
    });
  });

  describe('parseSubtitleStyleResponse', () => {
    it('parses valid response sorted by confidence', () => {
      const result = parseSubtitleStyleResponse({
        recommended: [
          { templateId: 'cinema-white', reason: 'serif suits documentary', confidence: 0.6 },
          { templateId: 'variety-bold', reason: 'lively style', confidence: 0.9 },
          { templateId: 'documentary', reason: 'calm tone', confidence: 0.75 }
        ]
      });
      expect(result.recommended).toHaveLength(3);
      expect(result.recommended[0].templateId).toBe('variety-bold');
      expect(result.recommended[0].confidence).toBe(0.9);
      expect(result.recommended[1].templateId).toBe('documentary');
      expect(result.recommended[2].templateId).toBe('cinema-white');
    });

    it('returns empty for null input', () => {
      expect(parseSubtitleStyleResponse(null).recommended).toEqual([]);
    });

    it('filters out zero confidence items', () => {
      const result = parseSubtitleStyleResponse({
        recommended: [
          { templateId: 'cinema-white', reason: 'r', confidence: 0 },
          { templateId: 'variety-bold', reason: 'r', confidence: 0.8 }
        ]
      });
      expect(result.recommended).toHaveLength(1);
      expect(result.recommended[0].templateId).toBe('variety-bold');
    });

    it('clamps confidence to 0-1 range', () => {
      const result = parseSubtitleStyleResponse({
        recommended: [
          { templateId: 'cinema-white', reason: 'r', confidence: 1.5 }
        ]
      });
      expect(result.recommended[0].confidence).toBe(1);
    });

    it('limits to 3 results', () => {
      const result = parseSubtitleStyleResponse({
        recommended: [
          { templateId: 'cinema-white', reason: 'r', confidence: 0.9 },
          { templateId: 'variety-bold', reason: 'r', confidence: 0.8 },
          { templateId: 'documentary', reason: 'r', confidence: 0.7 },
          { templateId: 'karaoke', reason: 'r', confidence: 0.6 }
        ]
      });
      expect(result.recommended).toHaveLength(3);
    });

    it('handles missing recommended array', () => {
      expect(parseSubtitleStyleResponse({}).recommended).toEqual([]);
    });
  });

  describe('buildSubtitleStyleSystemPrompt', () => {
    it('contains template IDs and format spec', () => {
      const prompt = buildSubtitleStyleSystemPrompt();
      expect(prompt).toContain('news-lower-third');
      expect(prompt).toContain('variety-bold');
      expect(prompt).toContain('templateId');
      expect(prompt).toContain('confidence');
    });
  });

  describe('buildSubtitleStyleUserPrompt', () => {
    it('includes resolution and portrait info', () => {
      const prompt = buildSubtitleStyleUserPrompt({
        width: 1080, height: 1920, isPortrait: true, mediaTags: ['vlog', 'lifestyle'], scene: 'daily vlog', mood: 'cheerful'
      });
      expect(prompt).toContain('1080x1920');
      expect(prompt).toContain('竖版');
      expect(prompt).toContain('vlog');
      expect(prompt).toContain('daily vlog');
      expect(prompt).toContain('cheerful');
    });

    it('works without optional fields', () => {
      const prompt = buildSubtitleStyleUserPrompt({ width: 1920, height: 1080, isPortrait: false });
      expect(prompt).toContain('1920x1080');
      expect(prompt).toContain('横版');
    });
  });
});
