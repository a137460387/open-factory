import { describe, expect, it } from 'vitest';
import {
  scanSubtitleSpelling,
  applySpellCheckReplacement,
  buildSpellCheckReplacement,
  serializeSpellCheckReportCsv,
  DEFAULT_SPELL_CHECK_DICT,
  CHINESE_SPELL_CHECK_DICT,
  ENGLISH_SPELL_CHECK_DICT,
} from '../src/subtitles/spell-check';

describe('subtitle spell check', () => {
  it('matches Chinese typo and suggests correction', () => {
    const results = scanSubtitleSpelling([{ clipId: 'c1', start: 1, text: '我在也不是小孩了' }]);
    expect(results.length).toBe(1);
    expect(results[0].matchedWord).toBe('在也不是');
    expect(results[0].suggestions).toEqual(['再也不是']);
  });

  it('matches English typo case-insensitively', () => {
    const results = scanSubtitleSpelling([{ clipId: 'c2', start: 2, text: 'Teh quick brown fox' }]);
    expect(results.length).toBe(1);
    expect(results[0].matchedWord).toBe('Teh');
    expect(results[0].suggestions).toEqual(['the']);
  });

  it('skips glossary terms during spell check', () => {
    const results = scanSubtitleSpelling(
      [{ clipId: 'c3', start: 3, text: '以经完成' }],
      DEFAULT_SPELL_CHECK_DICT,
      ['以经']
    );
    expect(results.length).toBe(0);
  });

  it('returns multiple results for multiple typos in one subtitle', () => {
    const results = scanSubtitleSpelling([{ clipId: 'c4', start: 4, text: '己经在次确认 teh result' }]);
    expect(results.length).toBeGreaterThanOrEqual(2);
    const words = results.map((r) => r.matchedWord);
    expect(words).toContain('己经');
    expect(words).toContain('在次');
    expect(words).toContain('teh');
  });

  it('applies single replacement correctly', () => {
    const text = '在也不是小孩了';
    const result = scanSubtitleSpelling([{ clipId: 'c5', start: 5, text }])[0];
    const replaced = applySpellCheckReplacement(text, result, result.suggestions[0]);
    expect(replaced).toBe('再也不是小孩了');
  });

  it('applies multiple replacements via buildSpellCheckReplacement', () => {
    const text = '己经在次确认';
    const results = scanSubtitleSpelling([{ clipId: 'c6', start: 6, text }]);
    const replacements = results.map((r) => ({
      clipId: r.clipId,
      startIndex: r.startIndex,
      endIndex: r.endIndex,
      replacement: r.suggestions[0]
    }));
    const replaced = buildSpellCheckReplacement(text, replacements);
    expect(replaced).not.toContain('己经');
    expect(replaced).not.toContain('在次');
  });

  it('produces valid CSV report format', () => {
    const results = scanSubtitleSpelling([
      { clipId: 'c7', start: 1.5, text: '己经完成' },
      { clipId: 'c8', start: 5.0, text: 'Teh result is correct' }
    ]);
    const csv = serializeSpellCheckReportCsv(results, { fps: 30 });
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(results.length + 1);
    expect(lines[0]).toBe('timecode,clip_id,matched_word,suggestion,original_text');
    expect(lines[1]).toContain('c7');
    expect(lines[1]).toContain('己经');
  });

  it('Chinese dictionary has entries', () => {
    expect(CHINESE_SPELL_CHECK_DICT.length).toBeGreaterThan(5);
  });

  it('English dictionary has entries', () => {
    expect(ENGLISH_SPELL_CHECK_DICT.length).toBeGreaterThan(10);
  });

  it('returns empty for clean text', () => {
    const results = scanSubtitleSpelling([{ clipId: 'c9', start: 9, text: 'All text is correct here' }]);
    expect(results.length).toBe(0);
  });
});
