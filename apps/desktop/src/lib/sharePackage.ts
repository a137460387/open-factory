import { dirname, joinPath, normalizePath, type ExportTask, type Project } from '@open-factory/editor-core';
import { enqueueExport } from '../export/export-queue-runner';
import { BUILTIN_EXPORT_PRESETS, type ExportPresetSettings } from '../export/export-presets';
import { useExportQueueStore } from '../export/export-queue-store';
import { zhCN } from '../i18n/strings';
import { createProjectArchivePlan, serializeArchivedProject } from './projectArchive';
import {
  createSharePackageZip,
  getAppDataDir,
  listenBridge,
  removeFile,
  saveFileDialog,
  type FileDialogFilter,
  type SharePackageProgressEvent,
  type SharePackageRequest,
  type SharePackageResult
} from './tauri-bridge';

type SharePackageWorkflowStage = 'exporting' | SharePackageProgressEvent['stage'];

export interface SharePackageWorkflowProgress {
  stage: SharePackageWorkflowStage;
  progress: number;
  current: number;
  total: number;
  outputPath: string;
}

export interface SharePackageWorkflowDependencies {
  chooseOutputPath(project: Project): Promise<string | undefined> | string | undefined;
  getAppDataDir(): Promise<string> | string;
  enqueueExport(project: Project, outputPath: string, settings: ExportPresetSettings): Promise<ExportTask> | ExportTask;
  waitForExportTask(taskId: string, onProgress?: (task: ExportTask) => void): Promise<ExportTask>;
  createSharePackageZip(request: SharePackageRequest): Promise<SharePackageResult> | SharePackageResult;
  removeFile(path: string): Promise<void> | void;
  listenToPackageProgress(handler: (progress: SharePackageProgressEvent) => void): Promise<() => void> | (() => void);
  now(): number;
}

export async function createSharePackageFromProject(
  project: Project,
  options: {
    onProgress?: (progress: SharePackageWorkflowProgress) => void;
    dependencies?: Partial<SharePackageWorkflowDependencies>;
  } = {}
): Promise<SharePackageResult | undefined> {
  const dependencies = { ...defaultSharePackageDependencies, ...options.dependencies };
  const outputPath = await dependencies.chooseOutputPath(project);
  if (!outputPath) {
    return undefined;
  }

  const appDataDir = await dependencies.getAppDataDir();
  const temporaryVideoPath = joinPath(appDataDir, `${sanitizeFileBaseName(project.name)}-share-${dependencies.now()}.mp4`);
  const normalizedOutputPath = normalizePath(outputPath);
  let cleanupTemporaryVideo = false;

  try {
    options.onProgress?.({ stage: 'exporting', progress: 0, current: 0, total: 1, outputPath: normalizedOutputPath });
    const task = await dependencies.enqueueExport(project, temporaryVideoPath, sharePackageExportSettings());
    cleanupTemporaryVideo = true;
    await dependencies.waitForExportTask(task.id, (updatedTask) => {
      options.onProgress?.({
        stage: 'exporting',
        progress: updatedTask.progress,
        current: updatedTask.status === 'success' ? 1 : 0,
        total: 1,
        outputPath: normalizedOutputPath
      });
    });

    const request = buildSharePackageRequest(project, normalizedOutputPath, temporaryVideoPath);
    const unlisten = await dependencies.listenToPackageProgress((progress) => {
      if (normalizePath(progress.outputPath) !== normalizedOutputPath) {
        return;
      }
      options.onProgress?.({
        stage: progress.stage,
        progress: progress.progress,
        current: progress.current,
        total: progress.total,
        outputPath: normalizedOutputPath
      });
    });
    try {
      return await dependencies.createSharePackageZip(request);
    } finally {
      unlisten();
    }
  } finally {
    if (cleanupTemporaryVideo) {
      await Promise.resolve(dependencies.removeFile(temporaryVideoPath)).catch((error) => {
        console.warn(zhCN.sharePackage.cleanupFailed, error);
      });
    }
  }
}

export function buildSharePackageRequest(project: Project, outputPath: string, exportedVideoPath: string): SharePackageRequest {
  const normalizedOutputPath = normalizePath(outputPath);
  const plan = createProjectArchivePlan(project, dirname(normalizedOutputPath));
  const projectFileName = fileNameFromPath(plan.projectPath) || `${sanitizeFileBaseName(project.name)}.cutproj.json`;
  const exportedVideoArchivePath = `export/${sanitizeFileBaseName(project.name)}.mp4`;
  return {
    outputPath: normalizedOutputPath,
    projectFileName,
    projectContents: serializeArchivedProject(plan.project),
    readmeContents: zhCN.sharePackage.readme(project.name, projectFileName, exportedVideoArchivePath),
    exportedVideo: {
      sourcePath: normalizePath(exportedVideoPath),
      archivePath: exportedVideoArchivePath
    },
    mediaFiles: plan.copyTasks.map((task) => ({
      sourcePath: task.sourcePath,
      archivePath: task.relativePath
    }))
  };
}

function waitForSharePackageExportTask(taskId: string, onProgress?: (task: ExportTask) => void): Promise<ExportTask> {
  const current = useExportQueueStore.getState().tasks.find((task) => task.id === taskId);
  if (current) {
    onProgress?.(current);
    const outcome = getExportTaskOutcome(current);
    if (outcome) {
      return outcome;
    }
  }

  return new Promise((resolve, reject) => {
    const unsubscribe = useExportQueueStore.subscribe((state) => {
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      onProgress?.(task);
      const outcome = getExportTaskOutcome(task);
      if (!outcome) {
        return;
      }
      unsubscribe();
      outcome.then(resolve, reject);
    });
  });
}

function getExportTaskOutcome(task: ExportTask): Promise<ExportTask> | undefined {
  if (task.status === 'success') {
    return Promise.resolve(task);
  }
  if (task.status === 'error') {
    return Promise.reject(new Error(task.error || zhCN.sharePackage.exportFailed));
  }
  if (task.status === 'canceled') {
    return Promise.reject(new Error(zhCN.sharePackage.exportCanceled));
  }
  return undefined;
}

function sharePackageExportSettings(): ExportPresetSettings {
  return {
    ...BUILTIN_EXPORT_PRESETS[0].settings,
    format: 'mp4',
    outputMode: 'video',
    hardwareEncoding: false
  };
}

function chooseSharePackageOutputPath(project: Project): Promise<string | undefined> {
  const filters: FileDialogFilter[] = [{ name: zhCN.sharePackage.fileDialogFilter, extensions: ['zip'] }];
  return saveFileDialog(`${sanitizeFileBaseName(project.name)}.zip`, filters);
}

function listenToPackageProgress(handler: (progress: SharePackageProgressEvent) => void): Promise<() => void> {
  return listenBridge<SharePackageProgressEvent>('share-package-progress', handler);
}

function fileNameFromPath(path: string): string {
  return normalizePath(path).split('/').filter(Boolean).pop() ?? '';
}

function sanitizeFileBaseName(name: string): string {
  const trimmed = name.trim().replace(/\.cutproj(?:\.json)?$/i, '') || 'open-factory-project';
  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_').replace(/\s+/g, ' ').trim() || 'open-factory-project';
}

const defaultSharePackageDependencies: SharePackageWorkflowDependencies = {
  chooseOutputPath: chooseSharePackageOutputPath,
  getAppDataDir,
  enqueueExport,
  waitForExportTask: waitForSharePackageExportTask,
  createSharePackageZip,
  removeFile,
  listenToPackageProgress,
  now: () => Date.now()
};
