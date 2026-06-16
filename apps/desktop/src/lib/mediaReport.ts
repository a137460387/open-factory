import {
  buildOfflineMediaReportHtml,
  buildClipReportHtml,
  buildProjectArchivePreflight,
  collectOfflineMediaReportPaths,
  type OfflineMediaFileStatus,
  type Project,
  type ProjectArchivePreflight
} from '@open-factory/editor-core';
import { getLanguage, zhCN } from '../i18n/strings';
import { fsExists, getFileStat, saveFileDialog, writeClipReport, writeFile } from './tauri-bridge';

export async function collectOfflineMediaFileStatuses(project: Project): Promise<OfflineMediaFileStatus[]> {
  const paths = collectOfflineMediaReportPaths(project);
  return Promise.all(
    paths.map(async (path) => {
      const exists = await fsExists(path).catch(() => false);
      if (!exists) {
        return { path, exists: false };
      }
      const stat = await getFileStat(path).catch(() => undefined);
      return { path, exists: true, size: stat?.size };
    })
  );
}

export async function saveOfflineMediaReport(project: Project): Promise<string | undefined> {
  const outputPath = await saveFileDialog(`${project.name}-素材使用分析.html`, [{ name: zhCN.fileDialogs.htmlReport, extensions: ['html', 'htm'] }]);
  if (!outputPath) {
    return undefined;
  }
  const statuses = await collectOfflineMediaFileStatuses(project);
  await writeFile(outputPath, buildOfflineMediaReportHtml(project, statuses, { locale: getLanguage() }));
  return outputPath;
}

export async function saveClipReport(project: Project): Promise<string | undefined> {
  const outputPath = await saveFileDialog(`${project.name}-剪辑报告.html`, [{ name: zhCN.fileDialogs.htmlReport, extensions: ['html', 'htm'] }]);
  if (!outputPath) {
    return undefined;
  }
  await writeClipReport(outputPath, buildClipReportHtml(project, { exportPresetName: zhCN.clipReport.defaultExportPreset, locale: getLanguage() }));
  return outputPath;
}

export async function collectProjectArchivePreflight(project: Project): Promise<ProjectArchivePreflight> {
  return buildProjectArchivePreflight(project, await collectOfflineMediaFileStatuses(project));
}
