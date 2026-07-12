import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies before importing the module under test.
vi.mock('../src/ai-scene-detector', () => ({
  detectScenes: vi.fn(() => ({
    boundaries: [{ time: 5, score: 0.8, histogramDiff: 0.7, motionDiff: 0.3, threshold: 0.4 }],
    segments: [
      { start: 0, end: 5, sceneType: 'indoor', avgBrightness: 0.5, avgMotion: 0.2 },
      { start: 5, end: 10, sceneType: 'outdoor', avgBrightness: 0.7, avgMotion: 0.4 },
    ],
    thresholdCurve: [{ time: 5, threshold: 0.4 }],
    sampleCount: 10,
    scenes: [
      { start: 0, end: 5, sceneType: 'indoor', avgBrightness: 0.5, avgMotion: 0.2 },
      { start: 5, end: 10, sceneType: 'outdoor', avgBrightness: 0.7, avgMotion: 0.4 },
    ],
  })),
}));

vi.mock('../src/ai-emotion-analyzer', () => ({
  analyzeEmotion: vi.fn(() => ({
    curve: [
      { time: 0, value: 0.3, arousal: 0.2, source: 'visual' },
      { time: 5, value: 0.7, arousal: 0.5, source: 'visual' },
      { time: 10, value: 0.5, arousal: 0.3, source: 'visual' },
    ],
    peaks: [{ time: 5, value: 0.7, type: 'positive' }],
    overallMood: 'positive',
    emotionalArc: 'rising',
  })),
}));

vi.mock('../src/ai-speech-understanding', () => ({
  understandSpeech: vi.fn(() => ({
    topics: ['nature', 'travel'],
    summary: 'A scenic travel video',
    keywords: ['landscape', 'mountain'],
    language: 'zh',
    segments: [],
  })),
}));

vi.mock('../src/ai-narrative-analyzer', () => ({
  analyzeNarrative: vi.fn(() => ({
    structure: {
      acts: [
        { label: 'setup', start: 0, end: 2.5, segmentIndices: [0] },
        { label: 'development', start: 2.5, end: 5, segmentIndices: [0] },
        { label: 'climax', start: 5, end: 7.5, segmentIndices: [1] },
        { label: 'resolution', start: 7.5, end: 10, segmentIndices: [1] },
      ],
      peakIndex: 1,
      troughIndex: 0,
      hasClimax: true,
    },
    arc: {
      points: [
        { time: 0, tension: 0.3, act: 'setup' },
        { time: 5, tension: 0.7, act: 'climax' },
        { time: 10, tension: 0.4, act: 'resolution' },
      ],
      peakTime: 5,
      troughTime: 0,
    },
    score: 72,
    suggestions: [
      { category: 'structure', severity: 'info', message: 'Good narrative structure.' },
    ],
  })),
}));

vi.mock('../src/ai-smart-recommender', () => ({
  recommendClips: vi.fn(() => ({
    clips: [
      { id: 'c1', score: 0.9, reason: 'Matches opening mood' },
      { id: 'c2', score: 0.7, reason: 'Good transition' },
    ],
  })),
}));

vi.mock('../src/ai-narrative-generator', () => ({
  generateNarrative: vi.fn(() => ({
    storyline: [
      { id: 'segment-0', sceneType: 'outdoor', purpose: 'Opening', suggestedClips: [], duration: 15, emotionTarget: 0.15, transitionType: 'fade' },
      { id: 'segment-1', sceneType: 'indoor', purpose: 'Main', suggestedClips: [], duration: 30, emotionTarget: 0.45, transitionType: 'cut' },
      { id: 'segment-2', sceneType: 'action', purpose: 'Climax', suggestedClips: [], duration: 12, emotionTarget: 0.75, transitionType: 'dissolve' },
      { id: 'segment-3', sceneType: 'indoor', purpose: 'Ending', suggestedClips: [], duration: 9, emotionTarget: 0.2, transitionType: 'fade' },
    ],
    totalDuration: 66,
    pacing: 'moderate',
    template: 'documentary',
    generatedAt: '2025-01-01T00:00:00.000Z',
  })),
}));

import { orchestrateSmartCreation } from '../src/ai-smart-creation-orchestrator';
import { detectScenes } from '../src/ai-scene-detector';
import { analyzeEmotion } from '../src/ai-emotion-analyzer';
import { understandSpeech } from '../src/ai-speech-understanding';
import { analyzeNarrative } from '../src/ai-narrative-analyzer';
import { recommendClips } from '../src/ai-smart-recommender';
import { generateNarrative } from '../src/ai-narrative-generator';

