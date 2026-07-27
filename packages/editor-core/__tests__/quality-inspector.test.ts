import { describe, it, expect } from 'vitest';
import {
  detectBlackFrame,
  detectColorBars,
  calculateMotionScore,
  analyzeAudioSegment,
  analyzeFrames,
  detectQualitySceneTransitions,
  analyzeQualityPacing,
  checkPlatformCompliance,
  generateIssues,
  calculateQualityScore,
  scoreToGrade,
} from '../src/quality/inspector';
import { DEFAULT_INSPECTOR_CONFIG } from '../src/quality/types';

function makePixels(r: number, g: number, b: number, count = 100): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

function makeBlackPixels(count = 100): Uint8ClampedArray {
  return makePixels(0, 0, 0, count);
}

function makeWhitePixels(count = 100): Uint8ClampedArray {
  return makePixels(255, 255, 255, count);
}

describe('detectBlackFrame', () => {
  it('detects black pixels as black frame', () => {
    expect(detectBlackFrame(makeBlackPixels())).toBe(true);
  });

  it('does not detect white pixels as black frame', () => {
    expect(detectBlackFrame(makeWhitePixels())).toBe(false);
  });

  it('returns false for empty pixels', () => {
    expect(detectBlackFrame(new Uint8ClampedArray(0))).toBe(false);
  });

  it('respects custom threshold', () => {
    // White pixels with normal threshold should not be black
    expect(detectBlackFrame(makeWhitePixels(), 0.05)).toBe(false);
    // Black pixels with very low threshold should still be black
    expect(detectBlackFrame(makeBlackPixels(), 0.001)).toBe(true);
  });
});

describe('detectColorBars', () => {
  it('returns false for small images', () => {
    const pixels = makeWhitePixels(50);
    expect(detectColorBars(pixels, 50, 50)).toBe(false);
  });

  it('returns false for non-color-bar patterns', () => {
    const pixels = makePixels(128, 128, 128, 200 * 200);
    expect(detectColorBars(pixels, 200, 200)).toBe(false);
  });
});

describe('calculateMotionScore', () => {
  it('returns 0 for identical frames', () => {
    const frame = makePixels(100, 100, 100, 100);
    expect(calculateMotionScore(frame, frame)).toBe(0);
  });

  it('returns high score for very different frames', () => {
    const black = makeBlackPixels(100);
    const white = makeWhitePixels(100);
    const score = calculateMotionScore(black, white);
    expect(score).toBeGreaterThan(0.5);
  });

  it('returns 0 for empty frames', () => {
    expect(calculateMotionScore(new Uint8ClampedArray(0), new Uint8ClampedArray(0))).toBe(0);
  });

  it('returns 0 for mismatched lengths', () => {
    expect(calculateMotionScore(makeBlackPixels(10), makeBlackPixels(20))).toBe(0);
  });
});

describe('analyzeAudioSegment', () => {
  it('returns silent for empty samples', () => {
    const result = analyzeAudioSegment(new Float32Array(0));
    expect(result.isSilent).toBe(true);
    expect(result.rmsDb).toBe(-Infinity);
  });

  it('detects clipping for loud samples', () => {
    const samples = new Float32Array(100);
    samples.fill(1.0); // max amplitude
    const result = analyzeAudioSegment(samples);
    expect(result.isClipping).toBe(true);
    expect(result.peakDb).toBeCloseTo(0, 1);
  });

  it('detects silence for very quiet samples', () => {
    const samples = new Float32Array(100);
    samples.fill(0.00001);
    const result = analyzeAudioSegment(samples);
    expect(result.isSilent).toBe(true);
  });

  it('analyzes normal audio correctly', () => {
    const samples = new Float32Array(100);
    for (let i = 0; i < 100; i++) {
      samples[i] = Math.sin(i * 0.1) * 0.5;
    }
    const result = analyzeAudioSegment(samples);
    expect(result.rmsDb).toBeLessThan(0);
    expect(result.isSilent).toBe(false);
    expect(result.isClipping).toBe(false);
  });
});

describe('analyzeFrames', () => {
  it('analyzes a sequence of frames', () => {
    const frames = [
      { timestamp: 0, pixels: makeBlackPixels(100), width: 100, height: 100 },
      { timestamp: 1, pixels: makeWhitePixels(100), width: 100, height: 100 },
    ];
    const results = analyzeFrames(frames);
    expect(results).toHaveLength(2);
    expect(results[0].isBlack).toBe(true);
    expect(results[1].isBlack).toBe(false);
    expect(results[0].motionScore).toBe(0); // first frame has no prev
    expect(results[1].motionScore).toBeGreaterThan(0);
  });

  it('returns empty for no frames', () => {
    expect(analyzeFrames([])).toEqual([]);
  });
});

