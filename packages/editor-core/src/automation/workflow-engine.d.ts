/**
 * 自动化工作流引擎
 * 基于触发器、条件、动作的工作流定义与执行
 * 本地优先：所有执行在本地完成，不依赖云端API
 */

export type {
  WorkflowStatus,
  TriggerType,
  WorkflowTrigger,
  ConditionOperator,
  WorkflowCondition,
  ActionType,
  WorkflowAction,
  AutomationWorkflowStep,
  Workflow,
  WorkflowLogEntry,
  WorkflowExecutionContext,
  StepResult,
  ActionResult,
  WorkflowTemplate,
  ActionExecutor,
  TriggerListener,
  WorkflowEngineEvent,
  WorkflowEngineEventCallback,
  WorkflowEngineConfig,
} from './workflow-engine-types';

export {
  createDefaultTrigger,
  createDefaultCondition,
  createDefaultAction,
  createDefaultStep,
  createDefaultWorkflow,
  createExecutionContext,
  evaluateCondition,
  evaluateConditions,
} from './workflow-engine-factories';

export { validateWorkflow, normalizeWorkflow } from './workflow-engine-validation';
export { BUILTIN_TEMPLATES } from './workflow-engine-templates';

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

import type {
  WorkflowEngineConfig,
} from './workflow-engine-types';
