// ── Types ──────────────────────────────────────────────────────────────────

export type ImportConflictType =
  'duplicate-file' | 'same-name-different-content' | 'special-characters' | 'file-locked';

export type ImportConflictAction = 'rename' | 'skip' | 'overwrite' | 'force-import';

export interface ImportConflictItem {
  id: string;
  conflictType: ImportConflictType;
  fileName: string;
  filePath: string;
  existingPath?: string;
  fileSize?: number;
  existingSize?: number;
  detail: string;
  recommendedAction: ImportConflictAction;
  resolvedAction?: ImportConflictAction;
  resolvedNewName?: string;
}

export interface ImportConflictWizardState {
  items: ImportConflictItem[];
  currentIndex: number;
  batchAction?: ImportConflictAction;
  batchApplied: boolean;
  completed: boolean;
}

export interface ImportConflictReport {
  totalConflicts: number;
  resolved: number;
  skipped: number;
  renamed: number;
  overwritten: number;
  forceImported: number;
  byType: Record<ImportConflictType, number>;
}

// ── Constants ──────────────────────────────────────────────────────────────

const FFmpeg_SPECIAL_CHARS = /[&|;`$!#%*?<>{}[\]\\~]/;

// ── Conflict Detection ─────────────────────────────────────────────────────

export function detectDuplicateFileConflict(
  fileName: string,
  filePath: string,
  existingPaths: string[],
  existingSizes: Map<string, number>,
  newFileSize: number,
): ImportConflictItem | undefined {
  const existingPath = existingPaths.find((p) => p.toLowerCase() === filePath.toLowerCase());
  if (!existingPath) {
    return undefined;
  }
  const existingSize = existingSizes.get(existingPath);
  if (existingSize !== undefined && existingSize === newFileSize) {
    return createConflictItem(
      'duplicate-file',
      fileName,
      filePath,
      existingPath,
      'skip',
      `文件已存在于媒体库中（相同大小 ${newFileSize} 字节）`,
    );
  }
  return undefined;
}

export function detectSameNameDifferentContentConflict(
  fileName: string,
  filePath: string,
  existingPaths: string[],
  existingSizes: Map<string, number>,
  newFileSize: number,
): ImportConflictItem | undefined {
  const existingPath = existingPaths.find((p) => {
    const existingName = p.split(/[/\\]/).pop() ?? '';
    const newName = filePath.split(/[/\\]/).pop() ?? '';
    return existingName.toLowerCase() === newName.toLowerCase() && p.toLowerCase() !== filePath.toLowerCase();
  });
  if (!existingPath) {
    return undefined;
  }
  const existingSize = existingSizes.get(existingPath);
  if (existingSize !== undefined && existingSize !== newFileSize) {
    return createConflictItem(
      'same-name-different-content',
      fileName,
      filePath,
      existingPath,
      'rename',
      `同名文件已存在但内容不同（现有 ${existingSize} 字节，新 ${newFileSize} 字节）`,
    );
  }
  return undefined;
}

export function detectSpecialCharactersConflict(fileName: string, filePath: string): ImportConflictItem | undefined {
  if (FFmpeg_SPECIAL_CHARS.test(filePath)) {
    return createConflictItem(
      'special-characters',
      fileName,
      filePath,
      undefined,
      'rename',
      `路径包含特殊字符（${FFmpeg_SPECIAL_CHARS.exec(filePath)?.[0] ?? ''}），可能导致 FFmpeg 处理失败`,
    );
  }
  return undefined;
}

export function detectFileLockedConflict(
  fileName: string,
  filePath: string,
  isLocked: boolean,
): ImportConflictItem | undefined {
  if (isLocked) {
    return createConflictItem('file-locked', fileName, filePath, undefined, 'skip', '文件正被其他程序占用，无法读取');
  }
  return undefined;
}

// ── Smart Default Action ───────────────────────────────────────────────────

export function getRecommendedAction(conflictType: ImportConflictType): ImportConflictAction {
  switch (conflictType) {
    case 'duplicate-file':
      return 'skip';
    case 'same-name-different-content':
      return 'rename';
    case 'special-characters':
      return 'rename';
    case 'file-locked':
      return 'skip';
  }
}

// ── Wizard Logic ───────────────────────────────────────────────────────────

export function createConflictWizard(items: ImportConflictItem[]): ImportConflictWizardState {
  return {
    items: items.map((item) => ({
      ...item,
      recommendedAction: item.recommendedAction ?? getRecommendedAction(item.conflictType),
    })),
    currentIndex: 0,
    batchApplied: false,
    completed: items.length === 0,
  };
}

export function resolveCurrentConflict(
  state: ImportConflictWizardState,
  action: ImportConflictAction,
  newName?: string,
): ImportConflictWizardState {
  const items = state.items.map((item, index) =>
    index === state.currentIndex
      ? {
          ...item,
          resolvedAction: action,
          resolvedNewName: action === 'rename' ? (newName ?? generateRename(item.fileName)) : undefined,
        }
      : item,
  );
  const nextIndex = state.currentIndex + 1;
  return {
    ...state,
    items,
    currentIndex: nextIndex,
    completed: nextIndex >= items.length,
  };
}

export function applyBatchAction(
  state: ImportConflictWizardState,
  action: ImportConflictAction,
): ImportConflictWizardState {
  const items = state.items.map((item) => ({
    ...item,
    resolvedAction: item.resolvedAction ?? action,
    resolvedNewName:
      (item.resolvedAction ?? action) === 'rename'
        ? (item.resolvedNewName ?? generateRename(item.fileName))
        : undefined,
  }));
  return {
    ...state,
    items,
    batchAction: action,
    batchApplied: true,
    currentIndex: items.length,
    completed: true,
  };
}

export function moveToNextUnresolved(state: ImportConflictWizardState): ImportConflictWizardState {
  for (let i = state.currentIndex; i < state.items.length; i++) {
    if (!state.items[i].resolvedAction) {
      return { ...state, currentIndex: i };
    }
  }
  return { ...state, completed: true };
}

// ── Report ─────────────────────────────────────────────────────────────────

export function buildConflictReport(items: ImportConflictItem[]): ImportConflictReport {
  const resolved = items.filter((item) => item.resolvedAction !== undefined);
  const byType: Record<ImportConflictType, number> = {
    'duplicate-file': 0,
    'same-name-different-content': 0,
    'special-characters': 0,
    'file-locked': 0,
  };
  for (const item of items) {
    byType[item.conflictType]++;
  }
  return {
    totalConflicts: items.length,
    resolved: resolved.length,
    skipped: resolved.filter((item) => item.resolvedAction === 'skip').length,
    renamed: resolved.filter((item) => item.resolvedAction === 'rename').length,
    overwritten: resolved.filter((item) => item.resolvedAction === 'overwrite').length,
    forceImported: resolved.filter((item) => item.resolvedAction === 'force-import').length,
    byType,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function createConflictItem(
  conflictType: ImportConflictType,
  fileName: string,
  filePath: string,
  existingPath: string | undefined,
  recommendedAction: ImportConflictAction,
  detail: string,
): ImportConflictItem {
  return {
    id: `conflict-${conflictType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conflictType,
    fileName,
    filePath,
    existingPath,
    detail,
    recommendedAction,
  };
}

function generateRename(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return `${fileName}_imported`;
  }
  const name = fileName.slice(0, dotIndex);
  const ext = fileName.slice(dotIndex);
  return `${name}_imported${ext}`;
}

export function normalizeConflictAction(action: string | undefined): ImportConflictAction | undefined {
  if (action === 'rename' || action === 'skip' || action === 'overwrite' || action === 'force-import') {
    return action;
  }
  return undefined;
}
