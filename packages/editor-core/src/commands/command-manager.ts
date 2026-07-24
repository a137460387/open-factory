import type { Command, HistoryEntry, HistoryMeta } from './command';

interface CommandHistoryRecord {
  command: Command;
  entry: HistoryEntry;
}

interface CommandHistoryNode extends Partial<CommandHistoryRecord> {
  id: string;
  parent?: CommandHistoryNode;
  children: CommandHistoryNode[];
  preferredChildId?: string;
  order: number;
}

interface FlattenedCommandHistoryNode {
  node: CommandHistoryNode;
  depth: number;
  branchIndex: number;
  siblingCount: number;
}

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

export class CommandManager {
  private readonly root: CommandHistoryNode = { id: 'history-root', children: [], order: 0 };
  private current: CommandHistoryNode = this.root;
  private nodeById = new Map<string, CommandHistoryNode>([[this.root.id, this.root]]);
  private onChange?: (meta: HistoryMeta) => void;
  private onExecute?: CommandExecuteListener;
  private nextEntryId = 1;
  private nextOrder = 1;
  private readonly mergeWindowMs: number;
  private lastExecuteTime = 0;

  constructor(private readonly maxHistory = 100, options: CommandManagerOptions = {}) {
    this.maxHistory = options.maxHistory ?? maxHistory;
    this.mergeWindowMs = options.mergeWindowMs ?? 200;
  }

  setOnChange(onChange: (meta: HistoryMeta) => void): void {
    this.onChange = onChange;
    this.emitChange();
  }

  setOnExecute(onExecute?: CommandExecuteListener): void {
    this.onExecute = onExecute;
  }

  execute(command: Command): void {
    const now = Date.now();

    // Attempt merge with the most recent command if within time window
    if (this.canMergeWithPrevious(command, now)) {
      const prevNode = this.current;
      if (prevNode.command) {
        const merged = prevNode.command.merge!(command);
        if (merged) {
          // Replace the previous command with the merged one
          prevNode.command = merged;
          prevNode.entry = {
            ...prevNode.entry!,
            description: merged.description,
            timestamp: new Date().toISOString(),
          };
          merged.execute();
          this.onExecute?.(merged);
          this.lastExecuteTime = now;
          this.emitChange();
          return;
        }
      }
    }

    command.execute();
    this.onExecute?.(command);
    const entry: HistoryEntry = {
      id: `history-${this.nextEntryId++}`,
      description: command.description,
      timestamp: new Date().toISOString(),
      affectedClipCount: inferAffectedClipCount(command),
    };
    const node: CommandHistoryNode = {
      id: entry.id,
      command,
      entry,
      parent: this.current,
      children: [],
      order: this.nextOrder++,
    };
    this.current.children.push(node);
    this.current.preferredChildId = node.id;
    this.nodeById.set(node.id, node);
    this.enforceBranchLimit(this.current);
    this.current = node;
    this.pruneToMaxHistory();
    this.lastExecuteTime = now;
    this.emitChange();
  }

  private canMergeWithPrevious(command: Command, now: number): boolean {
    if (!command.merge) return false;
    if (now - this.lastExecuteTime > this.mergeWindowMs) return false;
    if (this.current === this.root) return false;
    return true;
  }

  undo(): void {
    if (!this.canUndo()) {
      return;
    }
    const node = this.current;
    node.command?.undo();
    const parent = node.parent ?? this.root;
    parent.preferredChildId = node.id;
    this.current = parent;
    this.emitChange();
  }

  redo(): void {
    if (!this.canRedo()) {
      return;
    }
    const next = this.getPreferredRedoChild(this.current);
    if (!next) {
      return;
    }
    next.command?.execute();
    this.current.preferredChildId = next.id;
    this.current = next;
    this.emitChange();
  }

  jumpTo(index: number): void {
    const flattened = this.flattenHistory();
    const targetIndex = Math.min(flattened.length - 1, Math.max(-1, Math.floor(index)));
    const target = targetIndex < 0 ? this.root : (flattened[targetIndex]?.node ?? this.root);
    this.jumpToNode(target);
  }

  jumpToEntry(entryId: string): void {
    this.jumpToNode(this.nodeById.get(entryId) ?? this.current);
  }

  switchToPreviousBranch(): void {
    const target = this.findPreviousBranchTarget();
    if (target) {
      this.jumpToNode(target);
    }
  }

