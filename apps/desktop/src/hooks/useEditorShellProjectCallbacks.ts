import { useCallback } from 'react';
import {
  LoadProjectCommand,
  NewProjectCommand,
  createProject,
  getTimelineDuration,
  instantiateProjectTemplate,
  type Project,
} from '@open-factory/editor-core';
import {
  chooseProjectSavePath,
  chooseProjectToOpen,
  confirmDiscardChanges,
  deleteAutosaveAfterSave,
  isEncryptedProjectPath,
  readProjectFile,
  setActiveProjectEncryptionPassword,
  writeProjectFile,
  type ProjectFileEncryptionOptions,
} from '../lib/projectFiles';
import { bridgeConfirm } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { zhCN } from '../i18n/strings';
import { dirname } from '@open-factory/editor-core';
import { readBackupSettings } from '../settings/appSettings';
import { createProjectArchivePlan, writeProjectArchive } from '../lib/projectArchive';
import { collectProjectArchivePreflight } from '../lib/mediaReport';
import { saveProjectSnapshot } from '../lib/projectSnapshots';
import { applyTimelineVersionDiffSelection, replaceProjectActiveTimeline } from '@open-factory/editor-core';
import { commandManager, projectAccessor } from '../store/commandManager';
import { useEditorStore } from '../store/editorStore';
import { useEditorSettingsStore } from '../store/editorSettingsStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';
import { useEditorUIStore } from '../store/editorUIStore';
import { copyFile as bridgeCopyFile, openDirectoryDialog, writeFile as bridgeWriteFile } from '../lib/tauri-bridge';
import {
  normalizeTutorialProgressSettings,
  skipTutorialProgress,
  DEFAULT_TUTORIAL_SIGNALS,
} from '../tutorial/tutorialState';
import { saveTutorialProgressSettings } from '../settings/appSettings';
import type { ExportPreset } from '../export/export-presets';
import type { ProjectTemplateId } from '@open-factory/editor-core';

function projectTemplateCopy(templateId: ProjectTemplateId): { name: string; description: string } {
  const templates = zhCN.projectTemplates.templates;
  switch (templateId) {
    case 'vertical-short':
      return templates.verticalShort;
    case 'youtube-horizontal':
      return templates.youtubeHorizontal;
    case 'square-social':
      return templates.squareSocial;
    case 'podcast':
      return templates.podcast;
    case 'cinema':
      return templates.cinema;
  }
}

/**
 * 从 EditorShell 中提取的项目文件操作回调。
 * 涵盖新建、打开、保存、加密保存、归档、快照、教程，约 350 行。
 */
