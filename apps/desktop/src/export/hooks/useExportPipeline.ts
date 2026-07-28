import {logger} from '@open-factory/editor-core/utils';
import {getTimelinePlaybackDuration, buildExportProjectFromProject, buildFfmpegPreviewSamplePlans, topologicallySortExportPipeline, getPipelineUpstreamNodeIds, shouldRunExportPipelineNode, createTwoStepExportPipeline, createPublishAutomationPipeline, SequenceDependencyCycleError, ExportPipelineCycleError, runExportPreflight, type ExportPipelineNode, type ExportPipelineNodeStatus, type ExportPublishNodeLog, type ExportTask, type ExportTaskHistoryEntry, type PreflightResult, type Project, applyExportOptimizationSuggestion} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {chooseExportPath} from '../../lib/exportVideo';
import {isFontFamilyAvailable} from '../../lib/fonts';
import {cancelQualityEvaluation, convertLocalFileSrc, evaluateExportQuality, getAppDataDir, getFileStat, getFfmpegCapabilities, getTempSegmentsDir, openDirectoryDialog, runExportPowerAction, runExportPreviewSamples, sendNotification, writeExportUploadWebdavPassword} from '../../lib/tauri-bridge';
import {showToast} from '../../lib/toast';
import {runPublishPipelineNode} from '../publish-pipeline-runner';
import {saveExportBackgroundSettings, saveExportUploadSettings, type ExportBackgroundSettings, type ExportUploadSettings} from '../../settings/appSettings';
import {getWhisperAvailability} from '../../lib/whisper';
import {enqueueExport, enqueueStemExport} from '../export-queue-runner';
import {normalizeScheduledExportStart, type ExportCompletionAction} from '../export-background';
import {useExportQueueStore} from '../export-queue-store';
import {retryExportUploadFromHistory} from '../export-upload';
import {ensureMediaJobRunner} from '../../media/media-job-runner';
import {useMediaJobStore} from '../../media/media-job-store';
import {runExportWarmup} from '../export-warmup';
import {formatExportWarning} from '../export-utils';
import {getExportPreset, type ExportPresetSettings} from '../export-presets';
import {buildCodecCompareJobs, createInitialCodecCompareResults} from '../codec-compare';
import {buildExportPreviewOutputPaths, normalizeDraftSettings} from '../lib/exportSettingsHelpers';
import {buildExportJobs, delay, updatePipelineStatus, type ExportJob} from '../lib/pipelineHelpers';

import type {ExportState} from './useExportState';

const EXPORT_PREVIEW_TIMEOUT_MS = 10_000;

function logError(context: string) {
  return (error: unknown) => {
    logger.error(`[${context}]`, error);
  };
}

