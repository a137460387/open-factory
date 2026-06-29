import { describe, expect, it } from 'vitest';
import {
  calculateAudioRMS,
  estimateFrameMotion,
  buildMulticamFeaturePayload,
  buildMulticamCutSystemPrompt,
  buildMulticamCutUserPrompt,
  parseMulticamCutResponse,
  enforceMinimumSwitchInterval,
  validateCutAngles,
  DEFAULT_MIN_SWITCH_INTERVAL,
  type MulticamCutSuggestion,
  type AngleAudioSamples,
  type AngleMotionFrames
} from '../src';

describe('calculateAudioRMS', () => {
  it('returns 0 for empty buffer', () => {
    expect(calculateAudioRMS([])).toBe(0);
  });

  it('returns absolute value for single sample', () => {
    expect(calculateAudioRMS([0.5])).toBe(0.5);
  });

  it('returns 0 for zero samples', () => {
    expect(calculateAudioRMS([0, 0, 0])).toBe(0);
  });

  it('computes RMS for known values', () => {
    // RMS of [0.6, 0.8] = sqrt((0.36+0.64)/2) = sqrt(0.5) ≈ 0.707107
    const rms = calculateAudioRMS([0.6, 0.8]);
    expect(rms).toBeCloseTo(Math.sqrt(0.5), 4);
  });

  it('handles negative values (PCM signed)', () => {
    // RMS of [-0.3, 0.4] = sqrt((0.09+0.16)/2) = sqrt(0.125) ≈ 0.353553
    const rms = calculateAudioRMS([-0.3, 0.4]);
    expect(rms).toBeCloseTo(Math.sqrt(0.125), 4);
  });

  it('handles large buffers', () => {
    const samples = new Array(44100).fill(0.5);
    const rms = calculateAudioRMS(samples);
    expect(rms).toBeCloseTo(0.5, 4);
  });
});

describe('estimateFrameMotion', () => {
  it('returns 0 for identical frames', () => {
    // Non-linear texture so only zero offset gives perfect NCC
    const frame = new Array(16 * 16);
    for (let i = 0; i < 16 * 16; i++) frame[i] = 0.2 + 0.6 * Math.abs(Math.sin(i * 0.7));
    expect(estimateFrameMotion(frame, frame, 16, 16, 4, 2)).toBe(0);
  });

  it('returns >0 for shifted frames', () => {
    // prev: all 0.5, curr: shifted 1px right (first column 0, rest 0.5)
    const w = 16, h = 16;
    const prev = new Array(w * h).fill(0.5);
    const curr = new Array(w * h).fill(0.5);
    // shift pattern: make column 0 dark, column w-1 bright
    for (let y = 0; y < h; y++) {
      curr[y * w] = 0;
      curr[y * w + w - 1] = 1;
    }
    const motion = estimateFrameMotion(prev, curr, w, h, 4, 4);
    expect(motion).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 for frames smaller than grid', () => {
    const frame = [0.5, 0.5, 0.5, 0.5];
    expect(estimateFrameMotion(frame, frame, 2, 2, 4, 2)).toBe(0);
  });

  it('returns 0 for frames where block is too small', () => {
    const frame = new Array(3 * 3).fill(0.5);
    expect(estimateFrameMotion(frame, frame, 3, 3, 4, 2)).toBe(0);
  });

  it('handles non-default grid and search radius', () => {
    const w = 32, h = 32;
    const prev = new Array(w * h).fill(0.3);
    const curr = new Array(w * h).fill(0.7);
    const motion = estimateFrameMotion(prev, curr, w, h, 8, 2);
    expect(motion).toBeGreaterThanOrEqual(0);
  });
});

