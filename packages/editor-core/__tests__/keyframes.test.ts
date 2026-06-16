import { describe, expect, it } from 'vitest';
import {
  applyEasing,
  applyClipKeyframes,
  cloneClipKeyframes,
  createKeyframe,
  createKenBurnsKeyframes,
  getClipKeyframeValue,
  getClipStaticKeyframeValue,
  interpolateKeyframes,
  normalizeClipKeyframes,
  normalizeEasing,
  normalizeKeyframes,
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
