import {logger} from '@open-factory/editor-core/utils';
import {generatePlatformFitSuggestion, ApplyPlatformFitCommand, RestorePlatformFitClipCommand, PLATFORM_LIMITS} from '@open-factory/editor-core';
import {BUILTIN_BROADCAST_SPECS, checkCompliance, buildComplianceFix, type ExportComplianceParams} from '@open-factory/editor-core';
import {getTimelinePlaybackDuration, buildExportProjectFromProject, buildFfmpegPreviewSamplePlans, buildProjectForSequenceExport, expandSequenceBatchOutputPath, createVersionedExportJobs, parseVersionedBatchTemplate, serializeVersionedBatchTemplate, runExportPreflight, sortBatchSequenceIds, topologicallySortExportPipeline, getPipelineUpstreamNodeIds, shouldRunExportPipelineNode, createTwoStepExportPipeline, createPublishAutomationPipeline, SequenceDependencyCycleError, ExportPipelineCycleError, type ExportPipelineNode, type ExportPipelineNodeStatus, type ExportPublishNodeLog, type ExportTask, type ExportLoudnessNormalization, type ExportTaskHistoryEntry, type ExportOptimizationSuggestion, type PreflightResult, type Project, type VersionedExportDefinition, applyExportOptimizationSuggestion} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {commandManager, projectAccessor} from '../../store/commandManager';
import {chooseExportPath} from '../../lib/exportVideo';
import {isFontFamilyAvailable} from '../../lib/fonts';
import {cancelQualityEvaluation, convertLocalFileSrc, evaluateExportQuality, getAppDataDir, getFileStat, getFfmpegCapabilities, getWebdavText, getTempSegmentsDir, openFileDialog, openDirectoryDialog, readFile, runExportPowerAction, runExportPreviewSamples, saveFileDialog, putWebdavText, writeFile, writeExportUploadWebdavPassword, sendNotification} from '../../lib/tauri-bridge';
import {showToast} from '../../lib/toast';
import {runPublishPipelineNode} from '../publish-pipeline-runner';
import {saveExportBackgroundSettings, saveExportOptimizationSettings, saveExportPresetSyncSettings, saveExportUploadSettings, type ExportBackgroundSettings, type ExportUploadSettings} from '../../settings/appSettings';
import {getWhisperAvailability} from '../../lib/whisper';
import {enqueueExport, enqueueStemExport} from '../export-queue-runner';
import {normalizeScheduledExportStart, type ExportCompletionAction} from '../export-background';
import {useExportQueueStore} from '../export-queue-store';
import {retryExportUploadFromHistory} from '../export-upload';
import {ensureMediaJobRunner} from '../../media/media-job-runner';
import {useMediaJobStore} from '../../media/media-job-store';
import {runExportWarmup} from '../export-warmup';
import {formatExportWarning} from '../export-utils';
import {BUILTIN_EXPORT_PRESETS, deleteCustomExportPreset, EXPORT_PRESET_PACKAGE_EXTENSION, fetchOfficialExportPresetPackage, getExportPreset, importExportPresetPackage, parseExportPresetPackage, saveCustomExportPreset, serializeExportPresetPackage, syncExportPresetsWithWebdav, type ExportPresetSettings} from '../export-presets';
import {MAX_CODEC_COMPARE_PRESETS, buildCodecCompareJobs, createInitialCodecCompareResults, type CodecCompareSortKey} from '../codec-compare';

import {buildExportPreviewOutputPaths, normalizeDraftSettings, updateAudioVisualizationBackgroundImagePath, updateImageWatermarkPath, safePresetPackageFileName, choosePresetPackageConflictMode} from '../lib/exportSettingsHelpers';

import {buildExportJobs, delay, updatePipelineStatus, type ExportJob} from '../lib/pipelineHelpers';

import {formatOptimizationSuggestionTitle} from '../components/ExportOptimizationPanel';
import type {VersionedExportRowState} from '../components/ExportVersionBatchSection';

import type {ExportState} from './useExportState';

