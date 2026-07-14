import { useEffect, useCallback, useRef } from 'react';
import { zhCN } from '../i18n/strings';
import { showToast } from '../lib/toast';
import { readViewportSize, isEditableKeyboardEventTarget, getWorkspaceLayoutDisplayName } from '../lib/ui-helpers';
import { isEditableKeyboardTarget, isShortcutCheatsheetKey } from '../accessibility/keyboard-navigation';
import {
  applyWorkspaceLayout,
  getWorkspaceLayoutById,
  resolveWorkspaceLayoutShortcut,
  type WorkspaceLayoutId,
} from '../layout/layoutSettings';
import { runScheduledProxyIntegrityCheck } from '../media/proxy-integrity';
import { ensureMediaJobRunner } from '../media/media-job-runner';
import { projectUsesMediaOnTimeline } from '@open-factory/editor-core';
import { scanMediaHealthDashboard } from '../lib/mediaHealthDashboard';
import { shouldAutoShowMediaHealthDashboard } from '@open-factory/editor-core';
import { saveLayoutSettings } from '../settings/appSettings';
import { useEditorStore } from '../store/editorStore';
import { useEditorUIStore } from '../store/editorUIStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import { useMediaJobStore } from '../media/media-job-store';
import type { ClipboardKeyframeGroup } from '@open-factory/editor-core';

interface EditorShellInteractions {
  applyWorkspaceLayoutById: (layoutId: WorkspaceLayoutId) => void;
  toggleProjectDocumentation: () => void;
}

/**
 * 从 EditorShell 中提取的事件处理与副作用逻辑。
 * 仅包含无响应式依赖（deps=[]）的 effects 和键盘事件监听。
 * 返回 JSX 需要的绑定函数。
 */
