import { useCallback } from 'react';
import {
  AddClipCommand,
  AddMediaFolderCommand,
  AddSubclipCommand,
  AddTrackCommand,
  AddTransitionCommand,
  BatchRenameMediaCommand,
  BatchUpdateMetadataCommand,
  ConformMediaCommand,
  DeleteMediaFolderCommand,
  DeleteSubclipCommand,
  ImportEDLCommand,
  LoadProjectCommand,
  MergeMediaCommand,
  MoveMediaToFolderCommand,
  RemoveMediaCommand,
  RenameMediaFolderCommand,
  SetMediaFolderCollapsedCommand,
  UpdateProjectReleaseVersionCommand,
  UpdateSubclipCommand,
  applyArchiveRelinkPlan,
  buildConformMediaReplacements,
  buildConformPreflight,
  buildConformReport,
  buildCoverFrameBatchTasks,
  buildVideoStitchSequence,
  createId,
  createTrack,
  dirname,
  getClipSourceVisibleDuration,
  getColorSpaceDisplayName,
  getProjectFrameRateConversionTarget,
  isFrameRateMismatch,
  matchConformByFilename,
  normalizeProjectWorkingColorSpace,
  replaceMediaPathBasename,
  type BatchEditableMediaMetadata,
  type MediaAsset,
  type MediaRenamePreviewItem,
  type Subclip,
} from '@open-factory/editor-core';
import {
  batchExtractCoverFrames,
  bridgeConfirm,
  moveFile as bridgeMoveFile,
  trashFile as bridgeTrashFile,
  getAppDataDir,
  openDirectoryDialog,
  scanDirectory,
} from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { zhCN } from '../i18n/strings';
import { commandManager, projectAccessor, timelineAccessor } from '../store/commandManager';
import { useEditorStore } from '../store/editorStore';
import { useEditorSettingsStore } from '../store/editorSettingsStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';
import { useEditorUIStore } from '../store/editorUIStore';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import { useMediaJobStore } from '../media/media-job-store';
import { ensureMediaJobRunner } from '../media/media-job-runner';
import { probeMediaPaths, pickMediaPaths } from '../lib/media';
import { generateMediaFingerprint, scanDuplicateMediaGroups } from '../lib/duplicateMedia';
import {
  buildArchiveDestinationPath,
  buildRenameDestinationPath,
  scanMediaCleanupReport,
  scanSmartDuplicateMediaGroups,
} from '../lib/mediaOrganizer';
import type { DuplicateMediaMergeSelection } from '../media/DuplicateMediaDialog';
import type { MediaOrganizerDuplicateSelection } from '../media/MediaOrganizerDialog';
import type { SmartDuplicateGroup } from '@open-factory/editor-core';
import type { VideoStitchWizardSettings } from '../video-stitching/VideoStitchWizardDialog';
import { joinLocalPath } from '../lib/ui-helpers';
import { relinkMissingMediaInDirectory, relinkSingleMedia } from '../media/relink';
import { loadSharedLibrary } from '../shared-library/sharedLibrary';

// ---------------------------------------------------------------------------
// 参数接口
// ---------------------------------------------------------------------------

interface MediaCallbacksDeps {
  runAutomationForMedia: (trigger: 'on-import' | 'on-export-complete' | 'on-project-open', media: MediaAsset[]) => Promise<void>;
}

/**
 * 从 EditorShell 中提取的媒体管理相关回调。
 * 涵盖导入、版本管理、批量操作、文件夹、重链接、重复检测、整理等，约 800 行。
 */
