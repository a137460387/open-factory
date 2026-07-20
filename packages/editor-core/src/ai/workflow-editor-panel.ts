/**
 * Workflow Editor Panel
 *
 * Data layer for the visual "Workflow Editor" UI panel.
 * Manages node graph editing, connection creation, and workflow execution.
 *
 * Designed to be consumed by any frontend framework (React, Vue, Svelte, etc.)
 */

import type {
  NodeWorkflow,
  WorkflowNode,
  WorkflowParameter,
  NodeConnection,
  NodePosition,
  NodeDefinition,
  NodeGraphValidationError,
} from '../automation/workflow-node-editor';
import {
  createNodeWorkflow,
  createNodeFromDefinition,
  addNode,
  removeNode,
  connectNodes,
  disconnectNodes,
  updateNodeParams,
  moveNode,
  validateNodeWorkflow,
  convertToWorkflow,
  resolveParameters,
  validateParameters,
  BUILTIN_NODE_DEFINITIONS,
  BUILTIN_NODE_TEMPLATES,
} from '../automation/workflow-node-editor';
import type { Workflow, WorkflowExecutionContext } from '../automation/workflow-engine';

// ─── Panel State ────────────────────────────────────────────────

export type WorkflowEditorPhase =
  | 'idle'
  | 'editing'
  | 'validating'
  | 'executing'
  | 'complete'
  | 'error';

export interface WorkflowEditorState {
  /** Current phase */
  phase: WorkflowEditorPhase;
  /** The workflow being edited */
  workflow: NodeWorkflow;
  /** Selected node IDs */
  selectedNodeIds: string[];
  /** Selected connection ID */
  selectedConnectionId?: string;
  /** Node currently being dragged */
  draggingNodeId?: string;
  /** Connection being drawn (source info) */
  pendingConnection?: {
    sourceNodeId: string;
    sourcePortId: string;
  };
  /** Validation errors */
  validationErrors: NodeGraphValidationError[];
  /** Execution context (after running) */
  executionContext?: WorkflowExecutionContext;
  /** Parameter values for execution */
  parameterValues: Record<string, unknown>;
  /** Available node definitions for palette */
  nodeDefinitions: NodeDefinition[];
  /** Available templates */
  templates: typeof BUILTIN_NODE_TEMPLATES;
  /** Error message */
  error?: string;
  /** Canvas zoom level */
  zoom: number;
  /** Canvas pan offset */
  panOffset: NodePosition;
}

export function createInitialWorkflowEditorState(
  name: string = 'New Workflow',
): WorkflowEditorState {
  return {
    phase: 'editing',
    workflow: createNodeWorkflow(name),
    selectedNodeIds: [],
    validationErrors: [],
    parameterValues: {},
    nodeDefinitions: BUILTIN_NODE_DEFINITIONS,
    templates: BUILTIN_NODE_TEMPLATES,
    zoom: 1,
    panOffset: { x: 0, y: 0 },
  };
}

// ─── Panel Actions ──────────────────────────────────────────────