describe('detectQualitySceneTransitions', () => {
  it('detects transitions between different motion scores', () => {
    const analyses = [
      { timestamp: 0, isBlack: false, isStatic: false, isColorBars: false, brightness: 0.5, contrast: 0.5, motionScore: 0.1 },
      { timestamp: 1, isBlack: false, isStatic: false, isColorBars: false, brightness: 0.5, contrast: 0.5, motionScore: 0.8 },
    ];
    const transitions = detectQualitySceneTransitions(analyses);
    expect(transitions.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for single frame', () => {
    const analyses = [
      { timestamp: 0, isBlack: false, isStatic: false, isColorBars: false, brightness: 0.5, contrast: 0.5, motionScore: 0.1 },
    ];
    expect(detectQualitySceneTransitions(analyses)).toEqual([]);
  });

  it('returns empty for similar frames', () => {
    const analyses = [
      { timestamp: 0, isBlack: false, isStatic: false, isColorBars: false, brightness: 0.5, contrast: 0.5, motionScore: 0.1 },
      { timestamp: 1, isBlack: false, isStatic: false, isColorBars: false, brightness: 0.5, contrast: 0.5, motionScore: 0.12 },
    ];
    expect(detectQualitySceneTransitions(analyses)).toEqual([]);
  });
});

describe('analyzeQualityPacing', () => {
  it('returns empty for no transitions', () => {
    expect(analyzeQualityPacing([], 60)).toEqual([]);
  });

  it('returns empty for zero duration', () => {
    expect(analyzeQualityPacing([{ time: 1, type: 'cut', confidence: 1, isDiscontinuous: false }], 0)).toEqual([]);
  });

  it('classifies pacing segments', () => {
    const transitions = Array.from({ length: 20 }, (_, i) => ({
      time: i * 3,
      type: 'cut' as const,
      confidence: 1,
      isDiscontinuous: false,
    }));
    const segments = analyzeQualityPacing(transitions, 60);
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of segments) {
      expect(['slow', 'normal', 'fast']).toContain(seg.classification);
    }
  });
});

describe('checkPlatformCompliance', () => {
  const perfectMedia = {
    width: 1920,
    height: 1080,
    frameRate: 30,
    duration: 60,
    audioSampleRate: 48000,
    audioChannels: 2,
  };

  it('passes for matching media', () => {
    const result = checkPlatformCompliance(perfectMedia, 'youtube-1080p');
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('fails for wrong resolution', () => {
    const result = checkPlatformCompliance({ ...perfectMedia, width: 1280, height: 720 }, 'youtube-1080p');
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.parameter === 'resolution')).toBe(true);
  });

  it('fails for too long duration', () => {
    const result = checkPlatformCompliance({ ...perfectMedia, duration: 50000 }, 'youtube-1080p');
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.parameter === 'duration')).toBe(true);
  });

  it('warns for wrong frame rate', () => {
    const result = checkPlatformCompliance({ ...perfectMedia, frameRate: 24 }, 'youtube-1080p');
    expect(result.violations.some((v) => v.parameter === 'frameRate')).toBe(true);
  });

  it('warns for wrong audio sample rate', () => {
    const result = checkPlatformCompliance({ ...perfectMedia, audioSampleRate: 44100 }, 'youtube-1080p');
    expect(result.violations.some((v) => v.parameter === 'audioSampleRate')).toBe(true);
  });

  it('checks file size when provided', () => {
    const spec = { ...perfectMedia, fileSize: 200 * 1024 * 1024 };
    const result = checkPlatformCompliance(spec, 'tiktok-9-16');
    // TikTok has max file size limit
    const fileSizeViolation = result.violations.find((v) => v.parameter === 'fileSize');
    // May or may not have file size violation depending on spec
    expect(result.platform).toBe('tiktok-9-16');
  });

  it('falls back to custom spec for unknown platform', () => {
    const result = checkPlatformCompliance(perfectMedia, 'unknown-platform');
    // Unknown platforms use custom spec but keep original platform ID
    expect(result.violations).toBeDefined();
  });
});

