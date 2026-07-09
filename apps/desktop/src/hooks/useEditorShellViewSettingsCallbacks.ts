import { useCallback } from 'react';
import type { MediaAsset, TimelineGridSettings, TimelineGridUnit } from '@open-factory/editor-core';
import type {
  TimelineHeatmapViewSettings,
  TimelineInteractionSettings,
} from '../settings/appSettings';
import type { PreviewPerformanceSettings } from '../lib/preview/preview-performance';
import {
  emitBridge,
  closePreviewWindow,
  openPreviewWindow,
  sendNotification,
} from '../lib/tauri-bridge';
import type { PreviewWindowState } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { zhCN } from '../i18n/strings';
import { readViewportSize, moveAutomationMediaToGroup } from '../lib/ui-helpers';
import {
  normalizeTimelineHeatmapViewSettings,
  saveLayoutSettings,
  saveTimelineGridSettings,
  saveTimelineInteractionSettings,
  saveViewSettings,
  savePreviewWindowSettings,
  savePreviewPerformanceSettings,
  readPreviewWindowSettings,
} from '../settings/appSettings';
import {
  clampTimelineHeight,
  createCustomWorkspaceLayout,
  type EditorLayoutSettings,
} from '../layout/layoutSettings';
import { runConfiguredAutomationForMedia, type AutomationActionDependencies } from '../automation/automation-rules';
import { useEditorStore } from '../store/editorStore';
import { useEditorUIStore } from '../store/editorUIStore';
import { useEditorSettingsStore } from '../store/editorSettingsStore';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import { useMediaJobStore } from '../media/media-job-store';
import { ensureMediaJobRunner } from '../media/media-job-runner';
import { createPreviewWindowPlaybackState } from '../lib/previewWindowSync';

// ---------------------------------------------------------------------------
// 参数接口
// ---------------------------------------------------------------------------

type LayoutUpdater = EditorLayoutSettings | ((current: EditorLayoutSettings) => EditorLayoutSettings);

interface ViewSettingsCallbacksDeps {
  layoutSettings: EditorLayoutSettings;
  setLayoutSettings: (updater: LayoutUpdater) => void;
}

/**
 * 从 EditorShell 中提取的视图设置、布局、预览窗口、时间线网格与自动化相关回调。
 */
