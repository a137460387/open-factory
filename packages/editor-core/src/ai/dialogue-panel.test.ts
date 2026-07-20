import { describe, it, expect } from 'vitest';
import {
  createInitialDialogueState,
  dialoguePanelReducer,
  turnsToLLMMessages,
  getLatestPlan,
  getSortedInstructions,
  getExecutionSummary,
  getInstructionLabel,
} from './dialogue-panel';
import type { EditPlan, EditInstruction } from './llm-orchestrator';

function makePlan(overrides: Partial<EditPlan> = {}): EditPlan {
  return {
    title: 'Test Plan',
    description: 'A test editing plan',
    instructions: [
      {
        id: 'inst-1',
        action: 'cut',
        target: { materialIndex: 0, startSec: 5, endSec: 10 },
        params: {},
        confidence: 0.9,
        reason: 'Remove dead air',
      },
      {
        id: 'inst-2',
        action: 'add_subtitle',
        target: { startSec: 0, endSec: 5 },
        params: { text: 'Hello' },
        confidence: 0.8,
        reason: 'Add intro subtitle',
      },
    ],
    estimatedDurationSec: 50,
    ...overrides,
  };
}

// ─── dialoguePanelReducer ──────────────────────────────────────

describe('dialoguePanelReducer', () => {
  it('loads materials', () => {
    const state = createInitialDialogueState();
    const next = dialoguePanelReducer(state, { type: 'LOAD_MATERIALS', count: 3 });
    expect(next.hasMaterials).toBe(true);
    expect(next.materialCount).toBe(3);
  });

  it('sends message', () => {
    const state = createInitialDialogueState();
    const next = dialoguePanelReducer(state, { type: 'SEND_MESSAGE', content: 'Make a highlight reel' });
    expect(next.phase).toBe('thinking');
    expect(next.turns).toHaveLength(1);
    expect(next.turns[0].role).toBe('user');
  });

  it('receives response without plan', () => {
    const state = { ...createInitialDialogueState(), phase: 'thinking' as const };
    const next = dialoguePanelReducer(state, {
      type: 'RECEIVE_RESPONSE',
      content: 'I need more info',
    });
    expect(next.phase).toBe('idle');
    expect(next.turns).toHaveLength(1);
    expect(next.turns[0].role).toBe('assistant');
    expect(next.activePlan).toBeUndefined();
  });

  it('receives response with plan', () => {
    const state = { ...createInitialDialogueState(), phase: 'thinking' as const };
    const plan = makePlan();
    const next = dialoguePanelReducer(state, {
      type: 'RECEIVE_RESPONSE',
      content: 'Here is a plan',
      plan,
    });
    expect(next.phase).toBe('reviewing_plan');
    expect(next.activePlan).toBe(plan);
  });

  it('approves plan', () => {
    const plan = makePlan();
    const state = { ...createInitialDialogueState(), phase: 'reviewing_plan' as const, activePlan: plan };
    const next = dialoguePanelReducer(state, { type: 'APPROVE_PLAN' });
    expect(next.phase).toBe('idle');
    expect(next.planHistory).toHaveLength(1);
    expect(next.planHistory[0]).toBe(plan);
  });

  it('rejects plan', () => {
    const plan = makePlan();
    const state = { ...createInitialDialogueState(), phase: 'reviewing_plan' as const, activePlan: plan };
    const next = dialoguePanelReducer(state, { type: 'REJECT_PLAN' });
    expect(next.phase).toBe('idle');
    expect(next.activePlan).toBeUndefined();
  });

  it('modifies instruction', () => {
    const plan = makePlan();
    const state = { ...createInitialDialogueState(), activePlan: plan };
    const next = dialoguePanelReducer(state, {
      type: 'MODIFY_INSTRUCTION',
      instructionId: 'inst-1',
      updates: { confidence: 0.5 },
    });
    expect(next.activePlan!.instructions[0].confidence).toBe(0.5);
    expect(next.activePlan!.instructions[0].action).toBe('cut');
  });

  it('removes instruction', () => {
    const plan = makePlan();
    const state = { ...createInitialDialogueState(), activePlan: plan };
    const next = dialoguePanelReducer(state, { type: 'REMOVE_INSTRUCTION', instructionId: 'inst-1' });
    expect(next.activePlan!.instructions).toHaveLength(1);
    expect(next.activePlan!.instructions[0].id).toBe('inst-2');
  });

  it('starts execution', () => {
    const state = { ...createInitialDialogueState(), activePlan: makePlan() };
    const next = dialoguePanelReducer(state, { type: 'EXECUTE_START' });
    expect(next.phase).toBe('executing');
  });

  it('completes execution', () => {
    const result = {
      planTitle: 'Test',
      totalInstructions: 2,
      executed: 2,
      succeeded: 2,
      failed: 0,
      skipped: 0,
      results: [],
      totalMs: 1000,
    };
    const state = { ...createInitialDialogueState(), phase: 'executing' as const };
    const next = dialoguePanelReducer(state, { type: 'EXECUTE_COMPLETE', result });
    expect(next.phase).toBe('complete');
    expect(next.executionResults).toBe(result);
    expect(next.activePlan).toBeUndefined();
  });

  it('handles execution error', () => {
    const state = { ...createInitialDialogueState(), phase: 'executing' as const };
    const next = dialoguePanelReducer(state, { type: 'EXECUTE_ERROR', error: 'timeout' });
    expect(next.phase).toBe('error');
    expect(next.error).toBe('timeout');
  });

  it('resets state', () => {
    const state = { ...createInitialDialogueState(), phase: 'complete' as const, error: 'x' };
    const next = dialoguePanelReducer(state, { type: 'RESET' });
    expect(next.phase).toBe('idle');
  });
});

