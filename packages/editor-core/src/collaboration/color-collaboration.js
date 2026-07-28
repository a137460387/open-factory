/**
 * 实时协作调色模块
 *
 * 功能：
 * 1. 多用户调色参数实时同步
 * 2. OT (Operational Transformation) 冲突检测与解决
 * 3. 协作权限管理（编辑/查看/评论）
 * 4. 用户在线状态与光标同步
 * 5. 调色历史与撤销
 */
// ==================== 常量 ====================
const DEFAULT_SESSION_CONFIG = {
    sessionId: '',
    projectId: '',
    hostUserId: '',
    maxUsers: 8,
    enableComments: true,
    enableHistory: true,
    historyLimit: 500,
    syncIntervalMs: 100,
    conflictResolution: 'ot-rebase',
};
const USER_COLORS = ['#38bdf8', '#f59e0b', '#a78bfa', '#10b981', '#f43f5e', '#22c55e', '#6366f1', '#14b8a6'];
// ==================== 工具函数 ====================
function generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
// ==================== 默认工厂函数 ====================
/** 创建默认会话配置 */
export function createDefaultCollabSessionConfig(sessionId, projectId, hostUserId) {
    return { ...DEFAULT_SESSION_CONFIG, sessionId, projectId, hostUserId };
}
/** 创建空会话状态 */
export function createEmptyCollabSessionState(config) {
    return {
        config,
        users: [],
        version: 0,
        operations: [],
        pendingOperations: [],
        comments: [],
        isLocked: false,
        lockedBy: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}
/** 创建协作用户 */
export function createCollabUser(userId, userName, role = 'editor', colorIndex = 0) {
    return {
        userId,
        userName,
        role,
        color: USER_COLORS[colorIndex % USER_COLORS.length],
        isOnline: true,
        lastSeen: Date.now(),
        cursorPosition: null,
    };
}
/** 创建调色操作 */
export function createColorCollabOperation(type, userId, targetNodeId, parameterPath, previousValue, newValue, baseVersion) {
    return {
        id: generateId('collab-op'),
        type,
        userId,
        timestamp: Date.now(),
        targetNodeId,
        parameterPath,
        previousValue,
        newValue,
        version: baseVersion + 1,
        baseVersion,
    };
}
// ==================== 验证函数 ====================
/** 验证操作合法性 */
export function validateCollabOperation(operation, user, sessionVersion) {
    // 权限检查
    if (user.role === 'viewer') {
        return { valid: false, reason: '查看者无权修改调色参数' };
    }
    if (user.role === 'commenter' && operation.type !== 'parameter-set') {
        return { valid: false, reason: '评论者仅可添加评论' };
    }
    // 版本检查
    if (operation.baseVersion > sessionVersion) {
        return { valid: false, reason: `基础版本 ${operation.baseVersion} 超过当前版本 ${sessionVersion}` };
    }
    // 参数范围检查
    if (typeof operation.newValue === 'number') {
        if (isNaN(operation.newValue)) {
            return { valid: false, reason: '参数值不能为 NaN' };
        }
        if (!isFinite(operation.newValue)) {
            return { valid: false, reason: '参数值必须为有限数' };
        }
    }
    return { valid: true };
}
/** 验证用户角色 */
export function validateCollabRole(role) {
    return role === 'owner' || role === 'editor' || role === 'viewer' || role === 'commenter';
}
// ==================== OT 冲突检测与解决 ====================
/** 检测两个操作是否冲突 */
export function detectConflict(opA, opB) {
    // 同一节点同一参数的并发修改
    if (opA.targetNodeId === opB.targetNodeId && opA.parameterPath === opB.parameterPath) {
        if (opA.baseVersion === opB.baseVersion && opA.userId !== opB.userId) {
            return {
                operationA: opA,
                operationB: opB,
                conflictType: 'same-parameter',
                resolution: 'auto-resolved',
            };
        }
    }
    // 结构性冲突（添加/删除节点）
    if ((opA.type === 'node-remove' && opB.targetNodeId === opA.targetNodeId) ||
        (opB.type === 'node-remove' && opA.targetNodeId === opB.targetNodeId)) {
        return {
            operationA: opA,
            operationB: opB,
            conflictType: 'structural',
            resolution: 'needs-manual',
        };
    }
    return null;
}
/** OT 变换：将操作 op 相对于已应用的操作 againstOp 进行变换 */
export function transformOperation(op, againstOp) {
    // 不同节点的操作互不影响
    if (op.targetNodeId !== againstOp.targetNodeId) {
        return { transformed: { ...op, baseVersion: op.baseVersion + 1 }, conflicts: [], applied: true };
    }
    // 同节点不同参数
    if (op.parameterPath !== againstOp.parameterPath) {
        return { transformed: { ...op, baseVersion: op.baseVersion + 1 }, conflicts: [], applied: true };
    }
    // 同参数冲突 - 使用 last-write-wins 或合并策略
    const conflict = detectConflict(op, againstOp);
    if (conflict) {
        // 时间戳较新的胜出
        if (op.timestamp > againstOp.timestamp) {
            return {
                transformed: { ...op, baseVersion: againstOp.version },
                conflicts: [{ ...conflict, resolution: 'auto-resolved', resolvedValue: op.newValue }],
                applied: true,
            };
        }
        else {
            return {
                transformed: { ...op, baseVersion: againstOp.version },
                conflicts: [{ ...conflict, resolution: 'auto-resolved', resolvedValue: againstOp.newValue }],
                applied: false,
            };
        }
    }
    return { transformed: { ...op, baseVersion: op.baseVersion + 1 }, conflicts: [], applied: true };
}
/** 批量 OT 变换：将待处理操作相对于已应用操作列表进行变换 */
export function transformOperations(pending, applied) {
    const allConflicts = [];
    let transformed = [...pending];
    for (const appliedOp of applied) {
        const next = [];
        for (const pendOp of transformed) {
            const result = transformOperation(pendOp, appliedOp);
            next.push(result.transformed);
            allConflicts.push(...result.conflicts);
        }
        transformed = next;
    }
    return { transformed, conflicts: allConflicts };
}
// ==================== 会话管理 ====================
/** 添加用户到会话 */
export function addUserToSession(state, user) {
    if (state.users.length >= state.config.maxUsers) {
        return { state, accepted: false, reason: '会话已满' };
    }
    if (state.users.some((u) => u.userId === user.userId)) {
        return { state, accepted: false, reason: '用户已在会话中' };
    }
    return {
        state: {
            ...state,
            users: [...state.users, { ...user, isOnline: true, lastSeen: Date.now() }],
            updatedAt: Date.now(),
        },
        accepted: true,
    };
}
/** 从会话移除用户 */
export function removeUserFromSession(state, userId) {
    return {
        ...state,
        users: state.users.filter((u) => u.userId !== userId),
        updatedAt: Date.now(),
    };
}
/** 更新用户在线状态 */
export function updateUserPresence(state, userId, isOnline, cursorPosition) {
    return {
        ...state,
        users: state.users.map((u) => u.userId === userId
            ? { ...u, isOnline, lastSeen: Date.now(), cursorPosition: cursorPosition ?? u.cursorPosition }
            : u),
        updatedAt: Date.now(),
    };
}
/** 应用操作到会话状态 */
export function applyOperation(state, operation) {
    // 验证操作
    const user = state.users.find((u) => u.userId === operation.userId);
    if (!user) {
        return {
            state,
            result: { transformed: operation, conflicts: [], applied: false },
        };
    }
    const validation = validateCollabOperation(operation, user, state.version);
    if (!validation.valid) {
        return {
            state,
            result: { transformed: operation, conflicts: [], applied: false },
        };
    }
    // OT 变换
    const pendingOps = state.pendingOperations.filter((op) => op.userId !== operation.userId);
    const { transformed, conflicts } = transformOperations([operation], pendingOps);
    const finalOp = transformed[0];
    if (!finalOp) {
        return { state, result: { transformed: operation, conflicts, applied: false } };
    }
    const newVersion = state.version + 1;
    const appliedOp = { ...finalOp, version: newVersion };
    return {
        state: {
            ...state,
            version: newVersion,
            operations: state.config.enableHistory
                ? [...state.operations, appliedOp].slice(-state.config.historyLimit)
                : state.operations,
            pendingOperations: [...state.pendingOperations, appliedOp],
            updatedAt: Date.now(),
        },
        result: { transformed: appliedOp, conflicts, applied: true },
    };
}
/** 批量应用操作 */
export function applyOperations(state, operations) {
    let currentState = state;
    const results = [];
    for (const op of operations) {
        const { state: newState, result } = applyOperation(currentState, op);
        currentState = newState;
        results.push(result);
    }
    return { state: currentState, results };
}
/** 锁定会话（防编辑冲突） */
export function lockSession(state, userId) {
    if (state.isLocked && state.lockedBy !== userId) {
        return { state, acquired: false };
    }
    return {
        state: { ...state, isLocked: true, lockedBy: userId, updatedAt: Date.now() },
        acquired: true,
    };
}
/** 解锁会话 */
export function unlockSession(state, userId) {
    if (state.lockedBy !== userId)
        return state;
    return { ...state, isLocked: false, lockedBy: null, updatedAt: Date.now() };
}
// ==================== 评论系统 ====================
/** 添加评论 */
export function addComment(state, userId, userName, nodeId, text) {
    if (!state.config.enableComments)
        return state;
    const comment = {
        id: generateId('comment'),
        userId,
        userName,
        nodeId,
        text,
        timestamp: Date.now(),
        resolved: false,
        replies: [],
    };
    return {
        ...state,
        comments: [...state.comments, comment],
        updatedAt: Date.now(),
    };
}
/** 回复评论 */
export function replyToComment(state, commentId, userId, userName, text) {
    const reply = {
        id: generateId('reply'),
        userId,
        userName,
        text,
        timestamp: Date.now(),
    };
    return {
        ...state,
        comments: state.comments.map((c) => (c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c)),
        updatedAt: Date.now(),
    };
}
/** 解决评论 */
export function resolveComment(state, commentId) {
    return {
        ...state,
        comments: state.comments.map((c) => (c.id === commentId ? { ...c, resolved: true } : c)),
        updatedAt: Date.now(),
    };
}
/** 获取节点上的评论 */
export function getCommentsForNode(state, nodeId) {
    return state.comments.filter((c) => c.nodeId === nodeId && !c.resolved);
}
// ==================== 撤销/重做 ====================
/** 撤销最后操作 */
export function undoLastOperation(state, userId) {
    const userOps = state.operations.filter((op) => op.userId === userId);
    if (userOps.length === 0)
        return { state, undone: null };
    const lastOp = userOps[userOps.length - 1];
    const undoOp = createColorCollabOperation(lastOp.type, userId, lastOp.targetNodeId, lastOp.parameterPath, lastOp.newValue, lastOp.previousValue, state.version);
    const { state: newState } = applyOperation(state, undoOp);
    return { state: newState, undone: lastOp };
}
// ==================== 序列化 ====================
/** 序列化操作为 JSON */
export function serializeOperation(operation) {
    return JSON.stringify(operation);
}
/** 从 JSON 解析操作 */
export function parseOperation(json) {
    try {
        const parsed = JSON.parse(json);
        if (!parsed.id || !parsed.type || !parsed.userId || !parsed.targetNodeId || !parsed.parameterPath) {
            return null;
        }
        if (typeof parsed.timestamp !== 'number' || typeof parsed.version !== 'number') {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
/** 序列化会话快照 */
export function serializeSessionSnapshot(state) {
    return JSON.stringify({
        config: state.config,
        users: state.users,
        version: state.version,
        operations: state.operations.slice(-100), // 只保留最近 100 条
        comments: state.comments,
        isLocked: state.isLocked,
        lockedBy: state.lockedBy,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
    });
}
/** 从快照恢复会话状态 */
export function deserializeSessionSnapshot(json) {
    try {
        const parsed = JSON.parse(json);
        if (!parsed.config || parsed.version == null)
            return null;
        return {
            config: parsed.config,
            users: Array.isArray(parsed.users) ? parsed.users : [],
            version: parsed.version,
            operations: Array.isArray(parsed.operations) ? parsed.operations : [],
            pendingOperations: [],
            comments: Array.isArray(parsed.comments) ? parsed.comments : [],
            isLocked: !!parsed.isLocked,
            lockedBy: parsed.lockedBy ?? null,
            createdAt: parsed.createdAt ?? Date.now(),
            updatedAt: parsed.updatedAt ?? Date.now(),
        };
    }
    catch {
        return null;
    }
}
// ==================== 协作管理器 ====================
/**
 * 调色协作管理器
 *
 * 管理实时协作调色会话，处理用户操作同步、冲突解决和评论。
 */
export class ColorCollaborationManager {
    state;
    eventHandlers = new Set();
    syncTimer = null;
    constructor(config) {
        this.state = createEmptyCollabSessionState(config);
    }
    /** 获取当前状态 */
    getState() {
        return this.state;
    }
    /** 注册事件处理器 */
    onEvent(handler) {
        this.eventHandlers.add(handler);
        return () => this.eventHandlers.delete(handler);
    }
    /** 用户加入 */
    joinUser(userId, userName, role = 'editor') {
        const colorIndex = this.state.users.length;
        const user = createCollabUser(userId, userName, role, colorIndex);
        const { state, accepted, reason } = addUserToSession(this.state, user);
        if (!accepted) {
            this.emit({ type: 'conflict', conflict: this.createRejectedConflict(reason ?? '加入失败') });
            return false;
        }
        this.state = state;
        this.emit({ type: 'user-joined', user });
        return true;
    }
    /** 用户离开 */
    leaveUser(userId) {
        this.state = removeUserFromSession(this.state, userId);
        this.emit({ type: 'user-left', userId });
    }
    /** 更新用户光标位置 */
    updateCursor(userId, nodeId, parameter) {
        this.state = updateUserPresence(this.state, userId, true, { nodeId, parameter });
    }
    /** 提交操作 */
    submitOperation(operation) {
        const { state, result } = applyOperation(this.state, operation);
        this.state = state;
        if (result.applied) {
            this.emit({ type: 'operation', operation: result.transformed });
        }
        for (const conflict of result.conflicts) {
            this.emit({ type: 'conflict', conflict });
        }
        return result;
    }
    /** 添加评论 */
    addComment(userId, userName, nodeId, text) {
        this.state = addComment(this.state, userId, userName, nodeId, text);
        const comment = this.state.comments[this.state.comments.length - 1];
        if (comment) {
            this.emit({ type: 'comment', comment });
        }
    }
    /** 撤销 */
    undo(userId) {
        const { state, undone } = undoLastOperation(this.state, userId);
        this.state = state;
        return undone;
    }
    /** 锁定会话 */
    lock(userId) {
        const { state, acquired } = lockSession(this.state, userId);
        this.state = state;
        if (acquired)
            this.emit({ type: 'session-locked', lockedBy: userId });
        return acquired;
    }
    /** 解锁会话 */
    unlock(userId) {
        this.state = unlockSession(this.state, userId);
        if (!this.state.isLocked)
            this.emit({ type: 'session-unlocked' });
    }
    /** 开始同步定时器 */
    startSync(intervalMs) {
        this.stopSync();
        const interval = intervalMs ?? this.state.config.syncIntervalMs;
        this.syncTimer = setInterval(() => {
            this.emit({ type: 'version-sync', version: this.state.version });
        }, interval);
    }
    /** 停止同步 */
    stopSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }
    /** 导出快照 */
    exportSnapshot() {
        return serializeSessionSnapshot(this.state);
    }
    /** 导入快照 */
    importSnapshot(json) {
        const restored = deserializeSessionSnapshot(json);
        if (!restored)
            return false;
        this.state = restored;
        return true;
    }
    /** 销毁 */
    dispose() {
        this.stopSync();
        this.eventHandlers.clear();
    }
    // === 内部 ===
    emit(event) {
        for (const handler of this.eventHandlers) {
            try {
                handler(event);
            }
            catch {
                /* 忽略回调异常 */
            }
        }
    }
    createRejectedConflict(reason) {
        const dummyOp = createColorCollabOperation('parameter-set', '', '', '', null, null, 0);
        return {
            operationA: dummyOp,
            operationB: dummyOp,
            conflictType: 'structural',
            resolution: 'rejected',
            resolvedValue: reason,
        };
    }
}
//# sourceMappingURL=color-collaboration.js.map