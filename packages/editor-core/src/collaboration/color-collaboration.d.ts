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
/** 协作用户角色 */
export type ColorCollabRole = 'owner' | 'editor' | 'viewer' | 'commenter';
/** 协作操作类型 */
export type ColorCollabOperationType = 'wheel-adjust' | 'slider-adjust' | 'curve-adjust' | 'lut-apply' | 'preset-apply' | 'node-add' | 'node-remove' | 'node-connect' | 'parameter-set';
/** 协作用户 */
export interface ColorCollabUser {
    userId: string;
    userName: string;
    role: ColorCollabRole;
    color: string;
    isOnline: boolean;
    lastSeen: number;
    cursorPosition?: {
        nodeId: string;
        parameter: string;
    } | null;
}
/** 调色参数变更操作 */
export interface ColorCollabOperation {
    id: string;
    type: ColorCollabOperationType;
    userId: string;
    timestamp: number;
    /** 被修改的节点 ID */
    targetNodeId: string;
    /** 参数路径 (如 "lift.r", "gamma.g") */
    parameterPath: string;
    /** 旧值 */
    previousValue: unknown;
    /** 新值 */
    newValue: unknown;
    /** OT 版本号 */
    version: number;
    /** 此操作基于的版本 */
    baseVersion: number;
}
/** 协作会话配置 */
export interface ColorCollabSessionConfig {
    sessionId: string;
    projectId: string;
    hostUserId: string;
    maxUsers: number;
    enableComments: boolean;
    enableHistory: boolean;
    historyLimit: number;
    syncIntervalMs: number;
    conflictResolution: 'last-write-wins' | 'ot-rebase' | 'manual';
}
/** 协作会话状态 */
export interface ColorCollabSessionState {
    config: ColorCollabSessionConfig;
    users: ColorCollabUser[];
    version: number;
    operations: ColorCollabOperation[];
    pendingOperations: ColorCollabOperation[];
    comments: ColorCollabComment[];
    isLocked: boolean;
    lockedBy: string | null;
    createdAt: number;
    updatedAt: number;
}
/** 协作评论 */
export interface ColorCollabComment {
    id: string;
    userId: string;
    userName: string;
    nodeId: string;
    text: string;
    timestamp: number;
    resolved: boolean;
    replies: ColorCollabCommentReply[];
}
/** 评论回复 */
export interface ColorCollabCommentReply {
    id: string;
    userId: string;
    userName: string;
    text: string;
    timestamp: number;
}
/** 冲突检测结果 */
export interface ColorCollabConflict {
    operationA: ColorCollabOperation;
    operationB: ColorCollabOperation;
    conflictType: 'same-parameter' | 'dependent-parameter' | 'structural';
    resolution: 'auto-resolved' | 'needs-manual' | 'rejected';
    resolvedValue?: unknown;
}
/** OT 变换结果 */
export interface OTTransformResult {
    transformed: ColorCollabOperation;
    conflicts: ColorCollabConflict[];
    applied: boolean;
}
/** 协作事件 */
export type ColorCollabEvent = {
    type: 'user-joined';
    user: ColorCollabUser;
} | {
    type: 'user-left';
    userId: string;
} | {
    type: 'operation';
    operation: ColorCollabOperation;
} | {
    type: 'conflict';
    conflict: ColorCollabConflict;
} | {
    type: 'comment';
    comment: ColorCollabComment;
} | {
    type: 'version-sync';
    version: number;
} | {
    type: 'session-locked';
    lockedBy: string;
} | {
    type: 'session-unlocked';
};
/** 事件回调 */
export type ColorCollabEventHandler = (event: ColorCollabEvent) => void;
/** 创建默认会话配置 */
export declare function createDefaultCollabSessionConfig(sessionId: string, projectId: string, hostUserId: string): ColorCollabSessionConfig;
/** 创建空会话状态 */
export declare function createEmptyCollabSessionState(config: ColorCollabSessionConfig): ColorCollabSessionState;
/** 创建协作用户 */
export declare function createCollabUser(userId: string, userName: string, role?: ColorCollabRole, colorIndex?: number): ColorCollabUser;
/** 创建调色操作 */
export declare function createColorCollabOperation(type: ColorCollabOperationType, userId: string, targetNodeId: string, parameterPath: string, previousValue: unknown, newValue: unknown, baseVersion: number): ColorCollabOperation;
/** 验证操作合法性 */
export declare function validateCollabOperation(operation: ColorCollabOperation, user: ColorCollabUser, sessionVersion: number): {
    valid: boolean;
    reason?: string;
};
/** 验证用户角色 */
export declare function validateCollabRole(role: string): role is ColorCollabRole;
/** 检测两个操作是否冲突 */
export declare function detectConflict(opA: ColorCollabOperation, opB: ColorCollabOperation): ColorCollabConflict | null;
/** OT 变换：将操作 op 相对于已应用的操作 againstOp 进行变换 */
export declare function transformOperation(op: ColorCollabOperation, againstOp: ColorCollabOperation): OTTransformResult;
/** 批量 OT 变换：将待处理操作相对于已应用操作列表进行变换 */
export declare function transformOperations(pending: ColorCollabOperation[], applied: ColorCollabOperation[]): {
    transformed: ColorCollabOperation[];
    conflicts: ColorCollabConflict[];
};
/** 添加用户到会话 */
export declare function addUserToSession(state: ColorCollabSessionState, user: ColorCollabUser): {
    state: ColorCollabSessionState;
    accepted: boolean;
    reason?: string;
};
/** 从会话移除用户 */
export declare function removeUserFromSession(state: ColorCollabSessionState, userId: string): ColorCollabSessionState;
/** 更新用户在线状态 */
export declare function updateUserPresence(state: ColorCollabSessionState, userId: string, isOnline: boolean, cursorPosition?: {
    nodeId: string;
    parameter: string;
} | null): ColorCollabSessionState;
/** 应用操作到会话状态 */
export declare function applyOperation(state: ColorCollabSessionState, operation: ColorCollabOperation): {
    state: ColorCollabSessionState;
    result: OTTransformResult;
};
/** 批量应用操作 */
export declare function applyOperations(state: ColorCollabSessionState, operations: ColorCollabOperation[]): {
    state: ColorCollabSessionState;
    results: OTTransformResult[];
};
/** 锁定会话（防编辑冲突） */
export declare function lockSession(state: ColorCollabSessionState, userId: string): {
    state: ColorCollabSessionState;
    acquired: boolean;
};
/** 解锁会话 */
export declare function unlockSession(state: ColorCollabSessionState, userId: string): ColorCollabSessionState;
/** 添加评论 */
export declare function addComment(state: ColorCollabSessionState, userId: string, userName: string, nodeId: string, text: string): ColorCollabSessionState;
/** 回复评论 */
export declare function replyToComment(state: ColorCollabSessionState, commentId: string, userId: string, userName: string, text: string): ColorCollabSessionState;
/** 解决评论 */
export declare function resolveComment(state: ColorCollabSessionState, commentId: string): ColorCollabSessionState;
/** 获取节点上的评论 */
export declare function getCommentsForNode(state: ColorCollabSessionState, nodeId: string): ColorCollabComment[];
/** 撤销最后操作 */
export declare function undoLastOperation(state: ColorCollabSessionState, userId: string): {
    state: ColorCollabSessionState;
    undone: ColorCollabOperation | null;
};
/** 序列化操作为 JSON */
export declare function serializeOperation(operation: ColorCollabOperation): string;
/** 从 JSON 解析操作 */
export declare function parseOperation(json: string): ColorCollabOperation | null;
/** 序列化会话快照 */
export declare function serializeSessionSnapshot(state: ColorCollabSessionState): string;
/** 从快照恢复会话状态 */
export declare function deserializeSessionSnapshot(json: string): ColorCollabSessionState | null;
/**
 * 调色协作管理器
 *
 * 管理实时协作调色会话，处理用户操作同步、冲突解决和评论。
 */
