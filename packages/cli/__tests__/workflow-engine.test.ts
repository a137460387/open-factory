import { describe, test, expect } from 'vitest';
import {
  validateWorkflow,
  runWorkflow,
  type WorkflowDefinition,
  type WorkflowContext,
} from '../src/core/workflow-engine';

describe('Workflow Validation', () => {
  test('validates a correct workflow definition', () => {
    const workflow: WorkflowDefinition = {
      name: 'test-workflow',
      version: '1.0',
      steps: [
        { id: 'step1', type: 'command', command: 'echo', args: { message: 'hello' } },
        { id: 'step2', type: 'command', command: 'echo', args: { message: 'world' }, dependsOn: ['step1'] },
      ],
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects workflow without name', () => {
    const workflow = {
      name: '',
      version: '1.0',
      steps: [{ id: 'step1', type: 'command' as const, command: 'echo' }],
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing workflow name');
  });

  test('rejects workflow without steps', () => {
    const workflow: WorkflowDefinition = {
      name: 'test',
      version: '1.0',
      steps: [],
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('No steps defined');
  });

  test('detects duplicate step IDs', () => {
    const workflow: WorkflowDefinition = {
      name: 'test',
      version: '1.0',
      steps: [
        { id: 'step1', type: 'command', command: 'echo' },
        { id: 'step1', type: 'command', command: 'echo' },
      ],
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Duplicate step id: step1');
  });

  test('detects missing dependency references', () => {
    const workflow: WorkflowDefinition = {
      name: 'test',
      version: '1.0',
      steps: [
        { id: 'step1', type: 'command', command: 'echo', dependsOn: ['nonexistent'] },
      ],
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Step "step1" depends on unknown step "nonexistent"');
  });

  test('warns on missing version', () => {
    const workflow: WorkflowDefinition = {
      name: 'test',
      version: '',
      steps: [{ id: 'step1', type: 'command', command: 'echo' }],
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Missing workflow version');
  });
});

describe('Workflow Execution', () => {
  test('detects circular dependencies', async () => {
    const workflow: WorkflowDefinition = {
      name: 'circular-test',
      version: '1.0',
      steps: [
        { id: 'step1', type: 'command', command: 'echo', dependsOn: ['step2'] },
        { id: 'step2', type: 'command', command: 'echo', dependsOn: ['step1'] },
      ],
    };

    const context: WorkflowContext = {
      variables: {},
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    };

    const result = await runWorkflow(workflow, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Circular dependency');
  });
});
