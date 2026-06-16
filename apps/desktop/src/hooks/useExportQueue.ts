import { useCallback, useEffect, useState } from 'react';
import type { Project } from '@open-factory/editor-core';
import { cancelAllQueuedExportTasks, cancelQueuedExportTask, ensureExportQueueRunner, setExportQueuePaused } from '../export/export-queue-runner';
import { useExportQueueStore } from '../export/export-queue-store';
import {
  installExportQueuePersistence,
  loadExportQueueRecoveryCandidate,
  persistExportQueueState,
  type ExportQueueRecoveryCandidate
} from '../export/export-queue-persistence';
import { zhCN } from '../i18n/strings';
import { chooseCurrentFrameExportPath, startCurrentFrameExport } from '../lib/exportVideo';
import { createSharePackageFromProject, type SharePackageWorkflowProgress } from '../lib/sharePackage';
import { listenBridge, updateExportTrayProgress } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { useEditorStore } from '../store/editorStore';

export interface UseExportQueueResult {
  lastExportPath?: string;
  setLastExportPath(path: string | undefined): void;
  exportDialogOpen: boolean;
  setExportDialogOpen(open: boolean): void;
  timelineExportDialogOpen: boolean;
  setTimelineExportDialogOpen(open: boolean): void;
  exportQueueRecovery?: ExportQueueRecoveryCandidate;
  sharePackageProgress?: SharePackageWorkflowProgress;
  sharePackageBusy: boolean;
  cancelCurrentExport(): Promise<void>;
  createCurrentSharePackage(): Promise<void>;
  exportCurrentFrame(): Promise<void>;
  restoreExportQueueRecovery(taskIds: string[]): Promise<void>;
  discardExportQueueRecovery(): Promise<void>;
}

