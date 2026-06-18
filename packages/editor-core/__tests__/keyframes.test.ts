import { describe, expect, it } from 'vitest';
import {
  applyEasing,
  applyClipKeyframes,
  applyBatchKeyframeEasing,
  applyKeyframeHandlePatch,
  calculateBezierHandleCoordinates,
  calculateKeyframeSpeedSamples,
  alignKeyframeValues,
  cloneClipKeyframes,
  createKeyframe,
  createKenBurnsKeyframes,
  distributeKeyframeTimes,
  getClipKeyframeValue,
  getClipStaticKeyframeValue,
  interpolateKeyframes,
  normalizeClipKeyframes,
  normalizeEasing,
  normalizeKeyframeHandle,
  normalizeKeyframeHandleMode,
  normalizeKeyframes,
  parseKeyframeExpression,
  removeKeyframeForProperty,
  setKeyframeForProperty,
  resolveAnimatedTransform,
  resolveAnimatedVolume,
  setKenBurnsEndScaleKeyframes
} from '../src';
import { makeTextClip, makeVideoClip } from './test-utils';

describe('keyframe interpolation', () => {
  it('interpolates linear keyframes and clamps outside the keyframe range', () => {
    const frames = [
      { id: 'a', time: 1, value: 10, easing: 'linear' as const },
      { id: 'b', time: 3, value: 20, easing: 'linear' as const }
    ];

    expect(interpolateKeyframes(frames, 0, 0)).toBe(10);
    expect(interpolateKeyframes(frames, 2, 0)).toBe(15);
    expect(interpolateKeyframes(frames, 4, 0)).toBe(20);
  });

  it('applies ease-in-out interpolation', () => {
    expect(applyEasing(0.5, 'ease-in')).toBe(0.25);
    expect(applyEasing(0.5, 'ease-out')).toBe(0.75);
    expect(applyEasing(0.75, 'bounce')).toBeGreaterThan(0.9);
    expect(applyEasing(0.5, 'elastic')).toBeGreaterThan(0.9);
    expect(applyEasing(-1, 'linear')).toBe(0);
    expect(applyEasing(2, 'linear')).toBe(1);
    expect(applyEasing(0.25, 'ease-in-out')).toBeCloseTo(0.125, 3);
    expect(applyEasing(0.75, 'ease-in-out')).toBeCloseTo(0.875, 3);
    expect(
      interpolateKeyframes(
        [
          { id: 'a', time: 0, value: 0, easing: 'ease-in-out' },
          { id: 'b', time: 1, value: 100, easing: 'linear' }
        ],
        0.25,
        0
      )
    ).toBe(12.5);
  });

  it('uses the last matching keyframe when times overlap', () => {
    expect(
      interpolateKeyframes(
        [
          { id: 'a', time: 1, value: 10, easing: 'linear' },
          { id: 'b', time: 1, value: 20, easing: 'linear' },
          { id: 'c', time: 2, value: 30, easing: 'linear' }
        ],
        1,
        0
      )
    ).toBe(20);
  });

  it('returns fallbacks for empty, invalid, or single keyframe inputs', () => {
    expect(interpolateKeyframes(undefined, 1, 42)).toBe(42);
    expect(normalizeKeyframes(undefined, 1, 0)).toEqual([]);
    expect(normalizeKeyframes([{ id: '', time: Number.NaN, value: 1, easing: 'linear' }], 1, 0)).toEqual([]);
    expect(normalizeEasing('not-easing')).toBe('linear');
    expect(normalizeEasing('bounce')).toBe('bounce');
    expect(createKeyframe('opacity', { id: 'opacity-a', time: 2, value: 99, easing: 'ease-out' }, 1)).toEqual({
      id: 'opacity-a',
      time: 1,
      value: 1,
      easing: 'ease-out'
    });
  });

  it('normalizes clip keyframes and resolves animated transform and volume', () => {
    const clip = makeVideoClip({
      transform: { opacity: 1, scale: 1 },
      volume: 1,
      keyframes: {
        opacity: [
          { id: 'o-a', time: -1, value: -1, easing: 'unknown' as never },
          { id: 'o-b', time: 2, value: 2, easing: 'linear' }
        ],
        volume: [
          { id: 'v-a', time: 0, value: 1, easing: 'linear' },
          { id: 'v-b', time: 2, value: 0.5, easing: 'linear' }
        ],
        scaleX: [
          { id: 's-a', time: 0, value: 1, easing: 'linear' },
          { id: 's-b', time: 2, value: 2, easing: 'linear' }
        ],
        scaleY: [
          { id: 'sy-a', time: 0, value: 1, easing: 'linear' },
          { id: 'sy-b', time: 2, value: 2, easing: 'linear' }
        ]
      }
    });
    const normalized = { ...clip, keyframes: normalizeClipKeyframes(clip.keyframes, clip.duration) };

    expect(normalized.keyframes?.opacity?.[0]).toMatchObject({ time: 0, value: 0, easing: 'linear' });
    expect(resolveAnimatedTransform(normalized, 1)).toMatchObject({ opacity: 0.5, scale: 1.5 });
    expect(resolveAnimatedVolume(normalized, 1)).toBe(0.75);
  });

  it('normalizes speed keyframes to the clip speed range', () => {
    const normalized = normalizeClipKeyframes(
      {
        speed: [
          { id: 'speed-slow', time: -1, value: 0.01, easing: 'linear' },
          { id: 'speed-fast', time: 3, value: 9, easing: 'linear' }
        ]
      },
      2
    );

    expect(normalized?.speed).toEqual([
      { id: 'speed-slow', time: 0, value: 0.25, easing: 'linear' },
      { id: 'speed-fast', time: 2, value: 4, easing: 'linear' }
    ]);
  });

  it('resolves static keyframe values and applies animated transforms to non-audio clips', () => {
    const text = makeTextClip({
      transform: { x: 10, y: 20, scale: 1, opacity: 0.5 },
      keyframes: {
        x: [
          { id: 'x-a', time: 0, value: 0, easing: 'linear' },
          { id: 'x-b', time: 1, value: 1, easing: 'linear' }
        ],
        y: [{ id: 'y-a', time: 0, value: -0.5, easing: 'linear' }],
        spatialX: [{ id: 'spatial-x-a', time: 0, value: -0.25, easing: 'linear' }],
        spatialY: [{ id: 'spatial-y-a', time: 0, value: 0.5, easing: 'linear' }],
        opacity: [{ id: 'o-a', time: 0, value: 0.75, easing: 'linear' }]
      }
    });
    const animated = applyClipKeyframes(text, 0.5);

    expect(getClipStaticKeyframeValue(text, 'x')).toBe(10);
    expect(getClipStaticKeyframeValue(text, 'y')).toBe(20);
    expect(getClipStaticKeyframeValue(text, 'volume')).toBe(1);
    expect(getClipStaticKeyframeValue(makeVideoClip({ speed: 1.5 }), 'speed')).toBe(1.5);
    expect(getClipStaticKeyframeValue(makeVideoClip({ spatialAudio: { x: -0.4, y: 0.6, z: 0, distance: 'medium' } }), 'spatialX')).toBe(-0.4);
    expect(getClipStaticKeyframeValue(makeVideoClip({ spatialAudio: { x: -0.4, y: 0.6, z: 0, distance: 'medium' } }), 'spatialY')).toBe(0.6);
    expect(getClipStaticKeyframeValue(makeVideoClip({ spatialAudio: { renderMode: 'binaural', azimuth: 90, elevation: 15, distanceMeters: 4 } }), 'spatialAzimuth')).toBe(90);
    expect(getClipStaticKeyframeValue(makeVideoClip({ spatialAudio: { renderMode: 'binaural', azimuth: 90, elevation: 15, distanceMeters: 4 } }), 'spatialElevation')).toBe(15);
    expect(getClipStaticKeyframeValue(makeVideoClip({ spatialAudio: { renderMode: 'binaural', azimuth: 90, elevation: 15, distanceMeters: 4 } }), 'spatialDistanceMeters')).toBe(4);
    expect(getClipStaticKeyframeValue(text, 'pathStartOffset')).toBe(0);
    expect(getClipKeyframeValue(text, 'x', 0.5)).toBe(0.5);
    expect(animated).toMatchObject({ transform: { x: 0.5, y: -0.5, opacity: 0.75 } });
    expect('volume' in animated).toBe(false);
  });

  it('resolves animated panorama keyframes and static panorama fallbacks', () => {
    const clip = makeVideoClip({
      panorama: { yaw: 5, pitch: -2, roll: 1, fov: 90, outputProjection: 'flat' },
      keyframes: {
        yaw: [
          { id: 'yaw-a', time: 0, value: 0, easing: 'linear' },
          { id: 'yaw-b', time: 2, value: 90, easing: 'linear' }
        ],
        pitch: [{ id: 'pitch-a', time: 0, value: 10, easing: 'linear' }],
        roll: [{ id: 'roll-a', time: 0, value: -10, easing: 'linear' }]
      }
    });

    expect(getClipStaticKeyframeValue(clip, 'yaw')).toBe(5);
    expect(getClipStaticKeyframeValue(clip, 'pitch')).toBe(-2);
    expect(getClipStaticKeyframeValue(clip, 'roll')).toBe(1);
    expect(applyClipKeyframes(clip, 1).panorama).toMatchObject({ yaw: 45, pitch: 10, roll: -10 });
  });

  it('sets, clones, and removes keyframes without sharing nested arrays', () => {
    const withOpacity = setKeyframeForProperty(undefined, 'opacity', { id: 'opacity-a', time: 0.5, value: 0.25, easing: 'linear' }, 1);
    const cloned = cloneClipKeyframes(withOpacity);

    expect(cloned).toEqual(withOpacity);
    cloned!.opacity![0].value = 1;
    expect(withOpacity.opacity?.[0].value).toBe(0.25);
    expect(setKeyframeForProperty(withOpacity, 'opacity', { id: 'opacity-a', time: 0.75, value: 0.5, easing: 'ease-in' }, 1).opacity).toEqual([
      { id: 'opacity-a', time: 0.75, value: 0.5, easing: 'ease-in' }
    ]);
    expect(removeKeyframeForProperty(withOpacity, 'volume', 'missing')).toEqual(withOpacity);
    expect(removeKeyframeForProperty(withOpacity, 'opacity', 'opacity-a')).toBeUndefined();
  });

  it('calculates unified bezier handles as mirrored coordinates', () => {
    const coordinates = calculateBezierHandleCoordinates(
      { id: 'b', time: 1, value: 0.5, easing: 'linear', outHandle: { dx: 0.3, dy: 0.2 }, handleMode: 'unified' },
      { id: 'a', time: 0, value: 0, easing: 'linear' },
      { id: 'c', time: 2, value: 1, easing: 'linear' }
    );

    expect(coordinates.mode).toBe('unified');
    expect(coordinates.outHandle).toMatchObject({ time: 1.3, value: 0.7, dx: 0.3, dy: 0.2 });
    expect(coordinates.inHandle).toMatchObject({ time: 0.7, value: 0.3, dx: -0.3, dy: -0.2 });
  });

  it('clamps independent bezier handles inside adjacent segments', () => {
    const coordinates = calculateBezierHandleCoordinates(
      { id: 'b', time: 1, value: 0.5, easing: 'linear', inHandle: { dx: -9, dy: 0.1 }, outHandle: { dx: 9, dy: -0.1 }, handleMode: 'independent' },
      { id: 'a', time: 0.25, value: 0, easing: 'linear' },
      { id: 'c', time: 1.5, value: 1, easing: 'linear' }
    );

    expect(coordinates.mode).toBe('independent');
    expect(coordinates.inHandle?.dx).toBe(-0.75);
    expect(coordinates.outHandle?.dx).toBe(0.5);
  });

  it('keeps broken bezier handles exactly as authored', () => {
    const coordinates = calculateBezierHandleCoordinates(
      { id: 'b', time: 1, value: 0.5, easing: 'linear', inHandle: { dx: 0.2, dy: 0.1 }, outHandle: { dx: -0.2, dy: -0.1 }, handleMode: 'broken' },
      { id: 'a', time: 0, value: 0, easing: 'linear' },
      { id: 'c', time: 2, value: 1, easing: 'linear' }
    );

    expect(coordinates.mode).toBe('broken');
    expect(coordinates.inHandle).toMatchObject({ time: 1.2, value: 0.6, dx: 0.2, dy: 0.1 });
    expect(coordinates.outHandle).toMatchObject({ time: 0.8, value: 0.4, dx: -0.2, dy: -0.1 });
  });

  it('calculates speed derivative samples for keyframe curves', () => {
    const samples = calculateKeyframeSpeedSamples(
      [
        { id: 'a', time: 0, value: 0, easing: 'linear' },
        { id: 'b', time: 2, value: 2, easing: 'linear' }
      ],
      2,
      0,
      3
    );

    expect(samples.map((sample) => sample.time)).toEqual([0, 1, 2]);
    expect(samples[1].value).toBeCloseTo(1, 3);
  });

  it('applies batch easing presets and distributes keyframe times', () => {
    const frames = [
      { id: 'a', time: 0, value: 0, easing: 'linear' as const },
      { id: 'b', time: 0.3, value: 1, easing: 'linear' as const },
      { id: 'c', time: 1.2, value: 2, easing: 'linear' as const }
    ];

    expect(applyBatchKeyframeEasing(frames, 'elastic').map((frame) => frame.easing)).toEqual(['elastic', 'elastic', 'elastic']);
    expect(distributeKeyframeTimes(frames).map((frame) => frame.time)).toEqual([0, 0.6, 1.2]);
  });

  it('parses precise keyframe math expressions with previous values', () => {
    expect(parseKeyframeExpression('prev+0.5', { prev: 1.25, current: 2, min: 0, max: 3 })).toBe(1.75);
    expect(parseKeyframeExpression('(current+next)/2', { current: 1, next: 3 })).toBe(2);
  });

  it('covers keyframe helper edge cases and expression failures', () => {
    expect(applyEasing(0.2, 'bounce')).toBeGreaterThan(0);
    expect(applyEasing(0.5, 'bounce')).toBeGreaterThan(0.7);
    expect(applyEasing(0.9, 'bounce')).toBeGreaterThan(0.9);
    expect(normalizeKeyframeHandle({ dx: Number.NaN, dy: 1 })).toBeUndefined();
    expect(normalizeKeyframeHandleMode('locked')).toBeUndefined();

    const unified = applyKeyframeHandlePatch(
      { id: 'a', time: 1, value: 1, easing: 'linear' },
      'in',
      { dx: -0.25, dy: 0.2 },
      'unified'
    );
    expect(unified).toMatchObject({ inHandle: { dx: -0.25, dy: 0.2 }, outHandle: { dx: 0.25, dy: -0.2 }, handleMode: 'unified' });
    expect(applyKeyframeHandlePatch({ id: 'b', time: 1, value: 1, easing: 'linear' }, 'out', { dx: Number.NaN, dy: 0 }, 'broken')).toMatchObject({
      outHandle: { dx: 0, dy: 0 },
      handleMode: 'broken'
    });

    expect(
      interpolateKeyframes(
        [
          { id: 'a', time: 0, value: 1, easing: 'linear', outHandle: { dx: 0.2, dy: 0.4 } },
          { id: 'b', time: 1, value: 1, easing: 'linear', inHandle: { dx: -0.2, dy: -0.4 } }
        ],
        0.5,
        1
      )
    ).toBe(1);
    expect(alignKeyframeValues([{ id: 'a', time: 0, value: 0.25, easing: 'linear' }], 0.75)[0].value).toBe(0.75);
    expect(() => parseKeyframeExpression('', {})).toThrow('empty');
    expect(() => parseKeyframeExpression('prev+1', {})).toThrow('Missing prev');
    expect(() => parseKeyframeExpression('current/(next-next)', { current: 1, next: 1 })).toThrow('finite');
    expect(() => parseKeyframeExpression('(current+1', { current: 1 })).toThrow('closing parenthesis');
    expect(() => parseKeyframeExpression('current foo', { current: 1 })).toThrow('Unsupported');
  });

  it('creates Ken Burns scale keyframes at the start and end of a clip', () => {
    const keyframes = createKenBurnsKeyframes(3, 1, 1.5);

    expect(keyframes.scaleX?.map((frame) => [frame.time, frame.value])).toEqual([
      [0, 1],
      [3, 1.5]
    ]);
    expect(keyframes.scaleY?.map((frame) => [frame.time, frame.value])).toEqual([
      [0, 1],
      [3, 1.5]
    ]);
  });

  it('updates the Ken Burns ending scale keyframes', () => {
    const keyframes = setKenBurnsEndScaleKeyframes(createKenBurnsKeyframes(3, 1, 1.5), 3, 2);

    expect(keyframes.scaleX?.at(-1)).toMatchObject({ time: 3, value: 2, easing: 'ease-in-out' });
    expect(keyframes.scaleY?.at(-1)).toMatchObject({ time: 3, value: 2, easing: 'ease-in-out' });
    expect(keyframes.x?.map((frame) => frame.time)).toEqual([0, 3]);
  });

  it('creates Ken Burns scale frames when existing scale arrays are empty', () => {
    const keyframes = setKenBurnsEndScaleKeyframes({ scaleX: [], scaleY: [] }, 2, 99);

    expect(keyframes.scaleX?.at(-1)).toMatchObject({ time: 2, value: 4 });
    expect(keyframes.scaleY?.at(-1)).toMatchObject({ time: 2, value: 4 });
  });
});
