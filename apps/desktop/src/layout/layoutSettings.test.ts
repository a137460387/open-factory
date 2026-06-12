import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_LAYOUT_SETTINGS,
  clampTimelineHeight,
  getEffectivePanelState,
  normalizeStoredLayoutSettings
} from './layoutSettings';

describe('editor layout settings', () => {
  it('clamps timeline height between 120px and 60% of the viewport', () => {
    expect(clampTimelineHeight(80, 900)).toBe(120);
    expect(clampTimelineHeight(320, 900)).toBe(320);
    expect(clampTimelineHeight(800, 900)).toBe(540);
    expect(clampTimelineHeight(Number.NaN, 900)).toBe(DEFAULT_EDITOR_LAYOUT_SETTINGS.timelineHeightPx);
  });

  it('keeps the minimum timeline height when the viewport is very short', () => {
    expect(clampTimelineHeight(260, 180)).toBe(120);
  });

  it('auto-collapses the right panel below 1200px without changing left panel state', () => {
    const settings = { timelineHeightPx: 260, leftPanelCollapsed: true, rightPanelCollapsed: false };

    expect(getEffectivePanelState(settings, 1199)).toEqual({
      leftPanelCollapsed: true,
      rightPanelCollapsed: true,
      rightPanelAutoCollapsed: true
    });
    expect(getEffectivePanelState(settings, 1200)).toEqual({
      leftPanelCollapsed: true,
      rightPanelCollapsed: false,
      rightPanelAutoCollapsed: false
    });
  });

  it('normalizes stored panel collapse state and timeline height', () => {
    expect(
      normalizeStoredLayoutSettings({
        timelineHeightPx: 260.6,
        leftPanelCollapsed: true,
        rightPanelCollapsed: false
      })
    ).toEqual({
      timelineHeightPx: 261,
      leftPanelCollapsed: true,
      rightPanelCollapsed: false
    });
    expect(normalizeStoredLayoutSettings({ timelineHeightPx: -1, leftPanelCollapsed: 'yes', rightPanelCollapsed: true })).toEqual({
      timelineHeightPx: 120,
      leftPanelCollapsed: false,
      rightPanelCollapsed: true
    });
  });
});