export function useExportQueue(project: Project): UseExportQueueResult {
  const [lastExportPath, setLastExportPath] = useState<string>();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [timelineExportDialogOpen, setTimelineExportDialogOpen] = useState(false);
  const [exportQueueRecovery, setExportQueueRecovery] = useState<ExportQueueRecoveryCandidate>();
  const [sharePackageProgress, setSharePackageProgress] = useState<SharePackageWorkflowProgress>();
  const [sharePackageBusy, setSharePackageBusy] = useState(false);
  const exportTasks = useExportQueueStore((state) => state.tasks);
  const exportQueuePaused = useExportQueueStore((state) => state.queuePaused);

  useEffect(() => {
    const runningTasks = exportTasks.filter((task) => task.status === 'running');
    const runningCount = runningTasks.length;
    const progress = runningCount > 0 ? runningTasks.reduce((sum, task) => sum + task.progress, 0) / runningCount : 0;
    void updateExportTrayProgress(progress, runningCount).catch((error) => {
      console.warn('Unable to update export tray progress', error);
    });
  }, [exportTasks]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenBridge<'pause' | 'cancel-all'>('export-tray-command', async (command) => {
      if (command === 'pause') {
        const nextPaused = !useExportQueueStore.getState().queuePaused;
        setExportQueuePaused(nextPaused);
        showToast({ kind: 'info', title: zhCN.exportDialog.queueTitle, message: nextPaused ? zhCN.exportDialog.queuePausedByUser : zhCN.exportDialog.queueResumedByUser });
      }
      if (command === 'cancel-all') {
        await cancelAllQueuedExportTasks();
        showToast({ kind: 'info', title: zhCN.exportDialog.queueTitle, message: zhCN.exportDialog.queueCanceledAll });
      }
    }).then((dispose) => {
      if (disposed) {
        dispose();
      } else {
        unlisten = dispose;
      }
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let uninstallPersistence: (() => void) | undefined;
    void loadExportQueueRecoveryCandidate(zhCN.exportDialog.recovery.interruptedMessage)
      .then((candidate) => {
        if (!disposed && candidate) {
          setExportQueueRecovery(candidate);
        }
      })
      .catch((error) => {
        console.warn('Unable to load export queue recovery state', error);
      })
      .finally(() => {
        if (!disposed) {
          uninstallPersistence = installExportQueuePersistence();
        }
      });
    return () => {
      disposed = true;
      uninstallPersistence?.();
    };
  }, []);

  useEffect(() => {
    if (!exportQueuePaused) {
      return;
    }
    const hasWaiting = exportTasks.some((task) => task.status === 'pending' || task.status === 'scheduled');
    if (!hasWaiting) {
      setExportQueuePaused(false);
    }
  }, [exportQueuePaused, exportTasks]);

  const createCurrentSharePackage = useCallback(async () => {
    if (sharePackageBusy) {
      return;
    }
    try {
      setSharePackageBusy(true);
      const result = await createSharePackageFromProject(project, { onProgress: setSharePackageProgress });
      if (result) {
        showToast({ kind: 'success', title: zhCN.sharePackage.success, message: result.outputPath });
        setLastExportPath(result.outputPath);
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.sharePackage.failed, message: error instanceof Error ? error.message : zhCN.sharePackage.failedMessage });
    } finally {
      setSharePackageProgress(undefined);
      setSharePackageBusy(false);
    }
  }, [project, sharePackageBusy]);

  const cancelCurrentExport = useCallback(async () => {
    const runningTask = useExportQueueStore.getState().tasks.find((task) => task.status === 'running');
    if (runningTask) {
      await cancelQueuedExportTask(runningTask.id);
      showToast({ kind: 'info', title: zhCN.editorToasts.exportCanceled, message: runningTask.name });
    }
  }, []);

  const exportCurrentFrame = useCallback(async () => {
    const state = useEditorStore.getState();
    try {
      const outputPath = await chooseCurrentFrameExportPath(state.project, state.playheadTime);
      if (!outputPath) {
        return;
      }
      await startCurrentFrameExport(state.project, outputPath, state.playheadTime, {
        onProgress: () => undefined,
        onWarnings: (warnings) => {
          if (warnings.length > 0) {
            showToast({ kind: 'warning', title: zhCN.exportDialog.exportWarningTitle, message: warnings.join('\n') });
          }
        }
      });
      setLastExportPath(outputPath);
      showToast({ kind: 'success', title: zhCN.editorToasts.currentFrameExported, message: outputPath });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.editorToasts.currentFrameExportFailed,
        message: error instanceof Error ? error.message : zhCN.editorToasts.currentFrameExportFailedMessage
      });
    }
  }, []);

  const restoreExportQueueRecovery = useCallback(
    async (taskIds: string[]): Promise<void> => {
      if (!exportQueueRecovery) {
        return;
      }
      const selected = new Set(taskIds);
      const tasks = exportQueueRecovery.tasks.filter((task) => selected.has(task.id));
      if (tasks.length === 0) {
        return;
      }
      useExportQueueStore.getState().restoreTasks(tasks);
      setExportQueueRecovery(undefined);
      if (tasks.some((task) => task.status === 'pending')) {
        void ensureExportQueueRunner();
      }
    },
    [exportQueueRecovery]
  );

  const discardExportQueueRecovery = useCallback(async (): Promise<void> => {
    setExportQueueRecovery(undefined);
    try {
      await persistExportQueueState([]);
    } catch (error) {
      console.warn('Unable to discard export queue recovery state', error);
    }
  }, []);

  return {
    lastExportPath,
    setLastExportPath,
    exportDialogOpen,
    setExportDialogOpen,
    timelineExportDialogOpen,
    setTimelineExportDialogOpen,
    exportQueueRecovery,
    sharePackageProgress,
    sharePackageBusy,
    cancelCurrentExport,
    createCurrentSharePackage,
    exportCurrentFrame,
    restoreExportQueueRecovery,
    discardExportQueueRecovery
  };
}
