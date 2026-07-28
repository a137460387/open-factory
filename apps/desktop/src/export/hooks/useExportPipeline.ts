import {getTimelinePlaybackDuration, topologicallySortExportPipeline, getPipelineUpstreamNodeIds, shouldRunExportPipelineNode, createTwoStepExportPipeline, createPublishAutomationPipeline, SequenceDependencyCycleError, ExportPipelineCycleError, type ExportPipelineNode, type ExportPipelineNodeStatus, type ExportPublishNodeLog, type Project} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {chooseExportPath} from '../../lib/exportVideo';
import {getFileStat, openDirectoryDialog} from '../../lib/tauri-bridge';
import {showToast} from '../../lib/toast';
import {runPublishPipelineNode} from '../publish-pipeline-runner';
import {enqueueStemExport} from '../export-queue-runner';
import {useExportQueueStore} from '../export-queue-store';
import {buildCodecCompareJobs, createInitialCodecCompareResults} from '../codec-compare';
import {normalizeDraftSettings} from '../lib/exportSettingsHelpers';
import {buildExportJobs, delay, updatePipelineStatus, type ExportJob} from '../lib/pipelineHelpers';

import type {ExportState} from './useExportState';

const EXPORT_PREVIEW_TIMEOUT_MS = 10_000;

export function useExportPipeline(
  state: ExportState,
  helpers: {
    warmupSelectedJobs: (jobs: ExportJob[]) => Promise<void>;
    enqueueSelectedJobs: (jobs: ExportJob[]) => Promise<import('@open-factory/editor-core').ExportTask[]>;
    collectPreflightIssuesForJobs: (jobs: ExportJob[]) => Promise<import('@open-factory/editor-core').PreflightResult[]>;
    collectPreflightIssues: (project: Project, settings: import('../export-presets').ExportPresetSettings) => Promise<import('@open-factory/editor-core').PreflightResult[]>;
    ensurePostExportScriptAcknowledged: () => Promise<boolean>;
  },
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
    setStemOutputDir,
    setCodecCompareResults,
    // Computed values
    selectedPreset,
    exportSettings,
    isAudioOnly,
    activeExportRanges,
    // Other state
    project,
    outputPath,
    capabilities,
    preflight,
    exportMode,
    pipelineConfig,
    codecComparePresetIds,
    stemTracks,
    stemMode,
    stemOutputDir,
    batchOutputPaths,
    enqueueInFlight,
    t,
  } = state;

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
        const issues = await helpers.collectPreflightIssuesForJobs(selectedJobs);
        if (issues.length > 0) {
          setPreflight({ issues, selectedJobs });
          return;
        }
        await helpers.warmupSelectedJobs(selectedJobs);
        await helpers.enqueueSelectedJobs(selectedJobs);
        return;
      }
      if (exportMode === 'sequence-batch') {
        const selectedJobs = batchActions.buildSequenceBatchJobs();
        setError(undefined);
        const issues = await helpers.collectPreflightIssuesForJobs(selectedJobs);
        if (issues.length > 0) {
          setPreflight({ issues, selectedJobs });
          return;
        }
        await helpers.warmupSelectedJobs(selectedJobs);
        await helpers.enqueueSelectedJobs(selectedJobs);
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
        const issues = await helpers.collectPreflightIssuesForJobs(selectedJobs);
        if (issues.length > 0) {
          setPreflight({ issues, selectedJobs, codecCompareJobs: compareJobs });
          return;
        }
        await helpers.warmupSelectedJobs(selectedJobs);
        const queuedTasks = await helpers.enqueueSelectedJobs(selectedJobs);
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
      const issues = await helpers.collectPreflightIssues(project, exportSettings);
      if (issues.length > 0) {
        setPreflight({ issues, selectedJobs });
        return;
      }
      await helpers.warmupSelectedJobs(selectedJobs);
      await helpers.enqueueSelectedJobs(selectedJobs);
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
    const issues = await helpers.collectPreflightIssuesForJobs(jobs);
    const blocking = issues.find((issue) => issue.severity === 'blocking');
    if (blocking) {
      throw new Error(blocking.message);
    }
    await helpers.warmupSelectedJobs(jobs);
    const tasks = await helpers.enqueueSelectedJobs(jobs);
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
    state.setPreviewError(undefined);
    state.setPreviewRunning(true);
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
      state.setPreviewSamples(
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
      state.setPreviewError(message);
      showToast({ kind: 'error', title: t.preview.failedTitle, message });
    } finally {
      state.setPreviewRunning(false);
    }
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
      await helpers.warmupSelectedJobs(jobs);
      const queuedTasks = await helpers.enqueueSelectedJobs(jobs);
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

  return {
    addToQueue,
    runPipeline,
    runPipelineExportNode,
    runPipelineUtilityNode,
    createPipelineTemplate,
    createPublishPipelineTemplate,
    previewExport,
    continueAfterWarnings,
    relinkFromPreflight,
  };
}

// Module-level helpers

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