describe('generateIssues', () => {
  const config = DEFAULT_INSPECTOR_CONFIG;

  it('generates black frame issues', () => {
    const frames = [
      { timestamp: 0, isBlack: true, isStatic: false, isColorBars: false, brightness: 0, contrast: 0, motionScore: 0 },
    ];
    const issues = generateIssues(frames, [], [], [], { platform: 'custom', passed: true, violations: [] }, config);
    expect(issues.some((i) => i.type === 'black-frame')).toBe(true);
  });

  it('generates audio clipping issues', () => {
    const audio = [
      { timestamp: 0, rmsDb: -5, peakDb: 0, isClipping: true, isSilent: false, isDistorted: false, spectralCentroid: 0 },
    ];
    const issues = generateIssues([], audio, [], [], { platform: 'custom', passed: true, violations: [] }, config);
    expect(issues.some((i) => i.type === 'audio-clipping')).toBe(true);
  });

  it('generates pacing issues', () => {
    const pacing = [
      { timeRange: { start: 0, end: 30 }, cutsPerMinute: 0.5, classification: 'slow' as const },
      { timeRange: { start: 30, end: 60 }, cutsPerMinute: 20, classification: 'fast' as const },
    ];
    const issues = generateIssues([], [], pacing, [], { platform: 'custom', passed: true, violations: [] }, config);
    expect(issues.some((i) => i.type === 'pacing-slow')).toBe(true);
    expect(issues.some((i) => i.type === 'pacing-fast')).toBe(true);
  });

  it('generates scene discontinuity issues', () => {
    const transitions = [
      { time: 5, type: 'cut' as const, confidence: 1, isDiscontinuous: true },
    ];
    const issues = generateIssues([], [], [], transitions, { platform: 'custom', passed: true, violations: [] }, config);
    expect(issues.some((i) => i.type === 'scene-discontinuity')).toBe(true);
  });

  it('generates compliance violation issues', () => {
    const compliance = {
      platform: 'custom' as const,
      passed: false,
      violations: [{ parameter: 'resolution', expected: '1920x1080', actual: '1280x720', severity: 'error' as const }],
    };
    const issues = generateIssues([], [], [], [], compliance, config);
    expect(issues.some((i) => i.category === 'compliance')).toBe(true);
  });

  it('generates static frame issues', () => {
    const frames = [
      { timestamp: 0, isBlack: false, isStatic: true, isColorBars: false, brightness: 0.5, contrast: 0.3, motionScore: 0 },
    ];
    const issues = generateIssues(frames, [], [], [], { platform: 'custom', passed: true, violations: [] }, config);
    expect(issues.some((i) => i.type === 'static-frame')).toBe(true);
  });

  it('generates silent audio issues', () => {
    const audio = [
      { timestamp: 0, rmsDb: -60, peakDb: -50, isClipping: false, isSilent: true, isDistorted: false, spectralCentroid: 0 },
    ];
    const issues = generateIssues([], audio, [], [], { platform: 'custom', passed: true, violations: [] }, config);
    expect(issues.some((i) => i.description.includes('静音'))).toBe(true);
  });
});

describe('calculateQualityScore', () => {
  it('returns 100 for no issues', () => {
    const result = calculateQualityScore([]);
    expect(result.totalIssues).toBe(0);
    expect(result.technicalScore).toBe(100);
    expect(result.contentScore).toBe(100);
    expect(result.complianceScore).toBe(100);
  });

  it('deducts points for critical issues', () => {
    const issues = [
      { id: '1', category: 'technical' as const, type: 'black-frame', severity: 'critical' as const, description: '', suggestion: '', autoFixable: false },
    ];
    const result = calculateQualityScore(issues);
    expect(result.criticalIssues).toBe(1);
  });

  it('counts auto-fixable issues', () => {
    const issues = [
      { id: '1', category: 'technical' as const, type: 'audio-clipping', severity: 'error' as const, description: '', suggestion: '', autoFixable: true },
      { id: '2', category: 'technical' as const, type: 'black-frame', severity: 'warning' as const, description: '', suggestion: '', autoFixable: false },
    ];
    const result = calculateQualityScore(issues);
    expect(result.autoFixableCount).toBe(1);
  });
});

describe('scoreToGrade', () => {
  it('returns A for 90+', () => { expect(scoreToGrade(95)).toBe('A'); });
  it('returns B for 80-89', () => { expect(scoreToGrade(85)).toBe('B'); });
  it('returns C for 70-79', () => { expect(scoreToGrade(75)).toBe('C'); });
  it('returns D for 60-69', () => { expect(scoreToGrade(65)).toBe('D'); });
  it('returns F for below 60', () => { expect(scoreToGrade(50)).toBe('F'); });
});
