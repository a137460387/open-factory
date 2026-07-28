/**
 * Export Queue Completion Actions
 *
 * Supports system notification and auto-shutdown after batch rendering.
 * Pure functions for state management.
 */
export type CompletionActionType = 'notify' | 'shutdown' | 'sleep' | 'hibernate' | 'open_folder';
export interface CompletionAction {
    id: string;
    type: CompletionActionType;
    enabled: boolean;
    delaySeconds?: number;
    /** For notify: custom message template */
    messageTemplate?: string;
}
export interface BatchRenderConfig {
    id: string;
    name: string;
    taskIds: string[];
    completionActions: CompletionAction[];
    createdAt: string;
    status: 'pending' | 'running' | 'completed' | 'canceled';
    startedAt?: string;
    finishedAt?: string;
}
export interface BatchRenderProgress {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    currentTaskId?: string;
    currentTaskName?: string;
    overallProgress: number;
    estimatedRemainingSeconds?: number;
}
export declare const COMPLETION_ACTION_LABELS: Record<CompletionActionType, string>;
export declare const DEFAULT_COMPLETION_ACTIONS: CompletionAction[];
export declare function createBatchRender(input: {
    name?: string;
    taskIds: string[];
    completionActions?: CompletionAction[];
}): BatchRenderConfig;
export declare function startBatchRender(batch: BatchRenderConfig, now?: string): BatchRenderConfig;
export declare function completeBatchRender(batch: BatchRenderConfig, now?: string): BatchRenderConfig;
export declare function cancelBatchRender(batch: BatchRenderConfig, now?: string): BatchRenderConfig;
export declare function calculateBatchProgress(batch: BatchRenderConfig, taskStatuses: Map<string, {
    status: string;
    progress: number;
    name?: string;
}>): BatchRenderProgress;
export declare function addCompletionAction(actions: CompletionAction[], type: CompletionActionType): CompletionAction[];
export declare function removeCompletionAction(actions: CompletionAction[], actionId: string): CompletionAction[];
export declare function toggleCompletionAction(actions: CompletionAction[], actionId: string): CompletionAction[];
export declare function updateCompletionAction(actions: CompletionAction[], actionId: string, patch: Partial<Omit<CompletionAction, 'id'>>): CompletionAction[];
export declare function getEnabledActions(actions: CompletionAction[]): CompletionAction[];
export declare function buildCompletionNotificationMessage(template: string, context: {
    batchName: string;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    durationSeconds?: number;
}): string;
export declare const DEFAULT_NOTIFY_TEMPLATE = "\u300C{batchName}\u300D\u6E32\u67D3\u5B8C\u6210\uFF1A{completed}/{total} \u6210\u529F";
//# sourceMappingURL=batch-render-actions.d.ts.map