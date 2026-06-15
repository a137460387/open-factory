export interface Command {
  description: string;
  execute(): void;
  undo(): void;
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