export function useExportPipeline(
  state: ExportState,
  batchActions: {
    buildVersionedBatchJobs: () => ExportJob[];
    buildSequenceBatchJobs: () => ExportJob[];
  },
) {
  const {
    // Setters
    setError,
    setPreflight,
    setOutputPath,
    setCapabilities,
    setPipelineConfig,
    setPipelineStatuses,
    setPublishPipelineLogs,
    setBatchOutputPaths,
    setStemOutputDir,
    setCompletionAction,
    setExportBackgroundSettings,
    setPostExportScriptPendingConfirm,
    setExportUploadSettings,
    setExportUploadPassword,
    setWarmupStatus,
    setPreviewRunning,
    setPreviewError,
    setPreviewSamples,
    setQualityTaskId,
    setQualityProgress,
    setQualityResult,
    setQualityError,
    setCodecCompareResults,
    // Computed values
    selectedPreset,
    exportSettings,
    isAudioOnly,
    activeExportRanges,
    progressiveExportSupported,
    // Store selectors
    whisperExecutablePath,
    whisperModelPath,
    // Refs
    pendingCompletionAction,
    completionActionHandled,
    enqueueInFlight,
    pendingConfirmResolveRef,
    // Other state
    project,
    outputPath,
    capabilities,
    error,
    preflight,
    exportMode,
    pipelineConfig,
    pipelineStatuses,
    publishPipelineLogs,
    batchOutputPaths,
    codecComparePresetIds,
    stemTracks,
    stemMode,
    stemOutputDir,
    priority,
    scheduleEnabled,
    scheduledStartInput,
    completionAction,
    exportBackgroundSettings,
    exportUploadSettings,
    exportUploadPassword,
    renderFarmEnabled,
    renderFarmInstances,
    progressiveExportEnabled,
    warmupStatus,
    previewRunning,
    previewError,
    previewSamples,
    qualityTaskId,
    qualityProgress,
    qualityResult,
    qualityError,
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
        exportMode === 'codec-compare'
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

  async function continueAfterWarnings(): Promise<void> {
    if (!preflight || preflight.issues.some((issue) => issue.severity === 'blocking')) {
      return;
    }
    if (enqueueInFlight.current) {
      return;
    }
    enqueueInFlight.current = true;
    const jobs = preflight.selectedJobs;
    const compareJobs = preflight.codecCompareJobs;
    setPreflight(undefined);
    try {
      await warmupSelectedJobs(jobs);
      const queuedTasks = await enqueueSelectedJobs(jobs);
      if (compareJobs) {
        setCodecCompareResults(createInitialCodecCompareResults(compareJobs, queuedTasks));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.exportFailed);
    } finally {
      enqueueInFlight.current = false;
    }
  }

  function relinkFromPreflight(): void {
    setPreflight(undefined);
    state.onClose();
    state.onRelinkMissing?.();
  }

  // Main export action
  async function addToQueue(): Promise<void> {
    if (enqueueInFlight.current) {
      return;
    }
    enqueueInFlight.current = true;
    try {
      if (exportMode === 'pipeline') {
        await runPipeline();
        return;
      }
      if (exportMode === 'version-batch') {
        const selectedJobs = batchActions.buildVersionedBatchJobs();
        setError(undefined);
        const issues = await collectPreflightIssuesForJobs(selectedJobs);
        if (issues.length > 0) {
          setPreflight({ issues, selectedJobs });
          return;
        }
        await warmupSelectedJobs(selectedJobs);
        await enqueueSelectedJobs(selectedJobs);
        return;
      }
      if (exportMode === 'sequence-batch') {
        const selectedJobs = batchActions.buildSequenceBatchJobs();
        setError(undefined);
        const issues = await collectPreflightIssuesForJobs(selectedJobs);
        if (issues.length > 0) {
          setPreflight({ issues, selectedJobs });
          return;
        }
        await warmupSelectedJobs(selectedJobs);
        await enqueueSelectedJobs(selectedJobs);
        return;
      }
      if (exportMode === 'codec-compare') {
        const baseOutputPath = outputPath || (await chooseExportPath(project, exportSettings.format));
        if (!baseOutputPath) {
          return;
        }
        if (codecComparePresetIds.length < 2) {
          throw new Error(t.codecCompare.selectAtLeastTwo);
        }
        setOutputPath(baseOutputPath);
        const compareJobs = buildCodecCompareJobs({
          baseOutputPath,
          presets: state.presets,
          selectedPresetIds: codecComparePresetIds,
        });
        const selectedJobs = compareJobs.map((job) => ({
          outputPath: job.outputPath,
          range: activeExportRanges[0] ?? null,
          settings: job.settings,
          presetName: job.presetName,
        }));
        setError(undefined);
        const issues = await collectPreflightIssuesForJobs(selectedJobs);
        if (issues.length > 0) {
          setPreflight({ issues, selectedJobs, codecCompareJobs: compareJobs });
          return;
        }
        await warmupSelectedJobs(selectedJobs);
        const queuedTasks = await enqueueSelectedJobs(selectedJobs);
        setCodecCompareResults(createInitialCodecCompareResults(compareJobs, queuedTasks));
        return;
      }
      if (exportMode === 'stem') {
        const selectedStemTracks = stemTracks.filter((track) => track.selected);
        if (selectedStemTracks.length === 0) {
          throw new Error(t.stem.noAudioTracks);
        }
        const stemOutDir = stemOutputDir || (await openDirectoryDialog());
        if (!stemOutDir) {
          return;
        }
        setStemOutputDir(stemOutDir);
        const tasks = await enqueueStemExport({
          project,
          outputDir: stemOutDir,
          stemTracks: selectedStemTracks.map((track) => ({
            trackIndex: track.trackIndex,
            trackName: track.trackName,
            format: track.format,
          })),
          stemMode,
        });
        showToast({ kind: 'info', title: t.queuedTitle, message: t.stem.queuedMessage(tasks.length) });
        return;
      }
      const paths = batchOutputPaths
        .split(/\r?\n/)
        .map((path) => path.trim())
        .filter(Boolean);
      const selectedPaths =
        paths.length > 0
          ? paths
          : [outputPath || (await chooseExportPath(project, exportSettings.format))].filter((path): path is string =>
              Boolean(path),
            );
      if (selectedPaths.length === 0) {
        return;
      }
      setOutputPath(selectedPaths[0]);
      const selectedJobs = buildExportJobs(selectedPaths, activeExportRanges);
      setError(undefined);
      const issues = await collectPreflightIssues(project, exportSettings);
      if (issues.length > 0) {
        setPreflight({ issues, selectedJobs });
        return;
      }
      await warmupSelectedJobs(selectedJobs);
      await enqueueSelectedJobs(selectedJobs);
    } catch (reason) {
      setError(
        reason instanceof SequenceDependencyCycleError
          ? t.sequenceBatch.cycleDetected(reason.cycleIds.join(' -> '))
          : reason instanceof ExportPipelineCycleError
            ? t.pipeline.cycleDetected(reason.cycleIds.join(' -> '))
            : reason instanceof Error
              ? reason.message
              : t.exportFailed,
      );
    } finally {
      enqueueInFlight.current = false;
    }
  }

  // Pipeline
  async function runPipeline(): Promise<void> {
    if (pipelineConfig.nodes.length === 0) {
      throw new Error(t.pipeline.empty);
    }
    const sorted = topologicallySortExportPipeline(pipelineConfig);
    let snapshot = Object.fromEntries(
      pipelineConfig.nodes.map((node) => [node.id, 'waiting' as ExportPipelineNodeStatus]),
    );
    let publishLogs: ExportPublishNodeLog[] = [];
    setPublishPipelineLogs([]);
    setPipelineStatuses(snapshot);
    let pipelineOutputPath = outputPath;
    for (const node of sorted) {
      const upstreamStatuses = getPipelineUpstreamNodeIds(pipelineConfig, node.id).map(
        (id) => snapshot[id] ?? 'waiting',
      );
      if (!shouldRunExportPipelineNode(node, upstreamStatuses)) {
        snapshot = updatePipelineStatus(snapshot, node.id, 'skipped');
        setPipelineStatuses(snapshot);
        continue;
      }
      snapshot = updatePipelineStatus(snapshot, node.id, 'running');
      setPipelineStatuses(snapshot);
      try {
        if (node.type === 'export-mp4') {
          pipelineOutputPath = await runPipelineExportNode(pipelineOutputPath);
        } else {
          const publishLog = await runPipelineUtilityNode(node, pipelineOutputPath, publishLogs);
          if (publishLog) {
            publishLogs = [...publishLogs, publishLog];
            setPublishPipelineLogs(publishLogs);
            snapshot = updatePipelineStatus(
              snapshot,
              node.id,
              publishLog.status === 'failed' ? 'failed' : publishLog.status === 'skipped' ? 'skipped' : 'complete',
            );
            setPipelineStatuses(snapshot);
            continue;
          }
        }
        snapshot = updatePipelineStatus(snapshot, node.id, 'complete');
        setPipelineStatuses(snapshot);
      } catch {
        snapshot = updatePipelineStatus(snapshot, node.id, 'failed');
        setPipelineStatuses(snapshot);
      }
    }
    showToast({ kind: 'info', title: t.pipeline.completedTitle, message: pipelineConfig.name });
  }

  async function runPipelineExportNode(currentOutputPath: string): Promise<string> {
    const selectedPath = currentOutputPath || (await chooseExportPath(project, 'mp4'));
    if (!selectedPath) {
      throw new Error(t.pipeline.outputRequired);
    }
    setOutputPath(selectedPath);
    const jobs: ExportJob[] = [
      {
        outputPath: selectedPath,
        range: activeExportRanges[0] ?? null,
        settings: normalizeDraftSettings({ ...exportSettings, format: 'mp4' }),
        presetName: selectedPreset.name,
      },
    ];
    const issues = await collectPreflightIssuesForJobs(jobs);
    const blocking = issues.find((issue) => issue.severity === 'blocking');
    if (blocking) {
      throw new Error(blocking.message);
    }
    await warmupSelectedJobs(jobs);
    const tasks = await enqueueSelectedJobs(jobs);
    await waitForExportTasks(tasks.map((task) => task.id));
    const latestTasks = useExportQueueStore
      .getState()
      .tasks.filter((task) => tasks.some((queued) => queued.id === task.id));
    const failed = latestTasks.find(
      (task) => task.status === 'error' || task.status === 'canceled' || task.status === 'interrupted',
    );
    if (failed) {
      throw new Error(failed.error ?? t.exportFailed);
    }
    return selectedPath;
  }

  async function runPipelineUtilityNode(
    node: ExportPipelineNode,
    currentOutputPath: string,
    existingLogs: ExportPublishNodeLog[],
  ): Promise<ExportPublishNodeLog | undefined> {
    if (
      node.type === 'email-notification' ||
      node.type === 'webhook-callback' ||
      node.type === 'publish-platform' ||
      node.type === 'write-release-record'
    ) {
      const stat = await getFileStat(currentOutputPath).catch(() => ({
        path: currentOutputPath,
        size: 0,
        mtimeMs: Date.now(),
      }));
      return runPublishPipelineNode(node, {
        project,
        outputPath: currentOutputPath,
        outputSize: stat.size,
        duration: getTimelinePlaybackDuration(project.timeline),
        existingLogs,
        messages: zhCN.exportDialog.pipeline.publishMessages,
      });
    }
    await delay(40);
    return undefined;
  }

  function createPipelineTemplate(): void {
    const next = createTwoStepExportPipeline(t.pipeline.defaultName);
    setPipelineConfig(next);
    setPipelineStatuses(Object.fromEntries(next.nodes.map((node) => [node.id, 'waiting' as ExportPipelineNodeStatus])));
    setPublishPipelineLogs([]);
  }

  function createPublishPipelineTemplate(): void {
    const next = createPublishAutomationPipeline(t.pipeline.publishDefaultName);
    setPipelineConfig(next);
    setPipelineStatuses(Object.fromEntries(next.nodes.map((node) => [node.id, 'waiting' as ExportPipelineNodeStatus])));
    setPublishPipelineLogs([]);
  }

  // Preview
  async function previewExport(): Promise<void> {
    if (isAudioOnly) {
      return;
    }
    setError(undefined);
    setPreviewError(undefined);
    setPreviewRunning(true);
    try {
      const nextCapabilities = capabilities ?? (await getFfmpegCapabilities());
      if (!nextCapabilities.available) {
        throw new Error(t.preview.ffmpegMissing);
      }
      if (!capabilities) {
        setCapabilities(nextCapabilities);
      }
      const appDataDir = await getAppDataDir();
      const outputPaths = buildExportPreviewOutputPaths(appDataDir);
      const exportProject = buildExportProjectFromProject(project, {
        outputPath: outputPath || outputPaths[0].replace(/\.png$/i, '.mp4'),
        settings: exportSettings,
      });
      const samples = buildFfmpegPreviewSamplePlans(exportProject, outputPaths, nextCapabilities).map((sample) => ({
        ...sample,
        label: t.preview.sampleLabels[sample.kind],
      }));
      const result = await runExportPreviewSamples({ samples, timeoutMs: EXPORT_PREVIEW_TIMEOUT_MS });
      setPreviewSamples(
        result.samples.map((sample) => ({
          id: sample.id,
          kind: sample.kind,
          label: t.preview.sampleLabels[sample.kind],
          time: sample.time,
          path: sample.path,
          src: convertLocalFileSrc(sample.path),
          durationMs: sample.durationMs,
        })),
      );
      showToast({ kind: 'success', title: t.preview.readyTitle, message: t.preview.readyMessage });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t.preview.failed;
      setPreviewError(message);
      showToast({ kind: 'error', title: t.preview.failedTitle, message });
    } finally {
      setPreviewRunning(false);
    }
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
    // Main export
    addToQueue,
    runPipeline,
    runPipelineExportNode,
    runPipelineUtilityNode,
    createPipelineTemplate,
    createPublishPipelineTemplate,
    // Preview
    previewExport,
    // Quality evaluation
    evaluateHistoryQuality,
    cancelRunningQualityEvaluation,
    // Warmup
    warmupSelectedJobs,
    // Enqueue
    enqueueSelectedJobs,
    // Post-export script
    ensurePostExportScriptAcknowledged,
    setPostExportScriptAcknowledged,
    // Upload settings
    updateExportUploadSettings,
    updateExportUploadPassword,
    chooseExportUploadDirectory,
    retryHistoryUpload,
    // Preflight
    collectPreflightIssues,
    collectPreflightIssuesForJobs,
    continueAfterWarnings,
    relinkFromPreflight,
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

async function waitForExportTasks(taskIds: string[]): Promise<void> {
  const ids = new Set(taskIds);
  if (ids.size === 0) {
    return;
  }
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const tasks = useExportQueueStore.getState().tasks.filter((task) => ids.has(task.id));
    if (
      tasks.length === ids.size &&
      tasks.every(
        (task) =>
          task.status === 'success' ||
          task.status === 'error' ||
          task.status === 'canceled' ||
          task.status === 'interrupted',
      )
    ) {
      return;
    }
    await delay(100);
  }
  throw new Error(zhCN.exportDialog.pipeline.timeout);
}
