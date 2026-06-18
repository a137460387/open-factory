import { fsExists, getAppDataDir, openFileDialog, readFile, removeFile, saveFileDialog, scanDirectory, writeFile } from '../lib/tauri-bridge';
import { zhCN } from '../i18n/strings';

export const TIMELINE_SCRIPT_EXTENSION = '.js';
const TIMELINE_SCRIPTS_DIR = 'scripts';

export interface TimelineScriptFile {
  id: string;
  name: string;
  path: string;
  code: string;
}

interface TimelineScriptStorage {
  fsExists(path: string): Promise<boolean> | boolean;
  getAppDataDir(): Promise<string> | string;
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, contents: string): Promise<void> | void;
  removeFile(path: string): Promise<void> | void;
  scanDirectory(path: string, depth?: number): Promise<string[]> | string[];
}

const defaultStorage: TimelineScriptStorage = {
  fsExists,
  getAppDataDir,
  readFile,
  writeFile,
  removeFile,
  scanDirectory
};

export function getTimelineScriptsDir(appDataDir: string): string {
  return `${appDataDir.replace(/[\\/]+$/, '')}/${TIMELINE_SCRIPTS_DIR}`;
}

export function getTimelineScriptPath(appDataDir: string, name: string): string {
  return `${getTimelineScriptsDir(appDataDir)}/${sanitizeTimelineScriptName(name)}${TIMELINE_SCRIPT_EXTENSION}`;
}

export async function loadTimelineScripts(storage: TimelineScriptStorage = defaultStorage): Promise<TimelineScriptFile[]> {
  const appDataDir = await storage.getAppDataDir();
  const scriptsDir = getTimelineScriptsDir(appDataDir);
  if (!(await Promise.resolve(storage.fsExists(scriptsDir)).catch(() => false))) {
    return [];
  }
  const paths = (await storage.scanDirectory(scriptsDir, 1)).filter((path) => path.toLowerCase().endsWith(TIMELINE_SCRIPT_EXTENSION));
  const scripts = await Promise.all(
    paths.map(async (path) => ({
      id: path,
      name: scriptNameFromPath(path),
      path,
      code: await storage.readFile(path)
    }))
  );
  return scripts.sort((left, right) => left.name.localeCompare(right.name));
}

export async function saveTimelineScript(name: string, code: string, previousPath?: string, storage: TimelineScriptStorage = defaultStorage): Promise<TimelineScriptFile> {
  const appDataDir = await storage.getAppDataDir();
  const path = getTimelineScriptPath(appDataDir, name);
  await storage.writeFile(path, code.endsWith('\n') ? code : `${code}\n`);
  if (previousPath && previousPath !== path) {
    await Promise.resolve(storage.removeFile(previousPath)).catch(() => undefined);
  }
  return { id: path, name: scriptNameFromPath(path), path, code };
}

export async function deleteTimelineScript(path: string, storage: TimelineScriptStorage = defaultStorage): Promise<void> {
  if (path.trim()) {
    await storage.removeFile(path);
  }
}

export async function importTimelineScriptFromDialog(storage: TimelineScriptStorage = defaultStorage): Promise<TimelineScriptFile | undefined> {
  const [sourcePath] = await openFileDialog(false, [{ name: zhCN.settings.scripts.fileDialogName, extensions: ['js'] }]);
  if (!sourcePath) {
    return undefined;
  }
  const code = await storage.readFile(sourcePath);
  return saveTimelineScript(scriptNameFromPath(sourcePath), code, undefined, storage);
}

export async function exportTimelineScriptToDialog(name: string, code: string): Promise<string | undefined> {
  const outputPath = await saveFileDialog(`${sanitizeTimelineScriptName(name)}${TIMELINE_SCRIPT_EXTENSION}`, [{ name: zhCN.settings.scripts.fileDialogName, extensions: ['js'] }]);
  if (!outputPath) {
    return undefined;
  }
  await writeFile(outputPath, code.endsWith('\n') ? code : `${code}\n`);
  return outputPath;
}

function scriptNameFromPath(path: string): string {
  const fileName = path.split(/[\\/]/).pop() ?? path;
  return fileName.replace(/\.js$/i, '') || zhCN.settings.scripts.defaultScriptName;
}

function sanitizeTimelineScriptName(name: string): string {
  const normalized = name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ');
  return (normalized || zhCN.settings.scripts.defaultScriptName).slice(0, 80);
}
