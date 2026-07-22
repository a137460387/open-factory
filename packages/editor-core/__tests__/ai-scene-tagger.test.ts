import { describe, it, expect } from 'vitest';
import {
  generateAutoTags,
  generateAutoTagsBatch,
  mergeAutoTagsWithExisting,
  getTagsByCategory,
} from '../src/ai-scene-tagger';
import type { MediaAsset } from '../src/model-types';
import type { ClipContentAnalysis } from '../src/content-analysis';

function makeAsset(overrides?: Partial<MediaAsset>): MediaAsset {
  return {
    id: 'asset-1',
    type: 'video',
    name: 'test.mp4',
    path: '/test.mp4',
    duration: 60,
    width: 1920,
    height: 1080,
    ...overrides,
  };
}

function makeAnalysis(overrides?: Partial<ClipContentAnalysis>): ClipContentAnalysis {
  return {
    version: 1,
    analyzedAt: new Date().toISOString(),
    sceneTypes: ['indoor', 'dialogue'],
    primarySceneType: 'indoor',
    segments: [
      { start: 0, end: 30, sceneTypes: ['indoor'], brightness: 0.5, motion: 0.2, loudness: 0.3 },
      { start: 30, end: 60, sceneTypes: ['dialogue'], brightness: 0.6, motion: 0.1, loudness: 0.4 },
    ],
    emotionCurve: [
      { time: 0, value: 0.3, brightness: 0.5 },
      { time: 30, value: 0.6, brightness: 0.6 },
      { time: 60, value: 0.4, brightness: 0.5 },
    ],
    dialogueTurns: [
      { start: 5, end: 25, loudness: 0.4 },
      { start: 35, end: 55, loudness: 0.35 },
    ],
    ...overrides,
  };
}

describe('ai-scene-tagger', () => {
  describe('generateAutoTags', () => {
    it('generates tags for video asset with analysis', () => {
      const result = generateAutoTags(makeAsset(), makeAnalysis());
      expect(result.mediaId).toBe('asset-1');
      expect(result.tags.length).toBeGreaterThan(0);
      expect(result.analyzedAt).toBeTruthy();
    });

    it('includes scene type tags', () => {
      const result = generateAutoTags(makeAsset(), makeAnalysis(), { includeSceneTypes: true });
      const tagNames = result.tags.map((t) => t.tag);
      expect(tagNames).toContain('室内');
    });

    it('includes mood tags', () => {
      const result = generateAutoTags(makeAsset(), makeAnalysis(), { includeMoodTags: true });
      const tagNames = result.tags.map((t) => t.tag);
      // Should have some mood tags based on brightness/motion
      expect(tagNames.length).toBeGreaterThan(0);
    });

    it('includes audio tags for dialogue content', () => {
      const result = generateAutoTags(makeAsset(), makeAnalysis(), { includeAudioTags: true });
      const tagNames = result.tags.map((t) => t.tag);
      expect(tagNames).toContain('对话为主');
    });

    it('generates metadata tags', () => {
      const result = generateAutoTags(makeAsset(), makeAnalysis());
      const tagNames = result.tags.map((t) => t.tag);
      expect(tagNames).toContain('1080p');
      expect(tagNames).toContain('视频');
    });

    it('works without content analysis', () => {
      const result = generateAutoTags(makeAsset());
      expect(result.tags.length).toBeGreaterThan(0);
      expect(result.tags.some((t) => t.tag === '视频')).toBe(true);
    });

    it('respects maxTagsPerAsset', () => {
      const result = generateAutoTags(makeAsset(), makeAnalysis(), { maxTagsPerAsset: 3 });
      expect(result.tags.length).toBeLessThanOrEqual(3);
    });

    it('respects minConfidence', () => {
      const result = generateAutoTags(makeAsset(), makeAnalysis(), { minConfidence: 0.95 });
      expect(result.tags.every((t) => t.confidence >= 0.95)).toBe(true);
    });

    it('tags 4K assets', () => {
      const asset4k = makeAsset({ width: 3840, height: 2160 });
      const result = generateAutoTags(asset4k, makeAnalysis());
      const tagNames = result.tags.map((t) => t.tag);
      expect(tagNames).toContain('4K');
    });

    it('tags long videos', () => {
      const longAsset = makeAsset({ duration: 1200 });
      const result = generateAutoTags(longAsset, makeAnalysis());
      const tagNames = result.tags.map((t) => t.tag);
      expect(tagNames).toContain('长视频');
    });

    it('tags short videos', () => {
      const shortAsset = makeAsset({ duration: 5 });
      const result = generateAutoTags(shortAsset, makeAnalysis());
      const tagNames = result.tags.map((t) => t.tag);
      expect(tagNames).toContain('短视频');
    });
  });

  describe('generateAutoTagsBatch', () => {
    it('generates tags for multiple assets', () => {
      const assets = [makeAsset({ id: 'a1' }), makeAsset({ id: 'a2' })];
      const analyses: Record<string, ClipContentAnalysis> = {
        a1: makeAnalysis(),
        a2: makeAnalysis({ primarySceneType: 'outdoor' }),
      };
      const results = generateAutoTagsBatch(assets, {}, analyses);
      expect(results.length).toBe(2);
      expect(results[0].mediaId).toBe('a1');
      expect(results[1].mediaId).toBe('a2');
    });
  });

  describe('mergeAutoTagsWithExisting', () => {
    it('merges without duplicates', () => {
      const existing = ['室内', '自定义标签'];
      const auto = [
        { tag: '室内', confidence: 0.9, source: 'ai-analysis' as const },
        { tag: '对话为主', confidence: 0.8, source: 'audio-analysis' as const },
      ];
      const merged = mergeAutoTagsWithExisting(existing, auto);
      expect(merged).toContain('室内');
      expect(merged).toContain('自定义标签');
      expect(merged).toContain('对话为主');
      expect(merged.filter((t) => t === '室内').length).toBe(1);
    });
  });

  describe('getTagsByCategory', () => {
    it('groups tags by source', () => {
      const tags = [
        { tag: '室内', confidence: 0.9, source: 'ai-analysis' as const },
        { tag: '明亮', confidence: 0.7, source: 'content-heuristic' as const },
        { tag: '对话为主', confidence: 0.8, source: 'audio-analysis' as const },
      ];
      const categories = getTagsByCategory(tags);
      expect(categories['AI 分析']).toHaveLength(1);
      expect(categories['内容启发']).toHaveLength(1);
      expect(categories['音频分析']).toHaveLength(1);
    });
  });
});
