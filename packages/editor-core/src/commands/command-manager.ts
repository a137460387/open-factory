import type { Command, HistoryMeta } from './command';

export class CommandManager {
  private history: Command[] = [];
  private cursor = -1;
  private onChange?: (meta: HistoryMeta) => void;

  constructor(private readonly maxHistory = 100) {}

  setOnChange(onChange: (meta: HistoryMeta) => void): void {
    this.onChange = onChange;
    this.emitChange();
  }

  execute(command: Command): void {
    if (this.cursor < this.history.length - 1) {
      this.history = this.history.slice(0, this.cursor + 1);
    }
    command.execute();
    this.history.push(command);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.cursor = this.history.length - 1;
    this.emitChange();
  }

  undo(): void {
    if (!this.canUndo()) {
      return;
    }
    this.history[this.cursor]?.undo();
    this.cursor -= 1;
    this.emitChange();
  }

  redo(): void {
    if (!this.canRedo()) {
      return;
    }
    this.cursor += 1;
    this.history[this.cursor]?.execute();
    this.emitChange();
  }

  canUndo(): boolean {
    return this.cursor >= 0;
  }

  canRedo(): boolean {
    return this.cursor < this.history.length - 1;
  }

  clear(): void {
    this.history = [];
    this.cursor = -1;
    this.emitChange();
  }

  getHistoryMeta(): HistoryMeta {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }

  historySize(): number {
    return this.history.length;
  }

  private emitChange(): void {
    this.onChange?.(this.getHistoryMeta());
  }
}
