/**
 * Command interface — standard Command Pattern for timeline operations.
 *
 * Every timeline mutation must implement this interface to support
 * undo/redo, operation merging, and history visualization.
 */
export interface Command {
  /** Human-readable description (shown in undo/redo UI). */
  readonly description: string;
  /** Execute the command. */
  execute(): void;
  /** Undo the command. */
  undo(): void;
  /**
   * Attempt to merge another command into this one.
   * Returns a new merged command, or null if merging is not possible.
   * Used for operation coalescing (e.g., dragging a slider produces
   * many small changes that should be a single undo step).
   */
  merge?(other: Command): Command | null;
}

/**
 * Batch command — groups multiple commands as a single undo step.
 */
export class BatchCommand implements Command {
  readonly description: string;
  private readonly commands: Command[];

  constructor(description: string, commands: Command[]) {
    this.description = description;
    this.commands = [...commands];
  }

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i]!.undo();
    }
  }
}

/**
 * No-op command — placeholder for empty operations.
 */
export class NoOpCommand implements Command {
  readonly description = '(no operation)';
  execute(): void { /* no-op */ }
  undo(): void { /* no-op */ }
}

export interface HistoryEntry {
  id: string;
  description: string;
  timestamp: string;
  affectedClipCount: number;
  parentId?: string;
  branchDepth?: number;
  branchIndex?: number;
  siblingCount?: number;
  childCount?: number;
  isCurrent?: boolean;
  activePath?: boolean;
}

export interface HistoryMeta {
  canUndo: boolean;
  canRedo: boolean;
  cursor: number;
  entries: HistoryEntry[];
  position: number;
  total: number;
}