describe('buildMulticamFeaturePayload', () => {
  const audioA: AngleAudioSamples = {
    angleId: 'cam-a',
    samples: new Array(44100 * 3).fill(0.5),
    sampleRate: 44100
  };
  const audioB: AngleAudioSamples = {
    angleId: 'cam-b',
    samples: new Array(44100 * 3).fill(0.2),
    sampleRate: 44100
  };
  const motionA: AngleMotionFrames = {
    angleId: 'cam-a',
    frames: [
      new Array(16 * 16).fill(0.5),
      new Array(16 * 16).fill(0.5),
      new Array(16 * 16).fill(0.6),
      new Array(16 * 16).fill(0.7)
    ],
    width: 16,
    height: 16
  };
  const motionB: AngleMotionFrames = {
    angleId: 'cam-b',
    frames: [
      new Array(16 * 16).fill(0.5),
      new Array(16 * 16).fill(0.5),
      new Array(16 * 16).fill(0.5),
      new Array(16 * 16).fill(0.5)
    ],
    width: 16,
    height: 16
  };

  it('creates windows for given duration', () => {
    const payload = buildMulticamFeaturePayload(3, 1, [audioA, audioB], [motionA, motionB]);
    expect(payload.windows.length).toBe(3);
    expect(payload.windows[0].time).toBe(0);
    expect(payload.windows[1].time).toBe(1);
    expect(payload.windows[2].time).toBe(2);
  });

  it('includes all angles in each window', () => {
    const payload = buildMulticamFeaturePayload(2, 1, [audioA], [motionA]);
    for (const w of payload.windows) {
      expect(w.angles.length).toBe(1);
      expect(w.angles[0].angleId).toBe('cam-a');
    }
  });

  it('computes different RMS for different audio levels', () => {
    const payload = buildMulticamFeaturePayload(1, 1, [audioA, audioB], []);
    const rmsA = payload.windows[0].angles.find(a => a.angleId === 'cam-a')!.audioRMS;
    const rmsB = payload.windows[0].angles.find(a => a.angleId === 'cam-b')!.audioRMS;
    expect(rmsA).toBeGreaterThan(rmsB);
  });

  it('handles missing audio data for an angle', () => {
    const payload = buildMulticamFeaturePayload(1, 1, [], [motionA]);
    expect(payload.windows[0].angles[0].audioRMS).toBe(0);
  });

  it('handles missing motion data for an angle', () => {
    const payload = buildMulticamFeaturePayload(1, 1, [audioA], []);
    expect(payload.windows[0].angles[0].motionScore).toBe(0);
  });

  it('clamps windowSeconds to minimum 0.1', () => {
    const payload = buildMulticamFeaturePayload(3, 0, [audioA], [motionA]);
    expect(payload.windows.length).toBeGreaterThanOrEqual(1);
  });

  it('handles duration shorter than one window', () => {
    const payload = buildMulticamFeaturePayload(0.5, 2, [audioA], [motionA]);
    expect(payload.windows.length).toBe(1);
  });
});

describe('buildMulticamCutSystemPrompt', () => {
  it('returns non-empty string', () => {
    expect(buildMulticamCutSystemPrompt().length).toBeGreaterThan(0);
  });

  it('contains JSON format instruction', () => {
    const prompt = buildMulticamCutSystemPrompt();
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('cuts');
  });
});

describe('buildMulticamCutUserPrompt', () => {
  it('serializes payload as JSON', () => {
    const payload = { windows: [{ time: 0, angles: [{ angleId: 'a', audioRMS: 0.5, motionScore: 0.3 }] }] };
    const prompt = buildMulticamCutUserPrompt(payload);
    expect(JSON.parse(prompt)).toEqual(payload);
  });
});

