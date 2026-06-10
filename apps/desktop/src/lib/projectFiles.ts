import { deserializeProject, serializeProject, type CutProjectFile, type Project } from '@open-factory/editor-core';
import { isTauriRuntime } from './tauri';
import {
  bridgeConfirm,
  chooseUnsavedCloseAction,
  forceCloseWindow as bridgeForceCloseWindow,
  fsExists,
  getAppDataDir,
  openFileDialog,
  readFile,
  removeFile,
  saveFileDialog,
  getFileStat,
  writeFile,
  getTauriMocks,
  type UnsavedCloseAction
} from './tauri-bridge';

export const AUTOSAVE_KEY = 'open-factory:autosave';
export const AUTOSAVE_INTERVAL_KEY = 'open-factory:autosave-interval-seconds';
export const RECENT_PROJECT_PATH_KEY = 'open-factory:recent-project-path';
export const DEFAULT_AUTOSAVE_INTERVAL_SECONDS = 60;

export interface AutosaveRecoveryCandidate {
  kind: 'saved-project' | 'unsaved-project';
  autosavePath: string;
  projectPath?: string;
  autosaveMtimeMs: number;
  projectMtimeMs?: number;
}

export async function confirmDiscardChanges(): Promise<boolean> {
  if (!isTauriRuntime() && !window.__TAURI_MOCKS__) {
    return window.confirm('Discard unsaved changes?');
  }
  return bridgeConfirm('Discard unsaved changes?', { title: 'Unsaved changes', kind: 'warning' });
}

export async function chooseUnsavedCloseActionForWindow(): Promise<UnsavedCloseAction> {
  return chooseUnsavedCloseAction();
}

export async function chooseProjectToOpen(): Promise<string | undefined> {
  if (!isTauriRuntime() && !window.__TAURI_MOCKS__) {
    return undefined;
  }
  return (await openFileDialog(false, [{ name: 'open-factory project', extensions: ['cutproj.json', 'json'] }]))[0];
}

export async function chooseProjectSavePath(defaultPath = 'open-factory.cutproj.json'): Promise<string | undefined> {
  if (!isTauriRuntime() && !window.__TAURI_MOCKS__) {
    return undefined;
  }
  return saveFileDialog(defaultPath, [{ name: 'open-factory project', extensions: ['cutproj.json', 'json'] }]);
}

export async function readProjectFile(path: string, projectPathForMedia = path): Promise<Project> {
  if (!hasNativeFileRuntime()) {
    const raw = getBrowserStorage()?.getItem(AUTOSAVE_KEY);
    if (!raw) {
      throw new Error('No browser autosave project is available.');
    }
    return deserializeProject(JSON.parse(raw) as CutProjectFile);
  }
  const raw = await readFile(path);
  const project = deserializeProject(JSON.parse(raw) as CutProjectFile, projectPathForMedia);
  const media = await Promise.all(project.media.map(async (asset) => ({ ...asset, missing: !(await fsExists(asset.path)) })));
  if (projectPathForMedia === path) {
    recordRecentProjectPath(path);
  }
  return { ...project, media };
}

export async function writeProjectFile(project: Project, path?: string): Promise<string | undefined> {
  const serialized = JSON.stringify(serializeProject(project, path), null, 2);
  if (!hasNativeFileRuntime()) {
    getBrowserStorage()?.setItem(AUTOSAVE_KEY, serialized);
    downloadText(serialized, project.name.endsWith('.cutproj.json') ? project.name : `${project.name}.cutproj.json`);
    return undefined;
  }
  if (!path) {
    throw new Error('A project path is required for saving.');
  }
  await writeFile(path, serialized);
  recordRecentProjectPath(path);
  return path;
}

export function autosaveProject(project: Project): void {
  getBrowserStorage()?.setItem(AUTOSAVE_KEY, JSON.stringify(serializeProject(project), null, 2));
}

export function readAutosaveIntervalSeconds(): number {
  const raw = getBrowserStorage()?.getItem(AUTOSAVE_INTERVAL_KEY);
  const parsed = raw ? Number(raw) : DEFAULT_AUTOSAVE_INTERVAL_SECONDS;
  return Number.isFinite(parsed) ? Math.min(600, Math.max(1, Math.round(parsed))) : DEFAULT_AUTOSAVE_INTERVAL_SECONDS;
}

export function writeAutosaveIntervalSeconds(seconds: number): number {
  const normalized = Math.min(600, Math.max(1, Math.round(seconds || DEFAULT_AUTOSAVE_INTERVAL_SECONDS)));
  getBrowserStorage()?.setItem(AUTOSAVE_INTERVAL_KEY, String(normalized));
  return normalized;
}

