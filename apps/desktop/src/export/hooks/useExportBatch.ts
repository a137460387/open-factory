import {getTimelinePlaybackDuration, createVersionedExportJobs, parseVersionedBatchTemplate, serializeVersionedBatchTemplate, expandSequenceBatchOutputPath, buildProjectForSequenceExport, sortBatchSequenceIds, type VersionedExportDefinition, type ExportLoudnessNormalization} from '@open-factory/editor-core';

import {showToast} from '../../lib/toast';
import {openFileDialog, readFile, saveFileDialog, writeFile} from '../../lib/tauri-bridge';
import {getExportPreset, type ExportPresetSettings} from '../export-presets';
import {MAX_CODEC_COMPARE_PRESETS, type CodecCompareSortKey} from '../codec-compare';
import {normalizeDraftSettings, safePresetPackageFileName} from '../lib/exportSettingsHelpers';
import type {VersionedExportRowState} from '../components/ExportVersionBatchSection';
import type {ExportJob} from '../lib/pipelineHelpers';

import type {ExportState} from './useExportState';

export const VERSIONED_BATCH_TEMPLATE_EXTENSION = 'ofbatch.json';

export function useExportBatch(state: ExportState) {
  const {
    setError,
    setVersionedBatchTemplate,
    setVersionedBatchRows,
    setLatestVersionedBatchId,
    setVersionedBatchFileSizes,
    setSelectedSequenceIds,
    setSequenceBatchOutputOverrides,
    setSequenceBatchPresetIds,
    setCodecComparePresetIds,
    setCodecCompareSort,
    project,
    exportSettings,
    batchSequences,
    sequenceBatchRows,
    presets,
    presetId,
    activeExportRanges,
    versionedBatchTemplate,
    versionedBatchRows,
    selectedSequenceIds,
    sequenceBatchTemplate,
    sequenceBatchOutputOverrides,
    sequenceBatchPresetMode,
    sequenceBatchPresetIds,
    codecComparePresetIds,
    codecCompareSort,
    selectedPreset,
    t,
  } = state;

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

  return {
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
  };
}
