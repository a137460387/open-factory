/**
 * Execution logic for the workflow engine
 * Extracted as standalone functions to keep the engine class focused on state management
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
  StepResult,
} from './workflow-engine-types';
import { evaluateConditions } from './workflow-engine-factories';

/** Dependencies required by execution functions */
export interface ExecutionDeps {
  emit: (event: WorkflowEngineEvent, data: unknown) => void;
  log: (
    context: WorkflowExecutionContext,
    level: WorkflowLogEntry['level'],
    message: string,
    stepId?: string,
    actionId?: string,
    details?: Record<string, unknown>,
  ) => void;
  actionExecutors: Map<ActionType, ActionExecutor>;
  config: WorkflowEngineConfig;
}

/** Execute a single step within a workflow */
export async function executeStep(
  deps: ExecutionDeps,
  step: AutomationWorkflowStep,
  context: WorkflowExecutionContext,
  workflow: Workflow,
): Promise<void> {
  const stepResult: StepResult = {
    stepId: step.id,
    status: 'running',
    startTime: Date.now(),
    actionResults: [],
  };
  context.stepResults.set(step.id, stepResult);
  deps.emit('step-started', { step, context });

  deps.log(context, 'info', `执行步骤: ${step.name}`, step.id);

  const conditionData = {
    ...context.triggerData,
    variables: Object.fromEntries(context.variables),
  };

  if (!evaluateConditions(step.conditions, conditionData)) {
    stepResult.status = 'skipped';
    stepResult.endTime = Date.now();
    deps.emit('step-skipped', { step, context });
    deps.log(context, 'info', `步骤 "${step.name}" 条件不满足，跳过`, step.id);
    return;
  }

  let hasError = false;
  for (const action of step.actions) {
    const actionResult = await executeAction(deps, action, context);
    stepResult.actionResults.push(actionResult);

    if (actionResult.status === 'failed') {
      hasError = true;
      if (!action.continueOnError && !step.skipOnError) {
        stepResult.status = 'failed';
        stepResult.endTime = Date.now();
        stepResult.error = actionResult.error;
        deps.emit('step-failed', { step, context, error: actionResult.error });
        throw new Error(`步骤 "${step.name}" 的动作失败: ${actionResult.error}`);
      }
    }
  }

  stepResult.status = hasError ? 'failed' : 'completed';
  stepResult.endTime = Date.now();

  if (hasError) {
    deps.emit('step-failed', { step, context });
  } else {
    deps.emit('step-completed', { step, context });
  }
}

/** Execute a single action */
export async function executeAction(
  deps: ExecutionDeps,
  action: WorkflowAction,
  context: WorkflowExecutionContext,
): Promise<ActionResult> {
  const executor = deps.actionExecutors.get(action.type);
  if (!executor) {
    return {
      actionId: action.id,
      status: 'failed',
      error: `未注册的动作执行器: ${action.type}`,
      reason: `系统中没有找到类型为 "${action.type}" 的动作执行器`,
    };
  }

  if (executor.validate) {
    const validation = executor.validate(action.params);
    if (!validation.valid) {
      return {
        actionId: action.id,
        status: 'failed',
        error: `参数验证失败: ${validation.errors.join(', ')}`,
        reason: `动作参数不符合要求: ${validation.errors.join('; ')}`,
      };
    }
  }

  deps.emit('action-started', { action, context });
  deps.log(context, 'debug', `执行动作: ${action.type}`, undefined, action.id);

  const timeout = action.timeout || deps.config.defaultActionTimeout;

  try {
    const resultPromise = executor.execute(action, context);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`动作执行超时 (${timeout}ms)`)), timeout);
    });

    const result = await Promise.race([resultPromise, timeoutPromise]);
    deps.emit('action-completed', { action, result, context });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result: ActionResult = {
      actionId: action.id,
      status: 'failed',
      error: message,
      reason: `动作执行异常: ${message}`,
    };
    deps.emit('action-failed', { action, result, context });
    return result;
  }
}
