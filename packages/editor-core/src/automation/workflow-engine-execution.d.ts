/**
 * Execution logic for the workflow engine
 */

import type {
  ActionExecutor,
  ActionResult,
  ActionType,
  AutomationWorkflowStep,
  Workflow,
  WorkflowAction,
  WorkflowEngineConfig,
  WorkflowEngineEvent,
  WorkflowEngineEventCallback,
  WorkflowExecutionContext,
  WorkflowLogEntry,
} from './workflow-engine-types';

/** Dependencies required by execution functions */
export interface ExecutionDeps {
    emit: (event: WorkflowEngineEvent, data: unknown) => void;
    log: (context: WorkflowExecutionContext, level: WorkflowLogEntry['level'], message: string, stepId?: string, actionId?: string, details?: Record<string, unknown>) => void;
    actionExecutors: Map<ActionType, ActionExecutor>;
    config: WorkflowEngineConfig;
}

/** Execute a single step within a workflow */
export declare function executeStep(deps: ExecutionDeps, step: AutomationWorkflowStep, context: WorkflowExecutionContext, workflow: Workflow): Promise<void>;
/** Execute a single action */
export declare function executeAction(deps: ExecutionDeps, action: WorkflowAction, context: WorkflowExecutionContext): Promise<ActionResult>;
