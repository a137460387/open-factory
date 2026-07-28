export type ImportConflictType = 'duplicate-file' | 'same-name-different-content' | 'special-characters' | 'file-locked';
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
export declare function detectDuplicateFileConflict(fileName: string, filePath: string, existingPaths: string[], existingSizes: Map<string, number>, newFileSize: number): ImportConflictItem | undefined;
export declare function detectSameNameDifferentContentConflict(fileName: string, filePath: string, existingPaths: string[], existingSizes: Map<string, number>, newFileSize: number): ImportConflictItem | undefined;
export declare function detectSpecialCharactersConflict(fileName: string, filePath: string): ImportConflictItem | undefined;
export declare function detectFileLockedConflict(fileName: string, filePath: string, isLocked: boolean): ImportConflictItem | undefined;
export declare function getRecommendedAction(conflictType: ImportConflictType): ImportConflictAction;
export declare function createConflictWizard(items: ImportConflictItem[]): ImportConflictWizardState;
export declare function resolveCurrentConflict(state: ImportConflictWizardState, action: ImportConflictAction, newName?: string): ImportConflictWizardState;
export declare function applyBatchAction(state: ImportConflictWizardState, action: ImportConflictAction): ImportConflictWizardState;
export declare function moveToNextUnresolved(state: ImportConflictWizardState): ImportConflictWizardState;
export declare function buildConflictReport(items: ImportConflictItem[]): ImportConflictReport;
export declare function normalizeConflictAction(action: string | undefined): ImportConflictAction | undefined;
//# sourceMappingURL=media-import-conflict.d.ts.map