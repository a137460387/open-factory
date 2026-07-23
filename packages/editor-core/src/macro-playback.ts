/**
 * Macro Playback Engine - Executes recorded macro operations
 *
 * Supports parameterized macros, progress tracking, error handling,
 * and dry-run mode for validation.
 */

import type {
  MacroDefinition,
  MacroOperation,
  MacroExecutionStatus,
  MacroExecutionProgress,
  MacroExecutionOptions,
  MacroOperationType,
} from './macro-types';

/** Operation executor function type */
export type OperationExecutor = (
  operation: MacroOperation,
  params: Record<string, unknown>,
) => Promise<boolean>;

/** Macro execution result */
export interface MacroExecutionResult {
  success: boolean;
  executedOperations: number;
  failedOperations: number;
  duration: number;
  errors: Array<{ operationIndex: number; error: string }>;
}

/**
 * Macro playback engine
 */
export class MacroPlaybackEngine {
  private status: MacroExecutionStatus = 'idle';
  private currentOperationIndex: number = 0;
  private startedAt: number = 0;
  private executors: Map<MacroOperationType, OperationExecutor> = new Map();
  private progressListeners: Array<(progress: MacroExecutionProgress) => void> = [];
  private abortController: AbortController | null = null;

  // ─── Executor Registration ───────────────────────────────────────────────

  /** Register an executor for an operation type */
  registerExecutor(type: MacroOperationType, executor: OperationExecutor): void {
    this.executors.set(type, executor);
  }

  /** Register multiple executors */
  registerExecutors(executors: Partial<Record<MacroOperationType, OperationExecutor>>): void {
    for (const [type, executor] of Object.entries(executors)) {
      this.executors.set(type as MacroOperationType, executor);
    }
  }

  // ─── Progress Tracking ───────────────────────────────────────────────────

  /** Subscribe to execution progress */
  onProgress(listener: (progress: MacroExecutionProgress) => void): () => void {
    this.progressListeners.push(listener);
    return () => {
      this.progressListeners = this.progressListeners.filter(l => l !== listener);
    };
  }

  private emitProgress(progress: MacroExecutionProgress): void {
    this.progressListeners.forEach(l => l(progress));
  }

  private updateProgress(
    status: MacroExecutionStatus,
    operationIndex: number,
    totalOperations: number,
    error?: string,
  ): void {
    this.status = status;
    this.currentOperationIndex = operationIndex;

    const elapsed = Date.now() - this.startedAt;
    const progress = operationIndex / totalOperations;
    const estimatedTotal = progress > 0 ? elapsed / progress : 0;

    this.emitProgress({
      status,
      currentOperationIndex: operationIndex,
      totalOperations,
      currentOperationType: this.getCurrentOperationType(operationIndex),
      startedAt: this.startedAt,
      estimatedTimeRemaining: Math.max(0, estimatedTotal - elapsed),
      error,
    });
  }

  private getCurrentOperationType(index: number): MacroOperationType | undefined {
    return undefined; // Will be set during execution
  }

  // ─── Execution ───────────────────────────────────────────────────────────

  /** Get current execution status */
  getStatus(): MacroExecutionStatus {
    return this.status;
  }

  /** Abort current execution */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Execute a macro
   * @param macro - Macro definition to execute
   * @param options - Execution options
   * @returns Execution result
   */
  async execute(
    macro: MacroDefinition,
    options: MacroExecutionOptions = {},
  ): Promise<MacroExecutionResult> {
    if (this.status === 'running') {
      throw new Error('Macro is already running');
    }

    this.abortController = new AbortController();
    this.startedAt = Date.now();
    this.status = 'running';
    this.currentOperationIndex = 0;

    const { parameterOverrides = {}, targetClipIds = [], dryRun = false, speed = 1 } = options;
    const operations = this.resolveOperations(macro, parameterOverrides, targetClipIds);
    const errors: Array<{ operationIndex: number; error: string }> = [];
    let executedCount = 0;
    let failedCount = 0;

    this.updateProgress('running', 0, operations.length);

    for (let i = 0; i < operations.length; i++) {
      // Check for abort
      if (this.abortController.signal.aborted) {
        this.updateProgress('cancelled', i, operations.length);
        break;
      }

      const operation = operations[i];
      this.currentOperationIndex = i;
      this.updateProgress('running', i, operations.length);

      try {
        if (!dryRun) {
          const executor = this.executors.get(operation.type);
          if (!executor) {
            throw new Error(`No executor registered for operation type: ${operation.type}`);
          }

          const success = await executor(operation, operation.params);
          if (success) {
            executedCount++;
          } else {
            failedCount++;
            errors.push({ operationIndex: i, error: 'Operation returned false' });
          }
        } else {
          // Dry run - just validate
          if (!this.executors.has(operation.type)) {
            throw new Error(`No executor for: ${operation.type}`);
          }
          executedCount++;
        }

        // Apply speed multiplier to delay between operations
        if (speed !== 1 && i < operations.length - 1) {
          const delay = Math.max(10, 50 / speed);
          await this.sleep(delay);
        }
      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ operationIndex: i, error: errorMessage });

        // Continue execution on error (non-fatal)
        if (this.abortController.signal.aborted) break;
      }
    }

    const duration = Date.now() - this.startedAt;
    const finalStatus = this.abortController.signal.aborted ? 'cancelled' :
                       failedCount > 0 ? 'completed' : 'completed';

    this.updateProgress(
      failedCount > 0 && executedCount === 0 ? 'failed' : 'completed',
      operations.length,
      operations.length,
      errors.length > 0 ? errors[0].error : undefined,
    );

    this.status = finalStatus;

    return {
      success: failedCount === 0,
      executedOperations: executedCount,
      failedOperations: failedCount,
      duration,
      errors,
    };
  }

  // ─── Operation Resolution ────────────────────────────────────────────────

  private resolveOperations(
    macro: MacroDefinition,
    parameterOverrides: Record<string, unknown>,
    targetClipIds: string[],
  ): MacroOperation[] {
    return macro.operations.map((op, index) => {
      const resolvedParams = this.resolveParameters(op.params, macro.parameters, parameterOverrides);
      const resolvedTargetId = targetClipIds.length > 0
        ? targetClipIds[index % targetClipIds.length]
        : op.targetId;

      return {
        ...op,
        targetId: resolvedTargetId,
        params: resolvedParams,
      };
    });
  }

  private resolveParameters(
    params: Record<string, unknown>,
    macroParams: import('./macro-types').MacroParameter[],
    overrides: Record<string, unknown>,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      // Check if this value references a parameter
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const paramId = value.slice(2, -1);
        const override = overrides[paramId];
        const macroParam = macroParams.find(p => p.id === paramId);

        if (override !== undefined) {
          resolved[key] = override;
        } else if (macroParam) {
          resolved[key] = macroParam.defaultValue;
        } else {
          resolved[key] = value;
        }
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Get current execution progress */
  getProgress(): MacroExecutionProgress {
    return {
      status: this.status,
      currentOperationIndex: this.currentOperationIndex,
      totalOperations: 0,
      startedAt: this.startedAt,
    };
  }

  /** Reset engine state */
  reset(): void {
    this.status = 'idle';
    this.currentOperationIndex = 0;
    this.startedAt = 0;
    this.abortController = null;
  }
}

/**
 * Create a macro playback engine
 */
export function createMacroPlaybackEngine(): MacroPlaybackEngine {
  return new MacroPlaybackEngine();
}