export function useEditorShellProjectCallbacks() {
  const requestProjectPassword = useCallback((title: string, description: string) => {
    return new Promise<string | undefined>((resolve) => {
      useEditorFeatureStore.getState().setProjectPasswordRequest({ title, description, resolve });
    });
  }, []);

  const saveProject = useCallback(async (options: ProjectFileEncryptionOptions = {}) => {
    const state = useEditorStore.getState();
    const project = state.project;
    const projectPath = state.projectPath;
    const encryptedSave = options.encrypted === true;
    const nextPath =
      projectPath && !encryptedSave
        ? projectPath
        : await chooseProjectSavePath(
            `${project.name}${encryptedSave ? '.cutproj.enc' : '.cutproj.json'}`,
            encryptedSave,
          );
    if (!nextPath && !projectPath) {
      return;
    }
    const targetPath = nextPath ?? projectPath;
    if (!targetPath) {
      return;
    }
    await writeProjectFile(project, targetPath, {
      ...options,
      encrypted: encryptedSave || isEncryptedProjectPath(targetPath),
    });
    await deleteAutosaveAfterSave(targetPath, projectPath);
    try {
      useEditorSettingsStore.getState().setLastBackupAt((await readBackupSettings()).lastBackupAt);
    } catch (error) {
      console.warn(zhCN.settings.backup.statusSaveFailed, error);
    }
    state.setProjectPath(targetPath);
    state.setDirty(false);
    useEditorSettingsStore.getState().setTutorialSignals((current) => ({ ...current, projectSaved: true }));
    showToast({ kind: 'success', title: zhCN.editorToasts.projectSaved });
  }, []);

  const saveEncryptedProject = useCallback(() => {
    useEditorUIStore.getState().setProjectEncryptionSaveOpen(true);
  }, []);

  const startTutorial = useCallback(() => {
    const nextProgress = normalizeTutorialProgressSettings({
      tutorialStep: 0,
      tutorialSkipped: false,
      tutorialCompleted: false,
    });
    useEditorSettingsStore.getState().setTutorialCelebrationVisible(false);
    useEditorSettingsStore.getState().setTutorialSignals(DEFAULT_TUTORIAL_SIGNALS);
    useEditorSettingsStore.getState().setTutorialProgress(nextProgress);
    void saveTutorialProgressSettings(nextProgress).catch((error) => {
      console.warn('Unable to save tutorial progress settings', error);
    });
  }, []);

  const skipTutorial = useCallback(() => {
    useEditorSettingsStore.getState().setTutorialCelebrationVisible(false);
    useEditorSettingsStore.getState().setTutorialProgress((current) => {
      const nextProgress = skipTutorialProgress(current ?? normalizeTutorialProgressSettings(undefined));
      void saveTutorialProgressSettings(nextProgress).catch((error) => {
        console.warn('Unable to save tutorial progress settings', error);
      });
      return nextProgress;
    });
  }, []);

  const closeTutorialCelebration = useCallback(() => {
    useEditorSettingsStore.getState().setTutorialCelebrationVisible(false);
  }, []);

  const confirmProjectEncryptionSave = useCallback(
    async (options: ProjectFileEncryptionOptions) => {
      useEditorUIStore.getState().setProjectEncryptionSaveOpen(false);
      await saveProject(options);
    },
    [saveProject],
  );

  const archiveCurrentProject = useCallback(async () => {
    try {
      const state = useEditorStore.getState();
      const project = state.project;
      const projectPath = state.projectPath;
      const preflight = await collectProjectArchivePreflight(project);
      if (preflight.missingRows.length > 0) {
        const shouldContinue = await bridgeConfirm(
          zhCN.projectArchive.missingMediaConfirm(preflight.missingRows.length),
          {
            title: zhCN.projectArchive.title,
            kind: 'warning',
          },
        );
        if (!shouldContinue) {
          return;
        }
      }
      const archiveParentDir = projectPath ? dirname(projectPath) : await openDirectoryDialog();
      if (!archiveParentDir) {
        return;
      }
      const plan = createProjectArchivePlan(project, archiveParentDir, { skipSourcePaths: preflight.missingPaths });
      useEditorFeatureStore
        .getState()
        .setArchiveProgress({ copied: 0, total: plan.copyTasks.filter((task) => task.copyRequired).length });
      await writeProjectArchive(plan, { copyFile: bridgeCopyFile, writeFile: bridgeWriteFile }, (progress) =>
        useEditorFeatureStore.getState().setArchiveProgress(progress),
      );
      commandManager.clear();
      state.setProject(plan.project, plan.projectPath);
      state.setProjectPath(plan.projectPath);
      state.setDirty(false);
      showToast({ kind: 'success', title: zhCN.projectArchive.success, message: plan.projectPath });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.projectArchive.failed,
        message: error instanceof Error ? error.message : zhCN.projectArchive.failedMessage,
      });
    } finally {
      useEditorFeatureStore.getState().setArchiveProgress(undefined);
    }
  }, []);

  const executeNewProject = useCallback(
    (nextProject: ReturnType<typeof createProject>, nextTemplatePreset?: ExportPreset) => {
      const state = useEditorStore.getState();
      commandManager.execute(
        new NewProjectCommand(
          {
            getProject: projectAccessor.getProject,
            setProject: (project) => state.setProject(project, undefined),
          },
          nextProject,
          zhCN.toolbar.newProject,
        ),
      );
      commandManager.clear();
      setActiveProjectEncryptionPassword(undefined);
      state.setProjectPath(undefined);
      state.setDirty(false);
      useEditorFeatureStore.getState().setTemplateExportPreset(nextTemplatePreset);
    },
    [],
  );

  const newProject = useCallback(async () => {
    const dirty = useEditorStore.getState().dirty;
    if (dirty && !(await confirmDiscardChanges())) {
      return;
    }
    executeNewProject(createProject(zhCN.project.defaultName));
  }, [executeNewProject]);

  const createProjectFromTemplate = useCallback(
    async (templateId: ProjectTemplateId) => {
      const dirty = useEditorStore.getState().dirty;
      if (dirty && !(await confirmDiscardChanges())) {
        return;
      }
      const copy = projectTemplateCopy(templateId);
      const instance = instantiateProjectTemplate(templateId, { name: copy.name });
      executeNewProject(instance.project, {
        id: `template-${templateId}`,
        name: copy.name,
        description: copy.description,
        builtin: true,
        settings: instance.exportSettings,
      });
      useEditorUIStore.getState().setProjectTemplateOpen(false);
    },
    [executeNewProject],
  );

  const createProjectFromTimelineTemplate = useCallback(
    async (nextProject: Project) => {
      const dirty = useEditorStore.getState().dirty;
      if (dirty && !(await confirmDiscardChanges())) {
        return;
      }
      executeNewProject(nextProject);
      useEditorFeatureStore.getState().setTimelineTemplateMode(undefined);
    },
    [executeNewProject],
  );

  const openProject = useCallback(async () => {
    try {
      const state = useEditorStore.getState();
      if (state.dirty && !(await confirmDiscardChanges())) {
        return;
      }
      const path = await chooseProjectToOpen();
      if (!path) {
        return;
      }
      const password = isEncryptedProjectPath(path)
        ? await requestProjectPassword(zhCN.projectFiles.encryptedOpenTitle, zhCN.projectFiles.encryptedOpenDescription)
        : undefined;
      if (isEncryptedProjectPath(path) && !password) {
        return;
      }
      const nextProject = await readProjectFile(path, path, { password });
      commandManager.clear();
      state.setProject(nextProject, path);
      // Note: runAutomationForMedia will be called from the component
      useEditorFeatureStore.getState().setTemplateExportPreset(undefined);
      showToast({ kind: 'success', title: zhCN.editorToasts.projectOpened });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.editorToasts.openFailed,
        message: error instanceof Error ? error.message : zhCN.editorToasts.openFailedMessage,
      });
    }
  }, [requestProjectPassword]);

  // --- 快照 ---
  const saveNamedSnapshot = useCallback(async (name: string) => {
    try {
      const state = useEditorStore.getState();
      const snapshot = await saveProjectSnapshot(state.project, name, state.projectPath);
      useEditorUIStore.getState().setSnapshotNameOpen(false);
      showToast({ kind: 'success', title: zhCN.projectSnapshots.saved, message: snapshot.name });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.projectSnapshots.saveFailed,
        message: error instanceof Error ? error.message : zhCN.projectSnapshots.saveFailed,
      });
    }
  }, []);

  const restoreSnapshotProject = useCallback((snapshotProject: Project) => {
    const state = useEditorStore.getState();
    commandManager.execute(
      new LoadProjectCommand(projectAccessor, snapshotProject, zhCN.projectSnapshots.restoreCommand),
    );
    state.clearSelectedClipIds();
    state.setPlayheadTime(0);
  }, []);

  const applySnapshotDiffSelection = useCallback((sourceProject: Project, itemIds: string[]) => {
    const state = useEditorStore.getState();
    const currentProject = state.project;
    const nextTimeline = applyTimelineVersionDiffSelection(currentProject.timeline, sourceProject.timeline, itemIds);
    const nextProject = replaceProjectActiveTimeline(currentProject, nextTimeline);
    commandManager.execute(new LoadProjectCommand(projectAccessor, nextProject, zhCN.projectSnapshots.appliedDiffs));
    state.clearSelectedClipIds();
    state.setPlayheadTime(0);
  }, []);

  return {
    requestProjectPassword,
    saveProject,
    saveEncryptedProject,
    startTutorial,
    skipTutorial,
    closeTutorialCelebration,
    confirmProjectEncryptionSave,
    archiveCurrentProject,
    executeNewProject,
    newProject,
    createProjectFromTemplate,
    createProjectFromTimelineTemplate,
    openProject,
    saveNamedSnapshot,
    restoreSnapshotProject,
    applySnapshotDiffSelection,
  };
}