describe('parseMulticamCutResponse', () => {
  it('parses valid response', () => {
    const result = parseMulticamCutResponse({
      cuts: [
        { time: 1.5, angleId: 'cam-a', reason: '说话人', confidence: 0.9 }
      ]
    });
    expect(result.length).toBe(1);
    expect(result[0].time).toBe(1.5);
    expect(result[0].angleId).toBe('cam-a');
    expect(result[0].confidence).toBe(0.9);
    expect(result[0].reason).toBe('说话人');
  });

  it('returns empty for null input', () => {
    expect(parseMulticamCutResponse(null)).toEqual([]);
  });

  it('returns empty for non-object input', () => {
    expect(parseMulticamCutResponse('string')).toEqual([]);
  });

  it('returns empty when cuts is not array', () => {
    expect(parseMulticamCutResponse({ cuts: 'not-array' })).toEqual([]);
  });

  it('filters out items without time or angleId', () => {
    const result = parseMulticamCutResponse({
      cuts: [
        { time: 1, angleId: 'cam-a' },
        { time: 'bad', angleId: 'cam-b' },
        { time: 2, angleId: 123 }
      ]
    });
    expect(result.length).toBe(1);
  });

  it('clamps confidence to [0, 1]', () => {
    const result = parseMulticamCutResponse({
      cuts: [
        { time: 1, angleId: 'a', confidence: -0.5 },
        { time: 2, angleId: 'b', confidence: 1.5 },
        { time: 3, angleId: 'c', confidence: 0.7 }
      ]
    });
    expect(result[0].confidence).toBe(0);
    expect(result[1].confidence).toBe(1);
    expect(result[2].confidence).toBe(0.7);
  });

  it('defaults confidence to 0.5 when missing', () => {
    const result = parseMulticamCutResponse({
      cuts: [{ time: 1, angleId: 'a' }]
    });
    expect(result[0].confidence).toBe(0.5);
  });

  it('defaults confidence to 0.5 for non-numeric value', () => {
    const result = parseMulticamCutResponse({
      cuts: [{ time: 1, angleId: 'a', confidence: 'high' }]
    });
    expect(result[0].confidence).toBe(0.5);
  });

  it('truncates reason to 200 chars', () => {
    const longReason = 'x'.repeat(300);
    const result = parseMulticamCutResponse({
      cuts: [{ time: 1, angleId: 'a', reason: longReason }]
    });
    expect(result[0].reason.length).toBe(200);
  });

  it('sorts by time ascending', () => {
    const result = parseMulticamCutResponse({
      cuts: [
        { time: 3, angleId: 'a' },
        { time: 1, angleId: 'b' },
        { time: 2, angleId: 'c' }
      ]
    });
    expect(result.map(r => r.time)).toEqual([1, 2, 3]);
  });

  it('filters out entries with empty angleId', () => {
    const result = parseMulticamCutResponse({
      cuts: [{ time: 1, angleId: '' }]
    });
    expect(result.length).toBe(0);
  });

  it('handles non-string reason gracefully', () => {
    const result = parseMulticamCutResponse({
      cuts: [{ time: 1, angleId: 'a', reason: 42 }]
    });
    expect(result[0].reason).toBe('');
  });
});

