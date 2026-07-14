import { describe, it, expect } from 'vitest';
import { understandSpeech } from '../src/ai-speech-understanding';

describe('ai-speech-understanding', () => {
  describe('understandSpeech', () => {
    it('should extract keywords from transcript', () => {
      const transcript = '视频编辑是一个有趣的过程。视频编辑需要创意和技术。视频编辑是核心能力。';
      const result = understandSpeech(transcript, undefined, { minKeywordFrequency: 1 });

      expect(result.keywords).toBeDefined();
      expect(result.keywords.length).toBeGreaterThan(0);
      expect(result.keywords[0].word).toBeDefined();
      expect(result.keywords[0].score).toBeGreaterThan(0);
      expect(result.keywords[0].frequency).toBeGreaterThan(0);
    });

    it('should filter stop words', () => {
      const transcript = '这是一个测试。那个测试很重要。';
      const result = understandSpeech(transcript);

      // Stop words like '这', '是', '一', '个', '那' should be filtered
      const stopWords = ['这', '是', '一', '个', '那'];
      for (const keyword of result.keywords) {
        expect(stopWords).not.toContain(keyword.word);
      }
    });

    it('should respect maxKeywords option', () => {
      const transcript = '苹果 香蕉 橙子 葡萄 西瓜 芒果 草莓 樱桃 桃子 梨';
      const result = understandSpeech(transcript, undefined, { maxKeywords: 5 });

      expect(result.keywords.length).toBeLessThanOrEqual(5);
    });

    it('should respect minKeywordFrequency option', () => {
      const transcript = '苹果 苹果 苹果 香蕉 橙子';
      const result = understandSpeech(transcript, undefined, { minKeywordFrequency: 2 });

      // Only '苹果' appears 3 times, others appear once
      for (const keyword of result.keywords) {
        expect(keyword.frequency).toBeGreaterThanOrEqual(2);
      }
    });

    it('should extract topics from keywords', () => {
      const transcript = '视频编辑技术包括剪辑和调色。视频编辑需要创意。剪辑是基础技术。';
      const result = understandSpeech(transcript);

      expect(result.topics).toBeDefined();
      expect(Array.isArray(result.topics)).toBe(true);
    });

    it('should detect narrative markers', () => {
      const transcript = '首先，让我们开始。然后，我们继续。最后，我们完成了。';
      const result = understandSpeech(transcript);

      expect(result.narrativeMarkers).toBeDefined();
      expect(Array.isArray(result.narrativeMarkers)).toBe(true);
    });

    it('should generate summary', () => {
      const transcript = '今天我们要讨论视频编辑的基础知识。首先了解剪辑，然后学习调色。';
      const result = understandSpeech(transcript);

      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('should handle empty transcript', () => {
      const result = understandSpeech('');

      expect(result.keywords).toEqual([]);
      expect(result.topics).toEqual([]);
      expect(result.narrativeMarkers).toEqual([]);
    });

    it('should handle English transcript', () => {
      const transcript = 'Video editing is a creative process. Video editing requires technical skills.';
      const result = understandSpeech(transcript);

      expect(result.keywords.length).toBeGreaterThan(0);
      // 'video' and 'editing' should be extracted as keywords
      const words = result.keywords.map(k => k.word.toLowerCase());
      expect(words).toContain('video');
      expect(words).toContain('editing');
    });

    it('should handle mixed Chinese and English', () => {
      const transcript = 'Video编辑是一门艺术。Video编辑需要AI技术。Video编辑很强大。';
      const result = understandSpeech(transcript, undefined, { minKeywordFrequency: 1 });

      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it('should use time alignment for topics', () => {
      const transcript = '开场白。主要内容第一点。主要内容第二点。结束语。';
      const timeAlignment = [
        { start: 0, end: 5 },
        { start: 5, end: 15 },
        { start: 15, end: 25 },
        { start: 25, end: 30 }
      ];
      const result = understandSpeech(transcript, timeAlignment);

      expect(result.topics).toBeDefined();
      // Topics should have time ranges if time alignment is provided
      for (const topic of result.topics) {
        if (topic.timeRange) {
          expect(topic.timeRange.start).toBeDefined();
          expect(topic.timeRange.end).toBeDefined();
        }
      }
    });

    it('should return keyword frequency counts', () => {
      const transcript = '剪辑 调色 剪辑 导出 剪辑 调色';
      const result = understandSpeech(transcript, undefined, { minKeywordFrequency: 1 });

      const clipKeyword = result.keywords.find(k => k.word === '剪辑');
      expect(clipKeyword).toBeDefined();
      expect(clipKeyword!.frequency).toBe(3);
    });

    it('should sort keywords by score descending', () => {
      const transcript = '剪辑 调色 剪辑 导出 剪辑 调色 导出 转场 特效 音频 混音 降噪';
      const result = understandSpeech(transcript, undefined, { minKeywordFrequency: 1 });

      for (let i = 1; i < result.keywords.length; i++) {
        expect(result.keywords[i - 1].score).toBeGreaterThanOrEqual(result.keywords[i].score);
      }
    });
  });
});