  private jumpToNode(target: CommandHistoryNode): void {
    if (target === this.current) {
      return;
    }
    const currentPath = this.pathFromRoot(this.current);
    const targetPath = this.pathFromRoot(target);
    let shared = 0;
    while (shared < currentPath.length && shared < targetPath.length && currentPath[shared] === targetPath[shared]) {
      shared += 1;
    }
    while (this.current !== (shared === 0 ? this.root : currentPath[shared - 1])) {
      const node = this.current;
      node.command?.undo();
      const parent = node.parent ?? this.root;
      parent.preferredChildId = node.id;
      this.current = parent;
    }
    for (const node of targetPath.slice(shared)) {
      node.command?.execute();
      const parent = node.parent ?? this.root;
      parent.preferredChildId = node.id;
      this.current = node;
    }
    this.emitChange();
  }

  canUndo(): boolean {
    return this.current !== this.root;
  }

  canRedo(): boolean {
    return this.current.children.length > 0;
  }

  clear(): void {
    this.root.children = [];
    this.root.preferredChildId = undefined;
    this.current = this.root;
    this.nodeById = new Map([[this.root.id, this.root]]);
    this.emitChange();
  }

  getHistoryMeta(): HistoryMeta {
    const flattened = this.flattenHistory();
    const activePathIds = new Set(this.pathFromRoot(this.current).map((node) => node.id));
    const cursor = flattened.findIndex((item) => item.node === this.current);
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      cursor,
      entries: flattened.map(({ node, depth, branchIndex, siblingCount }) => ({
        ...node.entry!,
        parentId: node.parent?.entry?.id,
        branchDepth: depth,
        branchIndex,
        siblingCount,
        childCount: node.children.length,
        isCurrent: node === this.current,
        activePath: activePathIds.has(node.id),
      })),
      position: cursor + 1,
      total: flattened.length,
    };
  }

  historySize(): number {
    return this.flattenHistory().length;
  }

  private emitChange(): void {
    this.onChange?.(this.getHistoryMeta());
  }

  private flattenHistory(): FlattenedCommandHistoryNode[] {
    const flattened: FlattenedCommandHistoryNode[] = [];
    const visit = (node: CommandHistoryNode, depth: number) => {
      node.children.forEach((child, index) => {
        flattened.push({ node: child, depth, branchIndex: index, siblingCount: node.children.length });
        visit(child, depth + 1);
      });
    };
    visit(this.root, 0);
    return flattened;
  }

  private pathFromRoot(node: CommandHistoryNode): CommandHistoryNode[] {
    const path: CommandHistoryNode[] = [];
    let cursor: CommandHistoryNode | undefined = node;
    while (cursor && cursor !== this.root) {
      path.unshift(cursor);
      cursor = cursor.parent;
    }
    return path;
  }

  private getPreferredRedoChild(node: CommandHistoryNode): CommandHistoryNode | undefined {
    return node.children.find((child) => child.id === node.preferredChildId) ?? node.children.at(-1);
  }

  private findPreviousBranchTarget(): CommandHistoryNode | undefined {
    if (this.current.children.length > 1) {
      const preferredIndex = this.current.children.findIndex((child) => child.id === this.current.preferredChildId);
      const startIndex = preferredIndex >= 0 ? preferredIndex : this.current.children.length;
      return this.current.children[(startIndex - 1 + this.current.children.length) % this.current.children.length];
    }
    let node: CommandHistoryNode | undefined = this.current;
    while (node?.parent) {
      const siblings = node.parent.children;
      if (siblings.length > 1) {
        const index = siblings.indexOf(node);
        return siblings[(index - 1 + siblings.length) % siblings.length];
      }
      node = node.parent;
    }
    return undefined;
  }

  private enforceBranchLimit(parent: CommandHistoryNode): void {
    while (parent.children.length > 3) {
      const [removed] = parent.children.splice(0, 1);
      if (removed) {
        this.removeSubtree(removed);
      }
    }
  }

  private pruneToMaxHistory(): void {
    while (this.historySize() > this.maxHistory) {
      const oldest = this.flattenHistory().sort((left, right) => left.node.order - right.node.order)[0]?.node;
      if (!oldest) {
        return;
      }
      this.promoteChildrenAndRemove(oldest);
    }
  }

  private promoteChildrenAndRemove(node: CommandHistoryNode): void {
    const parent = node.parent;
    if (!parent) {
      return;
    }
    const index = parent.children.indexOf(node);
    if (index < 0) {
      return;
    }
    for (const child of node.children) {
      child.parent = parent;
    }
    parent.children.splice(index, 1, ...node.children);
    if (parent.preferredChildId === node.id) {
      parent.preferredChildId = node.children.at(-1)?.id;
    }
    this.nodeById.delete(node.id);
    if (this.current === node) {
      this.current = parent;
    }
  }

  private removeSubtree(node: CommandHistoryNode): void {
    for (const child of node.children) {
      this.removeSubtree(child);
    }
    this.nodeById.delete(node.id);
    if (this.current === node) {
      this.current = node.parent ?? this.root;
    }
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
