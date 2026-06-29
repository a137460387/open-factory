import { describe, expect, it } from 'vitest';
import {
  countCharacters,
  getRecommendedMax,
  calculateReadingSpeed,
  detectSharedPrefix,
  autoSplitSubtitle,
  calculateSafeDuration,
  wouldOverlapNextSegment,
  READING_SPEED_LIMITS,
  WARNING_THRESHOLD_RATIO,
  CRITICAL_THRESHOLD_RATIO,
} from '../src';

describe('countCharacters', () => {
  it('counts Chinese characters (excluding whitespace and punctuation)', () => {
    expect(countCharacters('你好世界', 'zh')).toBe(4);
  });

  it('counts Japanese characters', () => {
    expect(countCharacters('こんにちは世界', 'ja')).toBe(7);
  });

  it('counts Korean characters', () => {
    expect(countCharacters('안녕하세요', 'ko')).toBe(5);
  });

  it('counts English words, not characters', () => {
    expect(countCharacters('Hello world', 'en')).toBe(2);
  });

  it('handles English with extra whitespace', () => {
    expect(countCharacters('  Hello   world  ', 'en')).toBe(2);
  });

  it('returns 0 for empty text', () => {
    expect(countCharacters('', 'zh')).toBe(0);
    expect(countCharacters('', 'en')).toBe(0);
  });

  it('strips punctuation for CJK languages', () => {
    expect(countCharacters('你好，世界！', 'zh')).toBe(4);
  });

  it('handles single English word', () => {
    expect(countCharacters('Hello', 'en')).toBe(1);
  });
});

describe('getRecommendedMax', () => {
  it('returns correct limits for known languages', () => {
    expect(getRecommendedMax('zh')).toBe(READING_SPEED_LIMITS.zh);
    expect(getRecommendedMax('en')).toBe(READING_SPEED_LIMITS.en);
    expect(getRecommendedMax('ja')).toBe(READING_SPEED_LIMITS.ja);
    expect(getRecommendedMax('ko')).toBe(READING_SPEED_LIMITS.ko);
  });

  it('falls back to English for unknown languages', () => {
    expect(getRecommendedMax('fr')).toBe(READING_SPEED_LIMITS.en);
    expect(getRecommendedMax('unknown')).toBe(READING_SPEED_LIMITS.en);
  });
});

describe('calculateReadingSpeed', () => {
  it('returns null for empty text', () => {
    expect(calculateReadingSpeed('', 0, 2)).toBeNull();
  });

  it('returns null for zero or negative duration', () => {
    expect(calculateReadingSpeed('你好世界', 1, 1)).toBeNull();
    expect(calculateReadingSpeed('你好世界', 2, 1)).toBeNull();
  });

  it('returns null when speed is within ok range', () => {
    // 4 chars / 2 seconds = 2 cps, limit for zh = 6, so well under
    expect(calculateReadingSpeed('你好世界', 0, 2, 'zh')).toBeNull();
  });

  it('returns warning when speed exceeds 100% of limit', () => {
    // Need cps > 6.0 (zh limit). 7 chars / 1 second = 7 cps > 6.0
    const result = calculateReadingSpeed('你好世界测试啊', 0, 1, 'zh');
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.charsPerSecond).toBe(7);
    expect(result!.recommendedMax).toBe(6);
  });

  it('returns critical when speed exceeds 120% of limit', () => {
    // Need cps > 6 * 1.2 = 7.2. 8 chars / 1 second = 8 cps > 7.2
    const result = calculateReadingSpeed('你好世界测试速度啊', 0, 1, 'zh');
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
  });

  it('boundary: exactly at warning threshold (100%)', () => {
    // 6 chars / 1 second = 6.0 cps = exactly 100% of 6.0
    // Should be ok (not > 100%)
    const result = calculateReadingSpeed('你好世界测试', 0, 1, 'zh');
    expect(result).toBeNull(); // exactly at threshold, not above
  });

  it('boundary: just above warning threshold', () => {
    // 6.1 chars/second needed → but chars must be integer
    // 7 chars / 1.15 seconds ≈ 6.087 > 6.0
    const result = calculateReadingSpeed('你好世界测试啊', 0, 1.15, 'zh');
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
  });

  it('boundary: exactly at critical threshold (120%) returns warning, not critical', () => {
    // cps = exactly 7.2 = 120% of 6.0 → code uses > not >=, so this is warning
    const exactTime = 7 / (READING_SPEED_LIMITS.zh * CRITICAL_THRESHOLD_RATIO);
    const result = calculateReadingSpeed('你好世界测试啊', 0, exactTime, 'zh');
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
  });

  it('boundary: just above critical threshold (120%)', () => {
    // Make time slightly shorter so cps > 7.2
    const slightlyLessTime = (7 / (READING_SPEED_LIMITS.zh * CRITICAL_THRESHOLD_RATIO)) - 0.01;
    const result = calculateReadingSpeed('你好世界测试啊', 0, slightlyLessTime, 'zh');
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
  });

  it('works with English language', () => {
    // en limit = 20 chars/s. 25 words / 1 second = 25 > 20
    const text = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty one two three four five';
    const result = calculateReadingSpeed(text, 0, 1, 'en');
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
  });

  it('uses default language zh when not specified', () => {
    const result = calculateReadingSpeed('你好世界测试啊', 0, 1);
    expect(result).not.toBeNull();
    expect(result!.recommendedMax).toBe(READING_SPEED_LIMITS.zh);
  });
});

