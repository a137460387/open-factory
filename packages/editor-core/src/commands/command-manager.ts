import type { Command, HistoryEntry, HistoryMeta } from './command';

interface CommandHistoryRecord {
  command: Command;
  entry: HistoryEntry;
}

export type CommandExecuteListener = (command: Command) => void;

export class CommandManager {
  private history: CommandHistoryRecord[] = [];
  private cursor = -1;
  private onChange?: (meta: HistoryMeta) => void;
  private onExecute?: CommandExecuteListener;
  private nextEntryId = 1;

  constructor(private readonly maxHistory = 100) {}

  setOnChange(onChange: (meta: HistoryMeta) => void): void {
    this.onChange = onChange;
    this.emitChange();
  }

  setOnExecute(onExecute?: CommandExecuteListener): void {
    this.onExecute = onExecute;
  }

  execute(command: Command): void {
    if (this.cursor < this.history.length - 1) {
      this.history = this.history.slice(0, this.cursor + 1);
    }
    command.execute();
    this.onExecute?.(command);
    this.history.push({
      command,
      entry: {
        id: `history-${this.nextEntryId++}`,
        description: command.description,
        timestamp: new Date().toISOString(),
        affectedClipCount: inferAffectedClipCount(command)
      }
    });
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
    this.history[this.cursor]?.command.undo();
    this.cursor -= 1;
    this.emitChange();
  }

  redo(): void {
    if (!this.canRedo()) {
      return;
    }
    this.cursor += 1;
    this.history[this.cursor]?.command.execute();
    this.emitChange();
  }

  jumpTo(index: number): void {
    const target = Math.min(this.history.length - 1, Math.max(-1, Math.floor(index)));
    if (target === this.cursor) {
      return;
    }
    while (this.cursor > target) {
      this.history[this.cursor]?.command.undo();
      this.cursor -= 1;
    }
    while (this.cursor < target) {
      this.cursor += 1;
      this.history[this.cursor]?.command.execute();
    }
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
      canRedo: this.canRedo(),
      cursor: this.cursor,
      entries: this.history.map((record) => ({ ...record.entry })),
      position: this.cursor + 1,
      total: this.history.length
    };
  }

  historySize(): number {
    return this.history.length;
  }

  private emitChange(): void {
    this.onChange?.(this.getHistoryMeta());
  }
}

function inferAffectedClipCount(command: Command): number {
  const record = command as unknown as Record<string, unknown>;
  const ids = new Set<string>();
  collectClipId(record.clipId, ids);
  collectClipIds(record.clipIds, ids);
  collectClipIds(record.selectedClipIds, ids);
  collectClipIds(Object.keys((record.newStartsByClipId as Record<string, unknown> | undefined) ?? {}), ids);
  collectClipLike(record.clip, ids);
  collectClipLike(record.before, ids);
  collectClipLike(record.after, ids);
  collectTrackLike(record.track, ids);
  collectTrackLike(record.removedTrack, ids);
  return ids.size;
}

function collectClipId(value: unknown, ids: Set<string>): void {
  if (typeof value === 'string' && value.trim()) {
    ids.add(value);
  }
}

function collectClipIds(value: unknown, ids: Set<string>): void {
  if (!Array.isArray(value)) {
    return;
  }
  for (const item of value) {
    collectClipId(item, ids);
  }
}

function collectClipLike(value: unknown, ids: Set<string>): void {
  if (value && typeof value === 'object') {
    collectClipId((value as { id?: unknown }).id, ids);
  }
}

function collectTrackLike(value: unknown, ids: Set<string>): void {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { clips?: unknown }).clips)) {
    return;
  }
  for (const clip of (value as { clips: unknown[] }).clips) {
    collectClipLike(clip, ids);
  }
}