export async function writeAutosaveProject(project: Project, projectPath?: string): Promise<string | undefined> {
  if (!hasNativeFileRuntime()) {
    autosaveProject(project);
    return undefined;
  }
  const autosavePath = await getAutosavePath(projectPath);
  if (!autosavePath) {
    return undefined;
  }
  const serialized = JSON.stringify(serializeProject(project, projectPath), null, 2);
  await writeFile(autosavePath, serialized);
  return autosavePath;
}

export async function writeAutosaveProjectSafely(project: Project, projectPath?: string): Promise<string | undefined> {
  try {
    return await writeAutosaveProject(project, projectPath);
  } catch (error) {
    console.warn('Autosave failed', error);
    return undefined;
  }
}

export async function deleteAutosaveAfterSave(savedProjectPath: string, previousProjectPath?: string): Promise<void> {
  const paths = new Set<string>();
  paths.add(getSavedProjectAutosavePath(savedProjectPath));
  if (previousProjectPath && previousProjectPath !== savedProjectPath) {
    paths.add(getSavedProjectAutosavePath(previousProjectPath));
  }
  const unsavedPath = await getUnsavedAutosavePath();
  if (unsavedPath) {
    paths.add(unsavedPath);
  }
  for (const path of paths) {
    try {
      await removeFile(path);
    } catch (error) {
      console.warn('Unable to delete autosave file', error);
    }
  }
}

export async function findStartupAutosaveRecovery(): Promise<AutosaveRecoveryCandidate | undefined> {
  if (!hasNativeFileRuntime()) {
    return undefined;
  }
  const recentPath = getBrowserStorage()?.getItem(RECENT_PROJECT_PATH_KEY) ?? undefined;
  if (recentPath) {
    const saved = await findAutosaveForSavedProject(recentPath);
    if (saved) {
      return saved;
    }
  }
  const unsavedPath = await getUnsavedAutosavePath();
  if (unsavedPath && (await fsExists(unsavedPath))) {
    const stat = await getFileStat(unsavedPath);
    return {
      kind: 'unsaved-project',
      autosavePath: unsavedPath,
      autosaveMtimeMs: stat.mtimeMs
    };
  }
  return undefined;
}

export async function restoreAutosaveRecovery(candidate: AutosaveRecoveryCandidate): Promise<Project> {
  return readProjectFile(candidate.autosavePath, candidate.projectPath ?? candidate.autosavePath);
}

export async function discardAutosaveRecovery(candidate: AutosaveRecoveryCandidate): Promise<void> {
  await removeFile(candidate.autosavePath);
}

export function getSavedProjectAutosavePath(projectPath: string): string {
  return `${projectPath}.autosave`;
}

export async function forceCloseWindow(): Promise<void> {
  await bridgeForceCloseWindow();
}

async function findAutosaveForSavedProject(projectPath: string): Promise<AutosaveRecoveryCandidate | undefined> {
  const autosavePath = getSavedProjectAutosavePath(projectPath);
  if (!(await fsExists(autosavePath))) {
    return undefined;
  }
  const autosaveStat = await getFileStat(autosavePath);
  if (!(await fsExists(projectPath))) {
    return {
      kind: 'saved-project',
      autosavePath,
      projectPath,
      autosaveMtimeMs: autosaveStat.mtimeMs
    };
  }
  const projectStat = await getFileStat(projectPath);
  if (autosaveStat.mtimeMs <= projectStat.mtimeMs) {
    return undefined;
  }
  return {
    kind: 'saved-project',
    autosavePath,
    projectPath,
    autosaveMtimeMs: autosaveStat.mtimeMs,
    projectMtimeMs: projectStat.mtimeMs
  };
}

async function getAutosavePath(projectPath?: string): Promise<string | undefined> {
  return projectPath ? getSavedProjectAutosavePath(projectPath) : getUnsavedAutosavePath();
}

async function getUnsavedAutosavePath(): Promise<string | undefined> {
  if (!hasNativeFileRuntime()) {
    return undefined;
  }
  const appDataDir = await getAppDataDir();
  return `${appDataDir.replace(/\/$/, '')}/unsaved.cutproj.json.autosave`;
}

function recordRecentProjectPath(path: string): void {
  getBrowserStorage()?.setItem(RECENT_PROJECT_PATH_KEY, path);
}

function hasNativeFileRuntime(): boolean {
  return isTauriRuntime() || Boolean(getTauriMocks());
}

function getBrowserStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
