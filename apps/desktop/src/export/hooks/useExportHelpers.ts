import {logger} from '@open-factory/editor-core/utils';
import {getTimelinePlaybackDuration, runExportPreflight, type ExportTask, type ExportTaskHistoryEntry, type PreflightResult, type Project} from '@open-factory/editor-core';
import {chooseExportPath} from '../../lib/exportVideo';
import {isFontFamilyAvailable} from '../../lib/fonts';
import {cancelQualityEvaluation, evaluateExportQuality, getFfmpegCapabilities, getTempSegmentsDir, openDirectoryDialog, writeExportUploadWebdavPassword} from '../../lib/tauri-bridge';
import {showToast} from '../../lib/toast';
import {saveExportBackgroundSettings, saveExportUploadSettings, type ExportUploadSettings} from '../../settings/appSettings';
import {getWhisperAvailability} from '../../lib/whisper';
import {enqueueExport, enqueueStemExport} from '../export-queue-runner';
import {normalizeScheduledExportStart} from '../export-background';
import {retryExportUploadFromHistory} from '../export-upload';
import {ensureMediaJobRunner} from '../../media/media-job-runner';
import {useMediaJobStore} from '../../media/media-job-store';
import {runExportWarmup} from '../export-warmup';
import {formatExportWarning} from '../export-utils';
import {getExportPreset, type ExportPresetSettings} from '../export-presets';
import {normalizeDraftSettings} from '../lib/exportSettingsHelpers';
import type {ExportJob} from '../lib/pipelineHelpers';

import type {ExportState} from './useExportState';

function logError(context: string) {
  return (error: unknown) => {
    logger.error(`[${context}]`, error);
  };
}

