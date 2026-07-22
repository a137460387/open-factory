/**
 * AI Dialogue Editing Panel
 *
 * Data layer for the "AI Conversation Editing" UI panel.
 * Manages conversation state, edit plan history, and instruction execution.
 *
 * Users interact with LLM through natural language to generate editing plans.
 */

import type { MaterialMetadata } from '../ai/semantic-extractor';
import type {
  EditPlan,
  EditInstruction,
  LLMMessage,
  InstructionExecutionResult,
  PlanExecutionResult,
} from '../ai/llm-orchestrator';
import { sortInstructionsByPriority } from '../ai/llm-orchestrator';
import { formatTimeShort } from '../utils/time';

// ─── Panel State ────────────────────────────────────────────────

export type DialoguePanelPhase =
  | 'idle'
  | 'thinking'
  | 'reviewing_plan'
  | 'executing'
  | 'complete'
  | 'error';

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** If assistant returned a plan, include it */
  plan?: EditPlan;
}

export interface DialoguePanelState {
  /** Current phase */
  phase: DialoguePanelPhase;
  /** Conversation history */
  turns: ConversationTurn[];
  /** Current edit plan being reviewed */
  activePlan?: EditPlan;
  /** Plans history */
  planHistory: EditPlan[];
  /** Execution results for active plan */
  executionResults?: PlanExecutionResult;
  /** Error message */
  error?: string;
  /** Whether the panel has analyzed materials loaded */
  hasMaterials: boolean;
  /** Number of loaded materials */
  materialCount: number;
}

export function createInitialDialogueState(): DialoguePanelState {
  return {
    phase: 'idle',
    turns: [],
    planHistory: [],
    hasMaterials: false,
    materialCount: 0,
  };
}

// ─── Panel Actions ──────────────────────────────────────────────

export type DialoguePanelAction =
  | { type: 'LOAD_MATERIALS'; count: number }
  | { type: 'SEND_MESSAGE'; content: string }
  | { type: 'RECEIVE_RESPONSE'; content: string; plan?: EditPlan }
  | { type: 'START_THINKING' }
  | { type: 'REVIEW_PLAN'; plan: EditPlan }
  | { type: 'APPROVE_PLAN' }
  | { type: 'REJECT_PLAN' }
  | { type: 'MODIFY_INSTRUCTION'; instructionId: string; updates: Partial<EditInstruction> }
  | { type: 'REMOVE_INSTRUCTION'; instructionId: string }
  | { type: 'EXECUTE_START' }
  | { type: 'EXECUTE_COMPLETE'; result: PlanExecutionResult }
  | { type: 'EXECUTE_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

let turnIdCounter = 0;
function nextTurnId(): string {
  return `turn-${++turnIdCounter}`;
}

/**
 * Pure state reducer for the dialogue editing panel.
 */
export function dialoguePanelReducer(
  state: DialoguePanelState,
  action: DialoguePanelAction
): DialoguePanelState {
  switch (action.type) {
    case 'LOAD_MATERIALS':
      return { ...state, hasMaterials: true, materialCount: action.count };

    case 'SEND_MESSAGE': {
      const userTurn: ConversationTurn = {
        id: nextTurnId(),
        role: 'user',
        content: action.content,
        timestamp: Date.now(),
      };
      return {
        ...state,
        phase: 'thinking',
        turns: [...state.turns, userTurn],
        error: undefined,
      };
    }

    case 'RECEIVE_RESPONSE': {
      const assistantTurn: ConversationTurn = {
        id: nextTurnId(),
        role: 'assistant',
        content: action.content,
        timestamp: Date.now(),
        plan: action.plan,
      };
      return {
        ...state,
        phase: action.plan ? 'reviewing_plan' : 'idle',
        turns: [...state.turns, assistantTurn],
        activePlan: action.plan,
      };
    }

    case 'START_THINKING':
      return { ...state, phase: 'thinking', error: undefined };

    case 'REVIEW_PLAN':
      return { ...state, phase: 'reviewing_plan', activePlan: action.plan };

    case 'APPROVE_PLAN':
      if (!state.activePlan) return state;
      return {
        ...state,
        phase: 'idle',
        planHistory: [...state.planHistory, state.activePlan],
      };

    case 'REJECT_PLAN':
      return { ...state, phase: 'idle', activePlan: undefined };

    case 'MODIFY_INSTRUCTION': {
      if (!state.activePlan) return state;
      const updatedInstructions = state.activePlan.instructions.map(inst =>
        inst.id === action.instructionId ? { ...inst, ...action.updates } : inst
      );
      return {
        ...state,
        activePlan: { ...state.activePlan, instructions: updatedInstructions },
      };
    }

    case 'REMOVE_INSTRUCTION': {
      if (!state.activePlan) return state;
      return {
        ...state,
        activePlan: {
          ...state.activePlan,
          instructions: state.activePlan.instructions.filter(i => i.id !== action.instructionId),
        },
      };
    }

    case 'EXECUTE_START':
      return { ...state, phase: 'executing', executionResults: undefined, error: undefined };

    case 'EXECUTE_COMPLETE':
      return {
        ...state,
        phase: 'complete',
        executionResults: action.result,
        activePlan: undefined,
      };

    case 'EXECUTE_ERROR':
      return { ...state, phase: 'error', error: action.error };

    case 'CLEAR_ERROR':
      return { ...state, error: undefined, phase: state.phase === 'error' ? 'idle' : state.phase };

    case 'RESET':
      return createInitialDialogueState();

    default:
      return state;
  }
}

// ─── Selectors ──────────────────────────────────────────────────

/** Convert conversation turns to LLM messages for the API */
export function turnsToLLMMessages(turns: ConversationTurn[]): LLMMessage[] {
  return turns.map(turn => ({
    role: turn.role,
    content: turn.content,
  }));
}

/** Get the latest plan from conversation */
export function getLatestPlan(turns: ConversationTurn[]): EditPlan | undefined {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].plan) return turns[i].plan;
  }
  return undefined;
}

/** Get sorted instructions from active plan */
export function getSortedInstructions(state: DialoguePanelState): EditInstruction[] {
  if (!state.activePlan) return [];
  return sortInstructionsByPriority(state.activePlan.instructions);
}

/** Get execution summary text */
export function getExecutionSummary(result: PlanExecutionResult): string {
  const parts = [
    `${result.succeeded}/${result.totalInstructions} instructions executed successfully`,
  ];
  if (result.failed > 0) {
    parts.push(`${result.failed} failed`);
  }
  if (result.skipped > 0) {
    parts.push(`${result.skipped} skipped`);
  }
  parts.push(`Completed in ${(result.totalMs / 1000).toFixed(1)}s`);
  return parts.join(' · ');
}

/** Get instruction display label */
export function getInstructionLabel(instruction: EditInstruction): string {
  const actionLabels: Record<string, string> = {
    cut: 'Cut',
    trim: 'Trim',
    reorder: 'Reorder',
    add_transition: 'Add Transition',
    add_subtitle: 'Add Subtitle',
    adjust_audio: 'Adjust Audio',
    add_effect: 'Add Effect',
    split: 'Split',
    merge: 'Merge',
    speed: 'Speed Change',
    fade: 'Fade',
    narration: 'Add Narration',
  };

  const label = actionLabels[instruction.action] ?? instruction.action;
  const target = instruction.target;

  if (target.startSec !== undefined && target.endSec !== undefined) {
    return `${label} (${formatTimeShort(target.startSec)} - ${formatTimeShort(target.endSec)})`;
  }
  return label;
}
