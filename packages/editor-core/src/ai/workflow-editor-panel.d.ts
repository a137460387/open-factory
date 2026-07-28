/**
 * Workflow Editor Panel
 *
 * Data layer for the visual "Workflow Editor" UI panel.
 * Manages node graph editing, connection creation, and workflow execution.
 *
 * Designed to be consumed by any frontend framework (React, Vue, Svelte, etc.)
 */
import type { NodeWorkflow, WorkflowNode, WorkflowParameter, NodePosition, NodeDefinition, NodeGraphValidationError } from '../automation/workflow-node-editor';
import { BUILTIN_NODE_TEMPLATES } from '../automation/workflow-node-editor';
import type { Workflow, WorkflowExecutionContext } from '../automation/workflow-engine';
export type WorkflowEditorPhase = 'idle' | 'editing' | 'validating' | 'executing' | 'complete' | 'error';
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
export declare function createInitialWorkflowEditorState(name?: string): WorkflowEditorState;
export type WorkflowEditorAction = {
    type: 'LOAD_WORKFLOW';
    workflow: NodeWorkflow;
} | {
    type: 'LOAD_TEMPLATE';
    templateId: string;
} | {
    type: 'ADD_NODE';
    definitionType: string;
    position: NodePosition;
} | {
    type: 'REMOVE_NODE';
    nodeId: string;
} | {
    type: 'SELECT_NODE';
    nodeId: string;
    additive?: boolean;
} | {
    type: 'DESELECT_ALL';
} | {
    type: 'SELECT_CONNECTION';
    connectionId: string | undefined;
} | {
    type: 'MOVE_NODE';
    nodeId: string;
    position: NodePosition;
} | {
    type: 'START_CONNECTION';
    sourceNodeId: string;
    sourcePortId: string;
} | {
    type: 'COMPLETE_CONNECTION';
    targetNodeId: string;
    targetPortId: string;
} | {
    type: 'CANCEL_CONNECTION';
} | {
    type: 'DELETE_CONNECTION';
    connectionId: string;
} | {
    type: 'UPDATE_NODE_PARAMS';
    nodeId: string;
    params: Record<string, unknown>;
} | {
    type: 'TOGGLE_NODE_ENABLED';
    nodeId: string;
} | {
    type: 'VALIDATE';
} | {
    type: 'SET_PARAMETER';
    name: string;
    value: unknown;
} | {
    type: 'EXECUTE';
} | {
    type: 'EXECUTE_COMPLETE';
    context: WorkflowExecutionContext;
} | {
    type: 'EXECUTE_ERROR';
    error: string;
} | {
    type: 'SET_ZOOM';
    zoom: number;
} | {
    type: 'SET_PAN';
    offset: NodePosition;
} | {
    type: 'UPDATE_WORKFLOW_META';
    updates: Partial<Pick<NodeWorkflow, 'name' | 'description' | 'tags'>>;
} | {
    type: 'ADD_PARAMETER';
    param: WorkflowParameter;
} | {
    type: 'REMOVE_PARAMETER';
    paramId: string;
} | {
    type: 'CLEAR_ERROR';
} | {
    type: 'RESET';
    name?: string;
};
/**
 * Pure state reducer for the workflow editor panel.
 */
export declare function workflowEditorReducer(state: WorkflowEditorState, action: WorkflowEditorAction): WorkflowEditorState;
/** Get node at a specific canvas position */
export declare function getNodeAtPosition(state: WorkflowEditorState, canvasX: number, canvasY: number): WorkflowNode | undefined;
/** Get the converted linear workflow for execution */
export declare function getLinearWorkflow(state: WorkflowEditorState): Workflow;
/** Get all available node types grouped by category */
export declare function getNodeDefinitionsByCategory(definitions: NodeDefinition[]): Map<string, NodeDefinition[]>;
/** Format execution status for display */
export declare function formatExecutionStatus(context: WorkflowExecutionContext): string;
//# sourceMappingURL=workflow-editor-panel.d.ts.map