export function useExportHelpers(state: ExportState) {
  const {
    // Setters
    setError,
    setOutputPath,
    setCapabilities,
    setCompletionAction,
    setExportBackgroundSettings,
    setPostExportScriptPendingConfirm,
    setExportUploadSettings,
    setExportUploadPassword,
    setWarmupStatus,
    setQualityTaskId,
    setQualityProgress,
    setQualityResult,
    setQualityError,
    // Computed values
    selectedPreset,
    exportSettings,
    progressiveExportSupported,
    // Store selectors
    whisperExecutablePath,
    whisperModelPath,
    // Refs
    pendingCompletionAction,
    completionActionHandled,
    pendingConfirmResolveRef,
    // Other state
    project,
    capabilities,
    stemTracks,
    stemMode,
    stemOutputDir,
    priority,
    scheduleEnabled,
    scheduledStartInput,
    completionAction,
    exportBackgroundSettings,
    exportUploadSettings,
    renderFarmEnabled,
    renderFarmInstances,
    progressiveExportEnabled,
    qualityTaskId,
    t,
  } = state;

  // Warmup
  async function warmupSelectedJobs(selectedJobs: ExportJob[]): Promise<void> {
    let sawColdWarmup = false;
    for (const job of selectedJobs) {
      const warmupProject = job.project ?? project;
      const result = await runExportWarmup(
        warmupProject,
        {
          checkProxyGeneration: runProxyGenerationWarmup,
          createTempDirectory: getTempSegmentsDir,
          getFfmpegCapabilities,
          checkFonts: (targetProject) => {
            const blockingFontIssue = runExportPreflight(targetProject, {
              ffmpegAvailable: true,
              isFontFamilyAvailable,
            }).find((issue) => issue.type === 'missing-font' && issue.severity === 'blocking');
            if (blockingFontIssue) {
              throw new Error(blockingFontIssue.message);
            }
          },
        },
        {
          ffmpegUnavailableMessage: t.warmup.ffmpegMissing,
          onStep: (step) => setWarmupStatus({ status: 'running', step }),
        },
      );
      sawColdWarmup ||= !result.cached;
    }
    setWarmupStatus({ status: sawColdWarmup ? 'complete' : 'cached' });
  }

  // Enqueue
  async function enqueueSelectedJobs(selectedJobs: ExportJob[]): Promise<ExportTask[]> {
    const scheduledStartAt = scheduleEnabled ? normalizeScheduledExportStart(scheduledStartInput) : undefined;
    if (scheduleEnabled && !scheduledStartAt) {
      setError(t.scheduleInvalid);
      return [];
    }
    if (!(await ensurePostExportScriptAcknowledged())) {
      return [];
    }
    const queuedTasks: ExportTask[] = [];
    pendingCompletionAction.current = completionAction;
    completionActionHandled.current = false;
    if (progressiveExportEnabled && !progressiveExportSupported) {
      showToast({ kind: 'warning', title: t.progressive.title, message: t.progressive.unsupportedWarning });
    }
    for (const job of selectedJobs) {
      const task = await enqueueExport(
        job.project ?? project,
        job.outputPath,
        job.settings ?? exportSettings,
        priority,
        renderFarmEnabled ? { enabled: true, maxInstances: renderFarmInstances } : undefined,
        scheduledStartAt,
        job.range,
        progressiveExportEnabled,
        {
          metadata: job.metadata,
          versionedBatch: job.versionedBatch,
        },
      );
      queuedTasks.push(task);
      for (const warning of task.plan.warnings) {
        showToast({ kind: 'warning', title: t.exportWarningTitle, message: formatExportWarning(warning) });
      }
    }
    const sequenceJobCount = selectedJobs.filter((job) => job.sequenceName).length;
    const versionJobCount = selectedJobs.filter((job) => job.versionedBatch).length;
    showToast({
      kind: 'info',
      title: scheduleEnabled ? t.scheduledTitle : t.queuedTitle,
      message:
        state.exportMode === 'codec-compare'
          ? t.codecCompare.queuedMessage(selectedJobs.length)
          : versionJobCount > 0
            ? t.versionBatch.queuedMessage(versionJobCount)
            : sequenceJobCount > 0
              ? t.sequenceBatch.queuedMessage(sequenceJobCount)
              : t.queuedMessage(selectedJobs.length, selectedPreset.name),
    });
    return queuedTasks;
  }

  // Post-export script
  async function ensurePostExportScriptAcknowledged(): Promise<boolean> {
    if (!exportSettings.postExportScript?.command) {
      return true;
    }
    if (!exportBackgroundSettings.postExportScriptAcknowledged) {
      setError(t.postExportScript.ackRequired);
      return false;
    }
    return new Promise<boolean>((resolve) => {
      pendingConfirmResolveRef.current = resolve;
      setPostExportScriptPendingConfirm(true);
    });
  }

  async function setPostExportScriptAcknowledged(checked: boolean): Promise<void> {
    const next = { ...exportBackgroundSettings, postExportScriptAcknowledged: checked };
    setExportBackgroundSettings(next);
    try {
      setExportBackgroundSettings(await saveExportBackgroundSettings(next));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.savePresetFailed);
    }
  }

  // Upload settings
  async function updateExportUploadSettings(next: ExportUploadSettings): Promise<void> {
    setExportUploadSettings(next);
    try {
      setExportUploadSettings(await saveExportUploadSettings(next));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.savePresetFailed);
    }
  }

  async function updateExportUploadPassword(password: string): Promise<void> {
    setExportUploadPassword(password);
    try {
      await writeExportUploadWebdavPassword(password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.savePresetFailed);
    }
  }

  async function chooseExportUploadDirectory(): Promise<void> {
    try {
      const directory = await openDirectoryDialog();
      if (directory) {
        await updateExportUploadSettings({
          ...exportUploadSettings,
          local: { ...exportUploadSettings.local, directory },
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.savePresetFailed);
    }
  }

  async function retryHistoryUpload(entry: ExportTaskHistoryEntry): Promise<void> {
    try {
      await retryExportUploadFromHistory(entry.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.upload.failedMessage);
    }
  }

  // Preflight
  async function collectPreflightIssues(
    targetProject: Project,
    settings: ExportPresetSettings,
  ): Promise<PreflightResult[]> {
    const nextCapabilities = capabilities ?? (await getFfmpegCapabilities().catch(logError('ExportDialogx')));
    if (nextCapabilities && !capabilities) {
      setCapabilities(nextCapabilities);
    }
    const whisperAvailability = await getWhisperAvailability({
      executablePath: whisperExecutablePath,
      modelPath: whisperModelPath,
    });
    return runExportPreflight(targetProject, {
      ffmpegAvailable: nextCapabilities?.available === true,
      whisperReady: whisperAvailability.ready,
      whisperMessage: whisperAvailability.error,
      isFontFamilyAvailable,
      platformPreset: settings.platformPreset,
    });
  }

  async function collectPreflightIssuesForJobs(jobs: ExportJob[]): Promise<PreflightResult[]> {
    const seen = new Set<string>();
    const issues: PreflightResult[] = [];
    for (const job of jobs) {
      for (const issue of await collectPreflightIssues(job.project ?? project, job.settings ?? exportSettings)) {
        const key = `${issue.id}:${issue.severity}:${issue.items.join('|')}`;
        if (!seen.has(key)) {
          seen.add(key);
          issues.push(issue);
        }
      }
    }
    return issues;
  }

  // Quality evaluation
  async function evaluateHistoryQuality(entry: ExportTaskHistoryEntry): Promise<void> {
    if (!entry.sourcePath) {
      setQualityError(t.quality.sourceMissing);
      showToast({ kind: 'warning', title: t.quality.title, message: t.quality.sourceMissing });
      return;
    }
    const taskId = `quality-${entry.id}`;
    setQualityTaskId(taskId);
    setQualityProgress(0);
    setQualityError(undefined);
    try {
      const result = await evaluateExportQuality({
        taskId,
        sourcePath: entry.sourcePath,
        outputPath: entry.outputPath,
        duration: getTimelinePlaybackDuration(project.timeline),
      });
      setQualityResult({ entry, result });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t.quality.failedMessage;
      setQualityError(message);
      showToast({ kind: 'error', title: t.quality.failedTitle, message });
    } finally {
      setQualityTaskId(undefined);
    }
  }

  async function cancelRunningQualityEvaluation(): Promise<void> {
    if (!qualityTaskId) {
      return;
    }
    const taskId = qualityTaskId;
    setQualityTaskId(undefined);
    setQualityProgress(0);
    await cancelQualityEvaluation(taskId);
  }

  return {
    warmupSelectedJobs,
    enqueueSelectedJobs,
    ensurePostExportScriptAcknowledged,
    setPostExportScriptAcknowledged,
    updateExportUploadSettings,
    updateExportUploadPassword,
    chooseExportUploadDirectory,
    retryHistoryUpload,
    collectPreflightIssues,
    collectPreflightIssuesForJobs,
    evaluateHistoryQuality,
    cancelRunningQualityEvaluation,
  };
}

// Module-level helpers

async function runProxyGenerationWarmup(project: Project): Promise<void> {
  const mediaIds = new Set(project.media.map((asset) => asset.id));
  const hasActiveProxyJobs = useMediaJobStore
    .getState()
    .jobs.some(
      (job) =>
        job.type === 'proxy' && mediaIds.has(job.assetId) && (job.status === 'pending' || job.status === 'running'),
    );
  if (hasActiveProxyJobs) {
    await ensureMediaJobRunner();
  }
}