export type WorkflowEditorAction =
  | { type: 'LOAD_WORKFLOW'; workflow: NodeWorkflow }
  | { type: 'LOAD_TEMPLATE'; templateId: string }
  | { type: 'ADD_NODE'; definitionType: string; position: NodePosition }
  | { type: 'REMOVE_NODE'; nodeId: string }
  | { type: 'SELECT_NODE'; nodeId: string; additive?: boolean }
  | { type: 'DESELECT_ALL' }
  | { type: 'SELECT_CONNECTION'; connectionId: string | undefined }
  | { type: 'MOVE_NODE'; nodeId: string; position: NodePosition }
  | { type: 'START_CONNECTION'; sourceNodeId: string; sourcePortId: string }
  | { type: 'COMPLETE_CONNECTION'; targetNodeId: string; targetPortId: string }
  | { type: 'CANCEL_CONNECTION' }
  | { type: 'DELETE_CONNECTION'; connectionId: string }
  | { type: 'UPDATE_NODE_PARAMS'; nodeId: string; params: Record<string, unknown> }
  | { type: 'TOGGLE_NODE_ENABLED'; nodeId: string }
  | { type: 'VALIDATE' }
  | { type: 'SET_PARAMETER'; name: string; value: unknown }
  | { type: 'EXECUTE' }
  | { type: 'EXECUTE_COMPLETE'; context: WorkflowExecutionContext }
  | { type: 'EXECUTE_ERROR'; error: string }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_PAN'; offset: NodePosition }
  | { type: 'UPDATE_WORKFLOW_META'; updates: Partial<Pick<NodeWorkflow, 'name' | 'description' | 'tags'>> }
  | { type: 'ADD_PARAMETER'; param: WorkflowParameter }
  | { type: 'REMOVE_PARAMETER'; paramId: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET'; name?: string };

/**
 * Pure state reducer for the workflow editor panel.
 */
export function workflowEditorReducer(
  state: WorkflowEditorState,
  action: WorkflowEditorAction,
): WorkflowEditorState {
  switch (action.type) {
    case 'LOAD_WORKFLOW':
      return { ...state, workflow: action.workflow, selectedNodeIds: [], validationErrors: [], phase: 'editing' };

    case 'LOAD_TEMPLATE': {
      const template = BUILTIN_NODE_TEMPLATES.find((t) => t.id === action.templateId);
      if (!template) return { ...state, error: `Template not found: ${action.templateId}` };
      return {
        ...state,
        workflow: { ...template.workflow, id: `wf-${Date.now()}`, createdAt: Date.now(), updatedAt: Date.now() },
        selectedNodeIds: [],
        validationErrors: [],
        phase: 'editing',
      };
    }

    case 'ADD_NODE': {
      const def = state.nodeDefinitions.find((d) => d.type === action.definitionType);
      if (!def) return { ...state, error: `Unknown node type: ${action.definitionType}` };
      const node = createNodeFromDefinition(def, action.position);
      return { ...state, workflow: addNode(state.workflow, node), selectedNodeIds: [node.id] };
    }

    case 'REMOVE_NODE': {
      const selectedNodeIds = state.selectedNodeIds.filter((id) => id !== action.nodeId);
      return { ...state, workflow: removeNode(state.workflow, action.nodeId), selectedNodeIds };
    }

    case 'SELECT_NODE': {
      if (action.additive) {
        const isSelected = state.selectedNodeIds.includes(action.nodeId);
        const selectedNodeIds = isSelected
          ? state.selectedNodeIds.filter((id) => id !== action.nodeId)
          : [...state.selectedNodeIds, action.nodeId];
        return { ...state, selectedNodeIds };
      }
      return { ...state, selectedNodeIds: [action.nodeId], selectedConnectionId: undefined };
    }

    case 'DESELECT_ALL':
      return { ...state, selectedNodeIds: [], selectedConnectionId: undefined };

    case 'SELECT_CONNECTION':
      return { ...state, selectedConnectionId: action.connectionId, selectedNodeIds: [] };

    case 'MOVE_NODE':
      return { ...state, workflow: moveNode(state.workflow, action.nodeId, action.position) };

    case 'START_CONNECTION':
      return {
        ...state,
        pendingConnection: { sourceNodeId: action.sourceNodeId, sourcePortId: action.sourcePortId },
      };

    case 'COMPLETE_CONNECTION': {
      if (!state.pendingConnection) return state;
      return {
        ...state,
        workflow: connectNodes(
          state.workflow,
          state.pendingConnection.sourceNodeId,
          state.pendingConnection.sourcePortId,
          action.targetNodeId,
          action.targetPortId,
        ),
        pendingConnection: undefined,
      };
    }

    case 'CANCEL_CONNECTION':
      return { ...state, pendingConnection: undefined };

    case 'DELETE_CONNECTION':
      return { ...state, workflow: disconnectNodes(state.workflow, action.connectionId), selectedConnectionId: undefined };

    case 'UPDATE_NODE_PARAMS':
      return { ...state, workflow: updateNodeParams(state.workflow, action.nodeId, action.params) };

    case 'TOGGLE_NODE_ENABLED': {
      const nodes = state.workflow.nodes.map((n) =>
        n.id === action.nodeId ? { ...n, enabled: !n.enabled } : n,
      );
      return { ...state, workflow: { ...state.workflow, nodes, updatedAt: Date.now() } };
    }

    case 'VALIDATE': {
      const errors = validateNodeWorkflow(state.workflow);
      return { ...state, validationErrors: errors, phase: errors.length > 0 ? 'error' : 'editing' };
    }

    case 'SET_PARAMETER':
      return { ...state, parameterValues: { ...state.parameterValues, [action.name]: action.value } };

    case 'EXECUTE': {
      const paramErrors = validateParameters(state.workflow.parameters, state.parameterValues);
      if (paramErrors.length > 0) {
        return { ...state, error: paramErrors.join('; '), phase: 'error' };
      }
      const validationErrors = validateNodeWorkflow(state.workflow);
      if (validationErrors.length > 0) {
        return { ...state, validationErrors, phase: 'error' };
      }
      return { ...state, phase: 'executing', error: undefined };
    }

    case 'EXECUTE_COMPLETE':
      return { ...state, phase: 'complete', executionContext: action.context };

    case 'EXECUTE_ERROR':
      return { ...state, phase: 'error', error: action.error };

    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(0.1, Math.min(3, action.zoom)) };

    case 'SET_PAN':
      return { ...state, panOffset: action.offset };

    case 'UPDATE_WORKFLOW_META':
      return {
        ...state,
        workflow: { ...state.workflow, ...action.updates, updatedAt: Date.now() },
      };

    case 'ADD_PARAMETER':
      return {
        ...state,
        workflow: {
          ...state.workflow,
          parameters: [...state.workflow.parameters, action.param],
          updatedAt: Date.now(),
        },
      };

    case 'REMOVE_PARAMETER':
      return {
        ...state,
        workflow: {
          ...state.workflow,
          parameters: state.workflow.parameters.filter((p) => p.id !== action.paramId),
          updatedAt: Date.now(),
        },
      };

    case 'CLEAR_ERROR':
      return { ...state, error: undefined };

    case 'RESET':
      return createInitialWorkflowEditorState(action.name);

    default:
      return state;
  }
}