function makeMedia(overrides: Record<string, unknown> = {}) {
  return {
    id: 'media-1',
    name: 'clip.mp4',
    type: 'video',
    path: '/media/clip.mp4',
    duration: 30,
    width: 1920,
    height: 1080,
    size: 1024,
    mtimeMs: Date.now(),
    hasAudio: true,
    contentAnalysis: {
      segments: [
        { start: 0, end: 5, brightness: 0.5, motion: 0.2, sceneTypes: ['indoor'] },
        { start: 5, end: 10, brightness: 0.7, motion: 0.4, sceneTypes: ['outdoor'] },
      ],
      emotionCurve: [
        { time: 0, value: 0.3, brightness: 0.5 },
        { time: 5, value: 0.7, brightness: 0.7 },
      ],
    },
    aiAnalysis: {
      transcript: 'Hello world, welcome to the video.',
    },
    ...overrides,
  };
}

describe('orchestrateSmartCreation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes the full pipeline and returns all analysis results', async () => {
    const media = [makeMedia()];
    const result = await orchestrateSmartCreation(media);

    expect(result.scenes).toBeDefined();
    expect(result.emotions).toBeDefined();
    expect(result.speech).toBeDefined();
    expect(result.narrative).toBeDefined();
    expect(result.recommendations).toBeDefined();
    expect(result.analyzedAt).toBeTruthy();
  });

  it('calls detectScenes with visual samples from media', async () => {
    const media = [makeMedia()];
    await orchestrateSmartCreation(media);

    expect(detectScenes).toHaveBeenCalled();
    const callArgs = (detectScenes as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(Array.isArray(callArgs[0])).toBe(true);
  });

  it('calls analyzeEmotion with visual and audio samples', async () => {
    const media = [makeMedia()];
    await orchestrateSmartCreation(media);

    expect(analyzeEmotion).toHaveBeenCalled();
  });

  it('calls analyzeNarrative with scene and emotion data', async () => {
    const media = [makeMedia()];
    await orchestrateSmartCreation(media);

    expect(analyzeNarrative).toHaveBeenCalled();
  });

  it('calls recommendClips with extracted clips', async () => {
    const media = [makeMedia()];
    await orchestrateSmartCreation(media);

    expect(recommendClips).toHaveBeenCalled();
  });

  it('invokes progress callback for each phase', async () => {
    const media = [makeMedia()];
    const onProgress = vi.fn();

    await orchestrateSmartCreation(media, { onProgress });

    expect(onProgress).toHaveBeenCalled();
    // Should be called multiple times (at least start and end of each phase)
    expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(4);

    // Verify progress structure
    const firstCall = onProgress.mock.calls[0][0];
    expect(firstCall).toHaveProperty('phase');
    expect(firstCall).toHaveProperty('progress');
    expect(firstCall).toHaveProperty('message');
    expect(typeof firstCall.progress).toBe('number');
    expect(firstCall.progress).toBeGreaterThanOrEqual(0);
    expect(firstCall.progress).toBeLessThanOrEqual(100);
  });

  it('reports progress from 0 to 100 across phases', async () => {
    const media = [makeMedia()];
    const progressValues: number[] = [];
    const onProgress = (p: { progress: number }) => {
      progressValues.push(p.progress);
    };

    // With narrativeTemplate, all phases including storyline run (total weight = 100)
    await orchestrateSmartCreation(media, { onProgress, narrativeTemplate: 'documentary' });

    // Progress should start near 0 and end at 100
    expect(progressValues[0]).toBeLessThanOrEqual(30);
    expect(progressValues[progressValues.length - 1]).toBe(100);
  });

  it('skips speech understanding when enableSpeechUnderstanding is false', async () => {
    const media = [makeMedia()];
    const result = await orchestrateSmartCreation(media, {
      enableSpeechUnderstanding: false,
    });

    expect(result.speech).toBeUndefined();
    expect(understandSpeech).not.toHaveBeenCalled();
  });

  it('includes speech when enableSpeechUnderstanding is true (default)', async () => {
    const media = [makeMedia({ aiAnalysis: { transcript: 'Test transcript' } })];
    const result = await orchestrateSmartCreation(media);

    expect(result.speech).toBeDefined();
    expect(understandSpeech).toHaveBeenCalled();
  });

  it('generates storyline when narrativeTemplate is provided', async () => {
    const media = [makeMedia()];
    const result = await orchestrateSmartCreation(media, {
      narrativeTemplate: 'cinematic',
      targetDuration: 120,
      pacing: 'slow',
    });

    expect(result.storyline).toBeDefined();
    expect(result.storyline?.storyline.length).toBeGreaterThan(0);
    expect(generateNarrative).toHaveBeenCalled();
  });

  it('does not generate storyline when narrativeTemplate is omitted', async () => {
    const media = [makeMedia()];
    const result = await orchestrateSmartCreation(media);

    expect(result.storyline).toBeUndefined();
    expect(generateNarrative).not.toHaveBeenCalled();
  });

  it('passes custom sceneDetection options to detectScenes', async () => {
    const media = [makeMedia()];
    const customOptions = { histogramThreshold: 0.5, motionThreshold: 0.7 };
    await orchestrateSmartCreation(media, { sceneDetection: customOptions });

    expect(detectScenes).toHaveBeenCalled();
    const callArgs = (detectScenes as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1]).toEqual(customOptions);
  });

  it('passes maxRecommendations to the recommendation phase', async () => {
    const media = [makeMedia()];
    await orchestrateSmartCreation(media, { maxRecommendations: 5 });

    expect(recommendClips).toHaveBeenCalled();
    const callArgs = (recommendClips as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = callArgs[2];
    expect(options.maxResults).toBe(5);
  });

  it('handles media without contentAnalysis gracefully', async () => {
    const media = [makeMedia({ contentAnalysis: undefined })];
    const result = await orchestrateSmartCreation(media);

    expect(result.scenes).toBeDefined();
    expect(result.emotions).toBeDefined();
  });

  it('handles media without aiAnalysis transcript gracefully', async () => {
    const media = [makeMedia({ aiAnalysis: undefined })];
    const result = await orchestrateSmartCreation(media, {
      enableSpeechUnderstanding: true,
    });

    // Speech should be undefined since there is no transcript
    expect(result.speech).toBeUndefined();
  });

  it('handles empty media array', async () => {
    const result = await orchestrateSmartCreation([]);

    expect(result.scenes).toBeDefined();
    expect(result.emotions).toBeDefined();
    expect(result.narrative).toBeDefined();
    expect(result.recommendations).toBeDefined();
  });

  it('passes all options through to generateNarrative', async () => {
    const media = [makeMedia()];
    await orchestrateSmartCreation(media, {
      narrativeTemplate: 'vlog',
      targetDuration: 90,
      pacing: 'fast',
    });

    expect(generateNarrative).toHaveBeenCalled();
    const callArgs = (generateNarrative as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = callArgs[1];
    expect(options.template).toBe('vlog');
    expect(options.targetDuration).toBe(90);
    expect(options.pacing).toBe('fast');
  });

  it('includes analyzedAt timestamp in ISO format', async () => {
    const media = [makeMedia()];
    const result = await orchestrateSmartCreation(media);

    expect(result.analyzedAt).toBeTruthy();
    // Should be a valid ISO date string
    expect(() => new Date(result.analyzedAt)).not.toThrow();
    expect(new Date(result.analyzedAt).toISOString()).toBe(result.analyzedAt);
  });

  it('calls phases in correct order: scene -> emotion -> speech -> narrative -> recommendation', async () => {
    const media = [makeMedia({ aiAnalysis: { transcript: 'test' } })];
    const phases: string[] = [];
    let lastPhase = '';
    const onProgress = (p: { phase: string }) => {
      if (p.phase !== lastPhase) {
        phases.push(p.phase);
        lastPhase = p.phase;
      }
    };

    await orchestrateSmartCreation(media, { onProgress });

    expect(phases).toEqual([
      'scene_detection',
      'emotion_analysis',
      'speech_understanding',
      'narrative_analysis',
      'recommendation',
    ]);
  });

  it('skips speech phase in order when disabled', async () => {
    const media = [makeMedia()];
    const phases: string[] = [];
    let lastPhase = '';
    const onProgress = (p: { phase: string }) => {
      if (p.phase !== lastPhase) {
        phases.push(p.phase);
        lastPhase = p.phase;
      }
    };

    await orchestrateSmartCreation(media, {
      enableSpeechUnderstanding: false,
      onProgress,
    });

    expect(phases).not.toContain('speech_understanding');
  });

  it('includes storyline phase in order when template is provided', async () => {
    const media = [makeMedia()];
    const phases: string[] = [];
    let lastPhase = '';
    const onProgress = (p: { phase: string }) => {
      if (p.phase !== lastPhase) {
        phases.push(p.phase);
        lastPhase = p.phase;
      }
    };

    await orchestrateSmartCreation(media, {
      narrativeTemplate: 'documentary',
      onProgress,
    });

    expect(phases).toContain('storyline');
    expect(phases[phases.length - 1]).toBe('storyline');
  });
});
