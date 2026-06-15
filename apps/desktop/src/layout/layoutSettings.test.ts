import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_WORKSPACE_LAYOUT_IDS,
  BUILT_IN_WORKSPACE_LAYOUTS,
  DEFAULT_EDITOR_LAYOUT_SETTINGS,
  applyWorkspaceLayout,
  clampTimelineHeight,
  createCustomWorkspaceLayout,
  getEffectivePanelState,
  normalizeStoredLayoutSettings,
  resolveWorkspaceLayoutShortcut
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

  it('auto-collapses panels from workspace visibility and viewport width', () => {
    const hiddenMediaLayout = applyWorkspaceLayout(DEFAULT_EDITOR_LAYOUT_SETTINGS, BUILT_IN_WORKSPACE_LAYOUTS['color-grading']);

    expect(getEffectivePanelState(hiddenMediaLayout, 1440)).toEqual({
      leftPanelCollapsed: true,
      rightPanelCollapsed: false,
      rightPanelAutoCollapsed: false,
      rightPrimaryPanelVisible: true,
      audioMixerVisible: false
    });
    expect(getEffectivePanelState(DEFAULT_EDITOR_LAYOUT_SETTINGS, 1199)).toMatchObject({
      rightPanelCollapsed: true,
      rightPanelAutoCollapsed: true
    });
  });

  it('deserializes legacy panel collapse state and fills workspace defaults', () => {
    expect(
      normalizeStoredLayoutSettings({
        timelineHeightPx: 260.6,
        leftPanelCollapsed: true,
        rightPanelCollapsed: false
      })
    ).toEqual({
      ...DEFAULT_EDITOR_LAYOUT_SETTINGS,
      timelineHeightPx: 261,
      leftPanelCollapsed: true,
      rightPanelCollapsed: false
    });
    expect(normalizeStoredLayoutSettings({ timelineHeightPx: -1, leftPanelCollapsed: 'yes', rightPanelCollapsed: true })).toEqual({
      ...DEFAULT_EDITOR_LAYOUT_SETTINGS,
      timelineHeightPx: 120,
      leftPanelCollapsed: false,
      rightPanelCollapsed: true
    });
  });

  it('keeps built-in workspace layout definitions complete', () => {
    expect(BUILT_IN_WORKSPACE_LAYOUT_IDS).toEqual(['standard-editing', 'color-grading', 'audio-editing']);
    for (const id of BUILT_IN_WORKSPACE_LAYOUT_IDS) {
      const layout = BUILT_IN_WORKSPACE_LAYOUTS[id];
      expect(layout).toMatchObject({
        id,
        builtIn: true,
        panels: {
          mediaLibrary: expect.any(Boolean),
          inspector: expect.any(Boolean),
          audioMixer: expect.any(Boolean),
          colorScopes: expect.any(Boolean),
          history: expect.any(Boolean),
          bookmarks: expect.any(Boolean)
        }
      });
      expect(layout.leftPanelWidthPx).toBeGreaterThanOrEqual(48);
      expect(layout.rightPanelWidthPx).toBeGreaterThanOrEqual(48);
      expect(layout.timelineHeightPx).toBeGreaterThanOrEqual(120);
      expect(layout.shortcutSlot).toBeGreaterThanOrEqual(1);
      expect(layout.shortcutSlot).toBeLessThanOrEqual(3);
    }
  });

  it('serializes and deserializes custom workspace layouts for settings persistence', () => {
    const audioSettings = applyWorkspaceLayout(DEFAULT_EDITOR_LAYOUT_SETTINGS, BUILT_IN_WORKSPACE_LAYOUTS['audio-editing']);
    const customLayout = createCustomWorkspaceLayout('音频审核', audioSettings);
    const restored = normalizeStoredLayoutSettings({
      ...audioSettings,
      activeWorkspaceLayoutId: customLayout.id,
      customWorkspaceLayouts: [customLayout]
    });

    expect(restored?.activeWorkspaceLayoutId).toBe(customLayout.id);
    expect(restored?.customWorkspaceLayouts).toEqual([
      expect.objectContaining({
        id: customLayout.id,
        name: '音频审核',
        builtIn: false,
        shortcutSlot: 4,
        panels: audioSettings.panels,
        mixerHeightPx: audioSettings.mixerHeightPx
      })
    ]);
  });

  it('resolves workspace layout shortcuts for built-in and custom layouts', () => {
    const customLayout = createCustomWorkspaceLayout('审片', DEFAULT_EDITOR_LAYOUT_SETTINGS);

    expect(resolveWorkspaceLayoutShortcut({ key: '2', ctrlKey: true, shiftKey: true }, [])).toBe('color-grading');
    expect(resolveWorkspaceLayoutShortcut({ key: '4', ctrlKey: true, shiftKey: true }, [customLayout])).toBe(customLayout.id);
    expect(resolveWorkspaceLayoutShortcut({ key: '4', ctrlKey: true }, [customLayout])).toBeUndefined();
    expect(resolveWorkspaceLayoutShortcut({ key: '4', ctrlKey: true, shiftKey: true, altKey: true }, [customLayout])).toBeUndefined();
  });
});