// ─── Selectors ──────────────────────────────────────────────────

describe('turnsToLLMMessages', () => {
  it('converts turns to messages', () => {
    const turns = [
      { id: '1', role: 'user' as const, content: 'Hello', timestamp: 0 },
      { id: '2', role: 'assistant' as const, content: 'Hi', timestamp: 1 },
    ];
    const messages = turnsToLLMMessages(turns);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi' });
  });
});

describe('getLatestPlan', () => {
  it('returns latest plan', () => {
    const plan = makePlan();
    const turns = [
      { id: '1', role: 'user' as const, content: 'Hi', timestamp: 0 },
      { id: '2', role: 'assistant' as const, content: 'Plan', timestamp: 1, plan },
    ];
    expect(getLatestPlan(turns)).toBe(plan);
  });

  it('returns undefined when no plan', () => {
    const turns = [{ id: '1', role: 'user' as const, content: 'Hi', timestamp: 0 }];
    expect(getLatestPlan(turns)).toBeUndefined();
  });
});

describe('getSortedInstructions', () => {
  it('returns sorted instructions', () => {
    const state = { ...createInitialDialogueState(), activePlan: makePlan() };
    const sorted = getSortedInstructions(state);
    expect(sorted).toHaveLength(2);
    // cut should come before add_subtitle
    expect(sorted[0].action).toBe('cut');
  });

  it('returns empty when no active plan', () => {
    expect(getSortedInstructions(createInitialDialogueState())).toEqual([]);
  });
});

describe('getExecutionSummary', () => {
  it('formats summary', () => {
    const summary = getExecutionSummary({
      planTitle: 'Test',
      totalInstructions: 3,
      executed: 3,
      succeeded: 2,
      failed: 1,
      skipped: 0,
      results: [],
      totalMs: 1500,
    });
    expect(summary).toContain('2/3');
    expect(summary).toContain('1 failed');
    expect(summary).toContain('1.5s');
  });
});

describe('getInstructionLabel', () => {
  it('labels cut with time range', () => {
    const label = getInstructionLabel({
      id: '1',
      action: 'cut',
      target: { startSec: 5, endSec: 10 },
      params: {},
      confidence: 0.8,
      reason: 'test',
    });
    expect(label).toContain('Cut');
    expect(label).toContain('0:05');
    expect(label).toContain('0:10');
  });

  it('labels without time range', () => {
    const label = getInstructionLabel({
      id: '1',
      action: 'add_transition',
      target: {},
      params: {},
      confidence: 0.8,
      reason: 'test',
    });
    expect(label).toBe('Add Transition');
  });
});
