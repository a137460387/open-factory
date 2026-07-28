import {logger} from '@open-factory/editor-core/utils';
import {BUILTIN_BROADCAST_SPECS, checkCompliance, buildComplianceFix, generatePlatformFitSuggestion, ApplyPlatformFitCommand, RestorePlatformFitClipCommand, PLATFORM_LIMITS, getTimelinePlaybackDuration, type ExportComplianceParams, type ExportLoudnessNormalization} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {commandManager, projectAccessor} from '../../store/commandManager';
import {chooseExportPath} from '../../lib/exportVideo';
import {openFileDialog, runExportPowerAction} from '../../lib/tauri-bridge';
import {showToast} from '../../lib/toast';
import {type ExportCompletionAction} from '../export-background';
import {type ExportBackgroundSettings} from '../../settings/appSettings';
import {updateAudioVisualizationBackgroundImagePath, updateImageWatermarkPath} from '../lib/exportSettingsHelpers';

import type {ExportState} from './useExportState';
import {useExportPresets} from './useExportPresets';
import {useExportBatch, VERSIONED_BATCH_TEMPLATE_EXTENSION} from './useExportBatch';
import {useExportPipeline} from './useExportPipeline';

export {VERSIONED_BATCH_TEMPLATE_EXTENSION} from './useExportBatch';

