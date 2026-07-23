/**
 * Workflow Execution Engine - Executes node-based workflows
 *
 * Parses node graphs, builds execution flows, and runs them asynchronously.
 * Supports conditional branching, loops, and parallel execution.
 */

import type {
  WorkflowGraph,
  WorkflowNode,
  NodeConnection,
  WorkflowExecutionStatus,
  WorkflowExecutionProgress,
  NodeExecutionResult,
  NodeExecutionStatus,
  AIEngineConfig,
  AIEngineType,
  LoopConfig,
  FlowCondition,
} from './node-editor-types';
import { NodeEditorEngine } from './node-editor-engine';

// ─── Node Executor Types ───────────────────────────────────────────────────

/** Context passed to node executors */
export interface NodeExecutionContext {
  node: WorkflowNode;
  inputs: Record<string, unknown>;
  config: Record<string, unknown>;
  /** Signal for cancellation */
  abortSignal?: AbortSignal;
}

/** Node executor function */
export type NodeExecutor = (context: NodeExecutionContext) => Promise<Record<string, unknown>>;

// ─── Workflow Executor ─────────────────────────────────────────────────────

/**
 * Workflow execution engine
 */
export class WorkflowExecutor {
  private editorEngine: NodeEditorEngine;
  private executors: Map<string, NodeExecutor> = new Map();
  private progressListeners: Array<(progress: WorkflowExecutionProgress) => void> = [];
  private abortController: AbortController | null = null;
  private executionResults: Map<string, NodeExecutionResult> = new Map();

  constructor(editorEngine: NodeEditorEngine) {
    this.editorEngine = editorEngine;

    // Register built-in executors
    this.registerBuiltinExecutors();
  }

  // ─── Executor Registration ───────────────────────────────────────────────

  /** Register a node executor */
  registerExecutor(nodeType: string, executor: NodeExecutor): void {
    this.executors.set(nodeType, executor);
  }

  /** Register multiple executors */
  registerExecutors(executors: Record<string, NodeExecutor>): void {
    for (const [type, executor] of Object.entries(executors)) {
      this.executors.set(type, executor);
    }
  }

  private registerBuiltinExecutors(): void {
    // Input nodes
    this.registerExecutor('input.video', async (ctx) => ({
      video: ctx.config.mediaId ?? 'default-video',
      audio: ctx.config.mediaId ?? 'default-audio',
    }));

    this.registerExecutor('input.audio', async (ctx) => ({
      audio: ctx.config.mediaId ?? 'default-audio',
    }));

    this.registerExecutor('input.image', async (ctx) => ({
      image: ctx.config.mediaId ?? 'default-image',
    }));

    this.registerExecutor('input.timeline', async (ctx) => ({
      timeline: 'current-timeline',
      clips: [],
    }));

    // AI Engine nodes
    this.registerExecutor('ai.highlight-detection', async (ctx) => {
      await this.simulateAIProcessing(ctx);
      return {
        highlights: [
          { start: 10, end: 15, score: 0.9 },
          { start: 30, end: 35, score: 0.85 },
        ],
        timestamps: [10, 30],
      };
    });

    this.registerExecutor('ai.smart-trim', async (ctx) => {
      await this.simulateAIProcessing(ctx);
      return {
        trimmed: 'trimmed-video-id',
        segments: [
          { start: 0, end: 15 },
          { start: 28, end: 45 },
        ],
      };
    });

    this.registerExecutor('ai.auto-subtitle', async (ctx) => {
      await this.simulateAIProcessing(ctx);
      return {
        subtitles: [
          { start: 0, end: 3, text: 'Hello world' },
          { start: 3, end: 6, text: 'Welcome to Open Factory' },
        ],
      };
    });

    this.registerExecutor('ai.color-grading', async (ctx) => {
      await this.simulateAIProcessing(ctx);
      return {
        graded: 'graded-video-id',
      };
    });

    this.registerExecutor('ai.audio-enhance', async (ctx) => {
      await this.simulateAIProcessing(ctx);
      return {
        enhanced: 'enhanced-audio-id',
      };
    });

    this.registerExecutor('ai.scene-detection', async (ctx) => {
      await this.simulateAIProcessing(ctx);
      return {
        scenes: [
          { start: 0, end: 15, type: 'indoor' },
          { start: 15, end: 30, type: 'outdoor' },
        ],
        timestamps: [0, 15],
      };
    });

    // Transform nodes
    this.registerExecutor('transform.crop', async (ctx) => ({
      output: `cropped-${ctx.inputs.input}`,
    }));

    this.registerExecutor('transform.resize', async (ctx) => ({
      output: `resized-${ctx.inputs.input}`,
    }));

    this.registerExecutor('transform.speed', async (ctx) => ({
      output: `speed-${ctx.inputs.input}`,
    }));

    // Output nodes
    this.registerExecutor('output.timeline', async (ctx) => {
      // Would send to actual timeline
      return { success: true };
    });

    this.registerExecutor('output.export', async (ctx) => {
      // Would trigger actual export
      return { success: true, outputPath: ctx.config.outputPath };
    });

    // Control flow nodes
    this.registerExecutor('control.if', async (ctx) => {
      const condition = this.evaluateCondition(
        ctx.config.condition as FlowCondition,
        ctx.inputs,
      );
      return {
        true: condition ? ctx.inputs.input : undefined,
        false: condition ? undefined : ctx.inputs.input,
      };
    });

    this.registerExecutor('control.merge', async (ctx) => ({
      output: ctx.inputs.input1 ?? ctx.inputs.input2,
    }));

    this.registerExecutor('control.delay', async (ctx) => {
      const duration = (ctx.config.duration as number) ?? 1000;
      await new Promise(resolve => setTimeout(resolve, duration));
      return { output: ctx.inputs.input };
    });
  }

