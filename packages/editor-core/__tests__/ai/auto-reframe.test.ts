import { describe, it, expect } from 'vitest';
import {
  generateAutoReframe,
  interpolateAutoReframeAtTime,
  multiAspectReframe,
  validateReframeKeyframes,
} from '../../src/ai/auto-reframe';
import type {
  SubjectFrame,
  DetectedSubject,
  AutoReframeOptions,
} from '../../src/ai/auto-reframe';

// --- Test helpers ---

function makeSubject(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  type: DetectedSubject['type'] = 'face',
  importance = 0.9,
): DetectedSubject {
  return {
    id,
    bbox: { x, y, w, h },
    confidence: 0.9,
    type,
    importance,
  };
}

function makeFrame(
  time: number,
  subjects: DetectedSubject[],
  sourceWidth = 1920,
  sourceHeight = 1080,
): SubjectFrame {
  return { time, sourceWidth, sourceHeight, subjects };
}

const defaultOptions: AutoReframeOptions = {
  targetAspect: '9:16',
  padding: 0.1,
  smoothingWindow: 3,
};

// --- Tests ---

describe('generateAutoReframe', () => {
  it('returns empty result for no frames', () => {
    const result = generateAutoReframe([], defaultOptions);
    expect(result.keyframes).toEqual([]);
    expect(result.trackingInfo.totalFrames).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('returns empty keyframes for source aspect', () => {
    const frames = [
      makeFrame(0, [makeSubject('face-1', 0.4, 0.3, 0.2, 0.4)]),
    ];
    const result = generateAutoReframe(frames, { targetAspect: 'source' });
    expect(result.keyframes).toEqual([]);
    expect(result.trackingInfo.continuity).toBe(1);
  });

  it('generates crop keyframes for 9:16 aspect', () => {
    const frames = [
      makeFrame(0, [makeSubject('face-1', 0.4, 0.3, 0.2, 0.4)]),
      makeFrame(1, [makeSubject('face-1', 0.45, 0.3, 0.2, 0.4)]),
      makeFrame(2, [makeSubject('face-1', 0.5, 0.3, 0.2, 0.4)]),
    ];
    const result = generateAutoReframe(frames, defaultOptions);

    expect(result.keyframes).toHaveLength(3);
    for (const kf of result.keyframes) {
      expect(kf.cropW).toBeGreaterThan(0);
      expect(kf.cropH).toBeGreaterThan(0);
      expect(kf.cropX).toBeGreaterThanOrEqual(0);
      expect(kf.cropY).toBeGreaterThanOrEqual(0);
      // 9:16 means height > width.
      expect(kf.cropH).toBeGreaterThan(kf.cropW);
    }
  });

  it('generates crop keyframes for 16:9 aspect', () => {
    const frames = [
      makeFrame(0, [makeSubject('face-1', 0.4, 0.3, 0.2, 0.4)]),
      makeFrame(1, [makeSubject('face-1', 0.5, 0.3, 0.2, 0.4)]),
    ];
    const result = generateAutoReframe(frames, { targetAspect: '16:9' });

    expect(result.keyframes).toHaveLength(2);
    for (const kf of result.keyframes) {
      // 16:9 means width > height.
      expect(kf.cropW).toBeGreaterThan(kf.cropH);
    }
  });

  it('generates crop keyframes for 1:1 aspect', () => {
    const frames = [
      makeFrame(0, [makeSubject('face-1', 0.4, 0.3, 0.2, 0.4)]),
    ];
    const result = generateAutoReframe(frames, { targetAspect: '1:1' });

    expect(result.keyframes).toHaveLength(1);
    expect(result.keyframes[0].cropW).toBe(result.keyframes[0].cropH);
  });

  it('tracks primary subject across frames', () => {
    const frames = [
      makeFrame(0, [makeSubject('face-1', 0.4, 0.3, 0.2, 0.4)]),
      makeFrame(1, [makeSubject('face-1', 0.45, 0.3, 0.2, 0.4)]),
      makeFrame(2, [makeSubject('face-1', 0.5, 0.3, 0.2, 0.4)]),
      makeFrame(3, [makeSubject('face-1', 0.55, 0.3, 0.2, 0.4)]),
    ];
    const result = generateAutoReframe(frames, defaultOptions);

    expect(result.trackingInfo.primarySubjectId).toBe('face-1');
    expect(result.trackingInfo.trackedFrames).toBe(4);
    expect(result.trackingInfo.continuity).toBeCloseTo(1, 1);
  });

  it('prefers faces over objects', () => {
    const frames = [
      makeFrame(0, [
        makeSubject('obj-1', 0.1, 0.1, 0.3, 0.3, 'object', 0.8),
        makeSubject('face-1', 0.4, 0.3, 0.2, 0.4, 'face', 0.7),
      ]),
    ];
    const result = generateAutoReframe(frames, { ...defaultOptions, preferFaces: true });

    expect(result.trackingInfo.primarySubjectId).toBe('face-1');
  });

  it('uses center crop when no subject detected', () => {
    const frames = [
      makeFrame(0, []),
      makeFrame(1, []),
    ];
    const result = generateAutoReframe(frames, defaultOptions);

    expect(result.keyframes).toHaveLength(2);
    expect(result.trackingInfo.primarySubjectId).toBeNull();
    // Center crop should have lower confidence.
    for (const kf of result.keyframes) {
      expect(kf.confidence).toBeLessThan(0.5);
    }
  });

  it('handles frames with multiple subjects', () => {
    const frames = [
      makeFrame(0, [
        makeSubject('face-1', 0.3, 0.3, 0.15, 0.3, 'face', 0.9),
        makeSubject('face-2', 0.6, 0.3, 0.15, 0.3, 'face', 0.7),
      ]),
      makeFrame(1, [
        makeSubject('face-1', 0.35, 0.3, 0.15, 0.3, 'face', 0.9),
        makeSubject('face-2', 0.65, 0.3, 0.15, 0.3, 'face', 0.7),
      ]),
    ];
    const result = generateAutoReframe(frames, defaultOptions);

    // Should track the most important subject (face-1).
    expect(result.trackingInfo.primarySubjectId).toBe('face-1');
  });

  it('ensures even crop dimensions', () => {
    const frames = [
      makeFrame(0, [makeSubject('face-1', 0.4, 0.3, 0.2, 0.4)]),
    ];
    const result = generateAutoReframe(frames, defaultOptions);

    for (const kf of result.keyframes) {
      expect(kf.cropW % 2).toBe(0);
      expect(kf.cropH % 2).toBe(0);
    }
  });

  it('generates FFmpeg expression', () => {
    const frames = [
      makeFrame(0, [makeSubject('face-1', 0.4, 0.3, 0.2, 0.4)]),
      makeFrame(1, [makeSubject('face-1', 0.5, 0.3, 0.2, 0.4)]),
    ];
    const result = generateAutoReframe(frames, defaultOptions);

    expect(result.ffmpegExpression).toBeDefined();
    expect(result.ffmpegExpression).toContain('crop=');
  });

  it('filters out subjects below importance threshold', () => {
    const frames = [
      makeFrame(0, [makeSubject('obj-1', 0.4, 0.3, 0.2, 0.4, 'object', 0.1)]),
    ];
    const result = generateAutoReframe(frames, {
      ...defaultOptions,
      importanceThreshold: 0.5,
    });

    // Subject below threshold should be ignored, using center crop.
    expect(result.trackingInfo.primarySubjectId).toBeNull();
  });

  it('filters non-finite times', () => {
    const frames = [
      makeFrame(NaN, [makeSubject('face-1', 0.4, 0.3, 0.2, 0.4)]),
      makeFrame(1, [makeSubject('face-1', 0.5, 0.3, 0.2, 0.4)]),
      makeFrame(Infinity, [makeSubject('face-1', 0.6, 0.3, 0.2, 0.4)]),
    ];
    const result = generateAutoReframe(frames, defaultOptions);

    expect(result.keyframes).toHaveLength(1);
    expect(result.trackingInfo.totalFrames).toBe(1);
  });
});

describe('interpolateAutoReframeAtTime', () => {
  it('returns undefined for empty keyframes', () => {
    expect(interpolateAutoReframeAtTime([], 0)).toBeUndefined();
  });

  it('returns single keyframe for one entry', () => {
    const keyframes = [{ time: 1, cropX: 100, cropY: 50, cropW: 400, cropH: 720, confidence: 0.8 }];
    const result = interpolateAutoReframeAtTime(keyframes, 2);
    expect(result).toEqual(keyframes[0]);
  });

  it('interpolates between two keyframes', () => {
    const keyframes = [
      { time: 0, cropX: 100, cropY: 50, cropW: 400, cropH: 720, confidence: 0.8 },
      { time: 2, cropX: 200, cropY: 100, cropW: 400, cropH: 720, confidence: 0.9 },
    ];
    const result = interpolateAutoReframeAtTime(keyframes, 1);
    expect(result).toBeDefined();
    expect(result!.cropX).toBeCloseTo(150, 0);
    expect(result!.cropY).toBeCloseTo(75, 0);
    expect(result!.cropW).toBe(400);
    expect(result!.cropH).toBe(720);
  });

  it('clamps to first keyframe before range', () => {
    const keyframes = [
      { time: 5, cropX: 100, cropY: 50, cropW: 400, cropH: 720, confidence: 0.8 },
      { time: 10, cropX: 200, cropY: 100, cropW: 400, cropH: 720, confidence: 0.9 },
    ];
    const result = interpolateAutoReframeAtTime(keyframes, 0);
    expect(result).toEqual(keyframes[0]);
  });

  it('clamps to last keyframe after range', () => {
    const keyframes = [
      { time: 0, cropX: 100, cropY: 50, cropW: 400, cropH: 720, confidence: 0.8 },
      { time: 5, cropX: 200, cropY: 100, cropW: 400, cropH: 720, confidence: 0.9 },
    ];
    const result = interpolateAutoReframeAtTime(keyframes, 10);
    expect(result).toEqual(keyframes[1]);
  });
});

describe('multiAspectReframe', () => {
  it('generates results for multiple aspects', () => {
    const frames = [
      makeFrame(0, [makeSubject('face-1', 0.4, 0.3, 0.2, 0.4)]),
      makeFrame(1, [makeSubject('face-1', 0.5, 0.3, 0.2, 0.4)]),
    ];
    const results = multiAspectReframe(frames, ['16:9', '9:16', '1:1'], {
      smoothingWindow: 3,
    });

    expect(results.size).toBe(3);
    expect(results.has('16:9')).toBe(true);
    expect(results.has('9:16')).toBe(true);
    expect(results.has('1:1')).toBe(true);
  });

  it('produces different crop dimensions for different aspects', () => {
    const frames = [
      makeFrame(0, [makeSubject('face-1', 0.4, 0.3, 0.2, 0.4)]),
    ];
    const results = multiAspectReframe(frames, ['16:9', '9:16'], {
      smoothingWindow: 1,
    });

    const landscape = results.get('16:9')!;
    const portrait = results.get('9:16')!;

    expect(landscape.keyframes[0].cropW).toBeGreaterThan(landscape.keyframes[0].cropH);
    expect(portrait.keyframes[0].cropH).toBeGreaterThan(portrait.keyframes[0].cropW);
  });
});

describe('validateReframeKeyframes', () => {
  it('returns no issues for valid keyframes', () => {
    const keyframes = [
      { time: 0, cropX: 100, cropY: 50, cropW: 400, cropH: 720, confidence: 0.8 },
    ];
    const issues = validateReframeKeyframes(keyframes, 1920, 1080);
    expect(issues).toEqual([]);
  });

  it('detects negative cropX', () => {
    const keyframes = [
      { time: 0, cropX: -10, cropY: 50, cropW: 400, cropH: 720, confidence: 0.8 },
    ];
    const issues = validateReframeKeyframes(keyframes, 1920, 1080);
    expect(issues.some((i) => i.issue.includes('negative'))).toBe(true);
  });

  it('detects crop extending beyond source', () => {
    const keyframes = [
      { time: 0, cropX: 1600, cropY: 50, cropW: 400, cropH: 720, confidence: 0.8 },
    ];
    const issues = validateReframeKeyframes(keyframes, 1920, 1080);
    expect(issues.some((i) => i.issue.includes('beyond'))).toBe(true);
  });

  it('detects odd crop dimensions', () => {
    const keyframes = [
      { time: 0, cropX: 100, cropY: 50, cropW: 401, cropH: 721, confidence: 0.8 },
    ];
    const issues = validateReframeKeyframes(keyframes, 1920, 1080);
    expect(issues.some((i) => i.issue.includes('not even'))).toBe(true);
  });
});