export function useExportActions(state: ExportState) {
  const {
    project,
    // State setters
    setError,
    setComplianceResults,
    setOutputPath,
    // Computed values
    exportSettings,
    isAudioOnly,
    // Other state
    complianceResults,
    outputPath,
    selectedSpecId,
    platformFitTarget,
    platformFitCustomSeconds,
    draftSettings,
    t,
  } = state;

  // Compliance functions
  function runComplianceCheck() {
    const spec = BUILTIN_BROADCAST_SPECS.find((s) => s.id === selectedSpecId);
    if (!spec) return;
    const parseBitrate = (v: string | null | undefined, unit: 'mbps' | 'kbps'): number | undefined => {
      if (!v) return undefined;
      const m = v.trim().match(/^(\d+(?:\.\d+)?)\s*(k|m)?b?ps?$/i);
      if (!m) return undefined;
      const n = parseFloat(m[1]);
      const prefix = (m[2] ?? '').toLowerCase();
      if (unit === 'mbps') return prefix === 'k' ? n / 1000 : n;
      return prefix === 'm' ? n * 1000 : n;
    };
    const w = draftSettings.width ?? project.settings.width;
    const h = draftSettings.height ?? project.settings.height;
    const params: ExportComplianceParams = {
      videoCodec: exportSettings.videoCodec,
      videoBitrateMbps: parseBitrate(draftSettings.videoBitrate, 'mbps'),
      width: w,
      height: h,
      fps: draftSettings.fps ?? project.settings.fps,
      audioCodec: exportSettings.audioCodec,
      audioBitrateKbps: parseBitrate(draftSettings.audioBitrate, 'kbps'),
      subtitleFormat: exportSettings.subtitleFormat,
      durationSec: getTimelinePlaybackDuration(project.timeline),
    };
    setComplianceResults(checkCompliance(spec, params));
  }

  function applyComplianceFix() {
    const spec = BUILTIN_BROADCAST_SPECS.find((s) => s.id === selectedSpecId);
    if (!spec || complianceResults.length === 0) return;
    const fix = buildComplianceFix(spec, complianceResults);
    if (fix.loudnorm) {
      state.setDraftSettings((current) => ({ ...current, loudnessNormalization: 'ebu' as ExportLoudnessNormalization }));
      showToast({ kind: 'info', title: 'Loudnorm', message: 'Target: ' + fix.loudnorm!.targetLufs + ' LUFS' });
    }
  }

  // Path selection
  async function choosePath(): Promise<void> {
    const path = await chooseExportPath(project, exportSettings.format);
    if (path) {
      setOutputPath(path);
    }
  }

  async function chooseWatermarkImage(): Promise<void> {
    try {
      const [path] = await openFileDialog(false, [{ name: t.watermark.imageFilter, extensions: ['png'] }]);
      if (path) {
        updateImageWatermarkPath(state.setDraftSettings, path);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.watermark.chooseImageFailed);
    }
  }

  async function chooseAudioVisualizationBackgroundImage(): Promise<void> {
    try {
      const [path] = await openFileDialog(false, [
        { name: t.audioVisualization.backgroundImageFilter, extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      ]);
      if (path) {
        updateAudioVisualizationBackgroundImagePath(state.setDraftSettings, path);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.audioVisualization.chooseImageFailed);
    }
  }

  // Platform fit
  function applyPlatformFit() {
    const limit =
      platformFitTarget === 'custom'
        ? platformFitCustomSeconds
        : (PLATFORM_LIMITS[platformFitTarget as keyof typeof PLATFORM_LIMITS] ?? 60);
    const clips = project.timeline.tracks
      .flatMap((track) => track.clips)
      .map((clip) => ({
        clipId: clip.id,
        start: clip.start,
        end: clip.start + clip.duration,
        score: undefined as number | undefined,
        sceneChanges: [] as number[],
      }));
    const suggestion = generatePlatformFitSuggestion(clips, limit);
    const fullSuggestion = {
      ...suggestion,
      targetPlatform: platformFitTarget as 'tiktok' | 'reels' | 'shorts' | 'custom',
      limitSeconds: limit,
    };
    const cmd = new ApplyPlatformFitCommand(projectAccessor, fullSuggestion);
    commandManager.execute(cmd);
  }

  function restorePlatformFitClip(clipId: string) {
    const cmd = new RestorePlatformFitClipCommand(projectAccessor, clipId);
    commandManager.execute(cmd);
  }

  // Sub-hooks
  const presets = useExportPresets(state);
  const batch = useExportBatch(state);
  const pipeline = useExportPipeline(state, {
    buildVersionedBatchJobs: batch.buildVersionedBatchJobs,
    buildSequenceBatchJobs: batch.buildSequenceBatchJobs,
  });

  // savePreset wraps presets.savePreset with post-export script acknowledgment
  async function savePreset(): Promise<void> {
    if (!(await pipeline.ensurePostExportScriptAcknowledged())) {
      return;
    }
    await presets.savePreset();
  }

  return {
    // Compliance
    runComplianceCheck,
    applyComplianceFix,

    // Path selection
    choosePath,
    chooseWatermarkImage,
    chooseAudioVisualizationBackgroundImage,

    // Preset management
    savePreset,
    deletePreset: presets.deletePreset,
    applyOptimizationSuggestion: presets.applyOptimizationSuggestion,
    dismissOptimizationSuggestion: presets.dismissOptimizationSuggestion,
    exportSelectedPresetPackage: presets.exportSelectedPresetPackage,
    importPresetPackageFromFile: presets.importPresetPackageFromFile,
    importOfficialPresetPackage: presets.importOfficialPresetPackage,
    syncPresetPackageFromCloud: presets.syncPresetPackageFromCloud,
    importPresetPackageContents: presets.importPresetPackageContents,

    // Versioned batch
    exportVersionedBatchTemplate: batch.exportVersionedBatchTemplate,
    importVersionedBatchTemplate: batch.importVersionedBatchTemplate,
    buildVersionDefinitions: batch.buildVersionDefinitions,
    buildVersionedBatchJobs: batch.buildVersionedBatchJobs,
    updateVersionedBatchRow: batch.updateVersionedBatchRow,
    addVersionedBatchRow: batch.addVersionedBatchRow,
    removeVersionedBatchRow: batch.removeVersionedBatchRow,
    buildVersionSettings: batch.buildVersionSettings,
    versionDefinitionToRow: batch.versionDefinitionToRow,

    // Sequence batch
    toggleSequenceBatchSelection: batch.toggleSequenceBatchSelection,
    updateSequenceBatchOutput: batch.updateSequenceBatchOutput,
    updateSequenceBatchPreset: batch.updateSequenceBatchPreset,

    // Codec compare
    toggleCodecComparePreset: batch.toggleCodecComparePreset,
    toggleCodecCompareSort: batch.toggleCodecCompareSort,
    buildSequenceBatchJobs: batch.buildSequenceBatchJobs,

    // Main export
    addToQueue: pipeline.addToQueue,
    runPipeline: pipeline.runPipeline,
    runPipelineExportNode: pipeline.runPipelineExportNode,
    runPipelineUtilityNode: pipeline.runPipelineUtilityNode,
    createPipelineTemplate: pipeline.createPipelineTemplate,
    createPublishPipelineTemplate: pipeline.createPublishPipelineTemplate,

    // Preview
    previewExport: pipeline.previewExport,

    // Quality evaluation
    evaluateHistoryQuality: pipeline.evaluateHistoryQuality,
    cancelRunningQualityEvaluation: pipeline.cancelRunningQualityEvaluation,

    // Warmup
    warmupSelectedJobs: pipeline.warmupSelectedJobs,

    // Enqueue
    enqueueSelectedJobs: pipeline.enqueueSelectedJobs,

    // Post-export script
    ensurePostExportScriptAcknowledged: pipeline.ensurePostExportScriptAcknowledged,
    setPostExportScriptAcknowledged: pipeline.setPostExportScriptAcknowledged,

    // Upload settings
    updateExportUploadSettings: pipeline.updateExportUploadSettings,
    updateExportUploadPassword: pipeline.updateExportUploadPassword,
    chooseExportUploadDirectory: pipeline.chooseExportUploadDirectory,
    retryHistoryUpload: pipeline.retryHistoryUpload,

    // Preflight
    collectPreflightIssues: pipeline.collectPreflightIssues,
    collectPreflightIssuesForJobs: pipeline.collectPreflightIssuesForJobs,
    continueAfterWarnings: pipeline.continueAfterWarnings,
    relinkFromPreflight: pipeline.relinkFromPreflight,

    // Platform fit
    applyPlatformFit,
    restorePlatformFitClip,
  };
}

export type ExportActions = ReturnType<typeof useExportActions>;

// Helper functions (module-level)
function logError(context: string) {
  return (error: unknown) => {
    logger.error(`[${context}]`, error);
  };
}

async function runCompletionAction(action: ExportCompletionAction, settings: ExportBackgroundSettings): Promise<void> {
  if (action === 'none') {
    return;
  }
  if (action === 'notification') {
    showToast({
      kind: 'success',
      title: zhCN.exportDialog.completionAction.notificationTitle,
      message: zhCN.exportDialog.completionAction.notificationMessage,
    });
    if (typeof Notification !== 'undefined') {
      const permission =
        Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      if (permission === 'granted') {
        new Notification(zhCN.exportDialog.completionAction.notificationTitle, {
          body: zhCN.exportDialog.completionAction.notificationMessage,
        });
      }
    }
    return;
  }
  if (!settings.allowPowerActions) {
    showToast({
      kind: 'warning',
      title: zhCN.exportDialog.completionAction.powerDisabledTitle,
      message: zhCN.exportDialog.completionAction.powerDisabled,
    });
    return;
  }
  try {
    await runExportPowerAction(action, true);
  } catch (error) {
    showToast({
      kind: 'error',
      title: zhCN.exportDialog.completionAction.powerFailedTitle,
      message: error instanceof Error ? error.message : zhCN.exportDialog.completionAction.powerFailedMessage,
    });
  }
}
