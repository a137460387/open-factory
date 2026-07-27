import type { Command, HistoryMeta } from './command';
export type CommandExecuteListener = (command: Command) => void;
/** Options for the CommandManager. */
export interface CommandManagerOptions {
    /** Maximum history entries (default 100). */
    maxHistory?: number;
    /**
     * Time window in ms for operation merging.
     * Commands executed within this window that support merge()
     * will be coalesced into a single undo step. Default 200ms.
     */
    mergeWindowMs?: number;
}
export declare class CommandManager {
    private readonly maxHistory;
    private readonly root;
    private current;
    private nodeById;
    private onChange?;
    private onExecute?;
    private nextEntryId;
    private nextOrder;
    private readonly mergeWindowMs;
    private lastExecuteTime;
    constructor(maxHistory?: number, options?: CommandManagerOptions);
    setOnChange(onChange: (meta: HistoryMeta) => void): void;
    setOnExecute(onExecute?: CommandExecuteListener): void;
    execute(command: Command): void;
    private canMergeWithPrevious;
    undo(): void;
    redo(): void;
    jumpTo(index: number): void;
    jumpToEntry(entryId: string): void;
    switchToPreviousBranch(): void;
    private jumpToNode;
    canUndo(): boolean;
    canRedo(): boolean;
    clear(): void;
    getHistoryMeta(): HistoryMeta;
    historySize(): number;
    private emitChange;
    private flattenHistory;
    private pathFromRoot;
    private getPreferredRedoChild;
    private findPreviousBranchTarget;
    private enforceBranchLimit;
    private pruneToMaxHistory;
    private promoteChildrenAndRemove;
    private removeSubtree;
}
//# sourceMappingURL=command-manager.d.ts.map