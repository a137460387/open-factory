export interface Command {
  description: string;
  execute(): void;
  undo(): void;
}

export interface HistoryMeta {
  canUndo: boolean;
  canRedo: boolean;
}
