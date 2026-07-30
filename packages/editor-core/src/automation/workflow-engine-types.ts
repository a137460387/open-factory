/**
 * Type definitions for the automation workflow engine
 */

/** 工作流状态 */
export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/** 触发器类型 */
export type TriggerType =
  | 'manual' // 手动触发
  | 'media-import' // 媒体导入时
  | 'scene-detected' // 场景检测完成时
  | 'quality-threshold' // 质量低于阈值时
  | 'time-schedule' // 定时触发
  | 'project-open'; // 项目打开时

/** 触发器定义 */
export interface WorkflowTrigger {
  id: string;
  type: TriggerType;
  /** 触发器参数，如阈值、时间间隔等 */
  params: Record<string, unknown>;
  enabled: boolean;
}

/** 条件运算符 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

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
export type ActionType =
  | 'apply-effect' // 应用效果
  | 'apply-color-grade' // 应用调色
  | 'trim-clip' // 裁剪片段
  | 'add-subtitle' // 添加字幕
  | 'export' // 导出
  | 'notify' // 通知
  | 'analyze-scene' // 分析场景
  | 'auto-cut' // 自动剪辑
  | 'quality-check' // 质量检查
  | 'custom'; // 自定义动作

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
  validate?: (params: Record<string, unknown>) => { valid: boolean; errors: string[] };
}

/** 触发器监听器接口 */
export interface TriggerListener {
  type: TriggerType;
  /** 注册触发器 */
  register: (trigger: WorkflowTrigger, onFire: (data: Record<string, unknown>) => void) => void;
  /** 注销触发器 */
  unregister: (triggerId: string) => void;
}

/** 引擎事件类型 */
export type WorkflowEngineEvent =
  | 'workflow-started'
  | 'workflow-completed'
  | 'workflow-failed'
  | 'workflow-cancelled'
  | 'workflow-paused'
  | 'workflow-resumed'
  | 'step-started'
  | 'step-completed'
  | 'step-failed'
  | 'step-skipped'
  | 'action-started'
  | 'action-completed'
  | 'action-failed'
  | 'log';

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
