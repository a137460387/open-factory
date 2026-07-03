import { deserializeProject, serializeProject, type CutProjectFile, type Project } from '@open-factory/editor-core';
import { runProjectBackupAfterSave } from '../backup/projectBackup';
import { zhCN } from '../i18n/strings';
import { isTauriRuntime } from './tauri';
import {
  bridgeConfirm,
  chooseUnsavedCloseAction,
  decryptProjectFile,
  encryptProjectFile,
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
export const ENCRYPTED_PROJECT_EXTENSION = '.cutproj.enc';

export interface ProjectFileEncryptionOptions {
  encrypted?: boolean;
  password?: string;
}

let activeProjectEncryptionPassword: string | undefined;

export interface AutosaveRecoveryCandidate {
  kind: 'saved-project' | 'unsaved-project';
  autosavePath: string;
  projectPath?: string;
  autosaveMtimeMs: number;
  projectMtimeMs?: number;
}

export async function confirmDiscardChanges(): Promise<boolean> {
  if (!isTauriRuntime() && !window.__TAURI_MOCKS__) {
    return window.confirm(zhCN.projectFiles.discardChanges);
  }
  return bridgeConfirm(zhCN.projectFiles.discardChanges, { title: zhCN.projectFiles.unsavedChanges, kind: 'warning' });
}

export async function chooseUnsavedCloseActionForWindow(): Promise<UnsavedCloseAction> {
  return chooseUnsavedCloseAction();
}

export async function chooseProjectToOpen(): Promise<string | undefined> {
  if (!isTauriRuntime() && !window.__TAURI_MOCKS__) {
    return undefined;
  }
  return (await openFileDialog(false, [{ name: zhCN.projectFiles.projectFilter, extensions: ['cutproj.json', 'cutproj.enc', 'json'] }]))[0];
}

export async function chooseProjectSavePath(defaultPath = 'open-factory.cutproj.json', encrypted = false): Promise<string | undefined> {
  if (!isTauriRuntime() && !window.__TAURI_MOCKS__) {
    return undefined;
  }
  return saveFileDialog(defaultPath, [{ name: zhCN.projectFiles.projectFilter, extensions: encrypted ? ['cutproj.enc'] : ['cutproj.json', 'json'] }]);
}

export async function readProjectFile(path: string, projectPathForMedia = path, options: ProjectFileEncryptionOptions = {}): Promise<Project> {
  if (!hasNativeFileRuntime()) {
    const raw = getBrowserStorage()?.getItem(AUTOSAVE_KEY);
    if (!raw) {
      throw new Error(zhCN.projectFiles.noBrowserAutosave);
    }
    return deserializeProject(JSON.parse(raw) as CutProjectFile);
  }
  const encrypted = isEncryptedProjectPath(path);
  const raw = encrypted ? await readEncryptedProjectFile(path, options.password ?? activeProjectEncryptionPassword) : await readFile(path);
  const project = deserializeProject(JSON.parse(raw) as CutProjectFile, projectPathForMedia);
  const media = await Promise.all(project.media.map(async (asset) => ({ ...asset, missing: !(await fsExists(asset.path)) })));
  if (projectPathForMedia === path) {
    recordRecentProjectPath(path);
    setActiveProjectEncryptionPassword(encrypted ? options.password : undefined);
  }
  return { ...project, media };
}

export async function writeProjectFile(project: Project, path?: string, options: ProjectFileEncryptionOptions = {}): Promise<string | undefined> {
  const serialized = JSON.stringify(serializeProject(project, path), null, 2);
  if (!hasNativeFileRuntime()) {
    getBrowserStorage()?.setItem(AUTOSAVE_KEY, serialized);
    downloadText(serialized, project.name.endsWith('.cutproj.json') ? project.name : `${project.name}.cutproj.json`);
    return undefined;
  }
  if (!path) {
    throw new Error(zhCN.projectFiles.projectPathRequired);
  }
  const encrypted = await writeSerializedProjectFile(path, serialized, options);
  if (!encrypted) {
    await runProjectBackupAfterSave(project, path, serialized);
  }
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
  await writeSerializedProjectFile(autosavePath, serialized, { password: activeProjectEncryptionPassword });
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
      console.warn(zhCN.projectFiles.autosaveDeleteFailed, error);
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

export async function discardAutosaveRecovery(candidate: AutosaveRecoveryCandidate): Promise<void> {
  await removeFile(candidate.autosavePath);
}

export function getSavedProjectAutosavePath(projectPath: string): string {
  return `${projectPath}.autosave`;
}

export function setActiveProjectEncryptionPassword(password?: string): void {
  const trimmed = password?.trim();
  activeProjectEncryptionPassword = trimmed ? trimmed : undefined;
}

export function getActiveProjectEncryptionPassword(): string | undefined {
  return activeProjectEncryptionPassword;
}

export function isEncryptedProjectPath(path: string | undefined): boolean {
  return Boolean(path && /\.cutproj\.enc(?:\.autosave)?$/i.test(path));
}

export async function writeSerializedProjectFile(path: string, serialized: string, options: ProjectFileEncryptionOptions = {}): Promise<boolean> {
  const password = normalizeProjectPassword(options.password ?? (isEncryptedProjectPath(path) ? activeProjectEncryptionPassword : undefined));
  const encrypted = options.encrypted === true || Boolean(password) || isEncryptedProjectPath(path);
  if (!encrypted) {
    await writeFile(path, serialized);
    setActiveProjectEncryptionPassword(undefined);
    return false;
  }
  if (!password) {
    throw new Error(zhCN.projectFiles.encryptedPasswordRequired);
  }
  await encryptProjectFile(path, serialized, password);
  setActiveProjectEncryptionPassword(password);
  return true;
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

async function readEncryptedProjectFile(path: string, password: string | undefined): Promise<string> {
  const normalized = normalizeProjectPassword(password);
  if (!normalized) {
    throw new Error(zhCN.projectFiles.encryptedPasswordRequired);
  }
  try {
    const raw = await decryptProjectFile(path, normalized);
    setActiveProjectEncryptionPassword(normalized);
    return raw;
  } catch (error) {
    if (error instanceof Error && error.message.includes('密码错误')) {
      throw new Error(zhCN.projectFiles.encryptedWrongPassword);
    }
    throw error;
  }
}

function normalizeProjectPassword(password: string | undefined): string | undefined {
  const trimmed = password?.trim();
  return trimmed ? trimmed : undefined;
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
