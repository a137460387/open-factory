import { describe, expect, it } from 'vitest';
import {
  applyLineBreakToWhisperOutput,
  batchRebreakSubtitles,
  classifyText,
  getDisplayWidth,
  DEFAULT_CHINESE_MAX_CHARS,
  DEFAULT_ENGLISH_MAX_CHARS,
  detectLineBreakIssues,
  findBestBreakPoint,
  getMaxCharsForText,
  isChineseChar,
  normalizeLineBreakConfig,
  previewLineBreak,
  smartLineBreak
} from '../src';

describe('subtitle line-break', () => {
  describe('display width', () => {
    it('calculates display width for mixed text', () => {
      expect(getDisplayWidth('abc')).toBe(3);
      expect(getDisplayWidth('你好世界')).toBe(4);
      expect(getDisplayWidth('')).toBe(0);
    });
  });

  describe('character classification', () => {
    it('identifies Chinese characters', () => {
      expect(isChineseChar('你')).toBe(true);
      expect(isChineseChar('a')).toBe(false);
      expect(isChineseChar(' ')).toBe(false);
      expect(isChineseChar('')).toBe(false);
    });

    it('classifies text as Chinese/English/mixed', () => {
      expect(classifyText('这是一段中文字幕')).toBe('chinese');
      expect(classifyText('This is English subtitle text')).toBe('english');
      expect(classifyText('这是mixed混合text')).toBe('mixed');
    });
  });

  describe('max chars threshold', () => {
    it('returns Chinese limit for Chinese text', () => {
      expect(getMaxCharsForText('这是一段中文')).toBe(DEFAULT_CHINESE_MAX_CHARS);
    });

    it('returns English limit for English text', () => {
      expect(getMaxCharsForText('This is English text')).toBe(DEFAULT_ENGLISH_MAX_CHARS);
    });

    it('classifies pure number text as mixed fallback', () => {
      expect(classifyText('12345 !@#')).toBe('mixed');
    });

    it('returns blended limit for mixed Chinese-English text', () => {
      const mixed = getMaxCharsForText('这是mixed中文English');
      const expected = Math.max(DEFAULT_CHINESE_MAX_CHARS, Math.round(DEFAULT_ENGLISH_MAX_CHARS * 0.6));
      expect(mixed).toBe(expected);
    });
  });

  describe('break point selection', () => {
    it('prefers breaking after punctuation', () => {
      const text = '这是第一句，这是第二句很长的话需要断行处理';
      const breakAt = findBestBreakPoint(text, 10);
      expect(breakAt).toBe(6); // After '，'
    });

    it('prefers breaking at space for English', () => {
      const text = 'This is a long English subtitle that needs breaking';
      const breakAt = findBestBreakPoint(text, 20);
      expect(text[breakAt]).toBe(' ');
    });

    it('prefers breaking before preposition', () => {
      const text = 'The cat sat on the mat and looked around';
      const breakAt = findBestBreakPoint(text, 15);
      const wordAfter = text.slice(breakAt).match(/^([a-zA-Z]+)/);
      expect(['on', 'and', 'the']).toContain(wordAfter?.[1]?.toLowerCase());
    });
  });

  describe('smart line break', () => {
    it('does not change text within limits', () => {
      expect(smartLineBreak('短文本')).toBe('短文本');
    });

    it('breaks long Chinese text at ≤20 chars per line', () => {
      const longChinese = '这是一段超过二十个字符的中文字幕内容需要被正确地断行处理以符合广播标准';
      const result = smartLineBreak(longChinese);
      const lines = result.split('\n');
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(DEFAULT_CHINESE_MAX_CHARS);
      }
    });

    it('breaks long English text at ≤42 chars per line', () => {
      const longEnglish = 'This is a very long English subtitle text that definitely exceeds the forty-two character limit for broadcast standard subtitles';
      const result = smartLineBreak(longEnglish);
      const lines = result.split('\n');
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(DEFAULT_ENGLISH_MAX_CHARS);
      }
    });

    it('preserves existing line breaks', () => {
      const text = '第一行\n第二行';
      expect(smartLineBreak(text)).toBe('第一行\n第二行');
    });
  });

  describe('issue detection', () => {
    it('detects lines exceeding Chinese threshold', () => {
      const subtitles = [{ id: 's1', text: '这是一段超过二十个字符限制的很长中文字幕内容需要被检测出来' }];
      const issues = detectLineBreakIssues(subtitles);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].subtitleId).toBe('s1');
      expect(issues[0].issueType).toBe('line-too-long');
    });

    it('detects lines exceeding English threshold', () => {
      const longLine = 'This English subtitle line is way too long for broadcast standards and should be flagged';
      const subtitles = [{ id: 's1', text: longLine }];
      const issues = detectLineBreakIssues(subtitles);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].issueType).toBe('line-too-long');
    });

    it('reports no issues for compliant subtitles', () => {
      const subtitles = [
        { id: 's1', text: '短文本' },
        { id: 's2', text: 'Short text' }
      ];
      expect(detectLineBreakIssues(subtitles)).toEqual([]);
    });
  });

  describe('batch re-break', () => {
    it('preserves original text content', () => {
      const longChinese = '这是一段超过二十个字符的中文字幕内容需要被正确地断行处理以符合广播标准';
      const subtitles = [{ id: 's1', text: longChinese }];
      const results = batchRebreakSubtitles(subtitles);
      expect(results).toHaveLength(1);
      expect(results[0].changed).toBe(true);
      // Content preserved (no characters added/removed)
      const originalChars = longChinese.replace(/\s/g, '');
      const rebrokenChars = results[0].rebrokenText.replace(/\s/g, '');
      expect(rebrokenChars).toBe(originalChars);
    });

    it('marks unchanged subtitles', () => {
      const subtitles = [{ id: 's1', text: '短文本' }];
      const results = batchRebreakSubtitles(subtitles);
      expect(results[0].changed).toBe(false);
    });
  });

  describe('preview', () => {
    it('returns preview with lines array', () => {
      const longText = '这是一段超过二十个字符的中文字幕内容需要断行';
      const preview = previewLineBreak(longText);
      expect(preview.originalText).toBe(longText);
      expect(preview.lines.length).toBeGreaterThan(1);
    });
  });

  describe('Whisper integration', () => {
    it('applies line break to Whisper output', () => {
      const whisperText = '这是一段很长的Whisper生成字幕内容超过了标准字符限制需要自动断行';
      const result = applyLineBreakToWhisperOutput(whisperText);
      const lines = result.split('\n');
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(DEFAULT_CHINESE_MAX_CHARS);
      }
    });
  });

  describe('config normalization', () => {
    it('uses defaults for undefined config', () => {
      const config = normalizeLineBreakConfig(undefined);
      expect(config.chineseMaxCharsPerLine).toBe(DEFAULT_CHINESE_MAX_CHARS);
      expect(config.englishMaxCharsPerLine).toBe(DEFAULT_ENGLISH_MAX_CHARS);
    });

    it('overrides config values', () => {
      const config = normalizeLineBreakConfig({ chineseMaxCharsPerLine: 15 });
      expect(config.chineseMaxCharsPerLine).toBe(15);
      expect(config.englishMaxCharsPerLine).toBe(DEFAULT_ENGLISH_MAX_CHARS);
    });
  });

  describe('bad-break-point detection', () => {
    it('findBestBreakPoint returns maxChars when candidates are empty', () => {
      const result = findBestBreakPoint('abcde', 0, {
        chineseMaxCharsPerLine: 0,
        englishMaxCharsPerLine: 0,
        preferPunctuationBreak: false,
        preferPrepositionBreak: false
      });
      expect(result).toBe(0);
    });

    it('findBestBreakPoint returns text length when text fits within maxChars', () => {
      expect(findBestBreakPoint('ab', 10)).toBe(2);
      expect(findBestBreakPoint('short', 20)).toBe(5);
    });

    it('detects break in the middle of an English word', () => {
      const issues = detectLineBreakIssues([
        { id: 's1', text: 'He\nllo world this is a test' }
      ]);
      const badBreak = issues.find((i) => i.issueType === 'bad-break-point');
      expect(badBreak).toBeDefined();
      expect(badBreak!.subtitleId).toBe('s1');
      expect(badBreak!.detail).toContain('断在单词中间');
    });

    it('does not flag break after English punctuation', () => {
      const issues = detectLineBreakIssues([
        { id: 's2', text: 'Hello,\nworld this is fine' }
      ]);
      const badBreak = issues.find((i) => i.issueType === 'bad-break-point');
      expect(badBreak).toBeUndefined();
    });

    it('does not flag break at line with internal whitespace', () => {
      const issues = detectLineBreakIssues([
        { id: 's3', text: 'He llo\nworld this is fine' }
      ]);
      const badBreak = issues.find((i) => i.issueType === 'bad-break-point');
      expect(badBreak).toBeUndefined();
    });

    it('does not flag single-line subtitles', () => {
      const issues = detectLineBreakIssues([
        { id: 's4', text: 'Hello world' }
      ]);
      const badBreak = issues.find((i) => i.issueType === 'bad-break-point');
      expect(badBreak).toBeUndefined();
    });

    it('handles empty and whitespace-only lines', () => {
      expect(smartLineBreak('')).toBe('');
      expect(smartLineBreak('   ')).toBe('');
    });

    it('does not flag break after Chinese punctuation', () => {
      const issues = detectLineBreakIssues([
        { id: 's5', text: '你好，\n世界这是一个测试' }
      ]);
      const badBreak = issues.find((i) => i.issueType === 'bad-break-point');
      expect(badBreak).toBeUndefined();
    });
  });

});
