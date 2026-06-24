import { describe, expect, it } from 'vitest';
import {
  normalizeCrossPropertyValue,
  normalizePastedKeyframes,
  type ClipboardKeyframeGroup
} from '../src';

function kf(time: number, value: number, easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'linear') {
  return { id: `kf-${time}`, time, value, easing };
}

describe('normalizeCrossPropertyValue', () => {
  it('returns same value for same property', () => {
    expect(normalizeCrossPropertyValue(0.5, 'opacity', 'opacity')).toBe(0.5);
  });

  it('maps opacity 0.5 to volume 1.0 (0~1 -> 0~2)', () => {
    expect(normalizeCrossPropertyValue(0.5, 'opacity', 'volume')).toBe(1);
  });

  it('maps opacity 0.0 to volume 0.0', () => {
    expect(normalizeCrossPropertyValue(0, 'opacity', 'volume')).toBe(0);
  });

  it('maps opacity 1.0 to volume 2.0', () => {
    expect(normalizeCrossPropertyValue(1, 'opacity', 'volume')).toBe(2);
  });

  it('maps volume 1.0 to opacity 0.5 (0~2 -> 0~1)', () => {
    expect(normalizeCrossPropertyValue(1, 'volume', 'opacity')).toBe(0.5);
  });
});

describe('normalizePastedKeyframes', () => {
  it('relative paste keeps same clip-local time', () => {
    const groups: ClipboardKeyframeGroup[] = [
      { sourceClipId: 'src', sourceClipStart: 1, property: 'opacity', keyframes: [kf(0.5, 0.8)] }
    ];
    const result = normalizePastedKeyframes(groups, 5, 10, 'relative');
    expect(result).toHaveLength(1);
    expect(result[0].property).toBe('opacity');
    expect(result[0].keyframes[0].time).toBe(0.5);
    expect(result[0].keyframes[0].value).toBe(0.8);
  });

  it('absolute paste preserves timeline position', () => {
    const groups: ClipboardKeyframeGroup[] = [
      { sourceClipId: 'src', sourceClipStart: 2, property: 'opacity', keyframes: [kf(1, 0.6)] }
    ];
    const result = normalizePastedKeyframes(groups, 5, 10, 'absolute');
    expect(result[0].keyframes[0].time).toBe(0);
  });

  it('clamps keyframes beyond clip duration', () => {
    const groups: ClipboardKeyframeGroup[] = [
      { sourceClipId: 'src', sourceClipStart: 0, property: 'opacity', keyframes: [kf(8, 0.5)] }
    ];
    const result = normalizePastedKeyframes(groups, 0, 5, 'relative');
    expect(result[0].keyframes[0].time).toBe(5);
  });

  it('clamps negative time to 0', () => {
    const groups: ClipboardKeyframeGroup[] = [
      { sourceClipId: 'src', sourceClipStart: 2, property: 'opacity', keyframes: [kf(1, 0.5)] }
    ];
    const result = normalizePastedKeyframes(groups, 10, 10, 'absolute');
    expect(result[0].keyframes[0].time).toBe(0);
  });

  it('normalizes cross-property values when targetProperty differs', () => {
    const groups: ClipboardKeyframeGroup[] = [
      { sourceClipId: 'src', sourceClipStart: 0, property: 'opacity', keyframes: [kf(0, 0.5)] }
    ];
    const result = normalizePastedKeyframes(groups, 0, 10, 'relative', 'volume');
    expect(result[0].property).toBe('volume');
    expect(result[0].keyframes[0].value).toBe(1);
  });

  it('generates new keyframe ids', () => {
    const groups: ClipboardKeyframeGroup[] = [
      { sourceClipId: 'src', sourceClipStart: 0, property: 'opacity', keyframes: [kf(0, 0.5)] }
    ];
    const result = normalizePastedKeyframes(groups, 0, 10, 'relative');
    expect(result[0].keyframes[0].id).not.toBe('kf-0');
  });

  it('preserves easing', () => {
    const groups: ClipboardKeyframeGroup[] = [
      { sourceClipId: 'src', sourceClipStart: 0, property: 'opacity', keyframes: [kf(1, 0.5, 'ease-in')] }
    ];
    const result = normalizePastedKeyframes(groups, 0, 10, 'relative');
    expect(result[0].keyframes[0].easing).toBe('ease-in');
  });

  it('returns empty for empty groups', () => {
    const result = normalizePastedKeyframes([], 0, 10, 'relative');
    expect(result).toHaveLength(0);
  });
});
