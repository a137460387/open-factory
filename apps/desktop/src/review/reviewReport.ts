import { buildReviewReportHtml, type Project } from '@open-factory/editor-core';
import { getLanguage, zhCN } from '../i18n/strings';
import { saveFileDialog, writeFile } from '../lib/tauri-bridge';

export type ReviewReportWriter = (path: string, html: string) => Promise<void> | void;

export async function writeReviewReportFile(
  project: Project,
  outputPath: string,
  writer: ReviewReportWriter = writeFile,
): Promise<string> {
  const html = buildReviewReportHtml(project, { locale: getLanguage() });
  await writer(outputPath, html);
  return outputPath;
}

export async function saveReviewReport(project: Project): Promise<string | undefined> {
  const outputPath = await saveFileDialog(`${project.name}-评审报告.html`, [
    { name: zhCN.fileDialogs.htmlReport, extensions: ['html', 'htm'] },
  ]);
  if (!outputPath) {
    return undefined;
  }
  return writeReviewReportFile(project, outputPath);
}
