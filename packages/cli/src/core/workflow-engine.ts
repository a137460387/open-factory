/**
 * Workflow engine — JSON/YAML workflow definition executor.
 *
 * Supports:
 * - Sequential and parallel step execution
 * - Conditional branching (if/else)
 * - Looping (forEach)
 * - Variable interpolation
 * - Step dependencies
 */

import type { CliLogger } from './output.js';

// ==================== Types ====================

export interface WorkflowDefinition {
  name: string;
  version: string;
  description?: string;
  variables?: Record<string, string>;
  steps: WorkflowStep[];
}

export type WorkflowStep =
  | CommandStep
  | ParallelStep
  | ConditionalStep
  | LoopStep
  | WebhookStep;

export interface CommandStep {
  id: string;
  type: 'command';
  command: string;
  args?: Record<string, string>;
  dependsOn?: string[];
  continueOnError?: boolean;
  timeout?: number;
}

export interface ParallelStep {
  id: string;
  type: 'parallel';
  steps: WorkflowStep[];
  dependsOn?: string[];
}

export interface ConditionalStep {
  id: string;
  type: 'conditional';
  condition: string;
  then: WorkflowStep;
  else?: WorkflowStep;
  dependsOn?: string[];
}

export interface LoopStep {
  id: string;
  type: 'loop';
  items: string;
  variable: string;
  body: WorkflowStep;
  dependsOn?: string[];
}

export interface WebhookStep {
  id: string;
  type: 'webhook';
  url: string;
  method?: string;
  body?: Record<string, unknown>;
  dependsOn?: string[];
}

export interface WorkflowContext {
  variables: Record<string, string>;
  logger: CliLogger;
  onStepComplete?: (stepId: string, result: StepResult) => void;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  duration: number;
}

export interface WorkflowResult {
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  failedStep?: string;
  error?: string;
  stepResults: StepResult[];
  warnings: string[];
}

export interface WorkflowValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ==================== Workflow Loading ====================

/**
 * Load a workflow definition from a JSON or YAML file.
 */
export async function loadWorkflowDefinition(filePath: string): Promise<WorkflowDefinition> {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  const ext = filePath.split('.').pop()?.toLowerCase();

  if (ext === 'yaml' || ext === 'yml') {
    // Simple YAML parser for workflow definitions
    // For production, use a proper YAML library
    throw new Error('YAML support requires js-yaml dependency. Use JSON format instead.');
  }

  const definition = JSON.parse(content) as WorkflowDefinition;

  if (!definition.name || !definition.steps || !Array.isArray(definition.steps)) {
    throw new Error('Invalid workflow definition: missing name or steps');
  }

  return definition;
}

// ==================== Workflow Validation ====================

/**
 * Validate a workflow definition.
 */
