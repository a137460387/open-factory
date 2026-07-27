/**
 * 自动化工作流引擎
 * 基于触发器、条件、动作的工作流定义与执行
 * 本地优先：所有执行在本地完成，不依赖云端API
 */
/** 工作流状态 */
export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
/** 触发器类型 */
export type TriggerType = 'manual' | 'media-import' | 'scene-detected' | 'quality-threshold' | 'time-schedule' | 'project-open';
/** 触发器定义 */
export interface WorkflowTrigger {
    id: string;
    type: TriggerType;
    /** 触发器参数，如阈值、时间间隔等 */
    params: Record<string, unknown>;
    enabled: boolean;
}
/** 条件运算符 */
export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'exists' | 'not_exists';
/** 条件定义 */
export interface WorkflowCondition {
    id: string;
    /** 条件字段路径，如 'media.quality', 'clip.duration' */
    field: string;
    operator: ConditionOperator;
    /** 比较值 */
    value: unknown;
    /** 逻辑连接 */
    logic?: 'and' | 'or';
}
/** 动作类型 */
export type ActionType = 'apply-effect' | 'apply-color-grade' | 'trim-clip' | 'add-subtitle' | 'export' | 'notify' | 'analyze-scene' | 'auto-cut' | 'quality-check' | 'custom';
/** 动作定义 */
export interface WorkflowAction {
    id: string;
    type: ActionType;
    /** 动作参数 */
    params: Record<string, unknown>;
    /** 动作执行失败时是否继续 */
    continueOnError: boolean;
    /** 超时时间（毫秒） */
    timeout?: number;
}
/** 工作流步骤 */
export interface AutomationWorkflowStep {
    id: string;
    name: string;
    description?: string;
    conditions: WorkflowCondition[];
    actions: WorkflowAction[];
    /** 步骤执行失败时是否跳过 */
    skipOnError: boolean;
}
/** 工作流定义 */
export interface Workflow {
    id: string;
    name: string;
    description?: string;
    version: string;
    triggers: WorkflowTrigger[];
    steps: AutomationWorkflowStep[];
    /** 是否启用 */
    enabled: boolean;
    /** 创建时间 */
    createdAt: number;
    /** 最后修改时间 */
    updatedAt: number;
    /** 标签 */
    tags: string[];
}
/** 工作流执行日志条目 */
export interface WorkflowLogEntry {
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    stepId?: string;
    actionId?: string;
    details?: Record<string, unknown>;
}
/** 工作流执行上下文 */
export interface WorkflowExecutionContext {
    workflowId: string;
    executionId: string;
    startTime: number;
    endTime?: number;
    status: WorkflowStatus;
    /** 当前执行到的步骤索引 */
    currentStepIndex: number;
    /** 各步骤的执行结果 */
    stepResults: Map<string, StepResult>;
    /** 执行日志 */
    logs: WorkflowLogEntry[];
    /** 触发时传入的数据 */
    triggerData: Record<string, unknown>;
    /** 运行时变量 */
    variables: Map<string, unknown>;
}
/** 步骤执行结果 */
export interface StepResult {
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: number;
    endTime?: number;
    actionResults: ActionResult[];
    error?: string;
}
/** 动作执行结果 */
export interface ActionResult {
    actionId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: number;
    endTime?: number;
    output?: unknown;
    error?: string;
    /** 决策原因说明 */
    reason?: string;
}
/** 工作流模板 */
export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>;
    /** 模板预览图路径 */
    thumbnail?: string;
}
/** 动作执行器接口 */
export interface ActionExecutor {
    type: ActionType;
    execute: (action: WorkflowAction, context: WorkflowExecutionContext) => Promise<ActionResult>;
    /** 验证动作参数 */
    validate?: (params: Record<string, unknown>) => {
        valid: boolean;
        errors: string[];
    };
}
/** 触发器监听器接口 */
export interface TriggerListener {
    type: TriggerType;
    /** 注册触发器 */
    register: (trigger: WorkflowTrigger, onFire: (data: Record<string, unknown>) => void) => void;
    /** 注销触发器 */
    unregister: (triggerId: string) => void;
}
/** 创建默认触发器 */
export declare function createDefaultTrigger(type?: TriggerType): WorkflowTrigger;
/** 创建默认条件 */
export declare function createDefaultCondition(): WorkflowCondition;
/** 创建默认动作 */
export declare function createDefaultAction(type?: ActionType): WorkflowAction;
/** 创建默认步骤 */
export declare function createDefaultStep(name?: string): AutomationWorkflowStep;
/** 创建默认工作流 */
export declare function createDefaultWorkflow(name?: string): Workflow;
/** 创建执行上下文 */
export declare function createExecutionContext(workflowId: string, triggerData?: Record<string, unknown>): WorkflowExecutionContext;
/** 评估单个条件 */
export declare function evaluateCondition(condition: WorkflowCondition, data: Record<string, unknown>): boolean;
/** 评估一组条件（支持 and/or 逻辑） */
export declare function evaluateConditions(conditions: WorkflowCondition[], data: Record<string, unknown>): boolean;
/** 引擎事件类型 */
export type WorkflowEngineEvent = 'workflow-started' | 'workflow-completed' | 'workflow-failed' | 'workflow-cancelled' | 'workflow-paused' | 'workflow-resumed' | 'step-started' | 'step-completed' | 'step-failed' | 'step-skipped' | 'action-started' | 'action-completed' | 'action-failed' | 'log';
/** 引擎事件回调 */
export type WorkflowEngineEventCallback = (event: WorkflowEngineEvent, data: unknown) => void;
/** 工作流引擎配置 */
export interface WorkflowEngineConfig {
    /** 最大并发执行数 */
    maxConcurrentExecutions: number;
    /** 默认动作超时（毫秒） */
    defaultActionTimeout: number;
    /** 是否启用详细日志 */
    verboseLogging: boolean;
}
/** 创建默认引擎配置 */
export declare function createDefaultEngineConfig(): WorkflowEngineConfig;
/**
 * 自动化工作流引擎
 * 负责工作流的注册、触发、执行和监控
 */