export declare class ColorCollaborationManager {
    private state;
    private eventHandlers;
    private syncTimer;
    constructor(config: ColorCollabSessionConfig);
    /** 获取当前状态 */
    getState(): ColorCollabSessionState;
    /** 注册事件处理器 */
    onEvent(handler: ColorCollabEventHandler): () => void;
    /** 用户加入 */
    joinUser(userId: string, userName: string, role?: ColorCollabRole): boolean;
    /** 用户离开 */
    leaveUser(userId: string): void;
    /** 更新用户光标位置 */
    updateCursor(userId: string, nodeId: string, parameter: string): void;
    /** 提交操作 */
    submitOperation(operation: ColorCollabOperation): OTTransformResult;
    /** 添加评论 */
    addComment(userId: string, userName: string, nodeId: string, text: string): void;
    /** 撤销 */
    undo(userId: string): ColorCollabOperation | null;
    /** 锁定会话 */
    lock(userId: string): boolean;
    /** 解锁会话 */
    unlock(userId: string): void;
    /** 开始同步定时器 */
    startSync(intervalMs?: number): void;
    /** 停止同步 */
    stopSync(): void;
    /** 导出快照 */
    exportSnapshot(): string;
    /** 导入快照 */
    importSnapshot(json: string): boolean;
    /** 销毁 */
    dispose(): void;
    private emit;
    private createRejectedConflict;
}
//# sourceMappingURL=color-collaboration.d.ts.map