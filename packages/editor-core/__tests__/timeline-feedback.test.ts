import { describe, expect, it } from 'vitest';

import {
  buildSelectionMarqueeRect,
  buildTrimDurationBubble,
  createSnapHighlight,
  formatTrimDurationBubble,
  getSelectionMarqueeBox,
  isSnapHighlightActive,
  normalizeTimelineFeedbackSettings,
  shouldAnimateTimelineFeedback
} from '../src';

describe('timeline interaction feedback', () => {
  it('formats trim duration bubbles from preview duration deltas', () => {
    expect(formatTrimDurationBubble(0.49)).toBe('+0.5s');
    expect(formatTrimDurationBubble(-0.31)).toBe('-0.3s');
    expect(buildTrimDurationBubble(2, 2.51)).toBe('+0.5s');
    expect(buildTrimDurationBubble(2, 1.66)).toBe('-0.3s');
  });

  it('triggers snap highlights for a short visible window', () => {
    const highlight = createSnapHighlight(2.5, 1000);

    expect(highlight).toEqual({ time: 2.5, expiresAtMs: 1200 });
    expect(isSnapHighlightActive(highlight, 1199)).toBe(true);
    expect(isSnapHighlightActive(highlight, 1201)).toBe(false);
    expect(createSnapHighlight(Number.NaN, 1000)).toBeUndefined();
  });

  it('disables timeline feedback animations when reduced motion is enabled', () => {
    expect(normalizeTimelineFeedbackSettings(undefined)).toEqual({ reduceMotion: false });
    expect(shouldAnimateTimelineFeedback({ reduceMotion: false })).toBe(true);
    expect(shouldAnimateTimelineFeedback({ reduceMotion: true })).toBe(false);
  });

  it('builds a marquee rectangle that follows the pointer in either direction', () => {
    const rect = buildSelectionMarqueeRect({ x: 200, y: 120 }, { x: 80, y: 180 });

    expect(rect).toEqual({ left: 200, top: 120, right: 80, bottom: 180 });
    expect(getSelectionMarqueeBox(rect)).toEqual({ left: 80, top: 120, width: 120, height: 60 });
  });
});
