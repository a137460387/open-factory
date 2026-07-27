// ── Types ──────────────────────────────────────────────────────────────────
// ── Constants ──────────────────────────────────────────────────────────────
const FFmpeg_SPECIAL_CHARS = /[&|;`$!#%*?<>{}[\]\\~]/;
// ── Conflict Detection ─────────────────────────────────────────────────────
export function detectDuplicateFileConflict(fileName, filePath, existingPaths, existingSizes, newFileSize) {
    const existingPath = existingPaths.find((p) => p.toLowerCase() === filePath.toLowerCase());
    if (!existingPath) {
        return undefined;
    }
    const existingSize = existingSizes.get(existingPath);
    if (existingSize !== undefined && existingSize === newFileSize) {
        return createConflictItem('duplicate-file', fileName, filePath, existingPath, 'skip', `文件已存在于媒体库中（相同大小 ${newFileSize} 字节）`);
    }
    return undefined;
}
export function detectSameNameDifferentContentConflict(fileName, filePath, existingPaths, existingSizes, newFileSize) {
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
        return createConflictItem('same-name-different-content', fileName, filePath, existingPath, 'rename', `同名文件已存在但内容不同（现有 ${existingSize} 字节，新 ${newFileSize} 字节）`);
    }
    return undefined;
}
export function detectSpecialCharactersConflict(fileName, filePath) {
    if (FFmpeg_SPECIAL_CHARS.test(filePath)) {
        return createConflictItem('special-characters', fileName, filePath, undefined, 'rename', `路径包含特殊字符（${FFmpeg_SPECIAL_CHARS.exec(filePath)?.[0] ?? ''}），可能导致 FFmpeg 处理失败`);
    }
    return undefined;
}
export function detectFileLockedConflict(fileName, filePath, isLocked) {
    if (isLocked) {
        return createConflictItem('file-locked', fileName, filePath, undefined, 'skip', '文件正被其他程序占用，无法读取');
    }
    return undefined;
}
// ── Smart Default Action ───────────────────────────────────────────────────
export function getRecommendedAction(conflictType) {
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
export function createConflictWizard(items) {
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
export function resolveCurrentConflict(state, action, newName) {
    const items = state.items.map((item, index) => index === state.currentIndex
        ? {
            ...item,
            resolvedAction: action,
            resolvedNewName: action === 'rename' ? (newName ?? generateRename(item.fileName)) : undefined,
        }
        : item);
    const nextIndex = state.currentIndex + 1;
    return {
        ...state,
        items,
        currentIndex: nextIndex,
        completed: nextIndex >= items.length,
    };
}
export function applyBatchAction(state, action) {
    const items = state.items.map((item) => ({
        ...item,
        resolvedAction: item.resolvedAction ?? action,
        resolvedNewName: (item.resolvedAction ?? action) === 'rename'
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
export function moveToNextUnresolved(state) {
    for (let i = state.currentIndex; i < state.items.length; i++) {
        if (!state.items[i].resolvedAction) {
            return { ...state, currentIndex: i };
        }
    }
    return { ...state, completed: true };
}
// ── Report ─────────────────────────────────────────────────────────────────
export function buildConflictReport(items) {
    const resolved = items.filter((item) => item.resolvedAction !== undefined);
    const byType = {
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
function createConflictItem(conflictType, fileName, filePath, existingPath, recommendedAction, detail) {
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
function generateRename(fileName) {
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex <= 0) {
        return `${fileName}_imported`;
    }
    const name = fileName.slice(0, dotIndex);
    const ext = fileName.slice(dotIndex);
    return `${name}_imported${ext}`;
}
export function normalizeConflictAction(action) {
    if (action === 'rename' || action === 'skip' || action === 'overwrite' || action === 'force-import') {
        return action;
    }
    return undefined;
}
//# sourceMappingURL=media-import-conflict.js.map