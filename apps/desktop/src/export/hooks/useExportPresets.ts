import {applyExportOptimizationSuggestion, type ExportOptimizationSuggestion} from '@open-factory/editor-core';

import {showToast} from '../../lib/toast';
import {saveExportOptimizationSettings, saveExportPresetSyncSettings} from '../../settings/appSettings';
import {getWebdavText, putWebdavText, openFileDialog, readFile, saveFileDialog, writeFile} from '../../lib/tauri-bridge';
import {
  BUILTIN_EXPORT_PRESETS,
  deleteCustomExportPreset,
  EXPORT_PRESET_PACKAGE_EXTENSION,
  fetchOfficialExportPresetPackage,
  importExportPresetPackage,
  parseExportPresetPackage,
  saveCustomExportPreset,
  serializeExportPresetPackage,
  syncExportPresetsWithWebdav,
} from '../export-presets';
import {safePresetPackageFileName, choosePresetPackageConflictMode} from '../lib/exportSettingsHelpers';
import {formatOptimizationSuggestionTitle} from '../components/ExportOptimizationPanel';

import type {ExportState} from './useExportState';

export function useExportPresets(state: ExportState) {
  const {
    setError,
    setPresets,
    setPresetId,
    setDraftSettings,
    setProgressiveExportEnabled,
    setRenderFarmEnabled,
    setRenderFarmInstances,
    setExportOptimizationSettings,
    setExportPresetSyncSettings,
    setPresetSyncState,
    selectedPreset,
    exportSettings,
    presets,
    presetId,
    customPresetName,
    exportOptimizationSettings,
    exportPresetSyncSettings,
    exportPresetSyncPassword,
    suggestedRenderFarmInstances,
    t,
  } = state;

  async function savePreset(): Promise<void> {
    try {
      setError(undefined);
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

  return {
    savePreset,
    deletePreset,
    applyOptimizationSuggestion,
    dismissOptimizationSuggestion,
    exportSelectedPresetPackage,
    importPresetPackageFromFile,
    importOfficialPresetPackage,
    syncPresetPackageFromCloud,
    importPresetPackageContents,
  };
}