export function useEditorShellViewSettingsCallbacks(deps: ViewSettingsCallbacksDeps) {
  const { layoutSettings, setLayoutSettings } = deps;

  const saveCurrentWorkspaceLayout = useCallback(async () => {
    const name = window.prompt(zhCN.layout.saveWorkspacePrompt, zhCN.layout.customWorkspaceDefaultName)?.trim();
    if (!name) {
      return;
    }
    const customLayout = createCustomWorkspaceLayout(name, layoutSettings);
    const next = {
      ...layoutSettings,
      activeWorkspaceLayoutId: customLayout.id,
      customWorkspaceLayouts: [...layoutSettings.customWorkspaceLayouts, customLayout]
    };
    setLayoutSettings(next);
    try {
      await saveLayoutSettings(next);
      showToast({ kind: 'success', title: zhCN.layout.workspaceSaved, message: customLayout.shortcutSlot ? zhCN.layout.workspaceShortcut(customLayout.shortcutSlot) : customLayout.name });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.layout.workspaceSaveFailed, message: error instanceof Error ? error.message : zhCN.layout.workspaceSaveFailedMessage });
    }
  }, [layoutSettings, setLayoutSettings]);

  const toggleSafeFrameGuides = useCallback(() => {
    useEditorSettingsStore.getState().setSafeFrameGuides((current) => {
      const next = !current;
      void saveViewSettings({ safeFrameGuides: next }).catch((error) => {
        console.warn('Unable to save view settings', error);
      });
      return next;
    });
  }, []);

  const toggleThumbnailTrackVisible = useCallback(() => {
    useEditorSettingsStore.getState().setThumbnailTrackVisible((current) => {
      const next = !current;
      void saveViewSettings({ thumbnailTrackVisible: next }).catch((error) => {
        console.warn('Unable to save view settings', error);
      });
      return next;
    });
  }, []);

  const toggleTimelineMinimapVisible = useCallback(() => {
    useEditorSettingsStore.getState().setTimelineMinimapVisible((current) => {
      const next = !current;
      void saveViewSettings({ timelineMinimapVisible: next }).catch((error) => {
        console.warn('Unable to save view settings', error);
      });
      return next;
    });
  }, []);

  const updateTimelineHeatmap = useCallback((patch: Partial<TimelineHeatmapViewSettings>) => {
    useEditorSettingsStore.getState().setTimelineHeatmap((current) => {
      const optimistic = normalizeTimelineHeatmapViewSettings({ ...current, ...patch });
      void saveViewSettings({ timelineHeatmap: optimistic })
        .then((view) => useEditorSettingsStore.getState().setTimelineHeatmap(view.timelineHeatmap))
        .catch((error) => {
          console.warn('Unable to save timeline heatmap settings', error);
        });
      return optimistic;
    });
  }, []);

  const updatePreviewPerformance = useCallback((patch: Partial<PreviewPerformanceSettings>) => {
    useEditorSettingsStore.getState().setPreviewPerformance((current) => {
      const optimistic = { ...current, ...patch };
      void savePreviewPerformanceSettings(optimistic)
        .then((saved) => useEditorSettingsStore.getState().setPreviewPerformance(saved))
        .catch((error) => {
          console.warn('Unable to save preview performance settings', error);
        });
      return optimistic;
    });
  }, []);

  const updateTimelineInteractionSettings = useCallback((patch: Partial<TimelineInteractionSettings>) => {
    useEditorSettingsStore.getState().setTimelineInteractionSettings((current) => {
      const optimistic = { ...current, ...patch };
      void saveTimelineInteractionSettings(optimistic)
        .then((saved) => useEditorSettingsStore.getState().setTimelineInteractionSettings(saved))
        .catch((error) => {
          console.warn('Unable to save timeline interaction settings', error);
        });
      return optimistic;
    });
  }, []);

  const persistPreviewWindowState = useCallback((state: PreviewWindowState) => {
    if (!state.bounds) {
      return;
    }
    useEditorSettingsStore.getState().setPreviewWindowResolutionScale(state.resolutionScale);
    void savePreviewWindowSettings({
      bounds: state.bounds,
      alwaysOnTop: state.alwaysOnTop,
      resolutionScale: state.resolutionScale
    }).catch((error) => {
      console.warn('Unable to save preview window settings', error);
    });
  }, []);

  const openDetachedPreview = useCallback(async () => {
    try {
      const settings = await readPreviewWindowSettings();
      const state = await openPreviewWindow(settings);
      useEditorUIStore.getState().setPreviewWindowOpen(state.open);
      useEditorSettingsStore.getState().setPreviewWindowResolutionScale(state.resolutionScale);
      if (state.bounds) {
        persistPreviewWindowState(state);
      }
      const project = useEditorStore.getState().project;
      const playheadTime = useEditorStore.getState().playheadTime;
      const isPlaying = useEditorStore.getState().isPlaying;
      const previewPerformance = useEditorSettingsStore.getState().previewPerformance;
      await emitBridge('preview-window-project-state', {
        source: 'main',
        project,
        playheadTime,
        isPlaying,
        previewPerformance,
        resolutionScale: state.resolutionScale
      });
      await emitBridge('preview-window-sync', createPreviewWindowPlaybackState('main', playheadTime, isPlaying));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.toolbar.popoutPreview, message: error instanceof Error ? error.message : zhCN.common.unavailable });
    }
  }, [persistPreviewWindowState]);

  const reembedPreviewWindow = useCallback(async () => {
    const state = await closePreviewWindow().catch(() => undefined);
    if (state) {
      persistPreviewWindowState(state);
    }
    useEditorUIStore.getState().setPreviewWindowOpen(false);
  }, [persistPreviewWindowState]);

  const updateTimelineGridSettings = useCallback((patch: Partial<TimelineGridSettings>) => {
    useEditorSettingsStore.getState().setTimelineGridSettings((current) => {
      const optimistic = { ...current, ...patch };
      void saveTimelineGridSettings(optimistic)
        .then((saved) => useEditorSettingsStore.getState().setTimelineGridSettings(saved))
        .catch((error) => {
          console.warn('Unable to save timeline grid settings', error);
        });
      return optimistic;
    });
  }, []);

  const toggleTimelineGridSnap = useCallback(() => {
    useEditorSettingsStore.getState().setTimelineGridSettings((current) => {
      const optimistic = { ...current, enabled: !current.enabled };
      void saveTimelineGridSettings(optimistic)
        .then((saved) => useEditorSettingsStore.getState().setTimelineGridSettings(saved))
        .catch((error) => {
          console.warn('Unable to save timeline grid settings', error);
        });
      return optimistic;
    });
  }, []);

  const changeTimelineGridUnit = useCallback(
    (unit: TimelineGridUnit) => {
      updateTimelineGridSettings({ unit });
    },
    [updateTimelineGridSettings]
  );

  const runAutomationForMedia = useCallback(async (trigger: 'on-import' | 'on-export-complete' | 'on-project-open', media: MediaAsset[]) => {
    if (media.length === 0) {
      return;
    }
    const dependencies: AutomationActionDependencies = {
      enqueueProxy: (asset) => {
        useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], useProxySettingsStore.getState().settings, { force: true });
        void ensureMediaJobRunner();
      },
      setLabel: (assetId, labelColor) => {
        useEditorStore.getState().setMediaMetadata(assetId, { labelColor });
      },
      moveToGroup: (asset, groupName) => {
        moveAutomationMediaToGroup(asset.id, groupName);
      },
      notify: (title, body) => sendNotification(title, body)
    };
    try {
      await runConfiguredAutomationForMedia({ trigger, media, projectName: useEditorStore.getState().project.name }, dependencies);
    } catch (error) {
      console.warn('Automation rule execution failed', error);
    }
  }, []);

  const beginTimelineResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = layoutSettings.timelineHeightPx;
      let nextHeight = startHeight;
      const onPointerMove = (moveEvent: PointerEvent) => {
        nextHeight = clampTimelineHeight(startHeight + startY - moveEvent.clientY, readViewportSize().height);
        setLayoutSettings((current) => ({ ...current, timelineHeightPx: nextHeight }));
      };
      const finish = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        setLayoutSettings((current) => {
          const next = { ...current, timelineHeightPx: nextHeight };
          void saveLayoutSettings(next).catch((error) => {
            console.warn('Unable to save layout settings', error);
          });
          return next;
        });
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    },
    [layoutSettings.timelineHeightPx, setLayoutSettings]
  );

  return {
    saveCurrentWorkspaceLayout,
    toggleSafeFrameGuides,
    toggleThumbnailTrackVisible,
    toggleTimelineMinimapVisible,
    updateTimelineHeatmap,
    updatePreviewPerformance,
    updateTimelineInteractionSettings,
    persistPreviewWindowState,
    openDetachedPreview,
    reembedPreviewWindow,
    updateTimelineGridSettings,
    toggleTimelineGridSnap,
    changeTimelineGridUnit,
    runAutomationForMedia,
    beginTimelineResize,
  };
}