export function validateWorkflow(definition: WorkflowDefinition): WorkflowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!definition.name) errors.push('Missing workflow name');
  if (!definition.version) warnings.push('Missing workflow version');
  if (!definition.steps || definition.steps.length === 0) errors.push('No steps defined');

  // Check for duplicate step IDs
  const ids = new Set<string>();
  for (const step of definition.steps) {
    if (!step.id) errors.push('Step missing id');
    else if (ids.has(step.id)) errors.push(`Duplicate step id: ${step.id}`);
    else ids.add(step.id);

    // Validate dependencies
    if ('dependsOn' in step && step.dependsOn) {
      for (const dep of step.dependsOn) {
        if (!ids.has(dep) && dep !== step.id) {
          // Will be checked in second pass
        }
      }
    }
  }

  // Second pass: validate dependencies exist
  for (const step of definition.steps) {
    if ('dependsOn' in step && step.dependsOn) {
      for (const dep of step.dependsOn) {
        if (!ids.has(dep)) {
          errors.push(`Step "${step.id}" depends on unknown step "${dep}"`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ==================== Workflow Execution ====================

/**
 * Run a workflow definition.
 */
export async function runWorkflow(
  definition: WorkflowDefinition,
  context: WorkflowContext,
): Promise<WorkflowResult> {
  const warnings: string[] = [];
  const stepResults: StepResult[] = [];
  const completed = new Set<string>();

  // Merge default variables with overrides
  const variables: Record<string, string> = {
    ...definition.variables,
    ...context.variables,
  };

  // Topological sort of steps (detects circular dependencies)
  let sortedSteps: WorkflowStep[];
  try {
    sortedSteps = topologicalSort(definition.steps);
  } catch (err) {
    return {
      success: false,
      completedSteps: 0,
      totalSteps: definition.steps.length,
      error: err instanceof Error ? err.message : String(err),
      stepResults,
      warnings,
    };
  }

  for (const step of sortedSteps) {
    // Check dependencies
    if ('dependsOn' in step && step.dependsOn) {
      const unmet = step.dependsOn.filter((dep) => !completed.has(dep));
      if (unmet.length > 0) {
        const result: StepResult = {
          stepId: step.id,
          success: false,
          error: `Unmet dependencies: ${unmet.join(', ')}`,
          duration: 0,
        };
        stepResults.push(result);
        context.onStepComplete?.(step.id, result);
        return {
          success: false,
          completedSteps: completed.size,
          totalSteps: definition.steps.length,
          failedStep: step.id,
          error: result.error,
          stepResults,
          warnings,
        };
      }
    }

    // Execute step
    const result = await executeStep(step, { ...context, variables });
    stepResults.push(result);
    context.onStepComplete?.(step.id, result);

    if (result.success) {
      completed.add(step.id);
    } else if (!('continueOnError' in step && step.continueOnError)) {
      return {
        success: false,
        completedSteps: completed.size,
        totalSteps: definition.steps.length,
        failedStep: step.id,
        error: result.error,
        stepResults,
        warnings,
      };
    } else {
      warnings.push(`Step "${step.id}" failed but continuing: ${result.error}`);
      completed.add(step.id);
    }
  }

  return {
    success: true,
    completedSteps: completed.size,
    totalSteps: definition.steps.length,
    stepResults,
    warnings,
  };
}

// ==================== Step Execution ====================

async function executeStep(
  step: WorkflowStep,
  context: WorkflowContext,
): Promise<StepResult> {
  const startTime = Date.now();

  try {
    switch (step.type) {
      case 'command':
        return await executeCommandStep(step, context, startTime);
      case 'parallel':
        return await executeParallelStep(step, context, startTime);
      case 'conditional':
        return await executeConditionalStep(step, context, startTime);
      case 'loop':
        return await executeLoopStep(step, context, startTime);
      case 'webhook':
        return await executeWebhookStep(step, context, startTime);
      default:
        return {
          stepId: (step as WorkflowStep).id,
          success: false,
          error: `Unknown step type: ${(step as WorkflowStep).type}`,
          duration: Date.now() - startTime,
        };
    }
  } catch (err) {
    return {
      stepId: step.id,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - startTime,
    };
  }
}

async function executeCommandStep(
  step: CommandStep,
  context: WorkflowContext,
  startTime: number,
): Promise<StepResult> {
  const { spawn } = await import('node:child_process');
  const args = interpolateArgs(step.args ?? {}, context.variables);

  context.logger.debug(`Executing command: ${step.command} ${Object.values(args).join(' ')}`);

  return new Promise((resolve) => {
    const proc = spawn(step.command, Object.values(args), {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: step.timeout,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      resolve({
        stepId: step.id,
        success: code === 0,
        output: stdout,
        error: code !== 0 ? `Exit code ${code}: ${stderr.slice(-500)}` : undefined,
        duration: Date.now() - startTime,
      });
    });

    proc.on('error', (err) => {
      resolve({
        stepId: step.id,
        success: false,
        error: err.message,
        duration: Date.now() - startTime,
      });
    });
  });
}

async function executeParallelStep(
  step: ParallelStep,
  context: WorkflowContext,
  startTime: number,
): Promise<StepResult> {
  const results = await Promise.all(
    step.steps.map((s) => executeStep(s, context)),
  );

  const allSuccess = results.every((r) => r.success);
  const failedSteps = results.filter((r) => !r.success);

  return {
    stepId: step.id,
    success: allSuccess,
    output: results,
    error: failedSteps.length > 0
      ? `Parallel step failed: ${failedSteps.map((r) => r.stepId).join(', ')}`
      : undefined,
    duration: Date.now() - startTime,
  };
}

async function executeConditionalStep(
  step: ConditionalStep,
  context: WorkflowContext,
  startTime: number,
): Promise<StepResult> {
  const conditionResult = evaluateCondition(step.condition, context.variables);

  context.logger.debug(`Conditional "${step.id}": condition="${step.condition}" => ${conditionResult}`);

  if (conditionResult) {
    const result = await executeStep(step.then, context);
    return { ...result, stepId: step.id, duration: Date.now() - startTime };
  } else if (step.else) {
    const result = await executeStep(step.else, context);
    return { ...result, stepId: step.id, duration: Date.now() - startTime };
  }

  return {
    stepId: step.id,
    success: true,
    output: { skipped: true, reason: 'Condition false, no else branch' },
    duration: Date.now() - startTime,
  };
}

async function executeLoopStep(
  step: LoopStep,
  context: WorkflowContext,
  startTime: number,
): Promise<StepResult> {
  const items = resolveVariable(step.items, context.variables);
  const itemList = items.split(',').map((s) => s.trim()).filter(Boolean);
  const results: StepResult[] = [];

  for (const item of itemList) {
    const loopContext: WorkflowContext = {
      ...context,
      variables: { ...context.variables, [step.variable]: item },
    };

    const result = await executeStep(step.body, loopContext);
    results.push(result);

    if (!result.success) {
      return {
        stepId: step.id,
        success: false,
        output: results,
        error: `Loop iteration "${item}" failed: ${result.error}`,
        duration: Date.now() - startTime,
      };
    }
  }

  return {
    stepId: step.id,
    success: true,
    output: results,
    duration: Date.now() - startTime,
  };
}

async function executeWebhookStep(
  step: WebhookStep,
  context: WorkflowContext,
  startTime: number,
): Promise<StepResult> {
  const url = interpolateString(step.url, context.variables);
  const method = step.method ?? 'POST';

  context.logger.debug(`Webhook: ${method} ${url}`);

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: step.body ? JSON.stringify(step.body) : undefined,
    });

    const body = await response.text();

    return {
      stepId: step.id,
      success: response.ok,
      output: { status: response.status, body },
      error: response.ok ? undefined : `HTTP ${response.status}: ${body.slice(-500)}`,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      stepId: step.id,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - startTime,
    };
  }
}

// ==================== Helpers ====================

function interpolateString(template: string, variables: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, key) => variables[key] ?? '');
}

