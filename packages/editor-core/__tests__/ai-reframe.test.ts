import { describe, expect, it } from 'vitest';
import {
  bboxToCropWindow,
  buildReframeCropFFmpegExpression,
  computeReframeConfidence,
  computeSampleTimes,
  generateReframeKeyframes,
  interpolateReframeAtTime,
  smoothKeyframes,
  type ReframeAIFrame,
  type ReframeKeyframe
} from '../src';
import { round } from '../src/time';

describe('AI reframe sampling', () => {
  it('generates evenly spaced sample times for a clip', () => {
    const times = computeSampleTimes(10, 2);
    expect(times).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('merges scene cut points into sample times', () => {
    const times = computeSampleTimes(6, 3, [1.5, 4.2]);
    expect(times).toContain(1.5);
    expect(times).toContain(4.2);
    expect(times[0]).toBe(0);
    expect(times[times.length - 1]).toBe(6);
  });

  it('returns empty for zero duration', () => {
    expect(computeSampleTimes(0)).toEqual([]);
    expect(computeSampleTimes(-5)).toEqual([]);
  });
});

describe('bbox to crop window', () => {
  it('calculates 9:16 crop centered on subject', () => {
    const crop = bboxToCropWindow({ x: 500, y: 200, w: 200, h: 200 }, 1920, 1080, '9:16');
    expect(crop.cropH).toBe(1080);
    expect(crop.cropW).toBeLessThanOrEqual(1920);
    const expectedW = Math.round(1080 * (9 / 16));
    expectedW % 2 === 0 ? expect(crop.cropW).toBe(expectedW) : expect(crop.cropW).toBe(expectedW + 1);
  });

  it('clamps crop within source bounds', () => {
    const crop = bboxToCropWindow({ x: 0, y: 0, w: 50, h: 50 }, 1920, 1080, '16:9');
    expect(crop.cropX).toBeGreaterThanOrEqual(0);
    expect(crop.cropY).toBeGreaterThanOrEqual(0);
    expect(crop.cropX + crop.cropW).toBeLessThanOrEqual(1920);
    expect(crop.cropY + crop.cropH).toBeLessThanOrEqual(1080);
  });

  it('locks crop dimensions to target aspect ratio', () => {
    const crop = bboxToCropWindow({ x: 960, y: 540, w: 100, h: 100 }, 1920, 1080, '1:1');
    expect(crop.cropW).toBe(crop.cropH);
  });
});

describe('smoothing and interpolation', () => {
  const keyframes: ReframeKeyframe[] = [
    { time: 0, cropX: 100, cropY: 50, cropW: 600, cropH: 600 },
    { time: 2, cropX: 200, cropY: 100, cropW: 600, cropH: 600 },
    { time: 4, cropX: 150, cropY: 80, cropW: 600, cropH: 600 },
    { time: 6, cropX: 300, cropY: 120, cropW: 600, cropH: 600 }
  ];

  it('smooths keyframe positions with sliding average', () => {
    const smoothed = smoothKeyframes(keyframes, 3);
    expect(smoothed).toHaveLength(4);
    expect(smoothed[1].cropX).toBe(round((100 + 200 + 150) / 3));
    expect(smoothed[1].cropY).toBe(round((50 + 100 + 80) / 3));
    expect(smoothed[1].cropW).toBe(600);
  });

  it('returns copy when window size is 1', () => {
    const result = smoothKeyframes(keyframes, 1);
    expect(result[0].cropX).toBe(100);
  });

  it('interpolates linearly between keyframes', () => {
    const result = interpolateReframeAtTime(keyframes, 1);
    expect(result).toBeDefined();
    expect(result!.cropX).toBe(150);
    expect(result!.cropY).toBe(75);
  });

  it('clamps to first/last keyframe outside range', () => {
    expect(interpolateReframeAtTime(keyframes, -1)!.cropX).toBe(100);
    expect(interpolateReframeAtTime(keyframes, 10)!.cropX).toBe(300);
  });

  it('returns undefined for empty keyframes', () => {
    expect(interpolateReframeAtTime([], 0)).toBeUndefined();
  });
});

describe('FFmpeg crop expression', () => {
  it('builds single-keyframe crop expression', () => {
    const expr = buildReframeCropFFmpegExpression([{ time: 0, cropX: 10, cropY: 20, cropW: 1080, cropH: 1920 }]);
    expect(expr).toBe('crop=1080:1920:10:20');
  });

  it('builds multi-segment if(lt(t,...)) expression', () => {
    const expr = buildReframeCropFFmpegExpression([
      { time: 0, cropX: 100, cropY: 50, cropW: 600, cropH: 600 },
      { time: 2, cropX: 200, cropY: 100, cropW: 600, cropH: 600 },
      { time: 4, cropX: 150, cropY: 80, cropW: 600, cropH: 600 }
    ]);
    expect(expr).toContain('crop=600:600:');
    expect(expr).toContain('if(lt(t');
    expect(expr).toContain('100');
    expect(expr).toContain('200');
    expect(expr).toContain('150');
  });

  it('returns undefined for empty keyframes', () => {
    expect(buildReframeCropFFmpegExpression([])).toBeUndefined();
  });
});

describe('confidence scoring', () => {
  it('returns 0 for empty frames', () => {
    expect(computeReframeConfidence([])).toBe(0);
  });

  it('scores higher when faces are detected', () => {
    const withFace: ReframeAIFrame[] = [
      { time: 0, faceBox: { x: 100, y: 100, w: 0.3, h: 0.3 }, subjectBox: { x: 80, y: 80, w: 0.4, h: 0.4 } },
      { time: 2, faceBox: { x: 110, y: 110, w: 0.3, h: 0.3 }, subjectBox: { x: 85, y: 85, w: 0.4, h: 0.4 } }
    ];
    const noFace: ReframeAIFrame[] = [
      { time: 0, faceBox: null, subjectBox: { x: 0.2, y: 0.2, w: 0.1, h: 0.1 } },
      { time: 2, faceBox: null, subjectBox: { x: 0.3, y: 0.3, w: 0.1, h: 0.1 } }
    ];
    expect(computeReframeConfidence(withFace)).toBeGreaterThan(computeReframeConfidence(noFace));
  });
});

describe('generate reframe keyframes from AI result', () => {
  it('generates keyframes from AI frames', () => {
    const frames: ReframeAIFrame[] = [
      { time: 0, faceBox: { x: 500, y: 300, w: 200, h: 200 }, subjectBox: { x: 400, y: 200, w: 400, h: 400 } },
      { time: 2, faceBox: { x: 600, y: 350, w: 200, h: 200 }, subjectBox: { x: 500, y: 250, w: 400, h: 400 } }
    ];
    const result = generateReframeKeyframes(frames, 1920, 1080, '16:9');
    expect(result).toHaveLength(2);
    expect(result[0].cropW).toBe(result[1].cropW);
    expect(result[0].cropH).toBe(result[1].cropH);
  });

  it('returns empty for source aspect ratio', () => {
    const frames: ReframeAIFrame[] = [
      { time: 0, faceBox: null, subjectBox: { x: 0, y: 0, w: 1, h: 1 } }
    ];
    expect(generateReframeKeyframes(frames, 1920, 1080, 'source')).toEqual([]);
  });
});
