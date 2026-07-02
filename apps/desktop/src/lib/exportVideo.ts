import { buildExportProjectFromProject, buildFfmpegCurrentFrameExportPlan, timelineHasExportableVideo, type Project } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { getFfmpegCapabilities, openDirectoryDialog, openPath, runExport, saveFileDialog } from './tauri-bridge';

export interface ExportCallbacks {
  onProgress(progress: number): void;
  onWarnings?(warnings: string[]): void;
}

export async function chooseExportPath(project: Project, format = 'mp4'): Promise<string | undefined> {
  if (format === 'png-sequence') {
    return openDirectoryDialog();
  }
  const extension = normalizeExportExtension(format);
  return saveFileDialog(`${project.name || 'open-factory-export'}.${extension}`, [{ name: zhCN.exportDialog.exportFilterName(extension), extensions: [extension] }]);
}

export async function chooseCurrentFrameExportPath(project: Project, time: number): Promise<string | undefined> {
  const frameMs = Math.max(0, Math.round(time * 1000));
  return saveFileDialog(`${project.name || 'open-factory-frame'}-${frameMs}ms.png`, [
    { name: zhCN.exportDialog.framePngFilterName, extensions: ['png'] },
    { name: zhCN.exportDialog.frameJpegFilterName, extensions: ['jpg', 'jpeg'] }
  ]);
}

export async function startCurrentFrameExport(project: Project, outputPath: string, time: number, callbacks: ExportCallbacks = { onProgress: () => undefined }): Promise<void> {
  if (!timelineHasExportableVideo(project.timeline)) {
    throw new Error(zhCN.errors.exportNeedsVideo);
  }
  const capabilities = await getFfmpegCapabilities();
  if (!capabilities.available) {
    throw new Error(zhCN.errors.ffmpegMissing);
  }
  const exportProject = buildExportProjectFromProject(project, {
    outputPath,
    settings: { format: normalizeFrameExportExtension(outputPath), outputMode: 'video', audioCodec: 'aac' }
  });
  const plan = buildFfmpegCurrentFrameExportPlan(exportProject, time, capabilities);
  callbacks.onWarnings?.(plan.warnings);
  await runExport(plan);
  callbacks.onProgress(1);
}

export async function revealExport(path: string): Promise<void> {
  const folder = path.replace(/[\\/][^\\/]+$/, '');
  await openPath(folder);
}

function normalizeExportExtension(format: string): string {
  const value = format.toLowerCase();
  return value === 'mov' || value === 'mkv' || value === 'webm' || value === 'm4a' || value === 'gif' || value === 'webp' || value === 'apng' ? value : 'mp4';
}

function normalizeFrameExportExtension(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  return extension === 'jpg' || extension === 'jpeg' ? 'jpg' : 'png';
}
