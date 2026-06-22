import { describe, it, expect } from 'vitest';
import {
  classifyTagLearningAspect,
  recordTagAction,
  suggestTags,
  getConfidenceLevel,
  shouldProactivelySuggest,
  serializeTagLearningData,
  parseTagLearningData,
  resetTagLearningData,
  createEmptyTagLearningData,
  type TagLearningData,
} from '../src/tag-learning';

describe('tag-learning', () => {
  describe('classifyMediaAspect', () => {
    it('should classify vertical media', () => {
      expect(classifyTagLearningAspect(1080, 1920)).toBe('vertical');
    });
    it('should classify horizontal media', () => {
      expect(classifyTagLearningAspect(1920, 1080)).toBe('horizontal');
    });
    it('should classify square media', () => {
      expect(classifyTagLearningAspect(1080, 1080)).toBe('square');
    });
  });

  describe('recordTagAction', () => {
    it('should add a record to learning data', () => {
      const data = createEmptyTagLearningData();
      const updated = recordTagAction(data, 'vertical', true, '短视频', () => new Date('2025-01-01'));
      expect(updated.records).toHaveLength(1);
      expect(updated.records[0].tag).toBe('短视频');
      expect(updated.records[0].aspectClass).toBe('vertical');
    });

    it('should ignore empty tags', () => {
      const data = createEmptyTagLearningData();
      const updated = recordTagAction(data, 'vertical', true, '  ');
      expect(updated.records).toHaveLength(0);
    });

    it('should normalize tag to lowercase', () => {
      const data = createEmptyTagLearningData();
      const updated = recordTagAction(data, 'horizontal', false, 'Vlog');
      expect(updated.records[0].tag).toBe('vlog');
    });
  });

  describe('suggestTags', () => {
    it('should suggest tags with high confidence when pattern is consistent', () => {
      let data = createEmptyTagLearningData();
      for (let i = 0; i < 5; i++) {
        data = recordTagAction(data, 'vertical', true, '短视频');
      }
      const suggestions = suggestTags(data, 'vertical', true);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].tag).toBe('短视频');
      expect(suggestions[0].confidence).toBe(1);
      expect(getConfidenceLevel(suggestions[0].confidence)).toBe('high');
    });

    it('should return empty for no matching records', () => {
      const data = createEmptyTagLearningData();
      expect(suggestTags(data, 'vertical', true)).toHaveLength(0);
    });

    it('should not suggest tags below minimum match count', () => {
      const data = recordTagAction(createEmptyTagLearningData(), 'vertical', true, '短视频');
      expect(suggestTags(data, 'vertical', true)).toHaveLength(0);
    });

    it('should calculate medium confidence correctly', () => {
      let data = createEmptyTagLearningData();
      data = recordTagAction(data, 'vertical', true, '短视频');
      data = recordTagAction(data, 'vertical', true, '短视频');
      data = recordTagAction(data, 'vertical', true, '教程');
      data = recordTagAction(data, 'vertical', true, '教程');
      const suggestions = suggestTags(data, 'vertical', true);
      expect(suggestions).toHaveLength(2);
      expect(getConfidenceLevel(suggestions[0].confidence)).toBe('medium');
    });
  });

  describe('shouldProactivelySuggest', () => {
    it('should return true for high confidence', () => {
      expect(shouldProactivelySuggest({ tag: 'test', confidence: 0.95, matchCount: 10, totalCount: 10 })).toBe(true);
    });
    it('should return false for medium confidence', () => {
      expect(shouldProactivelySuggest({ tag: 'test', confidence: 0.6, matchCount: 3, totalCount: 5 })).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should round-trip serialize and parse', () => {
      let data = createEmptyTagLearningData();
      data = recordTagAction(data, 'vertical', true, '短视频', () => new Date('2025-01-01'));
      data = recordTagAction(data, 'horizontal', false, 'vlog', () => new Date('2025-01-02'));
      const json = serializeTagLearningData(data);
      const parsed = parseTagLearningData(json);
      expect(parsed.records).toHaveLength(2);
      expect(parsed.records[0].tag).toBe('短视频');
    });

    it('should return empty data for invalid JSON', () => {
      const result = parseTagLearningData('not json');
      expect(result.records).toHaveLength(0);
    });
  });

  describe('resetTagLearningData', () => {
    it('should return empty data', () => {
      const result = resetTagLearningData();
      expect(result.records).toHaveLength(0);
      expect(result.version).toBe(1);
    });
  });
});