function interpolateArgs(args: Record<string, string>, variables: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    result[key] = interpolateString(value, variables);
  }
  return result;
}

function resolveVariable(expr: string, variables: Record<string, string>): string {
  return interpolateString(expr, variables);
}

function evaluateCondition(condition: string, variables: Record<string, string>): boolean {
  const resolved = interpolateString(condition, variables);

  // Simple equality check: "var == value"
  const eqMatch = resolved.match(/^(\w+)\s*==\s*(.+)$/);
  if (eqMatch) {
    return variables[eqMatch[1]!] === eqMatch[2]!.trim();
  }

  // Simple inequality: "var != value"
  const neqMatch = resolved.match(/^(\w+)\s*!=\s*(.+)$/);
  if (neqMatch) {
    return variables[neqMatch[1]!] !== neqMatch[2]!.trim();
  }

  // Truthy check: just a variable name
  if (/^\w+$/.test(resolved)) {
    return !!variables[resolved] && variables[resolved] !== 'false' && variables[resolved] !== '0';
  }

  return false;
}

function topologicalSort(steps: WorkflowStep[]): WorkflowStep[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: WorkflowStep[] = [];
  const stepMap = new Map(steps.map((s) => [s.id, s]));

  function visit(step: WorkflowStep) {
    if (visited.has(step.id)) return;
    if (visiting.has(step.id)) {
      throw new Error(`Circular dependency detected involving step "${step.id}"`);
    }
    visiting.add(step.id);

    if ('dependsOn' in step && step.dependsOn) {
      for (const dep of step.dependsOn) {
        const depStep = stepMap.get(dep);
        if (depStep) visit(depStep);
      }
    }

    visiting.delete(step.id);
    visited.add(step.id);
    result.push(step);
  }

  for (const step of steps) {
    visit(step);
  }

  return result;
}
