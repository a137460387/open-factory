import { describe, expect, it, vi } from 'vitest';
import {
  parseEmotionToneResponse,
  buildEmotionTonePrompt,
  getClipsNeedingEmotionAnalysis,
  batchAnalyzeEmotionTones,
  EMOTION_COLORS,
  type EmotionAnalysis,
  type VideoClip,
} from '../src';
import { createProject } from '../src';

describe('parseEmotionToneResponse', () => {
  it('parses valid response', () => {
    const json = JSON.stringify({ emotionTone: 'calm', intensity: 0.8, reason: '平静的水面' });
    const result = parseEmotionToneResponse(json);
    expect(result).not.toBeNull();
    expect(result!.emotionTone).toBe('calm');
    expect(result!.intensity).toBe(0.8);
    expect(result!.reason).toBe('平静的水面');
  });

  it('returns null for invalid JSON', () => {
    expect(parseEmotionToneResponse('not json')).toBeNull();
  });

  it('returns null for invalid emotionTone value', () => {
    const json = JSON.stringify({ emotionTone: 'angry', intensity: 0.5, reason: 'test' });
    expect(parseEmotionToneResponse(json)).toBeNull();
  });

  it('returns null for intensity out of range', () => {
    const json = JSON.stringify({ emotionTone: 'calm', intensity: 1.5, reason: 'test' });
    expect(parseEmotionToneResponse(json)).toBeNull();
  });

  it('returns null for missing fields', () => {
    expect(parseEmotionToneResponse('{"emotionTone":"calm"}')).toBeNull();
  });

  it('parses all valid emotion tones', () => {
    for (const tone of ['energetic', 'calm', 'tense', 'happy', 'sad', 'neutral']) {
      const json = JSON.stringify({ emotionTone: tone, intensity: 0.5, reason: 'test' });
      const result = parseEmotionToneResponse(json);
      expect(result).not.toBeNull();
      expect(result!.emotionTone).toBe(tone);
    }
  });
});

describe('buildEmotionTonePrompt', () => {
  it('builds prompt without scene tag', () => {
    const prompt = buildEmotionTonePrompt();
    expect(prompt).toContain('emotionTone');
    expect(prompt).not.toContain('场景标签');
  });

  it('builds prompt with scene tag', () => {
    const prompt = buildEmotionTonePrompt('户外运动');
    expect(prompt).toContain('场景标签: 户外运动');
  });
});

describe('getClipsNeedingEmotionAnalysis', () => {
  it('returns clips without emotionAnalysis', () => {
    const project = createProject('Test');
    const clip = {
      id: 'clip-1', type: 'video' as const, name: 'test.mp4', mediaId: 'm1', trackId: 't1',
      start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: 1, volume: 1,
      colorCorrection: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, vibrance: 0, hue: 0, gamma: 0, exposure: 0 },
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    };
    project.timeline.tracks = [{ id: 't1', type: 'video', name: 'V', clips: [clip as any] }];
    const result = getClipsNeedingEmotionAnalysis(project);
    expect(result).toHaveLength(1);
  });

  it('skips clips that already have emotionAnalysis', () => {
    const project = createProject('Test');
    const clip = {
      id: 'clip-1', type: 'video' as const, name: 'test.mp4', mediaId: 'm1', trackId: 't1',
      start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: 1, volume: 1,
      colorCorrection: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, vibrance: 0, hue: 0, gamma: 0, exposure: 0 },
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      emotionAnalysis: { emotionTone: 'calm' as const, intensity: 0.5, reason: 'test', analyzedAt: new Date().toISOString() },
    };
    project.timeline.tracks = [{ id: 't1', type: 'video', name: 'V', clips: [clip as any] }];
    const result = getClipsNeedingEmotionAnalysis(project);
    expect(result).toHaveLength(0);
  });

  it('is backward compatible with no emotionAnalysis field', () => {
    const project = createProject('Test');
    const clip = {
      id: 'clip-1', type: 'video' as const, name: 'test.mp4', mediaId: 'm1', trackId: 't1',
      start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: 1, volume: 1,
      colorCorrection: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, vibrance: 0, hue: 0, gamma: 0, exposure: 0 },
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    };
    project.timeline.tracks = [{ id: 't1', type: 'video', name: 'V', clips: [clip as any] }];
    // Should work without emotionAnalysis field present
    const result = getClipsNeedingEmotionAnalysis(project);
    expect(result).toHaveLength(1);
  });
});

describe('batchAnalyzeEmotionTones', () => {
  const makeClip = (id: string): VideoClip => ({
    id, type: 'video', name: `${id}.mp4`, mediaId: 'm1', trackId: 't1',
    start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: 1, volume: 1,
    colorCorrection: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, vibrance: 0, hue: 0, gamma: 0, exposure: 0 },
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
  });

  it('enforces concurrency ≤ 3', async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;
    const clips = Array.from({ length: 9 }, (_, i) => makeClip(`clip-${i}`));

    const analyzeFn = async (clip: VideoClip): Promise<EmotionAnalysis> => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise((r) => setTimeout(r, 20));
      currentConcurrent--;
      return { emotionTone: 'calm', intensity: 0.5, reason: 'test', analyzedAt: new Date().toISOString() };
    };

    await batchAnalyzeEmotionTones(clips, analyzeFn, 3);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('preserves completed results when aborted', async () => {
    const clips = Array.from({ length: 6 }, (_, i) => makeClip(`clip-${i}`));
    const controller = new AbortController();

    const analyzeFn = async (clip: VideoClip): Promise<EmotionAnalysis | null> => {
      if (clip.id === 'clip-2') controller.abort();
      await new Promise((r) => setTimeout(r, 10));
      return { emotionTone: 'happy', intensity: 0.7, reason: 'test', analyzedAt: new Date().toISOString() };
    };

    const results = await batchAnalyzeEmotionTones(clips, analyzeFn, 3, controller.signal);
    // At least the first few should have completed
    expect(results.size).toBeGreaterThan(0);
    expect(results.size).toBeLessThan(6);
  });

  it('handles analyze function errors gracefully', async () => {
    const clips = [makeClip('clip-ok'), makeClip('clip-fail'), makeClip('clip-ok2')];
    const analyzeFn = async (clip: VideoClip): Promise<EmotionAnalysis | null> => {
      if (clip.id === 'clip-fail') throw new Error('AI error');
      return { emotionTone: 'neutral', intensity: 0.3, reason: 'test', analyzedAt: new Date().toISOString() };
    };

    const results = await batchAnalyzeEmotionTones(clips, analyzeFn);
    expect(results.size).toBe(2);
    expect(results.has('clip-fail')).toBe(false);
  });

  it('skips segments when analyze function returns null', async () => {
    const clips = [makeClip('clip-1'), makeClip('clip-2')];
    const analyzeFn = async (): Promise<EmotionAnalysis | null> => null;

    const results = await batchAnalyzeEmotionTones(clips, analyzeFn);
    expect(results.size).toBe(0);
  });
});
describe('EMOTION_COLORS', () => {
  it('has a color for every valid tone', () => {
    const tones = ['energetic', 'calm', 'tense', 'happy', 'sad', 'neutral'];
    for (const tone of tones) {
      expect(EMOTION_COLORS[tone as keyof typeof EMOTION_COLORS]).toBeDefined();
      expect(typeof EMOTION_COLORS[tone as keyof typeof EMOTION_COLORS]).toBe('string');
    }
  });
});