  // ─── Execution ───────────────────────────────────────────────────────────

  /** Execute a workflow */
  async execute(
    graph: WorkflowGraph,
    inputs?: Record<string, unknown>,
  ): Promise<WorkflowExecutionProgress> {
    this.abortController = new AbortController();
    this.executionResults.clear();

    const executionOrder = this.editorEngine.getExecutionOrder();
    const totalNodes = executionOrder.length;

    const progress: WorkflowExecutionProgress = {
      status: 'running',
      completedNodes: 0,
      totalNodes,
      results: this.executionResults,
      startedAt: Date.now(),
    };

    this.emitProgress(progress);

    // Build node output cache
    const nodeOutputs = new Map<string, Record<string, unknown>>();

    try {
      for (const nodeId of executionOrder) {
        // Check for cancellation
        if (this.abortController.signal.aborted) {
          progress.status = 'cancelled';
          this.emitProgress(progress);
          return progress;
        }

        const node = this.editorEngine.getNode(nodeId);
        if (!node || !node.enabled) {
          progress.completedNodes++;
          continue;
        }

        progress.currentNodeId = nodeId;
        this.emitProgress(progress);

        // Execute node
        const result = await this.executeNode(node, nodeOutputs, inputs);
        this.executionResults.set(nodeId, result);

        if (result.status === 'failed') {
          progress.status = 'failed';
          this.emitProgress(progress);
          return progress;
        }

        if (result.outputs) {
          nodeOutputs.set(nodeId, result.outputs);
        }

        progress.completedNodes++;
        progress.estimatedTimeRemaining = this.estimateTimeRemaining(
          progress.completedNodes,
          totalNodes,
          progress.startedAt,
        );
        this.emitProgress(progress);
      }

      progress.status = 'completed';
      this.emitProgress(progress);
      return progress;
    } catch (error) {
      progress.status = 'failed';
      this.emitProgress(progress);
      throw error;
    }
  }

  /** Abort current execution */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /** Get execution results */
  getResults(): Map<string, NodeExecutionResult> {
    return new Map(this.executionResults);
  }

  // ─── Node Execution ──────────────────────────────────────────────────────

  private async executeNode(
    node: WorkflowNode,
    nodeOutputs: Map<string, Record<string, unknown>>,
    globalInputs?: Record<string, unknown>,
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const result: NodeExecutionResult = {
      nodeId: node.id,
      status: 'running',
      startedAt: startTime,
    };

    try {
      const executor = this.executors.get(node.type);
      if (!executor) {
        throw new Error(`No executor for node type: ${node.type}`);
      }

      // Gather inputs from connected nodes
      const inputs = this.gatherInputs(node, nodeOutputs, globalInputs);

      // Execute
      const outputs = await executor({
        node,
        inputs,
        config: node.config,
        abortSignal: this.abortController?.signal,
      });

      result.status = 'completed';
      result.completedAt = Date.now();
      result.outputs = outputs;
    } catch (error) {
      result.status = 'failed';
      result.completedAt = Date.now();
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return result;
  }

  private gatherInputs(
    node: WorkflowNode,
    nodeOutputs: Map<string, Record<string, unknown>>,
    globalInputs?: Record<string, unknown>,
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    const connections = this.editorEngine.getIncomingConnections(node.id);

    for (const conn of connections) {
      const sourceOutputs = nodeOutputs.get(conn.sourceNodeId);
      if (sourceOutputs && conn.sourcePortId in sourceOutputs) {
        inputs[conn.targetPortId] = sourceOutputs[conn.sourcePortId];
      }
    }

    // Merge with global inputs
    if (globalInputs) {
      Object.assign(inputs, globalInputs);
    }

    return inputs;
  }

  // ─── Condition Evaluation ────────────────────────────────────────────────

  private evaluateCondition(
    condition: FlowCondition | undefined,
    inputs: Record<string, unknown>,
  ): boolean {
    if (!condition) return false;

    const left = this.resolveValue(condition.left, inputs);
    const right = condition.right;

    switch (condition.type) {
      case 'equals':
        return left === right;
      case 'not-equals':
        return left !== right;
      case 'greater':
        return (left as number) > (right as number);
      case 'less':
        return (left as number) < (right as number);
      case 'contains':
        return String(left).includes(String(right));
      case 'exists':
        return left !== undefined && left !== null;
      default:
        return false;
    }
  }

  private resolveValue(path: string, context: Record<string, unknown>): unknown {
    const parts = path.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  // ─── AI Processing Simulation ────────────────────────────────────────────

  private async simulateAIProcessing(ctx: NodeExecutionContext): Promise<void> {
    // Simulate processing time based on config
    const duration = 100 + Math.random() * 200;
    await new Promise(resolve => setTimeout(resolve, duration));

    if (ctx.abortSignal?.aborted) {
      throw new Error('Processing cancelled');
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  private estimateTimeRemaining(
    completed: number,
    total: number,
    startedAt: number,
  ): number {
    if (completed === 0) return 0;

    const elapsed = Date.now() - startedAt;
    const avgTimePerNode = elapsed / completed;
    const remaining = total - completed;

    return remaining * avgTimePerNode;
  }

  private emitProgress(progress: WorkflowExecutionProgress): void {
    this.progressListeners.forEach(l => l(progress));
  }

  /** Subscribe to execution progress */
  onProgress(listener: (progress: WorkflowExecutionProgress) => void): () => void {
    this.progressListeners.push(listener);
    return () => {
      this.progressListeners = this.progressListeners.filter(l => l !== listener);
    };
  }
}

/**
 * Create a workflow executor
 */
export function createWorkflowExecutor(editorEngine: NodeEditorEngine): WorkflowExecutor {
  return new WorkflowExecutor(editorEngine);
}
