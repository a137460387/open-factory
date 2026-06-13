import { describe, expect, it } from 'vitest';
import { buildPrivacyMasksFromDetections } from '../src';

describe('privacy blur detection conversion', () => {
  it('converts detected boxes into animated privacy mask keyframes', () => {
    const [mask] = buildPrivacyMasksFromDetections(
      [
        { time: 1, x: 0.2, y: 0.3, w: 0.15, h: 0.2, label: 'face', confidence: 0.9 },
        { time: 0, x: -1, y: 2, w: 0, h: 0.5, label: 'face', confidence: 0.8 }
      ],
      { effect: 'gblur', color: '#111111', idPrefix: 'privacy-test' }
    );

    expect(mask).toMatchObject({
      type: 'rect',
      x: 0,
      y: 0.5,
      w: 0.001,
      h: 0.5,
      privacyBlur: { enabled: true, effect: 'gblur', color: '#111111' }
    });
    expect(mask.keyframes).toEqual([
      { time: 0, x: 0, y: 0.5, w: 0.001, h: 0.5 },
      { time: 1, x: 0.2, y: 0.3, w: 0.15, h: 0.2 }
    ]);
  });

  it('returns no masks when detections are empty or invalid', () => {
    expect(buildPrivacyMasksFromDetections([])).toEqual([]);
    expect(buildPrivacyMasksFromDetections([{ time: Number.NaN, x: 0, y: 0, w: 0.2, h: 0.2 }])).toEqual([]);
  });
});