// ─── Derived Data Helpers ───────────────────────────────────────

/** Get node at a specific canvas position */
export function getNodeAtPosition(
  state: WorkflowEditorState,
  canvasX: number,
  canvasY: number,
): WorkflowNode | undefined {
  // Simple hit test: check if point is within node bounds (assuming 200x80 node size)
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 80;
  return state.workflow.nodes.find(
    (n) =>
      canvasX >= n.position.x &&
      canvasX <= n.position.x + NODE_WIDTH &&
      canvasY >= n.position.y &&
      canvasY <= n.position.y + NODE_HEIGHT,
  );
}

/** Get the converted linear workflow for execution */
export function getLinearWorkflow(state: WorkflowEditorState): Workflow {
  const resolvedNodes = state.workflow.nodes.map((node) => ({
    ...node,
    params: resolveParameters(node.params, state.workflow.parameters, state.parameterValues),
  }));
  const resolvedWorkflow = { ...state.workflow, nodes: resolvedNodes };
  return convertToWorkflow(resolvedWorkflow);
}

/** Get all available node types grouped by category */
export function getNodeDefinitionsByCategory(
  definitions: NodeDefinition[],
): Map<string, NodeDefinition[]> {
  const grouped = new Map<string, NodeDefinition[]>();
  for (const def of definitions) {
    const existing = grouped.get(def.category) ?? [];
    existing.push(def);
    grouped.set(def.category, existing);
  }
  return grouped;
}

/** Format execution status for display */
export function formatExecutionStatus(context: WorkflowExecutionContext): string {
  const total = context.stepResults.size;
  const completed = Array.from(context.stepResults.values()).filter(
    (r) => r.status === 'completed',
  ).length;
  const failed = Array.from(context.stepResults.values()).filter(
    (r) => r.status === 'failed',
  ).length;

  if (context.status === 'completed') return `Completed: ${completed}/${total} steps`;
  if (context.status === 'failed') return `Failed: ${failed} error(s), ${completed} succeeded`;
  if (context.status === 'running') return `Running: step ${context.currentStepIndex + 1}/${total}`;
  if (context.status === 'paused') return `Paused at step ${context.currentStepIndex + 1}/${total}`;
  if (context.status === 'cancelled') return 'Cancelled';
  return context.status;
}