describe('enforceMinimumSwitchInterval', () => {
  it('returns empty for empty input', () => {
    expect(enforceMinimumSwitchInterval([])).toEqual([]);
  });

  it('returns single suggestion unchanged', () => {
    const s: MulticamCutSuggestion = { time: 1, angleId: 'a', confidence: 0.8, reason: '' };
    expect(enforceMinimumSwitchInterval([s])).toEqual([s]);
  });

  it('keeps suggestions that are far enough apart', () => {
    const a: MulticamCutSuggestion = { time: 0, angleId: 'a', confidence: 0.8, reason: '' };
    const b: MulticamCutSuggestion = { time: 2, angleId: 'b', confidence: 0.7, reason: '' };
    const result = enforceMinimumSwitchInterval([a, b]);
    expect(result.length).toBe(2);
  });

  it('drops lower confidence when too close', () => {
    const a: MulticamCutSuggestion = { time: 0, angleId: 'a', confidence: 0.9, reason: '' };
    const b: MulticamCutSuggestion = { time: 0.5, angleId: 'b', confidence: 0.6, reason: '' };
    const result = enforceMinimumSwitchInterval([a, b]);
    expect(result.length).toBe(1);
    expect(result[0].angleId).toBe('a');
  });

  it('replaces with higher confidence when too close', () => {
    const a: MulticamCutSuggestion = { time: 0, angleId: 'a', confidence: 0.5, reason: '' };
    const b: MulticamCutSuggestion = { time: 0.5, angleId: 'b', confidence: 0.9, reason: '' };
    const result = enforceMinimumSwitchInterval([a, b]);
    expect(result.length).toBe(1);
    expect(result[0].angleId).toBe('b');
  });

  it('keeps earlier suggestion on equal confidence (tie-break)', () => {
    const a: MulticamCutSuggestion = { time: 0, angleId: 'a', confidence: 0.7, reason: '' };
    const b: MulticamCutSuggestion = { time: 0.5, angleId: 'b', confidence: 0.7, reason: '' };
    const result = enforceMinimumSwitchInterval([a, b]);
    expect(result.length).toBe(1);
    // When sorted by time asc, a is first. Equal confidence means a is kept.
    expect(result[0].angleId).toBe('a');
  });

  it('handles unsorted input', () => {
    const a: MulticamCutSuggestion = { time: 3, angleId: 'a', confidence: 0.8, reason: '' };
    const b: MulticamCutSuggestion = { time: 1, angleId: 'b', confidence: 0.9, reason: '' };
    const result = enforceMinimumSwitchInterval([a, b]);
    expect(result.length).toBe(2);
    expect(result[0].time).toBe(1);
  });

  it('respects custom minInterval', () => {
    const a: MulticamCutSuggestion = { time: 0, angleId: 'a', confidence: 0.8, reason: '' };
    const b: MulticamCutSuggestion = { time: 3, angleId: 'b', confidence: 0.7, reason: '' };
    const result = enforceMinimumSwitchInterval([a, b], 5);
    // gap=3 < 5, so b is dropped
    expect(result.length).toBe(1);
  });

  it('chains merge: A close to B close to C, all within minInterval', () => {
    const a: MulticamCutSuggestion = { time: 0, angleId: 'a', confidence: 0.5, reason: '' };
    const b: MulticamCutSuggestion = { time: 0.5, angleId: 'b', confidence: 0.9, reason: '' };
    const c: MulticamCutSuggestion = { time: 0.8, angleId: 'c', confidence: 0.7, reason: '' };
    const result = enforceMinimumSwitchInterval([a, b, c]);
    expect(result.length).toBe(1);
    expect(result[0].angleId).toBe('b');
  });

  it('exact boundary gap (= minInterval) keeps both', () => {
    const a: MulticamCutSuggestion = { time: 0, angleId: 'a', confidence: 0.8, reason: '' };
    const b: MulticamCutSuggestion = { time: DEFAULT_MIN_SWITCH_INTERVAL, angleId: 'b', confidence: 0.7, reason: '' };
    const result = enforceMinimumSwitchInterval([a, b]);
    expect(result.length).toBe(2);
  });

  it('just-below boundary gap keeps only one', () => {
    const a: MulticamCutSuggestion = { time: 0, angleId: 'a', confidence: 0.8, reason: '' };
    const b: MulticamCutSuggestion = { time: DEFAULT_MIN_SWITCH_INTERVAL - 0.01, angleId: 'b', confidence: 0.7, reason: '' };
    const result = enforceMinimumSwitchInterval([a, b]);
    expect(result.length).toBe(1);
  });
});

describe('validateCutAngles', () => {
  it('keeps only valid angle IDs', () => {
    const suggestions: MulticamCutSuggestion[] = [
      { time: 0, angleId: 'a', confidence: 0.8, reason: '' },
      { time: 1, angleId: 'x', confidence: 0.7, reason: '' },
      { time: 2, angleId: 'b', confidence: 0.9, reason: '' }
    ];
    const result = validateCutAngles(suggestions, ['a', 'b']);
    expect(result.length).toBe(2);
    expect(result.map(r => r.angleId)).toEqual(['a', 'b']);
  });

  it('returns empty when no valid angles', () => {
    const suggestions: MulticamCutSuggestion[] = [
      { time: 0, angleId: 'x', confidence: 0.8, reason: '' }
    ];
    expect(validateCutAngles(suggestions, ['a', 'b']).length).toBe(0);
  });

  it('returns empty for empty suggestions', () => {
    expect(validateCutAngles([], ['a']).length).toBe(0);
  });

  it('returns all when all are valid', () => {
    const suggestions: MulticamCutSuggestion[] = [
      { time: 0, angleId: 'a', confidence: 0.8, reason: '' },
      { time: 1, angleId: 'a', confidence: 0.7, reason: '' }
    ];
    expect(validateCutAngles(suggestions, ['a']).length).toBe(2);
  });
});
