// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useEditorShellDerivedState } from '../../hooks/useEditorShellDerivedState';

const baseLayoutSettings = {
  timelineHeightPx: 260,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  activeWorkspaceLayoutId: 'standard-editing',
  panels: {
    mediaLibrary: true,
    inspector: true,
    audioMixer: false,
    colorScopes: false,
    history: false,
    bookmarks: false,
  },
  leftPanelWidthPx: 280,
  rightPanelWidthPx: 360,
  mixerHeightPx: 220,
  previewPosition: 'center' as const,
  customWorkspaceLayouts: [],
};

const baseProject = {
  name: 'test',
  media: [],
  settings: { fps: 30 },
  beatMarkers: [],
  timeline: { tracks: [] },
};

const baseDeps = {
  project: baseProject as any,
  selectedClipId: null as string | null,
  selectedClipIds: [] as string[],
  demucsAvailability: false as any,
  audioSeparationClipId: null as string | null,
  speakerDiarizationRunning: false,
  autoAudioSyncRunning: false,
  autoAudioSyncPrimaryClipId: null as string | null,
  layoutSettings: baseLayoutSettings as any,
  viewportSize: { width: 1920, height: 1080 },
  reviewMode: false,
};

describe('useEditorShellDerivedState', () => {
  it('returns expected shape with empty project', () => {
    const { result } = renderHook(() => useEditorShellDerivedState(baseDeps));

    expect(result.current).toBeDefined();
    expect(result.current.beatSyncBeatTimes).toEqual([]);
    expect(result.current.canSnapToBeats).toBe(false);
    expect(result.current.canSplitToBeats).toBe(false);
    expect(typeof result.current.timelineHeightPx).toBe('number');
    expect(result.current.effectivePanels).toBeDefined();
    expect(result.current.workspaceLayouts).toBeDefined();
    expect(result.current.editorGridRows).toBeDefined();
    expect(result.current.mainGridColumns).toBeDefined();
    expect(result.current.rightPanelRows).toBeDefined();
  });

  it('returns null selectedClipMedia when no clip selected', () => {
    const { result } = renderHook(() => useEditorShellDerivedState(baseDeps));
    expect(result.current.selectedClipMedia).toBeUndefined();
  });

  it('returns canApplyPiPLayout as boolean', () => {
    const { result } = renderHook(() => useEditorShellDerivedState(baseDeps));
    expect(typeof result.current.canApplyPiPLayout).toBe('boolean');
  });

  it('returns canApplySplitLayout as boolean', () => {
    const { result } = renderHook(() => useEditorShellDerivedState(baseDeps));
    expect(typeof result.current.canApplySplitLayout).toBe('boolean');
  });

  it('handles reviewMode=true', () => {
    const deps = { ...baseDeps, reviewMode: true };
    const { result } = renderHook(() => useEditorShellDerivedState(deps));
    expect(result.current.reviewVisibility).toBeDefined();
  });
});
