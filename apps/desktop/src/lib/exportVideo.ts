import { buildExportProjectFromProject, buildFfmpegExportPlan, timelineHasExportableVideo, type Project } from '@open-factory/editor-core';
import { cancelExport as bridgeCancelExport, getFfmpegCapabilities, listenBridge, openPath, runExport, saveFileDialog } from './tauri-bridge';
import { normalizeExportProgressPayload, type ExportProgressEvent } from '../export/export-progress';

export interface ExportCallbacks {
  onProgress(progress: number): void;
  onWarnings?(warnings: string[]): void;
}

export async function chooseExportPath(project: Project, format = 'mp4'): Promise<string | undefined> {
  const extension = normalizeExportExtension(format);
  return saveFileDialog(`${project.name || 'open-factory-export'}.${extension}`, [{ name: `${extension.toUpperCase()} export`, extensions: [extension] }]);
}

export async function startExport(project: Project, outputPath: string, callbacks: ExportCallbacks): Promise<void> {
  if (!timelineHasExportableVideo(project.timeline)) {
    throw new Error('Please add video clips to the timeline before exporting.');
  }
  const capabilities = await getFfmpegCapabilities();
  if (!capabilities.available) {
    throw new Error('ffmpeg was not found. Install it with winget install ffmpeg, brew install ffmpeg, or apt install ffmpeg.');
  }
  const exportProject = buildExportProjectFromProject(project, { outputPath });
  const plan = buildFfmpegExportPlan(exportProject, capabilities);
  callbacks.onWarnings?.(plan.warnings);

  const unlisten = await listenBridge<ExportProgressEvent>('export-progress', (progress) => callbacks.onProgress(normalizeExportProgressPayload(progress)));
  try {
    await runExport(plan);
    callbacks.onProgress(1);
  } finally {
    unlisten();
  }
}

export async function cancelExport(): Promise<void> {
  await bridgeCancelExport();
}

export async function revealExport(path: string): Promise<void> {
  const folder = path.replace(/[\\/][^\\/]+$/, '');
  await openPath(folder);
}

function normalizeExportExtension(format: string): string {
  const value = format.toLowerCase();
  return value === 'mov' || value === 'webm' || value === 'm4a' ? value : 'mp4';
}
