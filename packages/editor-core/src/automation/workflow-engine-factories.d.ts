/**
 * Factory functions and condition evaluation for the workflow engine
 */

import type {
  ActionType,
  AutomationWorkflowStep,
  TriggerType,
  Workflow,
  WorkflowAction,
  WorkflowCondition,
  WorkflowExecutionContext,
  WorkflowTrigger,
} from './workflow-engine-types';

export declare function generateId(prefix: string): string;
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
