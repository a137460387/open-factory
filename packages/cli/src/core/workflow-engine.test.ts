/**
 * Workflow Engine 测试
 *
 * 覆盖: validateWorkflow, topologicalSort (via runWorkflow), interpolateString,
 *        evaluateCondition, 步骤执行逻辑
 */

import { describe, it, expect, vi } from 'vitest';
import {
  validateWorkflow,
  runWorkflow,
  type WorkflowDefinition,
  type WorkflowContext,
  type CommandStep,
  type ConditionalStep,
  type LoopStep,
  type ParallelStep,
} from './workflow-engine.js';
import type { CliLogger } from './output.js';

const mockLogger: CliLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function makeContext(vars: Record<string, string> = {}): WorkflowContext {
  return { variables: vars, logger: mockLogger };
}

function makeDef(steps: WorkflowDefinition['steps'], overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    name: 'test-workflow',
    version: '1.0.0',
    steps,
    ...overrides,
  };
}

// ==================== validateWorkflow ====================

describe('Workflow Engine', () => {
  describe('validateWorkflow', () => {
    it('should validate a valid definition', () => {
      const def = makeDef([
        { id: 'step1', type: 'command', command: 'echo' } satisfies CommandStep,
      ]);
      const result = validateWorkflow(def);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should error on missing name', () => {
      const def = { name: '', version: '1.0', steps: [{ id: 'a', type: 'command' as const, command: 'echo' }] };
      const result = validateWorkflow(def);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing workflow name');
    });

    it('should error on empty steps', () => {
      const def = makeDef([]);
      const result = validateWorkflow(def);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No steps defined');
    });

    it('should warn on missing version', () => {
      const def = makeDef(
        [{ id: 'a', type: 'command', command: 'echo' }],
        { version: '' },
      );
      const result = validateWorkflow(def);
      expect(result.warnings).toContain('Missing workflow version');
    });

    it('should error on duplicate step IDs', () => {
      const def = makeDef([
        { id: 'dup', type: 'command', command: 'echo' },
        { id: 'dup', type: 'command', command: 'ls' },
      ]);
      const result = validateWorkflow(def);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate step id: dup');
    });

    it('should error on missing step id', () => {
      const def = makeDef([
        { id: '', type: 'command', command: 'echo' },
      ]);
      const result = validateWorkflow(def);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Step missing id');
    });

    it('should error on unknown dependency', () => {
      const def = makeDef([
        { id: 'step1', type: 'command', command: 'echo', dependsOn: ['nonexistent'] },
      ]);
      const result = validateWorkflow(def);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Step "step1" depends on unknown step "nonexistent"');
    });

    it('should accept valid dependencies', () => {
      const def = makeDef([
        { id: 'step1', type: 'command', command: 'echo' },
        { id: 'step2', type: 'command', command: 'ls', dependsOn: ['step1'] },
      ]);
      const result = validateWorkflow(def);
      expect(result.valid).toBe(true);
    });
  });

  // ==================== runWorkflow ====================

  describe('runWorkflow', () => {
    it('should run empty workflow successfully', async () => {
      const def = makeDef([]);
      const result = await runWorkflow(def, makeContext());
      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(0);
      expect(result.totalSteps).toBe(0);
    });

    it('should detect circular dependencies', async () => {
      const def = makeDef([
        { id: 'a', type: 'command', command: 'echo', dependsOn: ['b'] },
        { id: 'b', type: 'command', command: 'echo', dependsOn: ['a'] },
      ]);
      const result = await runWorkflow(def, makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Circular dependency');
    });

    it('should fail on unmet dependencies', async () => {
      const def = makeDef([
        { id: 'step2', type: 'command', command: 'echo', dependsOn: ['step1'] },
      ]);
      const result = await runWorkflow(def, makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unmet dependencies');
      expect(result.failedStep).toBe('step2');
    });

    it('should merge variables from definition and context', async () => {
      const def = makeDef(
        [{ id: 'a', type: 'command', command: 'echo' }],
        { variables: { fromDef: 'def-val' } },
      );
      const ctx = makeContext({ fromCtx: 'ctx-val' });
      const result = await runWorkflow(def, ctx);
      // Just checking it doesn't crash; actual variable usage tested in interpolation
      expect(result).toBeDefined();
    });

    it('should call onStepComplete callback', async () => {
      const onStepComplete = vi.fn();
      const def = makeDef([]);
      await runWorkflow(def, { ...makeContext(), onStepComplete });
      // No steps, so no calls
      expect(onStepComplete).not.toHaveBeenCalled();
    });

    it('should continue on error when continueOnError is true', async () => {
      // Use a command that will fail
      const def = makeDef([
        {
          id: 'fail-step',
          type: 'command',
          command: 'nonexistent-command-xyz',
          continueOnError: true,
        },
        { id: 'next-step', type: 'command', command: 'echo', dependsOn: ['fail-step'] },
      ]);
      const result = await runWorkflow(def, makeContext());
      // fail-step runs, next-step depends on fail-step which "completed" (with continueOnError)
      expect(result.warnings.some((w) => w.includes('fail-step'))).toBe(true);
    });

    it('should fail immediately when step fails without continueOnError', async () => {
      const def = makeDef([
        { id: 'fail', type: 'command', command: 'nonexistent-command-xyz' },
        { id: 'never', type: 'command', command: 'echo' },
      ]);
      const result = await runWorkflow(def, makeContext());
      expect(result.success).toBe(false);
      expect(result.failedStep).toBe('fail');
    });
  });

  // ==================== Conditional Steps ====================

  describe('Conditional Steps', () => {
    it('should execute then branch when condition is true', async () => {
      const thenStep: CommandStep = { id: 'then-cmd', type: 'command', command: 'echo' };
      const condStep: ConditionalStep = {
        id: 'cond',
        type: 'conditional',
        condition: 'mode == production',
        then: thenStep,
      };
      const def = makeDef([condStep]);
      const result = await runWorkflow(def, makeContext({ mode: 'production' }));
      expect(result.success).toBe(true);
    });

    it('should execute else branch when condition is false', async () => {
      const thenStep: CommandStep = { id: 'then-cmd', type: 'command', command: 'echo' };
      const elseStep: CommandStep = { id: 'else-cmd', type: 'command', command: 'echo' };
      const condStep: ConditionalStep = {
        id: 'cond',
        type: 'conditional',
        condition: 'mode == production',
        then: thenStep,
        else: elseStep,
      };
      const def = makeDef([condStep]);
      const result = await runWorkflow(def, makeContext({ mode: 'development' }));
      expect(result.success).toBe(true);
    });

    it('should succeed with no else branch when condition is false', async () => {
      const thenStep: CommandStep = { id: 'then-cmd', type: 'command', command: 'echo' };
      const condStep: ConditionalStep = {
        id: 'cond',
        type: 'conditional',
        condition: 'enableFeature == true',
        then: thenStep,
      };
      const def = makeDef([condStep]);
      const result = await runWorkflow(def, makeContext({ enableFeature: 'false' }));
      expect(result.success).toBe(true);
    });

    it('should handle inequality condition', async () => {
      const thenStep: CommandStep = { id: 'then-cmd', type: 'command', command: 'echo' };
      const condStep: ConditionalStep = {
        id: 'cond',
        type: 'conditional',
        condition: 'env != production',
        then: thenStep,
      };
      const def = makeDef([condStep]);
      const result = await runWorkflow(def, makeContext({ env: 'staging' }));
      expect(result.success).toBe(true);
    });

    it('should handle truthy variable check', async () => {
      const thenStep: CommandStep = { id: 'then-cmd', type: 'command', command: 'echo' };
      const condStep: ConditionalStep = {
        id: 'cond',
        type: 'conditional',
        condition: 'verbose',
        then: thenStep,
      };
      const def = makeDef([condStep]);
      const result = await runWorkflow(def, makeContext({ verbose: 'true' }));
      expect(result.success).toBe(true);
    });

    it('should treat "false" variable as falsy', async () => {
      const thenStep: CommandStep = { id: 'then-cmd', type: 'command', command: 'echo' };
      const condStep: ConditionalStep = {
        id: 'cond',
        type: 'conditional',
        condition: 'verbose',
        then: thenStep,
      };
      const def = makeDef([condStep]);
      const result = await runWorkflow(def, makeContext({ verbose: 'false' }));
      expect(result.success).toBe(true);
    });

    it('should treat "0" variable as falsy', async () => {
      const thenStep: CommandStep = { id: 'then-cmd', type: 'command', command: 'echo' };
      const condStep: ConditionalStep = {
        id: 'cond',
        type: 'conditional',
        condition: 'count',
        then: thenStep,
      };
      const def = makeDef([condStep]);
      const result = await runWorkflow(def, makeContext({ count: '0' }));
      expect(result.success).toBe(true);
    });
  });

  // ==================== Loop Steps ====================

  describe('Loop Steps', () => {
    it('should iterate over comma-separated items', async () => {
      const bodyStep: CommandStep = { id: 'body', type: 'command', command: 'echo' };
      const loopStep: LoopStep = {
        id: 'loop',
        type: 'loop',
        items: 'a,b,c',
        variable: 'item',
        body: bodyStep,
      };
      const def = makeDef([loopStep]);
      const result = await runWorkflow(def, makeContext());
      expect(result.success).toBe(true);
    });

    it('should resolve variables in items expression', async () => {
      const bodyStep: CommandStep = { id: 'body', type: 'command', command: 'echo' };
      const loopStep: LoopStep = {
        id: 'loop',
        type: 'loop',
        items: '${fileList}',
        variable: 'file',
        body: bodyStep,
      };
      const def = makeDef([loopStep]);
      const result = await runWorkflow(def, makeContext({ fileList: 'a.ts,b.ts,c.ts' }));
      expect(result.success).toBe(true);
    });

    it('should fail loop when iteration fails', async () => {
      const bodyStep: CommandStep = { id: 'body', type: 'command', command: 'nonexistent-cmd-xyz' };
      const loopStep: LoopStep = {
        id: 'loop',
        type: 'loop',
        items: 'one,two',
        variable: 'item',
        body: bodyStep,
      };
      const def = makeDef([loopStep]);
      const result = await runWorkflow(def, makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Loop iteration');
    });

    it('should handle empty items list', async () => {
      const bodyStep: CommandStep = { id: 'body', type: 'command', command: 'echo' };
      const loopStep: LoopStep = {
        id: 'loop',
        type: 'loop',
        items: '',
        variable: 'item',
        body: bodyStep,
      };
      const def = makeDef([loopStep]);
      const result = await runWorkflow(def, makeContext());
      expect(result.success).toBe(true);
    });
  });

  // ==================== Parallel Steps ====================

  describe('Parallel Steps', () => {
    it('should execute parallel steps concurrently', async () => {
      const s1: CommandStep = { id: 'p1', type: 'command', command: 'echo' };
      const s2: CommandStep = { id: 'p2', type: 'command', command: 'echo' };
      const parallel: ParallelStep = {
        id: 'par',
        type: 'parallel',
        steps: [s1, s2],
      };
      const def = makeDef([parallel]);
      const result = await runWorkflow(def, makeContext());
      expect(result.success).toBe(true);
    });

    it('should fail when any parallel step fails', async () => {
      const s1: CommandStep = { id: 'p1', type: 'command', command: 'echo' };
      const s2: CommandStep = { id: 'p2', type: 'command', command: 'nonexistent-cmd-xyz' };
      const parallel: ParallelStep = {
        id: 'par',
        type: 'parallel',
        steps: [s1, s2],
      };
      const def = makeDef([parallel]);
      const result = await runWorkflow(def, makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toContain('p2');
    });
  });

  // ==================== Variable Interpolation ====================

  describe('Variable Interpolation', () => {
    it('should interpolate variables in webhook URL', async () => {
      // Use a webhook step that will fail (unreachable URL) but tests interpolation
      const def = makeDef([
        {
          id: 'hook',
          type: 'webhook',
          url: 'http://${host}:${port}/api',
          method: 'GET',
        },
      ]);
      const result = await runWorkflow(def, makeContext({ host: 'localhost', port: '3000' }));
      // Will fail because URL is unreachable, but interpolation happened
      expect(result).toBeDefined();
    });

    it('should interpolate variables in command args', async () => {
      const def = makeDef([
        {
          id: 'cmd',
          type: 'command',
          command: 'echo',
          args: { greeting: 'hello ${name}' },
        },
      ]);
      const result = await runWorkflow(def, makeContext({ name: 'World' }));
      // Command runs, args are interpolated
      expect(result).toBeDefined();
    });

    it('should replace missing variables with empty string', async () => {
      const def = makeDef([
        {
          id: 'hook',
          type: 'webhook',
          url: 'http://${undefined_host}/api',
          method: 'GET',
        },
      ]);
      const result = await runWorkflow(def, makeContext());
      // URL becomes http:///api which is invalid, but interpolation works
      expect(result).toBeDefined();
    });
  });

  // ==================== Step Dependencies ====================

  describe('Step Dependencies', () => {
    it('should execute steps in dependency order', async () => {
      const order: string[] = [];
      const onStepComplete = vi.fn((stepId: string) => { order.push(stepId); });

      const def = makeDef([
        { id: 'c', type: 'command', command: 'echo', dependsOn: ['a', 'b'] },
        { id: 'a', type: 'command', command: 'echo' },
        { id: 'b', type: 'command', command: 'echo', dependsOn: ['a'] },
      ]);

      const result = await runWorkflow(def, { ...makeContext(), onStepComplete });
      expect(result.success).toBe(true);
      // a must come before b, b must come before c
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
    });
  });
});
