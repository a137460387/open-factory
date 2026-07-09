import { useCallback } from 'react';
import { UpdateClipCommand } from '@open-factory/editor-core';
import type { ContentAnalysisTarget } from '../media/ContentAnalysisDialog';
import { showToast } from '../lib/toast';
import { zhCN } from '../i18n/strings';
import { commandManager, timelineAccessor } from '../store/commandManager';
import { useEditorStore } from '../store/editorStore';
import { analyzeClipContentLocally, exportClipContentAnalysisJson } from '../media/contentAnalysis';
import {
  collectContentAnalysisTargets,
  findContentAnalysisTarget,
} from '../lib/content-analysis-helpers';

// ---------------------------------------------------------------------------
// 参数接口：Content Analysis 回调组
// ---------------------------------------------------------------------------

interface ContentAnalysisCallbacksDeps {
  /** 内容分析运行中 clip ID 的 setter */
  setContentAnalysisRunningClipId: (clipId: string | undefined) => void;
}

/** 内容分析相关的回调组 */
export function useContentAnalysisCallbacks(deps: ContentAnalysisCallbacksDeps) {
  const { setContentAnalysisRunningClipId } = deps;

  const runSingleContentAnalysis = useCallback(async (target: ContentAnalysisTarget): Promise<boolean> => {
    setContentAnalysisRunningClipId(target.clip.id);
    try {
      const analysis = await analyzeClipContentLocally(target.clip, target.asset);
      commandManager.execute(new UpdateClipCommand(timelineAccessor, target.clip.id, { contentAnalysis: analysis }));
      return true;
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.contentAnalysis.failedTitle, message: error instanceof Error ? error.message : zhCN.contentAnalysis.failedMessage });
      return false;
    } finally {
      setContentAnalysisRunningClipId(undefined);
    }
  }, [setContentAnalysisRunningClipId]);

  const analyzeContentClip = useCallback(
    async (clipId: string) => {
      const target = findContentAnalysisTarget(useEditorStore.getState().project, clipId);
      if (!target) {
        showToast({ kind: 'warning', title: zhCN.contentAnalysis.failedTitle, message: zhCN.contentAnalysis.noTargets });
        return;
      }
      const completed = await runSingleContentAnalysis(target);
      if (completed) {
        showToast({ kind: 'success', title: zhCN.contentAnalysis.completedTitle, message: zhCN.contentAnalysis.completedMessage(1) });
      }
    },
    [runSingleContentAnalysis]
  );

  const analyzePreferredContentTargets = useCallback(async () => {
    const state = useEditorStore.getState();
    const targets = collectContentAnalysisTargets(state.project);
    const selected = targets.filter((target) => state.selectedClipIds.includes(target.clip.id));
    const runTargets = selected.length > 0 ? selected : targets;
    if (runTargets.length === 0) {
      showToast({ kind: 'warning', title: zhCN.contentAnalysis.failedTitle, message: zhCN.contentAnalysis.noTargets });
      return;
    }
    let completed = 0;
    for (const target of runTargets) {
      if (await runSingleContentAnalysis(target)) {
        completed += 1;
      }
    }
    if (completed > 0) {
      showToast({ kind: 'success', title: zhCN.contentAnalysis.completedTitle, message: zhCN.contentAnalysis.completedMessage(completed) });
    }
  }, [runSingleContentAnalysis]);

  const exportContentAnalysis = useCallback(async (clipId: string) => {
    const target = findContentAnalysisTarget(useEditorStore.getState().project, clipId);
    if (!target?.clip.contentAnalysis) {
      showToast({ kind: 'warning', title: zhCN.contentAnalysis.failedTitle, message: zhCN.contentAnalysis.notAnalyzed });
      return;
    }
    try {
      const outputPath = await exportClipContentAnalysisJson(target.clip);
      if (outputPath) {
        showToast({ kind: 'success', title: zhCN.contentAnalysis.exportedTitle, message: outputPath });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.contentAnalysis.failedTitle, message: error instanceof Error ? error.message : zhCN.contentAnalysis.failedMessage });
    }
  }, []);

  return {
    runSingleContentAnalysis,
    analyzeContentClip,
    analyzePreferredContentTargets,
    exportContentAnalysis,
  };
}