const VERSIONED_BATCH_TEMPLATE_EXTENSION = 'ofbatch.json';
const EXPORT_PREVIEW_TIMEOUT_MS = 10_000;

export function useExportActions(state: ExportState) {
  const {
    project,
    initialPreset,
    selectedClipIds = [],
    inPoint,
    outPoint,
    onClose,
    onCompleted,
    onRelinkMissing,
    t,
    // State setters
    setCurrentStep,
    setComplianceOpen,
    setSelectedSpecId,
    setComplianceResults,
    setOutputPath,
    setCapabilities,
    setAvailableHwEncoders,
    setError,
    setPreflight,
    setPresets,
    setPresetId,
    setPlatformFitTarget,
    setPlatformFitCustomSeconds,
    setDraftSettings,
    setExportRangeMode,
    setExportMode,
    setPipelineConfig,
    setPipelineStatuses,
    setPublishPipelineLogs,
    setCustomPresetName,
    setBatchOutputPaths,
    setVersionedBatchTemplate,
    setVersionedBatchRows,
    setLatestVersionedBatchId,
    setVersionedBatchFileSizes,
    setSequenceBatchTemplate,
    setSelectedSequenceIds,
    setSequenceBatchOutputOverrides,
    setSequenceBatchPresetMode,
    setSequenceBatchPresetIds,
    setCodecComparePresetIds,
    setCodecCompareResults,
    setCodecCompareSort,
    setCodecCompareRecommendationMode,
    setCodecCompareEvaluatingTaskId,
    setStemTracks,
    setStemMode,
    setStemOutputDir,
    setPriority,
    setScheduleEnabled,
    setScheduledStartInput,
    setCompletionAction,
    setExportBackgroundSettings,
    setPostExportScriptPendingConfirm,
    setExportOptimizationSettings,
    setExportUploadSettings,
    setExportUploadPassword,
    setExportPresetSyncSettings,
    setExportPresetSyncPassword,
    setPresetSyncState,
    setWarmupStatus,
    setPreviewRunning,
    setPreviewError,
    setPreviewSamples,
    setQualityTaskId,
    setQualityProgress,
    setQualityResult,
    setQualityError,
    setRenderFarmEnabled,
    setRenderFarmInstances,
    setProgressiveExportEnabled,
    setDisableRecommendations,
    // Computed values
    selectedPreset,
    exportSettings,
    batchSequences,
    sequenceBatchRows,
    isAudioVisualization,
    isAudioOnly,
    timelineVisualControlsDisabled,
    subtitleLanguageOptions,
    loudnessNormalizationEligible,
    estimatedSize,
    exportCostEstimate,
    exportOptimizationSuggestions,
    lastExportDurationSeconds,
    exportCostHistoryError,
    historyCostSamples,
    hardwareEncodingEligible,
    hardwareEncodingRequested,
    progressiveExportSupported,
    formatOptions,
    spatialDenoiseClipCount,
    inOutExportRanges,
    selectedClipExportRange,
    activeExportRanges,
    rangeModeAvailable,
    sortedCodecCompareResults,
    codecCompareRecommendation,
    versionedBatchReportRows,
    // Store selectors
    tasks,
    history,
    runnerActive,
    resourcePaused,
    queuePaused,
    maxConcurrent,
    clearFinishedTasks,
    whisperExecutablePath,
    whisperModelPath,
    // Refs
    notifiedSuccess,
    pendingCompletionAction,
    completionActionHandled,
    enqueueInFlight,
    // Other state
    complianceOpen,
    selectedSpecId,
    complianceResults,
    outputPath,
    capabilities,
    availableHwEncoders,
    error,
    preflight,
    presets,
    presetId,
    platformFitTarget,
    platformFitCustomSeconds,
    draftSettings,
    exportRangeMode,
    exportMode,
    pipelineConfig,
    pipelineStatuses,
    publishPipelineLogs,
    customPresetName,
    batchOutputPaths,
    versionedBatchTemplate,
    versionedBatchRows,
    latestVersionedBatchId,
    versionedBatchFileSizes,
    sequenceBatchTemplate,
    selectedSequenceIds,
    sequenceBatchOutputOverrides,
    sequenceBatchPresetMode,
    sequenceBatchPresetIds,
    codecComparePresetIds,
    codecCompareResults,
    codecCompareSort,
    codecCompareRecommendationMode,
    codecCompareEvaluatingTaskId,
    stemTracks,
    stemMode,
    stemOutputDir,
    priority,
    scheduleEnabled,
    scheduledStartInput,
    completionAction,
    exportBackgroundSettings,
    postExportScriptPendingConfirm,
    pendingConfirmResolveRef,
    exportOptimizationSettings,
    exportUploadSettings,
    exportUploadPassword,
    exportPresetSyncSettings,
    exportPresetSyncPassword,
    presetSyncState,
    warmupStatus,
    previewRunning,
    previewError,
    previewSamples,
    qualityTaskId,
    qualityProgress,
    qualityResult,
    qualityError,
    suggestedRenderFarmInstances,
    renderFarmEnabled,
    renderFarmInstances,
    progressiveExportEnabled,
    disableRecommendations,
    recommendationContext,
    recommendations,
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
      setDraftSettings((current) => ({ ...current, loudnessNormalization: 'ebu' as ExportLoudnessNormalization }));
      sendNotification('Loudnorm', 'Target: ' + fix.loudnorm!.targetLufs + ' LUFS');
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
        updateImageWatermarkPath(setDraftSettings, path);
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
        updateAudioVisualizationBackgroundImagePath(setDraftSettings, path);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.audioVisualization.chooseImageFailed);
    }
  }

  // Preset management
  async function savePreset(): Promise<void> {
    try {
      setError(undefined);
      if (!(await ensurePostExportScriptAcknowledged())) {
        return;
      }
      const nextPresets = await saveCustomExportPreset(
        customPresetName || `${selectedPreset.name} ${t.presetCopySuffix}`,
        exportSettings,
      );
      const createdPreset = nextPresets.filter((preset) => !preset.builtin).at(-1);
      setPresets(nextPresets);
      setPresetId(createdPreset?.id ?? nextPresets[0]?.id ?? BUILTIN_EXPORT_PRESETS[0].id);
      showToast({ kind: 'success', title: t.presetSavedTitle, message: createdPreset?.name ?? customPresetName });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.savePresetFailed);
    }
  }

  async function deletePreset(): Promise<void> {
    if (selectedPreset.builtin) {
      return;
    }
    try {
      setError(undefined);
      const nextPresets = await deleteCustomExportPreset(selectedPreset.id);
      setPresets(nextPresets);
      setPresetId(nextPresets[0]?.id ?? BUILTIN_EXPORT_PRESETS[0].id);
      showToast({ kind: 'info', title: t.presetDeletedTitle, message: selectedPreset.name });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.deletePresetFailed);
    }
  }

  function applyOptimizationSuggestion(suggestion: ExportOptimizationSuggestion): void {
    const result = applyExportOptimizationSuggestion(suggestion, exportSettings, { suggestedRenderFarmInstances });
    setDraftSettings(result.settings);
    if (result.renderFarm) {
      setProgressiveExportEnabled(false);
      setRenderFarmEnabled(result.renderFarm.enabled);
      setRenderFarmInstances(result.renderFarm.instances);
    }
    showToast({
      kind: 'info',
      title: t.optimization.appliedTitle,
      message: formatOptimizationSuggestionTitle(suggestion),
    });
  }

  async function dismissOptimizationSuggestion(suggestion: ExportOptimizationSuggestion): Promise<void> {
    const dismissedSuggestionIds = Array.from(
      new Set([...exportOptimizationSettings.dismissedSuggestionIds, suggestion.id]),
    );
    const saved = await saveExportOptimizationSettings({ dismissedSuggestionIds });
    setExportOptimizationSettings(saved);
    showToast({
      kind: 'info',
      title: t.optimization.dismissedTitle,
      message: formatOptimizationSuggestionTitle(suggestion),
    });
  }

  async function exportSelectedPresetPackage(): Promise<void> {
    try {
      setError(undefined);
      const path = await saveFileDialog(
        `${safePresetPackageFileName(selectedPreset.name)}.${EXPORT_PRESET_PACKAGE_EXTENSION}`,
        [{ name: t.exportPresetPackage, extensions: [EXPORT_PRESET_PACKAGE_EXTENSION, 'json'] }],
      );
      if (!path) {
        return;
      }
      await writeFile(path, serializeExportPresetPackage([selectedPreset]));
      showToast({ kind: 'success', title: t.presetPackageExportedTitle, message: path });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.presetPackageFailed);
    }
  }

  async function importPresetPackageFromFile(): Promise<void> {
    try {
      setError(undefined);
      const [path] = await openFileDialog(false, [
        { name: t.importPresetPackage, extensions: [EXPORT_PRESET_PACKAGE_EXTENSION, 'json'] },
      ]);
      if (!path) {
        return;
      }
      await importPresetPackageContents(await readFile(path));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.presetPackageFailed);
    }
  }

  async function importOfficialPresetPackage(): Promise<void> {
    try {
      setError(undefined);
      const packageFile = await fetchOfficialExportPresetPackage();
      if (!packageFile) {
        showToast({ kind: 'warning', title: t.officialPresetPackage, message: t.presetPackageNoOfficial });
        return;
      }
      await importPresetPackageContents(JSON.stringify(packageFile));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.presetPackageFailed);
    }
  }

  async function syncPresetPackageFromCloud(
    settings = exportPresetSyncSettings,
    password = exportPresetSyncPassword,
    silent = false,
  ): Promise<void> {
    if (!settings.url?.trim()) {
      const message = t.presetCloudSyncUrlMissing;
      setPresetSyncState({ status: 'error', message });
      if (!silent) {
        showToast({ kind: 'warning', title: t.presetCloudSyncFailedTitle, message });
      }
      return;
    }
    try {
      setError(undefined);
      setPresetSyncState({ status: 'running' });
      const result = await syncExportPresetsWithWebdav(
        {
          url: settings.url,
          username: settings.username,
          password: password || undefined,
          conflictResolution: settings.conflictMode,
        },
        {
          client: {
            getText: getWebdavText,
            putText: putWebdavText,
          },
        },
      );
      setPresets(result.presets);
      const latestCustomPreset = result.presets.filter((preset) => !preset.builtin).at(-1);
      if (latestCustomPreset) {
        setPresetId(latestCustomPreset.id);
      }
      const savedSettings = await saveExportPresetSyncSettings({
        ...settings,
        lastSyncedAt: result.syncedAt,
        lastSyncWarning: undefined,
      });
      setExportPresetSyncSettings(savedSettings);
      const message = t.presetCloudSyncCompleteMessage(result.uploadedCount, result.conflicts.length);
      setPresetSyncState({ status: 'success', message });
      if (!silent) {
        showToast({ kind: 'success', title: t.presetCloudSyncCompleteTitle, message });
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t.presetPackageFailed;
      setPresetSyncState({ status: 'error', message });
      setExportPresetSyncSettings(
        await saveExportPresetSyncSettings({ ...settings, lastSyncWarning: message }).catch(() => settings),
      );
      if (!silent) {
        showToast({ kind: 'warning', title: t.presetCloudSyncFailedTitle, message });
      }
    }
  }

  async function importPresetPackageContents(contents: string): Promise<void> {
    const packageFile = parseExportPresetPackage(contents);
    const conflictMode = choosePresetPackageConflictMode(
      packageFile.presets.map((preset) => preset.name),
      presets,
    );
    if (!conflictMode) {
      return;
    }
    const result = await importExportPresetPackage(contents, conflictMode);
    setPresets(result.presets);
    const importedPreset = result.presets.filter((preset) => !preset.builtin).at(-1);
    if (importedPreset) {
      setPresetId(importedPreset.id);
    }
    showToast({
      kind: 'success',
      title: t.presetPackageImportedTitle,
      message: t.presetPackageImportMessage(result.imported, result.skipped),
    });
  }

  // Versioned batch functions
  async function exportVersionedBatchTemplate(): Promise<void> {
    try {
      setError(undefined);
      const path = await saveFileDialog(
        `${safePresetPackageFileName(project.name || 'versioned-batch')}.${VERSIONED_BATCH_TEMPLATE_EXTENSION}`,
        [{ name: t.versionBatch.templateFilter, extensions: [VERSIONED_BATCH_TEMPLATE_EXTENSION, 'json'] }],
      );
      if (!path) {
        return;
      }
      await writeFile(
        path,
        serializeVersionedBatchTemplate(
          project.name || t.versionBatch.title,
          versionedBatchTemplate,
          buildVersionDefinitions(),
        ),
      );
      showToast({ kind: 'success', title: t.versionBatch.templateSavedTitle, message: path });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.versionBatch.templateFailed);
    }
  }

  async function importVersionedBatchTemplate(): Promise<void> {
    try {
      setError(undefined);
      const [path] = await openFileDialog(false, [
        { name: t.versionBatch.templateFilter, extensions: [VERSIONED_BATCH_TEMPLATE_EXTENSION, 'json'] },
      ]);
      if (!path) {
        return;
      }
      const template = parseVersionedBatchTemplate(await readFile(path));
      setVersionedBatchTemplate(template.outputPathTemplate);
      setVersionedBatchRows(template.versions.map(versionDefinitionToRow));
      showToast({ kind: 'success', title: t.versionBatch.templateLoadedTitle, message: template.name });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.versionBatch.templateFailed);
    }
  }

  function buildVersionDefinitions(): VersionedExportDefinition[] {
    return versionedBatchRows.map((row) => ({
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      presetId: row.presetId,
      platform: row.platform,
      language: row.language,
      range:
        row.rangeMode === 'custom'
          ? { start: Math.max(0, row.rangeStart || 0), duration: Math.max(0.001, row.rangeDuration || 0.001) }
          : undefined,
      settings: buildVersionSettings(row),
      metadata: {
        title: '{version_name}',
        description: '{platform} / {language}',
      },
    }));
  }

  function buildVersionedBatchJobs(): ExportJob[] {
    const enabledRows = versionedBatchRows.filter((row) => row.enabled);
    if (enabledRows.length === 0) {
      throw new Error(t.versionBatch.noneSelected);
    }
    const batchId = `version-batch-${Date.now().toString(36)}`;
    const presetSettingsById = new Map(presets.map((preset) => [preset.id, normalizeDraftSettings(preset.settings)]));
    const versionJobs = createVersionedExportJobs({
      batchId,
      outputPathTemplate: versionedBatchTemplate,
      defaultSettings: exportSettings,
      defaultRange: activeExportRanges[0] ?? null,
      presetSettingsById,
      metadata: {
        title: '{version_name}',
        description: '{platform} / {language}',
      },
      versions: buildVersionDefinitions().filter((version) => version.enabled !== false),
    });
    setLatestVersionedBatchId(batchId);
    setVersionedBatchFileSizes({});
    return versionJobs.map((job) => ({
      outputPath: job.outputPath,
      range: job.range,
      settings: job.settings,
      metadata: job.metadata,
      versionedBatch: job.batch,
      presetName: job.batch.versionName,
    }));
  }

  function updateVersionedBatchRow(rowId: string, patch: Partial<VersionedExportRowState>): void {
    setVersionedBatchRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function addVersionedBatchRow(): void {
    const index = versionedBatchRows.length + 1;
    setVersionedBatchRows((current) => [
      ...current,
      {
        id: `version-${Date.now().toString(36)}`,
        enabled: true,
        name: t.versionBatch.defaultVersionName(index),
        presetId,
        platform: 'Custom',
        language: 'zh',
        rangeMode: 'default',
        rangeStart: 0,
        rangeDuration: Math.max(1, Math.round(getTimelinePlaybackDuration(project.timeline) || 1)),
        width: exportSettings.width ?? project.settings.width,
        height: exportSettings.height ?? project.settings.height,
        watermarkMode: 'inherit',
      },
    ]);
  }

  function removeVersionedBatchRow(rowId: string): void {
    setVersionedBatchRows((current) => (current.length <= 1 ? current : current.filter((row) => row.id !== rowId)));
  }

  function buildVersionSettings(row: VersionedExportRowState): ExportPresetSettings {
    const settings: ExportPresetSettings = {
      width: Math.max(1, Math.round(row.width || project.settings.width)),
      height: Math.max(1, Math.round(row.height || project.settings.height)),
    };
    const language = row.language.trim();
    if (language) {
      settings.subtitleLanguages = [language];
      settings.subtitleBurnInLanguage = language;
    }
    if (row.watermarkMode === 'none') {
      settings.watermark = null;
    } else if (row.watermarkMode === 'text') {
      settings.watermark = {
        enabled: true,
        type: 'text',
        text: `${row.platform || row.name}`,
        fontFamily: 'Arial',
        color: '#ffffff',
        fontSize: 36,
        position: 'bottom-right',
      };
    }
    return settings;
  }

  function versionDefinitionToRow(version: VersionedExportDefinition): VersionedExportRowState {
    return {
      id: version.id,
      enabled: version.enabled !== false,
      name: version.name,
      presetId:
        version.presetId && presets.some((preset) => preset.id === version.presetId) ? version.presetId : presetId,
      platform: version.platform ?? 'Custom',
      language: version.language ?? 'zh',
      rangeMode: version.range ? 'custom' : 'default',
      rangeStart: Math.max(0, version.range?.start ?? 0),
      rangeDuration: Math.max(
        0.001,
        version.range?.duration ?? Math.max(1, Math.round(getTimelinePlaybackDuration(project.timeline) || 1)),
      ),
      width: Math.max(1, Math.round(version.settings?.width ?? exportSettings.width ?? project.settings.width)),
      height: Math.max(1, Math.round(version.settings?.height ?? exportSettings.height ?? project.settings.height)),
      watermarkMode:
        version.settings?.watermark === null
          ? 'none'
          : version.settings?.watermark?.type === 'text'
            ? 'text'
            : 'inherit',
    };
  }

  // Sequence batch functions
  function toggleSequenceBatchSelection(sequenceId: string, checked: boolean): void {
    setSelectedSequenceIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(sequenceId);
      } else {
        next.delete(sequenceId);
      }
      return Array.from(next);
    });
  }

  function updateSequenceBatchOutput(sequenceId: string, outputPath: string): void {
    setSequenceBatchOutputOverrides((current) => ({ ...current, [sequenceId]: outputPath }));
  }

  function updateSequenceBatchPreset(sequenceId: string, nextPresetId: string): void {
    setSequenceBatchPresetIds((current) => ({ ...current, [sequenceId]: nextPresetId }));
  }

  // Codec compare functions
  function toggleCodecComparePreset(presetId: string, checked: boolean): void {
    setCodecComparePresetIds((current) => {
      if (!checked) {
        return current.filter((id) => id !== presetId);
      }
      if (current.includes(presetId) || current.length >= MAX_CODEC_COMPARE_PRESETS) {
        return current;
      }
      return [...current, presetId];
    });
  }

  function toggleCodecCompareSort(key: CodecCompareSortKey): void {
    setCodecCompareSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  function buildSequenceBatchJobs(): ExportJob[] {
    const selectedIds = selectedSequenceIds.filter((id) => batchSequences.some((sequence) => sequence.id === id));
    if (selectedIds.length === 0) {
      throw new Error(t.sequenceBatch.noneSelected);
    }
    const sequenceById = new Map(batchSequences.map((sequence) => [sequence.id, sequence]));
    return sortBatchSequenceIds(project, selectedIds).map((sequenceId, index) => {
      const sequence = sequenceById.get(sequenceId);
      if (!sequence) {
        throw new Error(t.sequenceBatch.missingSequence(sequenceId));
      }
      const rowPreset = getExportPreset(sequenceBatchPresetIds[sequenceId] ?? presetId, presets);
      const settings =
        sequenceBatchPresetMode === 'individual' ? normalizeDraftSettings(rowPreset.settings) : exportSettings;
      const outputPath = (
        sequenceBatchOutputOverrides[sequenceId] ??
        expandSequenceBatchOutputPath(sequenceBatchTemplate, sequence, index + 1)
      ).trim();
      if (!outputPath) {
        throw new Error(t.sequenceBatch.outputRequired(sequence.name));
      }
      return {
        outputPath,
        range: null,
        project: buildProjectForSequenceExport(project, sequenceId),
        settings,
        presetName: sequenceBatchPresetMode === 'individual' ? rowPreset.name : selectedPreset.name,
        sequenceName: sequence.name,
      };
    });
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
        const selectedJobs = buildVersionedBatchJobs();
        setError(undefined);
        const issues = await collectPreflightIssuesForJobs(selectedJobs);
        if (issues.length > 0) {
          setPreflight({ issues, selectedJobs });
          // preflight 面板只渲染在 export 步（ExportProgress），
          // 拦截/警告发生时必须切过去，否则用户点入队后看不到任何反馈。
          setCurrentStep('export');
          return;
        }
        await warmupSelectedJobs(selectedJobs);
        await enqueueSelectedJobs(selectedJobs);
        return;
      }
      if (exportMode === 'sequence-batch') {
        const selectedJobs = buildSequenceBatchJobs();
        setError(undefined);
        const issues = await collectPreflightIssuesForJobs(selectedJobs);
        if (issues.length > 0) {
          setPreflight({ issues, selectedJobs });
          // 同 version-batch：preflight 面板在 export 步，必须切步才可见。
          setCurrentStep('export');
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
          presets,
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
          setCurrentStep('export');
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
        // preflight 面板（blocking 拦截与 warning 确认）只渲染在 export 步，
        // 不切步的话用户点"加入队列"后界面毫无反馈（静默拦截）。
        setCurrentStep('export');
        return;
      }
      await warmupSelectedJobs(selectedJobs);
      const queuedTasks = await enqueueSelectedJobs(selectedJobs);
      // 入队成功后自动切到 export 步骤，让用户立即看到队列/进度，
      // 对齐 07-14 拆分向导（bd315fd6）前"队列始终可见"的旧体验。
      // 校验不通过/未确认时 enqueueSelectedJobs 返回 []，不跳转；
      // 抛错则进入 catch，同样不会执行到此处。
      if (queuedTasks.length > 0) {
        setCurrentStep('export');
      }
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

  // Warmup
  async function warmupSelectedJobs(selectedJobs: ExportJob[]): Promise<void> {
    // warmup 状态面板（export-warmup-status）只渲染在 export 步，
    // warmup 启动即切步，让用户看到"正在准备导出"进度；
    // continueAfterWarnings 场景用户本就在 export 步，此调用为幂等。
    setCurrentStep('export');
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
    onClose();
    onRelinkMissing?.();
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
    deletePreset,
    applyOptimizationSuggestion,
    dismissOptimizationSuggestion,
    exportSelectedPresetPackage,
    importPresetPackageFromFile,
    importOfficialPresetPackage,
    syncPresetPackageFromCloud,
    importPresetPackageContents,

    // Versioned batch
    exportVersionedBatchTemplate,
    importVersionedBatchTemplate,
    buildVersionDefinitions,
    buildVersionedBatchJobs,
    updateVersionedBatchRow,
    addVersionedBatchRow,
    removeVersionedBatchRow,
    buildVersionSettings,
    versionDefinitionToRow,

    // Sequence batch
    toggleSequenceBatchSelection,
    updateSequenceBatchOutput,
    updateSequenceBatchPreset,

    // Codec compare
    toggleCodecComparePreset,
    toggleCodecCompareSort,
    buildSequenceBatchJobs,

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
