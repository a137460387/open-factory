import { describe, it, expect } from 'vitest';
import {
  detectTTSLanguage,
  getAvailableVoices,
  getVoicesByLanguage,
  getVoicesByGender,
  getVoiceById,
  recommendVoice,
  preprocessText,
  segmentText,
  calculateTextStats,
  normalizeTTSParams,
  adjustDurationBySpeed,
  adjustTimingsBySpeed,
  applyVolume,
  applyFadeInOut,
  generateSilence,
  pcmToWav,
  validateTTSParams,
} from './tts';

describe('detectTTSLanguage', () => {
  it('detects Chinese', () => {
    expect(detectTTSLanguage('你好世界')).toBe('zh');
  });

  it('detects English', () => {
    expect(detectTTSLanguage('Hello world')).toBe('en');
  });

  it('detects Japanese', () => {
    expect(detectTTSLanguage('こんにちは')).toBe('ja');
  });

  it('detects Korean', () => {
    expect(detectTTSLanguage('안녕하세요')).toBe('ko');
  });

  it('returns auto for empty', () => {
    expect(detectTTSLanguage('')).toBe('auto');
  });

  it('returns auto for whitespace only', () => {
    expect(detectTTSLanguage('   ')).toBe('auto');
  });

  it('returns auto for numbers only', () => {
    expect(detectTTSLanguage('12345')).toBe('auto');
  });

  it('detects mixed Chinese with some Japanese', () => {
    const text = '你好世界' + 'こんにちは';
    expect(detectTTSLanguage(text)).toBe('ja');
  });
});

describe('getAvailableVoices', () => {
  it('returns an array', () => {
    const voices = getAvailableVoices();
    expect(Array.isArray(voices)).toBe(true);
    expect(voices.length).toBeGreaterThan(0);
  });
});

describe('getVoicesByLanguage', () => {
  it('filters by language', () => {
    const voices = getVoicesByLanguage('zh');
    expect(voices.length).toBeGreaterThan(0);
    for (const v of voices) {
      expect(v.language).toBe('zh');
    }
  });
});

describe('getVoicesByGender', () => {
  it('filters by gender', () => {
    const voices = getVoicesByGender('male');
    expect(voices.length).toBeGreaterThan(0);
  });
});

describe('getVoiceById', () => {
  it('returns undefined for unknown id', () => {
    expect(getVoiceById('nonexistent')).toBeUndefined();
  });

  it('returns voice for known id', () => {
    const voices = getAvailableVoices();
    expect(voices.length).toBeGreaterThan(0);
    const found = getVoiceById(voices[0].id);
    expect(found).toBeDefined();
  });
});

describe('recommendVoice', () => {
  it('returns a voice', () => {
    const voice = recommendVoice('你好');
    expect(voice).toBeDefined();
  });

  it('returns a voice for empty text', () => {
    const voice = recommendVoice('');
    expect(voice).toBeDefined();
  });
});

describe('preprocessText', () => {
  it('returns empty for empty input', () => {
    expect(preprocessText('')).toBe('');
  });

  it('trims whitespace', () => {
    expect(preprocessText('  hello  ')).toBe('hello');
  });

  it('normalizes Chinese punctuation', () => {
    const result = preprocessText('你好，世界！');
    expect(result).toContain(',');
    expect(result).toContain('!');
  });

  it('removes extra whitespace', () => {
    expect(preprocessText('hello   world')).toBe('hello world');
  });

  it('removes control characters', () => {
    expect(preprocessText('hello\x00world')).toBe('helloworld');
  });
});

describe('segmentText', () => {
  it('returns empty for empty input', () => {
    expect(segmentText('')).toEqual([]);
  });

  it('returns single segment for short text', () => {
    const result = segmentText('hello');
    expect(result).toEqual(['hello']);
  });

  it('splits long text', () => {
    const text = 'a'.repeat(200);
    const result = segmentText(text, 50);
    expect(result.length).toBeGreaterThan(1);
  });

  it('splits at sentence boundaries', () => {
    const text = 'First sentence. Second sentence. Third sentence that is very long and should be split somewhere.';
    const result = segmentText(text, 40);
    expect(result.length).toBeGreaterThan(1);
  });

  it('splits at comma boundaries', () => {
    const text = 'first part, second part, third part, fourth part that goes on and on';
    const result = segmentText(text, 30);
    expect(result.length).toBeGreaterThan(1);
  });

  it('handles custom maxLength', () => {
    const text = 'hello world this is a test';
    const result = segmentText(text, 10);
    expect(result.length).toBeGreaterThan(1);
  });
});

describe('calculateTextStats', () => {
  it('returns zeros for empty', () => {
    const stats = calculateTextStats('');
    expect(stats.charCount).toBe(0);
    expect(stats.wordCount).toBe(0);
    expect(stats.sentenceCount).toBe(0);
    expect(stats.estimatedDurationMs).toBe(0);
  });

  it('counts Chinese characters', () => {
    const stats = calculateTextStats('你好世界');
    expect(stats.charCount).toBe(4);
    expect(stats.wordCount).toBe(4);
    expect(stats.language).toBe('zh');
  });

  it('counts English words', () => {
    const stats = calculateTextStats('Hello world');
    expect(stats.wordCount).toBe(2);
    expect(stats.language).toBe('en');
  });

  it('counts sentences', () => {
    const stats = calculateTextStats('Hello. World! How are you?');
    expect(stats.sentenceCount).toBe(3);
  });

  it('estimates duration for Chinese', () => {
    const stats = calculateTextStats('你好世界');
    expect(stats.estimatedDurationMs).toBeGreaterThan(0);
  });
});

