import { describe, it, expect } from 'vitest';
import { generateNarrative } from '../src/ai-narrative-generator';
import type { EmotionAnalysisResult, EmotionPoint } from '../src/ai-emotion-analyzer';
import type { NarrativeTemplate, PacingType } from '../src/ai-narrative-generator';

function makeEmotionResult(points?: EmotionPoint[]): EmotionAnalysisResult {
  return {
    curve: points ?? [
      { time: 0, value: 0.3, arousal: 0.2, source: 'visual' },
      { time: 5, value: 0.5, arousal: 0.4, source: 'visual' },
      { time: 10, value: 0.8, arousal: 0.7, source: 'visual' },
      { time: 15, value: 0.6, arousal: 0.5, source: 'visual' },
      { time: 20, value: 0.3, arousal: 0.2, source: 'visual' },
    ],
    peaks: [],
    overallMood: 'neutral',
    emotionalArc: 'stable',
  };
}

// SceneBoundary as expected by generateNarrative at runtime
// (the generator uses startTime/endTime/sceneType/avgBrightness/avgMotion)
function makeScene(overrides: Record<string, unknown> = {}) {
  return {
    time: 0,
    score: 0.5,
    histogramDiff: 0.3,
    motionDiff: 0.2,
    threshold: 0.4,
    startTime: 0,
    endTime: 10,
    sceneType: 'indoor',
    avgBrightness: 0.5,
    avgMotion: 0.3,
    ...overrides,
  };
}

describe('generateNarrative', () => {
  it('generates storyline with default template (documentary)', () => {
    const result = generateNarrative(
      { scenes: [], emotions: makeEmotionResult() },
      { targetDuration: 60 },
    );

    expect(result.template).toBe('documentary');
    expect(result.pacing).toBe('moderate');
    expect(result.storyline.length).toBeGreaterThan(0);
    expect(result.totalDuration).toBeGreaterThan(0);
    expect(result.generatedAt).toBeTruthy();
  });

  it('generates storyline with documentary template', () => {
    const result = generateNarrative(
      { scenes: [], emotions: makeEmotionResult() },
      { template: 'documentary', targetDuration: 120 },
    );

    expect(result.template).toBe('documentary');
    expect(result.storyline).toHaveLength(4);
    expect(result.storyline[0].purpose).toContain('开场');
    expect(result.storyline[1].purpose).toContain('主体');
    expect(result.storyline[2].purpose).toContain('高潮');
    expect(result.storyline[3].purpose).toContain('结尾');
  });

  it('generates storyline with vlog template', () => {
    const result = generateNarrative(
      { scenes: [], emotions: makeEmotionResult() },
      { template: 'vlog', targetDuration: 90 },
    );

    expect(result.template).toBe('vlog');
    expect(result.storyline).toHaveLength(4);
    expect(result.storyline[0].purpose).toContain('开场');
    expect(result.storyline[3].purpose).toContain('结尾');
  });

  it('generates storyline with tutorial template', () => {
    const result = generateNarrative(
      { scenes: [], emotions: makeEmotionResult() },
      { template: 'tutorial', targetDuration: 180 },
    );

    expect(result.template).toBe('tutorial');
    expect(result.storyline).toHaveLength(4);
    expect(result.storyline[0].purpose).toContain('目标');
    expect(result.storyline[1].purpose).toContain('步骤');
  });

  it('generates storyline with cinematic template', () => {
    const result = generateNarrative(
      { scenes: [], emotions: makeEmotionResult() },
      { template: 'cinematic', targetDuration: 300 },
    );

    expect(result.template).toBe('cinematic');
    expect(result.storyline).toHaveLength(4);
    expect(result.storyline[0].purpose).toContain('序幕');
    expect(result.storyline[2].purpose).toContain('高潮');
    expect(result.storyline[3].purpose).toContain('结局');
  });

  it('respects custom targetDuration', () => {
    const shortResult = generateNarrative(
      { scenes: [], emotions: makeEmotionResult() },
      { targetDuration: 30 },
    );
    const longResult = generateNarrative(
      { scenes: [], emotions: makeEmotionResult() },
      { targetDuration: 300 },
    );

    expect(longResult.totalDuration).toBeGreaterThan(shortResult.totalDuration);
  });

  it('applies slow pacing multiplier', () => {
    const moderate = generateNarrative(
      { scenes: [], emotions: makeEmotionResult() },
      { targetDuration: 60, pacing: 'moderate' },
    );
    const slow = generateNarrative(
      { scenes: [], emotions: makeEmotionResult() },
      { targetDuration: 60, pacing: 'slow' },
    );

    expect(slow.totalDuration).toBeGreaterThan(moderate.totalDuration);
  });

  it('applies fast pacing multiplier', () => {
    const moderate = generateNarrative(
      { scenes: [], emotions: makeEmotionResult() },
      { targetDuration: 60, pacing: 'moderate' },
    );
    const fast = generateNarrative(
      { scenes: [], emotions: makeEmotionResult() },
      { targetDuration: 60, pacing: 'fast' },
    );

    expect(fast.totalDuration).toBeLessThan(moderate.totalDuration);
  });

  it('generates correct number of segments matching template', () => {
    const templates: NarrativeTemplate[] = ['documentary', 'vlog', 'tutorial', 'cinematic'];
    for (const template of templates) {
      const result = generateNarrative(
        { scenes: [], emotions: makeEmotionResult() },
        { template, targetDuration: 100 },
      );
      expect(result.storyline).toHaveLength(4);
    }
  });

  it('each segment has required fields', () => {
    const result = generateNarrative(
      { scenes: [], emotions: makeEmotionResult() },
      { targetDuration: 60 },
    );

    for (const seg of result.storyline) {
      expect(seg.id).toBeTruthy();
      expect(seg.purpose).toBeTruthy();
      expect(seg.duration).toBeGreaterThan(0);
      expect(typeof seg.emotionTarget).toBe('number');
      expect(['cut', 'fade', 'dissolve', 'wipe']).toContain(seg.transitionType);
      expect(Array.isArray(seg.suggestedClips)).toBe(true);
    }
  });

  it('matches scenes to segments when scenes are provided', () => {
    // The generator accesses start/endTime/sceneType on scene objects at runtime
    const scenes = [
      { start: 0, end: 10, startTime: 0, endTime: 10, sceneType: 'indoor', avgBrightness: 0.5, avgMotion: 0.2 },
      { start: 10, end: 20, startTime: 10, endTime: 20, sceneType: 'outdoor', avgBrightness: 0.7, avgMotion: 0.4 },
      { start: 20, end: 30, startTime: 20, endTime: 30, sceneType: 'action', avgBrightness: 0.6, avgMotion: 0.8 },
    ];

    const result = generateNarrative(
      { scenes, emotions: makeEmotionResult() },
      { template: 'documentary', targetDuration: 60 },
    );

    expect(result.storyline.length).toBeGreaterThan(0);
    expect(result.template).toBe('documentary');
  });

  it('uses default 60s duration when no scenes and no targetDuration', () => {
    const result = generateNarrative(
      { scenes: [], emotions: makeEmotionResult() },
    );

    // With moderate pacing, total should be around 60s
    expect(result.totalDuration).toBeGreaterThan(0);
    expect(result.totalDuration).toBeLessThan(100);
  });
});