export declare class WorkflowEngine {
    private workflows;
    private templates;
    private executions;
    private actionExecutors;
    private triggerListeners;
    private eventListeners;
    private config;
    private runningExecutions;
    constructor(config?: Partial<WorkflowEngineConfig>);
    /** 注册工作流 */
    registerWorkflow(workflow: Workflow): void;
    /** 注销工作流 */
    unregisterWorkflow(workflowId: string): void;
    /** 获取工作流 */
    getWorkflow(workflowId: string): Workflow | undefined;
    /** 获取所有工作流 */
    getAllWorkflows(): Workflow[];
    /** 注册模板 */
    registerTemplate(template: WorkflowTemplate): void;
    /** 获取模板 */
    getTemplate(templateId: string): WorkflowTemplate | undefined;
    /** 获取所有模板 */
    getAllTemplates(): WorkflowTemplate[];
    /** 从模板创建工作流 */
    createFromTemplate(templateId: string, name?: string): Workflow | undefined;
    /** 注册动作执行器 */
    registerActionExecutor(executor: ActionExecutor): void;
    private registerTrigger;
    private unregisterTrigger;
    /** 注册触发器监听器 */
    registerTriggerListener(listener: TriggerListener): void;
    /** 监听引擎事件 */
    on(event: WorkflowEngineEvent, callback: WorkflowEngineEventCallback): void;
    /** 移除事件监听 */
    off(event: WorkflowEngineEvent, callback: WorkflowEngineEventCallback): void;
    private emit;
    /** 手动执行工作流 */
    executeWorkflow(workflowId: string, triggerData?: Record<string, unknown>): Promise<WorkflowExecutionContext>;
    /** 执行单个步骤 */
    private executeStep;
    /** 执行单个动作 */
    private executeAction;
    /** 暂停工作流 */
    pauseExecution(executionId: string): boolean;
    /** 恢复工作流 */
    resumeExecution(executionId: string): boolean;
    /** 取消工作流 */
    cancelExecution(executionId: string): boolean;
    /** 获取执行上下文 */
    getExecution(executionId: string): WorkflowExecutionContext | undefined;
    /** 获取工作流的所有执行记录 */
    getExecutionsForWorkflow(workflowId: string): WorkflowExecutionContext[];
    private log;
    /** 导出工作流为 JSON */
    exportWorkflow(workflowId: string): string | undefined;
    /** 从 JSON 导入工作流 */
    importWorkflow(json: string): Workflow;
}
/** 验证工作流 */
export declare function validateWorkflow(workflow: Workflow): Workflow;
/** 规范化工作流数据 */
export declare function normalizeWorkflow(data: unknown): Workflow;
/** 内置工作流模板 */
export declare const BUILTIN_TEMPLATES: WorkflowTemplate[];
//# sourceMappingURL=workflow-engine.d.ts.map