export function useEditorShellInteractions(): EditorShellInteractions {
  // === 视口大小监听 ===
  useEffect(() => {
    const updateViewport = () => useEditorUIStore.getState().setViewportSize(readViewportSize());
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  // === Ctrl+F 全局搜索 + 工作区布局快捷键 ===
  const applyWorkspaceLayoutById = useCallback((layoutId: WorkspaceLayoutId) => {
    const layoutSettings = useEditorUIStore.getState().layoutSettings;
    const layout = getWorkspaceLayoutById(layoutSettings, layoutId);
    if (!layout) {
      showToast({ kind: 'warning', title: zhCN.layout.workspaceApplyFailed, message: zhCN.layout.workspaceMissing });
      return;
    }
    const next = applyWorkspaceLayout(layoutSettings, layout);
    useEditorUIStore.getState().setLayoutSettings(next);
    useEditorUIStore.getState().setHistoryPanelOpen(layout.panels.history);
    useEditorUIStore.getState().setSmartRoughCutOpen(false);
    useEditorUIStore.getState().setAiRoughCutOpen(false);
    useEditorUIStore.getState().setAiChatEditorOpen(false);
    useEditorUIStore.getState().setVideoSummaryOpen(false);
    useEditorUIStore.getState().setNarrationOpen(false);
    void saveLayoutSettings(next).catch((error) => {
      console.warn('Unable to save workspace layout', error);
    });
    showToast({ kind: 'success', title: zhCN.layout.workspaceApplied, message: getWorkspaceLayoutDisplayName(layout) });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        useEditorUIStore.getState().setTimelineSearchOpen(true);
        return;
      }
      const layoutSettings = useEditorUIStore.getState().layoutSettings;
      const workspaceLayoutId = resolveWorkspaceLayoutShortcut(event, layoutSettings.customWorkspaceLayouts);
      if (workspaceLayoutId && !isEditableKeyboardEventTarget(event.target)) {
        event.preventDefault();
        applyWorkspaceLayoutById(workspaceLayoutId);
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [applyWorkspaceLayoutById]);

  // === 审核模式 URL hash 监听 ===
  useEffect(() => {
    const onHashChange = () => useEditorUIStore.getState().setReviewMode(window.location.hash === '#review');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // === Shift+D 切换项目文档 ===
  const toggleProjectDocumentation = useCallback(() => {
    const store = useEditorUIStore.getState();
    store.setProjectDocumentationOpen((open) => {
      const next = !open;
      if (next) {
        store.setHistoryPanelOpen(false);
        store.setSmartRoughCutOpen(false);
        store.setAiRoughCutOpen(false);
        store.setAiChatEditorOpen(false);
        store.setVideoSummaryOpen(false);
        store.setNarrationOpen(false);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !event.shiftKey ||
        event.key.toLowerCase() !== 'd'
      ) {
        return;
      }
      if (isEditableKeyboardTarget(event.target)) {
        return;
      }
      event.preventDefault();
      toggleProjectDocumentation();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleProjectDocumentation]);

  // === 快捷键速查表 ===
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && useEditorUIStore.getState().shortcutCheatsheetOpen) {
        event.preventDefault();
        useEditorUIStore.getState().setShortcutCheatsheetOpen(false);
        return;
      }
      if (event.defaultPrevented || isEditableKeyboardTarget(event.target) || !isShortcutCheatsheetKey(event)) {
        return;
      }
      event.preventDefault();
      useEditorUIStore.getState().setShortcutCheatsheetOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // === Ctrl+C 关键帧复制 ===
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== 'c' || event.shiftKey) return;
      if (isEditableKeyboardTarget(event.target)) return;
      const state = useEditorStore.getState();
      const refs = state.selectedKeyframes;
      if (refs.length === 0) return;
      event.preventDefault();
      const timeline = state.project.timeline;
      const allClips = timeline.tracks.flatMap((t) => t.clips);
      const groups: ClipboardKeyframeGroup[] = [];
      for (const ref of refs) {
        const clip = allClips.find((c) => c.id === ref.clipId);
        if (!clip) continue;
        const kf = clip.keyframes?.[ref.property]?.find((k) => k.id === ref.keyframeId);
        if (!kf) continue;
        const existing = groups.find((g) => g.sourceClipId === ref.clipId && g.property === ref.property);
        if (existing) {
          existing.keyframes.push(kf);
        } else {
          groups.push({
            sourceClipId: ref.clipId,
            sourceClipStart: clip.start,
            property: ref.property,
            keyframes: [kf],
          });
        }
      }
      if (groups.length > 0) {
        state.setClipboardKeyframes(groups);
        const count = groups.reduce((sum, g) => sum + g.keyframes.length, 0);
        showToast({ kind: 'success', title: zhCN.keyframePaste.copied(count) });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // === Ctrl+V 关键帧粘贴 ===
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== 'v' || event.shiftKey) return;
      if (isEditableKeyboardTarget(event.target)) return;
      const state = useEditorStore.getState();
      const groups = state.clipboardKeyframes;
      if (!groups || groups.length === 0) {
        showToast({ kind: 'warning', title: zhCN.keyframePaste.noSelection });
        return;
      }
      if (!state.selectedClipId) {
        showToast({ kind: 'warning', title: zhCN.keyframePaste.noTarget });
        return;
      }
      useEditorFeatureStore.getState().setPasteKeyframeDialogGroups(groups);
      useEditorUIStore.getState().setPasteKeyframeDialogOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // === 代理完整性检查 ===
  useEffect(() => {
    let disposed = false;
    const runIntegrityCheck = async () => {
      const currentProject = useEditorStore.getState().project;
      await runScheduledProxyIntegrityCheck(currentProject, {
        enqueueProxyAssets: (assetIds) => {
          if (disposed || assetIds.length === 0) {
            return;
          }
          const latestProject = useEditorStore.getState().project;
          const proxySettings = useProxySettingsStore.getState().settings;
          for (const asset of latestProject.media.filter((item) => assetIds.includes(item.id))) {
            useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], proxySettings, {
              force: true,
              priority: projectUsesMediaOnTimeline(latestProject, asset.id) ? 'high' : 'low',
            });
          }
          void ensureMediaJobRunner();
        },
      }).catch((error) => {
        console.warn('Unable to run proxy integrity check', error);
      });
    };
    void runIntegrityCheck();
    const timer = window.setInterval(() => void runIntegrityCheck(), 60 * 60 * 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  // === 媒体健康自动显示 ===
  const mediaHealthAutoShowCheckedRef = useRef(false);
  useEffect(() => {
    const mediaHealthAutoShowEnabled = useEditorFeatureStore.getState().mediaHealthAutoShowEnabled;
    if (mediaHealthAutoShowCheckedRef.current || !mediaHealthAutoShowEnabled) {
      return;
    }
    mediaHealthAutoShowCheckedRef.current = true;
    let disposed = false;
    scanMediaHealthDashboard(useEditorStore.getState().project, useProxySettingsStore.getState().settings)
      .then((result) => {
        if (disposed) {
          return;
        }
        useEditorFeatureStore.getState().setMediaHealthDashboard(result.dashboard);
        useEditorFeatureStore.getState().setProjectHealthReport(result.report);
        if (
          shouldAutoShowMediaHealthDashboard({
            enabled: mediaHealthAutoShowEnabled,
            issueCount: result.dashboard.issueCount,
          })
        ) {
          useEditorUIStore.getState().setMediaHealthDashboardOpen(true);
        }
      })
      .catch((error) => {
        console.warn('Unable to auto scan media health dashboard', error);
      });
    return () => {
      disposed = true;
    };
  }, []);

  return { applyWorkspaceLayoutById, toggleProjectDocumentation };
}
