export class CommandManager {
    maxHistory;
    root = { id: 'history-root', children: [], order: 0 };
    current = this.root;
    nodeById = new Map([[this.root.id, this.root]]);
    onChange;
    onExecute;
    nextEntryId = 1;
    nextOrder = 1;
    mergeWindowMs;
    lastExecuteTime = 0;
    constructor(maxHistory = 100, options = {}) {
        this.maxHistory = maxHistory;
        this.maxHistory = options.maxHistory ?? maxHistory;
        this.mergeWindowMs = options.mergeWindowMs ?? 200;
    }
    setOnChange(onChange) {
        this.onChange = onChange;
        this.emitChange();
    }
    setOnExecute(onExecute) {
        this.onExecute = onExecute;
    }
    execute(command) {
        const now = Date.now();
        // Attempt merge with the most recent command if within time window
        if (this.canMergeWithPrevious(command, now)) {
            const prevNode = this.current;
            if (prevNode.command) {
                const merged = prevNode.command.merge(command);
                if (merged) {
                    // Replace the previous command with the merged one
                    prevNode.command = merged;
                    prevNode.entry = {
                        ...prevNode.entry,
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
        const entry = {
            id: `history-${this.nextEntryId++}`,
            description: command.description,
            timestamp: new Date().toISOString(),
            affectedClipCount: inferAffectedClipCount(command),
        };
        const node = {
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
    canMergeWithPrevious(command, now) {
        if (!command.merge)
            return false;
        if (now - this.lastExecuteTime > this.mergeWindowMs)
            return false;
        if (this.current === this.root)
            return false;
        return true;
    }
    undo() {
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
    redo() {
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
    jumpTo(index) {
        const flattened = this.flattenHistory();
        const targetIndex = Math.min(flattened.length - 1, Math.max(-1, Math.floor(index)));
        const target = targetIndex < 0 ? this.root : (flattened[targetIndex]?.node ?? this.root);
        this.jumpToNode(target);
    }
    jumpToEntry(entryId) {
        this.jumpToNode(this.nodeById.get(entryId) ?? this.current);
    }
    switchToPreviousBranch() {
        const target = this.findPreviousBranchTarget();
        if (target) {
            this.jumpToNode(target);
        }
    }
    jumpToNode(target) {
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
    canUndo() {
        return this.current !== this.root;
    }
    canRedo() {
        return this.current.children.length > 0;
    }
    clear() {
        this.root.children = [];
        this.root.preferredChildId = undefined;
        this.current = this.root;
        this.nodeById = new Map([[this.root.id, this.root]]);
        this.emitChange();
    }
    getHistoryMeta() {
        const flattened = this.flattenHistory();
        const activePathIds = new Set(this.pathFromRoot(this.current).map((node) => node.id));
        const cursor = flattened.findIndex((item) => item.node === this.current);
        return {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            cursor,
            entries: flattened.map(({ node, depth, branchIndex, siblingCount }) => ({
                ...node.entry,
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
    historySize() {
        return this.flattenHistory().length;
    }
    emitChange() {
        this.onChange?.(this.getHistoryMeta());
    }
    flattenHistory() {
        const flattened = [];
        const visit = (node, depth) => {
            node.children.forEach((child, index) => {
                flattened.push({ node: child, depth, branchIndex: index, siblingCount: node.children.length });
                visit(child, depth + 1);
            });
        };
        visit(this.root, 0);
        return flattened;
    }
    pathFromRoot(node) {
        const path = [];
        let cursor = node;
        while (cursor && cursor !== this.root) {
            path.unshift(cursor);
            cursor = cursor.parent;
        }
        return path;
    }
    getPreferredRedoChild(node) {
        return node.children.find((child) => child.id === node.preferredChildId) ?? node.children.at(-1);
    }
    findPreviousBranchTarget() {
        if (this.current.children.length > 1) {
            const preferredIndex = this.current.children.findIndex((child) => child.id === this.current.preferredChildId);
            const startIndex = preferredIndex >= 0 ? preferredIndex : this.current.children.length;
            return this.current.children[(startIndex - 1 + this.current.children.length) % this.current.children.length];
        }
        let node = this.current;
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
    enforceBranchLimit(parent) {
        while (parent.children.length > 3) {
            const [removed] = parent.children.splice(0, 1);
            if (removed) {
                this.removeSubtree(removed);
            }
        }
    }
    pruneToMaxHistory() {
        while (this.historySize() > this.maxHistory) {
            const oldest = this.flattenHistory().sort((left, right) => left.node.order - right.node.order)[0]?.node;
            if (!oldest) {
                return;
            }
            this.promoteChildrenAndRemove(oldest);
        }
    }
    promoteChildrenAndRemove(node) {
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
    removeSubtree(node) {
        for (const child of node.children) {
            this.removeSubtree(child);
        }
        this.nodeById.delete(node.id);
        if (this.current === node) {
            this.current = node.parent ?? this.root;
        }
    }
}
function inferAffectedClipCount(command) {
    const record = command;
    const ids = new Set();
    collectClipId(record.clipId, ids);
    collectClipIds(record.clipIds, ids);
    collectClipIds(record.selectedClipIds, ids);
    collectClipIds(Object.keys(record.newStartsByClipId ?? {}), ids);
    collectClipLike(record.clip, ids);
    collectClipLike(record.before, ids);
    collectClipLike(record.after, ids);
    collectTrackLike(record.track, ids);
    collectTrackLike(record.removedTrack, ids);
    return ids.size;
}
function collectClipId(value, ids) {
    if (typeof value === 'string' && value.trim()) {
        ids.add(value);
    }
}
function collectClipIds(value, ids) {
    if (!Array.isArray(value)) {
        return;
    }
    for (const item of value) {
        collectClipId(item, ids);
    }
}
function collectClipLike(value, ids) {
    if (value && typeof value === 'object') {
        collectClipId(value.id, ids);
    }
}
function collectTrackLike(value, ids) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.clips)) {
        return;
    }
    for (const clip of value.clips) {
        collectClipLike(clip, ids);
    }
}
//# sourceMappingURL=command-manager.js.map