describe('detectSharedPrefix', () => {
  it('detects shared prefix of sufficient length', () => {
    expect(detectSharedPrefix('Hello world', 'Hello everyone')).toBe(true);
  });

  it('returns false when prefix differs early', () => {
    expect(detectSharedPrefix('Hello', 'World')).toBe(false);
  });

  it('returns false for empty strings', () => {
    expect(detectSharedPrefix('', 'Hello')).toBe(false);
    expect(detectSharedPrefix('Hello', '')).toBe(false);
    expect(detectSharedPrefix('', '')).toBe(false);
  });

  it('respects custom minPrefixLength', () => {
    expect(detectSharedPrefix('Hi', 'Ho', 1)).toBe(true);  // share 'H'
    expect(detectSharedPrefix('Hi', 'Ho', 2)).toBe(false); // differ at index 1
  });
});

describe('autoSplitSubtitle', () => {
  it('splits at nearest punctuation to center', () => {
    const result = autoSplitSubtitle('你好世界，测试速度', 0, 4);
    expect(result.textA).toBe('你好世界，');
    expect(result.textB).toBe('测试速度');
    expect(result.splitTime).toBeGreaterThan(0);
    expect(result.splitTime).toBeLessThan(4);
  });

  it('splits at midpoint when no punctuation', () => {
    const result = autoSplitSubtitle('你好世界测试', 0, 4);
    expect(result.textA.length).toBeGreaterThan(0);
    expect(result.textB.length).toBeGreaterThan(0);
    expect(result.textA + result.textB).toContain('你好世界测试');
  });

  it('handles English text with punctuation', () => {
    const result = autoSplitSubtitle('Hello world, how are you', 0, 4);
    expect(result.textA).toContain(',');
    expect(result.textB.length).toBeGreaterThan(0);
  });

  it('splitTime is proportional to text length', () => {
    const result = autoSplitSubtitle('AB', 0, 4);
    expect(result.splitTime).toBeGreaterThan(0);
    expect(result.splitTime).toBeLessThanOrEqual(4);
  });
});

describe('calculateSafeDuration', () => {
  it('calculates safe end time for Chinese text', () => {
    // 4 chars / 6 cps = 0.6667s
    const endTime = calculateSafeDuration('你好世界', 0, 'zh');
    expect(endTime).toBeCloseTo(4 / 6, 2);
  });

  it('adds safe duration to non-zero start time', () => {
    const endTime = calculateSafeDuration('你好世界', 5, 'zh');
    expect(endTime).toBeCloseTo(5 + 4 / 6, 2);
  });

  it('uses English word count', () => {
    // 2 words / 20 cps = 0.1s
    const endTime = calculateSafeDuration('Hello world', 0, 'en');
    expect(endTime).toBeCloseTo(2 / 20, 2);
  });
});

describe('wouldOverlapNextSegment', () => {
  it('returns true when new end time exceeds next start time', () => {
    expect(wouldOverlapNextSegment(5.0, 4.5)).toBe(true);
  });

  it('returns false when new end time is before next start time', () => {
    expect(wouldOverlapNextSegment(4.0, 5.0)).toBe(false);
  });

  it('returns false when difference is within tolerance', () => {
    // 5.005 - 5.0 = 0.005 < 0.01 tolerance
    expect(wouldOverlapNextSegment(5.005, 5.0)).toBe(false);
  });

  it('boundary: exactly at tolerance', () => {
    // 5.01 - 5.0 = 0.01 = tolerance exactly, should be false (not >)
    expect(wouldOverlapNextSegment(5.01, 5.0, 0.01)).toBe(false);
  });

  it('boundary: just beyond tolerance', () => {
    expect(wouldOverlapNextSegment(5.011, 5.0, 0.01)).toBe(true);
  });
});
