import { describe, it, expect } from 'vitest';
import {
  buildMusicMatchSystemPrompt,
  buildMusicMatchUserPrompt,
  parseMusicMatchResponse,
  scoreMediaAudioSimilarity,
  calculateAudioLoopOrTrimToDuration,
  rankAudioByMoodSimilarity
} from '../src/music-match';

describe('buildMusicMatchSystemPrompt', () => {
  it('returns a string containing JSON format instructions', () => {
    const prompt = buildMusicMatchSystemPrompt();
    expect(prompt).toContain('mood');
    expect(prompt).toContain('tempo');
    expect(prompt).toContain('genres');
    expect(prompt).toContain('keywords');
    expect(prompt).toContain('searchSuggestions');
    expect(prompt).toContain('JSON');
  });
});

describe('buildMusicMatchUserPrompt', () => {
  it('includes description and media info', () => {
    const prompt = buildMusicMatchUserPrompt('产品宣传片', [
      { mediaId: 'm1', filename: 'intro.mp4', type: 'video', duration: 10, mood: '积极' },
      { mediaId: 'm2', filename: 'bgm.mp3', type: 'audio', duration: 120 }
    ]);
    expect(prompt).toContain('产品宣传片');
    expect(prompt).toContain('intro.mp4');
    expect(prompt).toContain('bgm.mp3');
    expect(prompt).toContain('积极');
  });

  it('omits mood when not provided', () => {
    const prompt = buildMusicMatchUserPrompt('desc', [
      { mediaId: 'm1', filename: 'a.mp4', type: 'video', duration: 5 }
    ]);
    expect(prompt).not.toContain('氛围:');
  });
});

describe('parseMusicMatchResponse', () => {
  it('returns null for null input', () => {
    expect(parseMusicMatchResponse(null)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(parseMusicMatchResponse('string')).toBeNull();
  });

  it('returns null when mood is missing', () => {
    expect(parseMusicMatchResponse({ tempo: 'fast', genres: [], keywords: [], searchSuggestions: [] })).toBeNull();
  });

  it('returns null when mood is empty string', () => {
    expect(parseMusicMatchResponse({ mood: '', tempo: 'fast' })).toBeNull();
  });

  it('parses a valid response', () => {
    const result = parseMusicMatchResponse({
      mood: '活力积极',
      tempo: 'fast',
      genres: ['流行', '电子'],
      keywords: ['upbeat', 'energetic'],
      searchSuggestions: ['upbeat electronic background music']
    });
    expect(result).not.toBeNull();
    expect(result!.mood).toBe('活力积极');
    expect(result!.tempo).toBe('fast');
    expect(result!.genres).toEqual(['流行', '电子']);
    expect(result!.keywords).toEqual(['upbeat', 'energetic']);
    expect(result!.searchSuggestions).toEqual(['upbeat electronic background music']);
  });

  it('defaults invalid tempo to medium', () => {
    const result = parseMusicMatchResponse({ mood: 'calm', tempo: 'invalid' });
    expect(result!.tempo).toBe('medium');
  });

  it('defaults missing tempo to medium', () => {
    const result = parseMusicMatchResponse({ mood: 'calm' });
    expect(result!.tempo).toBe('medium');
  });

  it('filters out non-string array elements', () => {
    const result = parseMusicMatchResponse({
      mood: 'test',
      genres: ['rock', 123, null, 'jazz'],
      keywords: [true, 'kw1'],
      searchSuggestions: ['s1', 42]
    });
    expect(result!.genres).toEqual(['rock', 'jazz']);
    expect(result!.keywords).toEqual(['kw1']);
    expect(result!.searchSuggestions).toEqual(['s1']);
  });
});

describe('scoreMediaAudioSimilarity', () => {
  it('returns 0 for empty inputs', () => {
    expect(scoreMediaAudioSimilarity('', 'happy')).toBe(0);
    expect(scoreMediaAudioSimilarity('happy', '')).toBe(0);
    expect(scoreMediaAudioSimilarity('', '')).toBe(0);
  });

  it('returns 1 for identical single-word moods', () => {
    expect(scoreMediaAudioSimilarity('happy', 'happy')).toBe(1);
  });

  it('returns partial match for overlapping multi-word moods', () => {
    const score = scoreMediaAudioSimilarity('happy energetic', 'happy calm');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('is case-insensitive', () => {
    expect(scoreMediaAudioSimilarity('Happy', 'happy')).toBe(1);
  });

  it('handles Chinese comma separators', () => {
    expect(scoreMediaAudioSimilarity('活力，动感', '活力，动感')).toBe(1);
  });
});

describe('calculateAudioLoopOrTrimToDuration', () => {
  it('returns zeros for zero audio duration', () => {
    expect(calculateAudioLoopOrTrimToDuration(0, 90)).toEqual({ loops: 0, trimEnd: 0 });
  });

  it('returns zeros for zero target duration', () => {
    expect(calculateAudioLoopOrTrimToDuration(120, 0)).toEqual({ loops: 0, trimEnd: 0 });
  });

  it('returns 1 loop when audio is longer than target', () => {
    const result = calculateAudioLoopOrTrimToDuration(120, 90);
    expect(result.loops).toBe(1);
    expect(result.trimEnd).toBe(30);
  });

  it('returns multiple loops when audio is shorter than target', () => {
    const result = calculateAudioLoopOrTrimToDuration(30, 90);
    expect(result.loops).toBe(3);
    expect(result.trimEnd).toBe(0);
  });

  it('calculates trim for non-exact multiple', () => {
    const result = calculateAudioLoopOrTrimToDuration(30, 80);
    expect(result.loops).toBe(3);
    expect(result.trimEnd).toBe(10);
  });
});

describe('rankAudioByMoodSimilarity', () => {
  it('returns empty array for empty input', () => {
    expect(rankAudioByMoodSimilarity('happy', [])).toEqual([]);
  });

  it('ranks assets by similarity descending', () => {
    const assets = [
      { id: 'a1', name: 'calm.mp3', aiAnalysis: { mood: 'calm' } },
      { id: 'a2', name: 'happy.mp3', aiAnalysis: { mood: 'happy energetic' } },
      { id: 'a3', name: 'no-mood.mp3' }
    ];
    const ranked = rankAudioByMoodSimilarity('happy', assets);
    expect(ranked[0].mediaId).toBe('a2');
    expect(ranked[0].similarity).toBeGreaterThan(ranked[1].similarity);
  });

  it('gives 0 similarity to assets without aiAnalysis', () => {
    const assets = [
      { id: 'a1', name: 'no-analysis.mp3' }
    ];
    const ranked = rankAudioByMoodSimilarity('happy', assets);
    expect(ranked[0].similarity).toBe(0);
  });
});
