import { describe, expect, it } from 'vitest';
import { resolveSpectrumSelection, resolveSpectrumTime } from './audioSpectrum';

describe('audio spectrum editor geometry', () => {
  it('maps a canvas click to media time', () => {
    expect(resolveSpectrumTime(250, 50, 400, 20)).toBe(10);
    expect(resolveSpectrumTime(20, 50, 400, 20)).toBe(0);
    expect(resolveSpectrumTime(500, 50, 400, 20)).toBe(20);
  });

  it('converts dragged region to ordered in/out points', () => {
    expect(resolveSpectrumSelection(350, 150, 50, 400, 40)).toEqual({ inPoint: 10, outPoint: 30 });
  });
});