export function useEditorShellMediaCallbacks(deps: MediaCallbacksDeps) {
  const { runAutomationForMedia } = deps;

  // --- 共享库 ---
  const refreshSharedLibraryResources = useCallback(async () => {
    try {
      useEditorSettingsStore.getState().setSharedLibraryResources(await loadSharedLibrary());
    } catch (error) {
      console.warn('Unable to load shared library', error);
      useEditorSettingsStore.getState().setSharedLibraryResources([]);
    }
  }, []);

  // --- 媒体指纹 ---
  const persistMediaFingerprints = useCallback(async (media: MediaAsset[]) => {
    for (const asset of media) {
      try {
        const fingerprint = await generateMediaFingerprint(asset);
        if (fingerprint) {
          const metadata = useEditorStore.getState().project.mediaMetadata[asset.id];
          useEditorStore.getState().setMediaMetadata(asset.id, { ...metadata, fingerprint });
        }
      } catch {
        // Fingerprints improve duplicate detection but must not block local import.
      }
    }
  }, []);

  const applyImportedMediaColorConversionChoice = useCallback(async (media: MediaAsset[]): Promise<MediaAsset[]> => {
    const workingColorSpace = normalizeProjectWorkingColorSpace(useEditorStore.getState().project.settings.workingColorSpace);
    const mismatched = media.filter((asset) => asset.colorProfile && asset.colorProfile.sourceColorSpace !== workingColorSpace);
    if (mismatched.length === 0) {
      return media;
    }
    const confirmed = await bridgeConfirm(zhCN.editorToasts.colorConversionPrompt(mismatched.length, getColorSpaceDisplayName(workingColorSpace)), {
      title: zhCN.settings.general.workingColorSpace
    });
    if (!confirmed) {
      return media;
    }
    return media.map((asset) =>
      asset.colorProfile && asset.colorProfile.sourceColorSpace !== workingColorSpace
        ? { ...asset, colorProfile: { ...asset.colorProfile, autoConvertToWorkingSpace: true } }
        : asset
    );
  }, []);

  const queueFrameRateConversionForImportedMedia = useCallback(
    async (media: MediaAsset[]) => {
      const project = useEditorStore.getState().project;
      if (project.settings.vfrHandling === 'ignore') {
        return;
      }
      const frameRateMedia = media.filter((asset) => asset.type === 'video' && (asset.variableFrameRate || isFrameRateMismatch(asset.frameRate, project.settings.fps)));
      if (frameRateMedia.length === 0) {
        return;
      }
      if (project.settings.vfrHandling === 'ask') {
        const shouldConvert = await bridgeConfirm(zhCN.editorToasts.frameRateConversionPrompt(frameRateMedia.length, getProjectFrameRateConversionTarget(project.settings.fps)), {
          title: zhCN.editorToasts.frameRateConversionPromptTitle,
          kind: 'warning'
        });
        if (!shouldConvert) {
          return;
        }
      }
      for (const asset of frameRateMedia) {
        const cfrFrameRate = isFrameRateMismatch(asset.frameRate, project.settings.fps)
          ? getProjectFrameRateConversionTarget(project.settings.fps)
          : getProjectFrameRateConversionTarget(project.settings.fps, asset.frameRate ?? project.settings.fps);
        useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], useProxySettingsStore.getState().settings, {
          force: true,
          cfrFrameRate
        });
      }
      void ensureMediaJobRunner();
    },
    []
  );

  // --- 媒体导入 ---
  const importMedia = useCallback(async () => {
    try {
      const paths = await pickMediaPaths();
      if (paths.length === 0) {
        return;
      }
      const project = useEditorStore.getState().project;
      const result = await probeMediaPaths(paths, project.media);
      if (result.duplicateCount > 0) {
        showToast({ kind: 'info', title: zhCN.editorToasts.duplicateTitle, message: zhCN.editorToasts.duplicateMessage(result.duplicateCount) });
      }
      if (result.media.length > 0) {
        const importedMedia = await applyImportedMediaColorConversionChoice(result.media);
        useEditorStore.getState().addMedia(importedMedia);
        await persistMediaFingerprints(importedMedia);
        await queueFrameRateConversionForImportedMedia(importedMedia);
        void runAutomationForMedia('on-import', importedMedia);
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaImported, message: zhCN.editorToasts.mediaImportedMessage(result.media.length) });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.importFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.importFailedMessage });
    }
  }, [applyImportedMediaColorConversionChoice, persistMediaFingerprints, queueFrameRateConversionForImportedMedia, runAutomationForMedia]);

  const addVersionForMedia = useCallback(
    async (assetId: string) => {
      const currentProject = useEditorStore.getState().project;
      const asset = currentProject.media.find((item) => item.id === assetId);
      if (!asset) {
        showToast({ kind: 'error', title: zhCN.editorToasts.mediaVersionAddFailed, message: zhCN.editorToasts.mediaVersionMissingAsset });
        return;
      }
      try {
        const paths = await pickMediaPaths();
        const path = paths[0];
        if (!path) {
          return;
        }
        if (path === asset.path) {
          showToast({ kind: 'warning', title: zhCN.editorToasts.mediaVersionAddFailed, message: zhCN.editorToasts.mediaVersionSameFile });
          return;
        }
        const latestProject = useEditorStore.getState().project;
        const existing = latestProject.media.find((item) => item.path === path);
        const result = existing ? { media: [] as MediaAsset[], duplicateCount: 1 } : await probeMediaPaths([path], latestProject.media);
        const importedMedia = result.media.length > 0 ? await applyImportedMediaColorConversionChoice(result.media) : result.media;
        const versionAsset = existing ?? importedMedia[0];
        if (!versionAsset) {
          showToast({ kind: 'error', title: zhCN.editorToasts.mediaVersionAddFailed, message: zhCN.editorToasts.importFailedMessage });
          return;
        }
        if (versionAsset.type !== asset.type) {
          showToast({ kind: 'error', title: zhCN.editorToasts.mediaVersionAddFailed, message: zhCN.editorToasts.mediaVersionTypeMismatch });
          return;
        }
        if (importedMedia.length > 0) {
          useEditorStore.getState().addMedia(importedMedia);
          await persistMediaFingerprints(importedMedia);
          await queueFrameRateConversionForImportedMedia(importedMedia);
          void runAutomationForMedia('on-import', importedMedia);
        }
        const metadata = useEditorStore.getState().project.mediaMetadata[assetId];
        const { addMediaVersion } = await import('@open-factory/editor-core');
        useEditorStore.getState().setMediaMetadata(assetId, addMediaVersion(metadata, versionAsset));
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaVersionAdded, message: zhCN.editorToasts.mediaVersionAddedMessage(versionAsset.name) });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.mediaVersionAddFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.importFailedMessage });
      }
    },
    [applyImportedMediaColorConversionChoice, persistMediaFingerprints, queueFrameRateConversionForImportedMedia, runAutomationForMedia]
  );

  const openBatchTranscode = useCallback((paths: string[] = []) => {
    useEditorFeatureStore.getState().setBatchTranscodeInitialPaths(paths);
    useEditorUIStore.getState().setBatchTranscodeOpen(true);
  }, []);

  const batchGenerateCovers = useCallback(async () => {
    const tasks = buildCoverFrameBatchTasks(useEditorStore.getState().project.media);
    if (tasks.length === 0) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.coverBatchFailed, message: zhCN.editorToasts.coverBatchNoVideo });
      return;
    }
    try {
      const projectPath = useEditorStore.getState().projectPath;
      const baseDir = projectPath ? dirname(projectPath) : await getAppDataDir();
      const result = await batchExtractCoverFrames({
        outputDir: joinLocalPath(baseDir, 'covers'),
        tasks
      });
      const completed = result.results.filter((item) => item.status === 'completed').length;
      if (completed === 0) {
        showToast({ kind: 'error', title: zhCN.editorToasts.coverBatchFailed, message: result.results.find((item) => item.error)?.error ?? zhCN.editorToasts.coverBatchFailedMessage });
        return;
      }
      showToast({ kind: 'success', title: zhCN.editorToasts.coverBatchCompleted, message: zhCN.editorToasts.coverBatchCompletedMessage(completed) });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.coverBatchFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.coverBatchFailedMessage });
    }
  }, []);

  // --- 媒体文件夹 ---
  const createMediaFolder = useCallback((parentId?: string | null) => {
    try {
      commandManager.execute(new AddMediaFolderCommand(projectAccessor, { name: zhCN.mediaBin.newFolder, parentId }));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.mediaBin.newFolder, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }, []);

  const renameMediaFolder = useCallback((folderId: string, name: string) => {
    commandManager.execute(new RenameMediaFolderCommand(projectAccessor, folderId, name));
  }, []);

  const deleteMediaFolder = useCallback((folderId: string) => {
    commandManager.execute(new DeleteMediaFolderCommand(projectAccessor, folderId));
  }, []);

  const setMediaFolderCollapsed = useCallback((folderId: string, collapsed: boolean) => {
    commandManager.execute(new SetMediaFolderCollapsedCommand(projectAccessor, folderId, collapsed));
  }, []);

  const moveMediaToFolder = useCallback((assetIds: string[], folderId?: string | null) => {
    commandManager.execute(new MoveMediaToFolderCommand(projectAccessor, assetIds, folderId));
  }, []);

  const batchUpdateMediaMetadata = useCallback((assetIds: string[], metadata: BatchEditableMediaMetadata) => {
    if (assetIds.length === 0) {
      return;
    }
    commandManager.execute(new BatchUpdateMetadataCommand(projectAccessor, assetIds.map((assetId) => ({ assetId, metadata }))));
    showToast({ kind: 'success', title: zhCN.mediaBin.batchEditMetadata, message: zhCN.mediaBin.batchMetadataUpdated(assetIds.length) });
  }, []);

  const batchRenameMedia = useCallback(async (_assetIds: string[], preview: MediaRenamePreviewItem[], renameFiles: boolean) => {
    const state = useEditorStore.getState();
    const assetById = new Map(state.project.media.map((asset) => [asset.id, asset]));
    const renamePlan = preview
      .filter((item) => item.changed)
      .map((item) => {
        const asset = assetById.get(item.assetId);
        return asset
          ? {
              assetId: item.assetId,
              name: item.nextName,
              oldPath: asset.path,
              nextPath: renameFiles ? replaceMediaPathBasename(asset.path, item.nextName) : asset.path
            }
          : undefined;
      })
      .filter((item): item is { assetId: string; name: string; oldPath: string; nextPath: string } => Boolean(item));
    if (renamePlan.length === 0) {
      return;
    }
    let commandExecuted = false;
    try {
      commandManager.execute(
        new BatchRenameMediaCommand(
          projectAccessor,
          renamePlan.map((item) => ({
            assetId: item.assetId,
            name: item.name,
            path: renameFiles ? item.nextPath : undefined
          }))
        )
      );
      commandExecuted = true;
      if (renameFiles) {
        for (const item of renamePlan) {
          if (item.oldPath !== item.nextPath) {
            await bridgeMoveFile(item.oldPath, item.nextPath);
          }
        }
      }
      showToast({ kind: 'success', title: zhCN.mediaBin.batchRename, message: zhCN.mediaBin.batchRenameCompleted(renamePlan.length) });
    } catch (error) {
      if (commandExecuted && renameFiles) {
        commandManager.undo();
      }
      showToast({
        kind: 'error',
        title: zhCN.mediaBin.batchRenameFailed,
        message: error instanceof Error ? error.message : zhCN.mediaBin.batchRenameFailedMessage
      });
    }
  }, []);

  // --- 重链接 ---
  const relinkMedia = useCallback(
    async (assetId: string) => {
      const project = useEditorStore.getState().project;
      const asset = project.media.find((item) => item.id === assetId);
      if (!asset) {
        return;
      }
      try {
        const relinked = await relinkSingleMedia(asset);
        if (!relinked) {
          return;
        }
        useEditorStore.getState().setMedia(project.media.map((item) => (item.id === assetId ? relinked : item)));
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaRelinked, message: relinked.name });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.relinkFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.relinkFailedMessage });
      }
    },
    []
  );

  const relinkAllMissing = useCallback(async () => {
    try {
      const project = useEditorStore.getState().project;
      const result = await relinkMissingMediaInDirectory(project.media);
      useEditorStore.getState().setMedia(result.media);
      showToast({
        kind: result.relinkedCount > 0 ? 'success' : 'warning',
        title: zhCN.editorToasts.relinkComplete,
        message: zhCN.editorToasts.relinkCompleteMessage(result.relinkedCount, result.warnings.length)
      });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.relinkFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.relinkMissingFailedMessage });
    }
  }, []);

  // --- 重复媒体 ---
  const scanDuplicateMedia = useCallback(async () => {
    try {
      const currentProject = useEditorStore.getState().project;
      const groups = await scanDuplicateMediaGroups(currentProject.media, currentProject.mediaMetadata);
      if (groups.length === 0) {
        showToast({ kind: 'info', title: zhCN.duplicateMedia.empty });
        return;
      }
      useEditorFeatureStore.getState().setDuplicateMediaGroups(groups);
      useEditorUIStore.getState().setDuplicateMediaOpen(true);
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.duplicateMedia.scanFailed,
        message: error instanceof Error ? error.message : zhCN.duplicateMedia.scanFailedMessage
      });
    }
  }, []);

  const mergeDuplicateMediaGroups = useCallback((selections: DuplicateMediaMergeSelection[]) => {
    try {
      for (const selection of selections) {
        commandManager.execute(new MergeMediaCommand(projectAccessor, selection.keepAssetId, selection.assetIds));
      }
      useEditorUIStore.getState().setDuplicateMediaOpen(false);
      useEditorFeatureStore.getState().setDuplicateMediaGroups([]);
      showToast({ kind: 'success', title: zhCN.duplicateMedia.mergedTitle, message: zhCN.duplicateMedia.mergedMessage(selections.length) });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
    }
  }, []);

  // --- 媒体整理 ---
  const refreshMediaOrganizer = useCallback(async () => {
    useEditorFeatureStore.getState().setMediaOrganizerScanning(true);
    try {
      const currentProject = useEditorStore.getState().project;
      const [groups, cleanup] = await Promise.all([
        scanSmartDuplicateMediaGroups(currentProject.media, currentProject.mediaMetadata),
        scanMediaCleanupReport(currentProject)
      ]);
      useEditorFeatureStore.getState().setMediaOrganizerGroups(groups);
      useEditorFeatureStore.getState().setMediaOrganizerCleanup(cleanup);
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.mediaOrganizer.scanFailed,
        message: error instanceof Error ? error.message : zhCN.mediaOrganizer.scanFailedMessage
      });
    } finally {
      useEditorFeatureStore.getState().setMediaOrganizerScanning(false);
    }
  }, []);

  const openMediaOrganizer = useCallback(() => {
    useEditorUIStore.getState().setMediaOrganizerOpen(true);
    void refreshMediaOrganizer();
  }, [refreshMediaOrganizer]);

  const confirmMediaOrganizerDuplicateGroups = useCallback(
    async (selections: MediaOrganizerDuplicateSelection[], moveFilesToTrash: boolean) => {
      try {
        const assetById = new Map(useEditorStore.getState().project.media.map((asset) => [asset.id, asset]));
        if (moveFilesToTrash) {
          for (const assetId of selections.flatMap((selection) => selection.removeAssetIds)) {
            const asset = assetById.get(assetId);
            if (asset) {
              await bridgeTrashFile(asset.path);
            }
          }
        }
        let removedCount = 0;
        for (const selection of selections) {
          commandManager.execute(new MergeMediaCommand(projectAccessor, selection.keepAssetId, [selection.keepAssetId, ...selection.removeAssetIds]));
          removedCount += selection.removeAssetIds.length;
        }
        showToast({ kind: 'success', title: zhCN.mediaOrganizer.removedTitle, message: zhCN.mediaOrganizer.removedMessage(removedCount) });
        void refreshMediaOrganizer();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshMediaOrganizer]
  );

  const removeMediaOrganizerReferences = useCallback(
    (assetIds: string[]) => {
      try {
        commandManager.execute(new RemoveMediaCommand(projectAccessor, assetIds));
        showToast({ kind: 'success', title: zhCN.mediaOrganizer.removedTitle, message: zhCN.mediaOrganizer.removedMessage(assetIds.length) });
        void refreshMediaOrganizer();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshMediaOrganizer]
  );

  const archiveUnusedMedia = useCallback(async () => {
    const cleanup = useEditorFeatureStore.getState().mediaOrganizerCleanup;
    const unused = cleanup?.unused ?? [];
    if (unused.length === 0) {
      return;
    }
    try {
      const archiveDir = await openDirectoryDialog();
      if (!archiveDir) {
        showToast({ kind: 'info', title: zhCN.mediaOrganizer.archiveCanceled });
        return;
      }
      const relinkEntries = [];
      for (let index = 0; index < unused.length; index += 1) {
        const asset = unused[index];
        const destination = buildArchiveDestinationPath(archiveDir, asset, index);
        await bridgeMoveFile(asset.path, destination);
        relinkEntries.push({ assetId: asset.id, newPath: destination });
      }
      const nextProject = applyArchiveRelinkPlan(useEditorStore.getState().project, relinkEntries);
      commandManager.execute(new LoadProjectCommand(projectAccessor, nextProject, zhCN.mediaOrganizer.archivedTitle));
      showToast({ kind: 'success', title: zhCN.mediaOrganizer.archivedTitle, message: zhCN.mediaOrganizer.archivedMessage(relinkEntries.length) });
      void refreshMediaOrganizer();
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.mediaOrganizer.archiveFailed, message: error instanceof Error ? error.message : zhCN.mediaOrganizer.archiveFailed });
    }
  }, [refreshMediaOrganizer]);

  const renameUnusedMedia = useCallback(
    async (template: string) => {
      const cleanup = useEditorFeatureStore.getState().mediaOrganizerCleanup;
      const unused = cleanup?.unused ?? [];
      if (unused.length === 0) {
        return;
      }
      try {
        const relinkEntries = [];
        for (let index = 0; index < unused.length; index += 1) {
          const asset = unused[index];
          const destination = buildRenameDestinationPath(asset, template, index);
          await bridgeMoveFile(asset.path, destination);
          relinkEntries.push({ assetId: asset.id, newPath: destination });
        }
        const nextProject = applyArchiveRelinkPlan(useEditorStore.getState().project, relinkEntries);
        commandManager.execute(new LoadProjectCommand(projectAccessor, nextProject, zhCN.mediaOrganizer.renameTitle));
        showToast({ kind: 'success', title: zhCN.mediaOrganizer.renameTitle, message: zhCN.mediaOrganizer.archivedMessage(relinkEntries.length) });
        void refreshMediaOrganizer();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshMediaOrganizer]
  );

  // --- 合规 ---
  const conformMedia = useCallback(async () => {
    try {
      const directory = await openDirectoryDialog();
      if (!directory) {
        showToast({ kind: 'info', title: zhCN.conformMedia.canceledTitle });
        return;
      }
      const paths = await scanDirectory(directory, 3);
      const currentProject = useEditorStore.getState().project;
      const matches = matchConformByFilename(
        currentProject.media,
        paths.map((path) => ({ path })),
        { caseInsensitive: true }
      );
      const preflight = buildConformPreflight(currentProject.media, matches, { fallbackFrameRate: currentProject.settings.fps });
      const replacements = buildConformMediaReplacements(preflight);
      const report = buildConformReport(preflight, { selectedOnly: true });

      if (replacements.length === 0) {
        showToast({ kind: 'warning', title: zhCN.conformMedia.noMatchesTitle, message: zhCN.conformMedia.noMatchesMessage });
        return;
      }

      commandManager.execute(new ConformMediaCommand(projectAccessor, replacements, zhCN.conformMedia.commandDescription));
      showToast({
        kind: report.failureCount > 0 || report.warningCount > 0 ? 'warning' : 'success',
        title: zhCN.conformMedia.completedTitle,
        message: zhCN.conformMedia.completedMessage(report.successCount, report.warningCount, report.failureCount)
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.conformMedia.failedTitle,
        message: error instanceof Error ? error.message : zhCN.conformMedia.failedMessage
      });
    }
  }, []);

  // --- 子剪辑 ---
  const handleAddSubclip = useCallback((subclip: Subclip) => {
    commandManager.execute(new AddSubclipCommand(projectAccessor, subclip));
    showToast({ kind: 'success', title: zhCN.subclip.newSubclip, message: subclip.name });
  }, []);

  const handleUpdateSubclip = useCallback((subclipId: string, patch: Partial<Subclip>) => {
    commandManager.execute(new UpdateSubclipCommand(projectAccessor, subclipId, patch));
  }, []);

  const handleDeleteSubclip = useCallback((subclipId: string) => {
    commandManager.execute(new DeleteSubclipCommand(projectAccessor, subclipId));
    showToast({ kind: 'info', title: zhCN.subclip.deleteSubclip, message: '' });
  }, []);

  // --- 跳转媒体 ---
  const jumpToMediaAsset = useCallback((assetId: string) => {
    const element = document.querySelector(`[data-testid="media-card-${assetId}"]`) as HTMLElement | null;
    element?.scrollIntoView({ block: 'center', inline: 'nearest' });
    element?.focus();
  }, []);

  // --- 版本号 ---
  const updateProjectReleaseVersion = useCallback((version: string) => {
    commandManager.execute(new UpdateProjectReleaseVersionCommand(projectAccessor, version));
  }, []);

  return {
    refreshSharedLibraryResources,
    persistMediaFingerprints,
    applyImportedMediaColorConversionChoice,
    queueFrameRateConversionForImportedMedia,
    importMedia,
    addVersionForMedia,
    openBatchTranscode,
    batchGenerateCovers,
    createMediaFolder,
    renameMediaFolder,
    deleteMediaFolder,
    setMediaFolderCollapsed,
    moveMediaToFolder,
    batchUpdateMediaMetadata,
    batchRenameMedia,
    relinkMedia,
    relinkAllMissing,
    scanDuplicateMedia,
    mergeDuplicateMediaGroups,
    refreshMediaOrganizer,
    openMediaOrganizer,
    confirmMediaOrganizerDuplicateGroups,
    removeMediaOrganizerReferences,
    archiveUnusedMedia,
    renameUnusedMedia,
    conformMedia,
    handleAddSubclip,
    handleUpdateSubclip,
    handleDeleteSubclip,
    jumpToMediaAsset,
    updateProjectReleaseVersion,
  };
}
