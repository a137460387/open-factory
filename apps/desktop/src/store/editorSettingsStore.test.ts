// @vitest-environment jsdom
// 源文件：apps/desktop/src/store/editorSettingsStore.ts（106 可执行行，五期前覆盖 0%）
// 覆盖目标：≥70%。模式：直接 store.getState() / setState() 断言状态变化（纯 zustand，无外部依赖）。

import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorSettingsStore } from './editorSettingsStore';
import { DEFAULT_TIMELINE_GRID_SETTINGS } from '@open-factory/editor-core';

function resetStore() {
  useEditorSettingsStore.setState({
    timelineGridSettings: DEFAULT_TIMELINE_GRID_SETTINGS,
    safeFrameGuides: false,
    thumbnailTrackVisible: true,
    timelineMinimapVisible: true,
    macros: [],
    macroHistory: [],
    sharedLibraryResources: [],
    autosaveIntervalSeconds: 60,
    tutorialProgress: undefined,
    tutorialCelebrationVisible: false,
    pipLayoutPosition: 'bottom-right',
    customSplitLayouts: [],
    lastBackupAt: undefined,
    beatSensitivity: 'medium',
    beatSyncSpeedEnabled: false,
    beatSyncManualBpm: '',
    sceneDetectionRequestId: 0,
  });
}

beforeEach(() => {
  resetStore();
});

describe('useEditorSettingsStore 值与函数式更新器', () => {
  it('布尔开关 setter 支持值与函数两种形式', () => {
    const store = useEditorSettingsStore.getState();
    store.setSafeFrameGuides(true);
    expect(useEditorSettingsStore.getState().safeFrameGuides).toBe(true);
    useEditorSettingsStore.getState().setSafeFrameGuides((v) => !v);
    expect(useEditorSettingsStore.getState().safeFrameGuides).toBe(false);

    useEditorSettingsStore.getState().setThumbnailTrackVisible(false);
    expect(useEditorSettingsStore.getState().thumbnailTrackVisible).toBe(false);
    useEditorSettingsStore.getState().setTimelineMinimapVisible((v) => !v);
    expect(useEditorSettingsStore.getState().timelineMinimapVisible).toBe(false);
  });

  it('对象设置 setter 支持整体替换与函数式部分更新', () => {
    const grid = { enabled: true, size: 24 };
    useEditorSettingsStore.getState().setTimelineGridSettings(grid as never);
    expect(useEditorSettingsStore.getState().timelineGridSettings).toEqual(grid);
    useEditorSettingsStore.getState().setTimelineGridSettings((v) => ({ ...v, size: 48 } as never));
    expect(useEditorSettingsStore.getState().timelineGridSettings).toMatchObject({ enabled: true, size: 48 });
  });

  it('数组 setter（macros/macroHistory/sharedLibraryResources/customSplitLayouts）更新并替换', () => {
    const store = useEditorSettingsStore.getState();
    store.setMacros([{ id: 'm1' } as never]);
    expect(useEditorSettingsStore.getState().macros).toHaveLength(1);
    useEditorSettingsStore.getState().setMacros((v) => [...v, { id: 'm2' } as never]);
    expect(useEditorSettingsStore.getState().macros).toHaveLength(2);

    useEditorSettingsStore.getState().setMacroHistory([{ id: 'h1' } as never]);
    expect(useEditorSettingsStore.getState().macroHistory).toHaveLength(1);

    useEditorSettingsStore.getState().setSharedLibraryResources([{ id: 'r1' } as never]);
    expect(useEditorSettingsStore.getState().sharedLibraryResources).toHaveLength(1);

    useEditorSettingsStore.getState().setCustomSplitLayouts([{ id: 's1' } as never]);
    expect(useEditorSettingsStore.getState().customSplitLayouts).toHaveLength(1);
  });

  it('标量 setter（autosave/pip/backup/beat 系列/requestId）写入新值', () => {
    const store = useEditorSettingsStore.getState();
    store.setAutosaveIntervalSeconds(120);
    store.setPiPLayoutPosition('top-left');
    store.setLastBackupAt('2026-01-01T00:00:00Z');
    store.setBeatSensitivity('high');
    store.setBeatSyncSpeedEnabled(true);
    store.setBeatSyncManualBpm('128');
    store.setSceneDetectionRequestId(7);
    const next = useEditorSettingsStore.getState();
    expect(next.autosaveIntervalSeconds).toBe(120);
    expect(next.pipLayoutPosition).toBe('top-left');
    expect(next.lastBackupAt).toBe('2026-01-01T00:00:00Z');
    expect(next.beatSensitivity).toBe('high');
    expect(next.beatSyncSpeedEnabled).toBe(true);
    expect(next.beatSyncManualBpm).toBe('128');
    expect(next.sceneDetectionRequestId).toBe(7);

    useEditorSettingsStore.getState().setSceneDetectionRequestId((v) => v + 1);
    expect(useEditorSettingsStore.getState().sceneDetectionRequestId).toBe(8);
  });

  it('教程状态 setter 更新进度/庆祝标记/信号', () => {
    const progress = { completed: ['step-1'] } as never;
    useEditorSettingsStore.getState().setTutorialProgress(progress);
    expect(useEditorSettingsStore.getState().tutorialProgress).toEqual(progress);

    useEditorSettingsStore.getState().setTutorialCelebrationVisible(true);
    expect(useEditorSettingsStore.getState().tutorialCelebrationVisible).toBe(true);

    const signals = { anySignal: true } as never;
    useEditorSettingsStore.getState().setTutorialSignals(signals);
    expect(useEditorSettingsStore.getState().tutorialSignals).toEqual(signals);
  });

  it('其余派生设置 setter（interaction/heatmap/performance/resolutionScale/shortcut/collaborationIdentity）', () => {
    const store = useEditorSettingsStore.getState();
    store.setTimelineInteractionSettings({ snapEnabled: false } as never);
    expect(useEditorSettingsStore.getState().timelineInteractionSettings).toMatchObject({ snapEnabled: false });

    store.setTimelineHeatmap({ visible: true } as never);
    expect(useEditorSettingsStore.getState().timelineHeatmap).toMatchObject({ visible: true });

    store.setPreviewPerformance({ quality: 'low' } as never);
    expect(useEditorSettingsStore.getState().previewPerformance).toMatchObject({ quality: 'low' });

    store.setPreviewWindowResolutionScale(0.5);
    expect(useEditorSettingsStore.getState().previewWindowResolutionScale).toBe(0.5);

    store.setShortcutBindings({ 'ctrl+k': 'command' } as never);
    expect(useEditorSettingsStore.getState().shortcutBindings).toEqual({ 'ctrl+k': 'command' });

    store.setCollaborationIdentity({ displayName: '罗' } as never);
    expect(useEditorSettingsStore.getState().collaborationIdentity).toMatchObject({ displayName: '罗' });
  });
});
