import { describe, expect, it } from 'vitest';
import {
  buildTextAnimationKeyframes,
  normalizeTextAnimationDuration,
  TEXT_ANIMATION_PRESETS,
  type ClipKeyframes,
  type TextAnimationPreset
} from '../src';

const baseTransform = {
  x: 0.1,
  y: -0.2,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 0.8
};

describe('text animation presets', () => {
  it.each([
    ['fade', { opacity: 2 }, { opacity: 0 }],
    ['fly-up', { opacity: 2, y: 2 }, { opacity: 0, y: 0.05 }],
    ['slide-left', { opacity: 2, x: 2 }, { opacity: 0, x: -0.25 }],
    ['typewriter', { opacity: 2, scaleX: 5 }, { opacity: 0.8, scaleX: 0.01 }],
    ['bounce', { opacity: 2, y: 4 }, { opacity: 0, y: 0.02 }],
    ['scale', { opacity: 2, scaleX: 3, scaleY: 3 }, { opacity: 0, scaleX: 0.2, scaleY: 0.2 }]
  ] satisfies Array<[TextAnimationPreset, Partial<Record<keyof ClipKeyframes, number>>, Partial<Record<keyof ClipKeyframes, number>>]>)(
    'builds %s intro keyframes with the expected counts and initial values',
    (preset, counts, initialValues) => {
      const keyframes = buildTextAnimationKeyframes({
        preset,
        direction: 'in',
        duration: 0.5,
        clipDuration: 3,
        transform: baseTransform,
        text: 'HELLO'
      });

      for (const [property, count] of Object.entries(counts) as Array<[keyof ClipKeyframes, number]>) {
        expect(keyframes[property]).toHaveLength(count);
      }
      for (const [property, value] of Object.entries(initialValues) as Array<[keyof ClipKeyframes, number]>) {
        expect(keyframes[property]?.[0]?.value).toBeCloseTo(value, 3);
      }
    }
  );

  it.each([
    ['fade', { opacity: 2 }, { opacity: 0.8 }],
    ['fly-up', { opacity: 2, y: 2 }, { opacity: 0.8, y: -0.2 }],
    ['slide-left', { opacity: 2, x: 2 }, { opacity: 0.8, x: 0.1 }],
    ['typewriter', { opacity: 2, scaleX: 5 }, { opacity: 0.8, scaleX: 1.0 }],
    ['bounce', { opacity: 2, y: 3 }, { opacity: 0.8, y: -0.2 }],
    ['scale', { opacity: 2, scaleX: 3, scaleY: 3 }, { opacity: 0.8, scaleX: 1.0, scaleY: 1.0 }]
  ] satisfies Array<[TextAnimationPreset, Partial<Record<keyof ClipKeyframes, number>>, Partial<Record<keyof ClipKeyframes, number>>]>)(
    'builds %s outro keyframes with the expected counts and initial values',
    (preset, counts, initialValues) => {
      const keyframes = buildTextAnimationKeyframes({
        preset,
        direction: 'out',
        duration: 0.5,
        clipDuration: 3,
        transform: baseTransform,
        text: 'HELLO'
      });

      for (const [property, count] of Object.entries(counts) as Array<[keyof ClipKeyframes, number]>) {
        expect(keyframes[property]).toHaveLength(count);
      }
      for (const [property, value] of Object.entries(initialValues) as Array<[keyof ClipKeyframes, number]>) {
        expect(keyframes[property]?.[0]?.value).toBeCloseTo(value, 3);
      }
    }
  );

  it('scales keyframe times with the requested duration and clamps to the allowed range', () => {
    const short = buildTextAnimationKeyframes({ preset: 'fade', direction: 'in', duration: 0.01, clipDuration: 3, transform: baseTransform });
    const long = buildTextAnimationKeyframes({ preset: 'fade', direction: 'out', duration: 99, clipDuration: 5, transform: baseTransform });
    const both = buildTextAnimationKeyframes({ preset: 'fade', direction: 'both', duration: 2, clipDuration: 3, transform: baseTransform });

    expect(normalizeTextAnimationDuration(0.01)).toBe(0.1);
    expect(normalizeTextAnimationDuration(99)).toBe(2);
    expect(short.opacity?.map((frame) => frame.time)).toEqual([0, 0.1]);
    expect(long.opacity?.map((frame) => frame.time)).toEqual([3, 5]);
    expect(both.opacity?.map((frame) => frame.time)).toEqual([0, 1.5, 1.5, 3]);
  });

  it('exposes exactly the six built-in presets', () => {
    expect(TEXT_ANIMATION_PRESETS).toEqual(['fade', 'fly-up', 'slide-left', 'typewriter', 'bounce', 'scale']);
  });
});
