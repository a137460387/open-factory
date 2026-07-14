import { useCallback } from 'react';
import { buildMediaVersionCompareRequest, findSyncCompareClipRefs } from '@open-factory/editor-core';
import { revealInTimeline as coreRevealInTimeline } from '@open-factory/editor-core';
import { clearMediaCache } from '../cache/cache-service';
import { showToast } from '../lib/toast';
import { zhCN, t } from '../i18n/strings';
import { useEditorStore } from '../store/editorStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';
import { useEditorUIStore } from '../store/editorUIStore';
import { useEditorMiscStore } from '../store/editorMiscStore';
import { saveOfflineMediaReport, saveClipReport } from '../lib/mediaReport';

/**
 * 从 EditorShell 中提取的杂项回调。
 * 涵盖报告生成、媒体版本对比、同步对比、缓存清理、收藏/标记等。
 */
export function useEditorShellMiscCallbacks() {
  const setSelectedClipIds = useEditorStore((s) => s.setSelectedClipIds);
  const setSelectedClipId = useEditorStore((s) => s.setSelectedClipId);
  const setMediaVersionCompare = useEditorFeatureStore((s) => s.setMediaVersionCompare);
  const setSyncCompareOpen = useEditorUIStore((s) => s.setSyncCompareOpen);

  // -----------------------------------------------------------------------
  // Media/Clip Report
  // -----------------------------------------------------------------------

  const createMediaReport = useCallback(async () => {
    try {
      const project = useEditorStore.getState().project;
      const outputPath = await saveOfflineMediaReport(project);
      if (outputPath) {
        showToast({ kind: 'success', title: zhCN.mediaReport.success, message: outputPath });
      }
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.mediaReport.failed,
        message: error instanceof Error ? error.message : zhCN.mediaReport.failedMessage,
      });
    }
  }, []);

  const createClipReport = useCallback(async () => {
    try {
      const project = useEditorStore.getState().project;
      const outputPath = await saveClipReport(project);
      if (outputPath) {
        showToast({ kind: 'success', title: zhCN.clipReport.success, message: outputPath });
      }
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.clipReport.failed,
        message: error instanceof Error ? error.message : zhCN.clipReport.failedMessage,
      });
    }
  }, []);

  // -----------------------------------------------------------------------
  // Media Version Compare
  // -----------------------------------------------------------------------

  const openMediaVersionCompare = useCallback(
    (assetId: string) => {
      const state = useEditorStore.getState();
      const request = buildMediaVersionCompareRequest(state.project, assetId, undefined, undefined, state.playheadTime);
      if (!request) {
        showToast({
          kind: 'warning',
          title: zhCN.editorToasts.mediaVersionCompareUnavailable,
          message: zhCN.editorToasts.mediaVersionCompareUnavailableMessage,
        });
        return;
      }
      setMediaVersionCompare(request);
    },
    [setMediaVersionCompare],
  );

  // -----------------------------------------------------------------------
  // Sync Compare
  // -----------------------------------------------------------------------

  const openSyncCompare = useCallback(() => {
    const state = useEditorStore.getState();
    const refs = findSyncCompareClipRefs(state.project.timeline, state.selectedClipIds);
    if (refs.length !== 2) {
      showToast({
        kind: 'warning',
        title: zhCN.syncCompare.unavailableTitle,
        message: zhCN.syncCompare.unavailableMessage,
      });
      return;
    }
    state.setPlayheadTime(Math.min(refs[0].clip.start, refs[1].clip.start));
    setSyncCompareOpen(true);
  }, [setSyncCompareOpen]);

  // -----------------------------------------------------------------------
  // Cache
  // -----------------------------------------------------------------------

  const clearCache = useCallback(async () => {
    try {
      await clearMediaCache();
      showToast({ kind: 'success', title: zhCN.editorToasts.cacheCleared });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.editorToasts.cacheClearFailed,
        message: error instanceof Error ? error.message : zhCN.editorToasts.cacheClearFailedMessage,
      });
    }
  }, []);

  // -----------------------------------------------------------------------
  // Favorite / Pin / Reveal from MediaBin
  // -----------------------------------------------------------------------

  const handleToggleFavorite = useCallback((assetId: string) => {
    useEditorMiscStore
      .getState()
      .setFavoriteIds((prev: string[]) =>
        prev.includes(assetId) ? prev.filter((id: string) => id !== assetId) : [...prev, assetId],
      );
  }, []);

  const handlePinToSession = useCallback((assetId: string) => {
    useEditorMiscStore.getState().setPinnedIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);

  const handleRevealFromMediaBin = useCallback((assetId: string) => {
    const state = useEditorStore.getState();
    const result = coreRevealInTimeline(state.project.timeline, assetId, state.project.sequences);
    if (result.instances.length > 0) {
      state.setSelectedClipIds(result.instances.map((inst) => inst.clipId));
      showToast({
        kind: 'info',
        title: t('matchFrame.revealInTimeline'),
        message: 'Found ' + result.instances.length + ' instances',
      });
    } else {
      showToast({ kind: 'warning', title: t('matchFrame.revealInTimeline'), message: t('matchFrame.noSourceFound') });
    }
  }, []);

  return {
    createMediaReport,
    createClipReport,
    openMediaVersionCompare,
    openSyncCompare,
    clearCache,
    handleToggleFavorite,
    handlePinToSession,
    handleRevealFromMediaBin,
  };
}