describe('normalizeTTSParams', () => {
  it('normalizes speed', () => {
    const result = normalizeTTSParams({ text: 'hello', speed: 5 });
    expect(result.speed).toBeLessThanOrEqual(3);
  });

  it('normalizes pitch', () => {
    const result = normalizeTTSParams({ text: 'hello', pitch: 5 });
    expect(result.pitch).toBeLessThanOrEqual(2);
  });

  it('normalizes volume', () => {
    const result = normalizeTTSParams({ text: 'hello', volume: 5 });
    expect(result.volume).toBeLessThanOrEqual(2);
  });

  it('uses defaults for missing values', () => {
    const result = normalizeTTSParams({ text: 'hello' });
    expect(result.speed).toBeDefined();
    expect(result.pitch).toBeDefined();
    expect(result.volume).toBeDefined();
  });
});

describe('adjustDurationBySpeed', () => {
  it('divides by speed', () => {
    expect(adjustDurationBySpeed(1000, 2)).toBe(500);
  });

  it('clamps speed', () => {
    const result = adjustDurationBySpeed(1000, 0);
    expect(result).toBeGreaterThan(0);
  });
});

describe('adjustTimingsBySpeed', () => {
  it('adjusts timings', () => {
    const timings = [{ word: 'hello', startMs: 1000, endMs: 2000 }];
    const result = adjustTimingsBySpeed(timings, 2);
    expect(result[0].startMs).toBe(500);
    expect(result[0].endMs).toBe(1000);
  });
});

describe('applyVolume', () => {
  it('applies volume', () => {
    const data = new Float32Array([0.5, -0.5, 1, -1]);
    const result = applyVolume(data, 0.5);
    expect(result[0]).toBeCloseTo(0.25);
    expect(result[1]).toBeCloseTo(-0.25);
  });

  it('clamps to [-1, 1]', () => {
    const data = new Float32Array([0.8]);
    const result = applyVolume(data, 2);
    expect(result[0]).toBeLessThanOrEqual(1);
  });
});

describe('applyFadeInOut', () => {
  it('applies fade in', () => {
    const data = new Float32Array(4410).fill(1);
    const result = applyFadeInOut(data, 44100, 10, 0);
    expect(result[0]).toBeCloseTo(0);
    expect(result[4409]).toBeCloseTo(1);
  });

  it('applies fade out', () => {
    const data = new Float32Array(4410).fill(1);
    const result = applyFadeInOut(data, 44100, 0, 10);
    expect(result[0]).toBeCloseTo(1);
    expect(result[4409]).toBeCloseTo(0);
  });
});

describe('generateSilence', () => {
  it('generates silent audio', () => {
    const silence = generateSilence(44100, 100);
    expect(silence.length).toBe(Math.round(44100 * 100 / 1000));
    for (let i = 0; i < silence.length; i++) {
      expect(silence[i]).toBe(0);
    }
  });
});

describe('pcmToWav', () => {
  it('creates valid WAV buffer', () => {
    const pcm = new Float32Array([0, 0.5, -0.5, 1]);
    const wav = pcmToWav(pcm, 44100);
    expect(wav).toBeInstanceOf(ArrayBuffer);
    expect(wav.byteLength).toBe(44 + pcm.length * 2);
  });

  it('starts with RIFF header', () => {
    const pcm = new Float32Array(10);
    const wav = pcmToWav(pcm, 44100);
    const view = new DataView(wav);
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    expect(riff).toBe('RIFF');
  });
});

describe('validateTTSParams', () => {
  it('returns no issues for valid params', () => {
    const voices = getAvailableVoices();
    const issues = validateTTSParams({ text: 'hello', voiceId: voices[0].id });
    expect(issues.length).toBe(0);
  });

  it('reports empty text', () => {
    const issues = validateTTSParams({ text: '', voiceId: 'test' });
    expect(issues.some(i => i.type === 'empty-text')).toBe(true);
  });

  it('reports whitespace-only text', () => {
    const issues = validateTTSParams({ text: '   ', voiceId: 'test' });
    expect(issues.some(i => i.type === 'empty-text')).toBe(true);
  });

  it('reports text too long', () => {
    const longText = 'a'.repeat(10001);
    const issues = validateTTSParams({ text: longText, voiceId: 'test' });
    expect(issues.some(i => i.type === 'text-too-long')).toBe(true);
  });

  it('reports speed out of range', () => {
    const issues = validateTTSParams({ text: 'hello', voiceId: 'test', speed: 5 });
    expect(issues.some(i => i.type === 'invalid-params')).toBe(true);
  });

  it('reports negative speed', () => {
    const issues = validateTTSParams({ text: 'hello', voiceId: 'test', speed: -1 });
    expect(issues.some(i => i.type === 'invalid-params')).toBe(true);
  });

  it('reports pitch out of range', () => {
    const issues = validateTTSParams({ text: 'hello', voiceId: 'test', pitch: 5 });
    expect(issues.some(i => i.type === 'invalid-params')).toBe(true);
  });

  it('reports volume out of range', () => {
    const issues = validateTTSParams({ text: 'hello', voiceId: 'test', volume: 2 });
    expect(issues.some(i => i.type === 'invalid-params')).toBe(true);
  });

  it('reports negative volume', () => {
    const issues = validateTTSParams({ text: 'hello', voiceId: 'test', volume: -0.5 });
    expect(issues.some(i => i.type === 'invalid-params')).toBe(true);
  });

  it('reports voice not found', () => {
    const issues = validateTTSParams({ text: 'hello', voiceId: 'nonexistent-voice-id' });
    expect(issues.some(i => i.type === 'voice-not-found')).toBe(true);
  });

  it('accepts custom maxTextLength', () => {
    const issues = validateTTSParams({ text: 'hello', voiceId: 'test' }, { maxTextLength: 3 });
    expect(issues.some(i => i.type === 'text-too-long')).toBe(true);
  });
});
