/**
 * Workflow Node Editor Extension
 *
 * Adds visual node-graph workflow editing on top of the existing WorkflowEngine.
 * Supports:
 * - Node-based workflow definition (DAG)
 * - Parameterized workflows with typed inputs/outputs
 * - Enhanced conditional branching with expression evaluation
 * - Node connection validation
 *
 * Converts node graphs to Workflow steps for execution by WorkflowEngine.
 */
import type { Workflow, ActionType, ConditionOperator } from './workflow-engine';
/** Node port data type */
export type PortDataType = 'string' | 'number' | 'boolean' | 'json' | 'media' | 'subtitle' | 'color' | 'audio';
/** Node port definition */
export interface NodePort {
    id: string;
    name: string;
    dataType: PortDataType;
    /** Whether this port is required for the node to execute */
    required: boolean;
    /** Default value if no connection */
    defaultValue?: unknown;
    /** Port direction */
    direction: 'input' | 'output';
}
/** Node category for palette grouping */
export type NodeCategory = 'input' | 'ai' | 'transform' | 'output' | 'condition' | 'variable' | 'custom';
/** Visual position on canvas */
export interface NodePosition {
    x: number;
    y: number;
}
/** A single node in the workflow graph */
export interface WorkflowNode {
    id: string;
    /** Node type identifier (maps to action type or custom) */
    type: string;
    /** Display name */
    name: string;
    /** Category for palette */
    category: NodeCategory;
    /** Visual position on canvas */
    position: NodePosition;
    /** Input ports */
    inputs: NodePort[];
    /** Output ports */
    outputs: NodePort[];
    /** Node-specific parameters */
    params: Record<string, unknown>;
    /** Whether node is enabled */
    enabled: boolean;
    /** Optional description */
    description?: string;
}
/** Connection between two nodes */
export interface NodeConnection {
    id: string;
    /** Source node ID */
    sourceNodeId: string;
    /** Source port ID */
    sourcePortId: string;
    /** Target node ID */
    targetNodeId: string;
    /** Target port ID */
    targetPortId: string;
}
/** Conditional branch node configuration */
export interface BranchNodeConfig {
    /** Field path to evaluate */
    field: string;
    /** Comparison operator */
    operator: ConditionOperator;
    /** Value to compare against (supports template variables) */
    value: unknown;
    /** Output port for "true" branch */
    trueOutputId: string;
    /** Output port for "false" branch */
    falseOutputId: string;
}
/** Workflow parameter definition */
export interface WorkflowParameter {
    id: string;
    name: string;
    dataType: PortDataType;
    defaultValue?: unknown;
    description?: string;
    required: boolean;
}
/** Complete node-graph workflow definition */
export interface NodeWorkflow {
    id: string;
    name: string;
    description?: string;
    version: string;
    /** Workflow parameters (for parameterized templates) */
    parameters: WorkflowParameter[];
    /** All nodes in the graph */
    nodes: WorkflowNode[];
    /** Connections between nodes */
    connections: NodeConnection[];
    /** Entry point node IDs (nodes with no incoming connections) */
    entryNodeIds: string[];
    /** Visual canvas metadata */
    canvas: {
        zoom: number;
        offsetX: number;
        offsetY: number;
    };
    createdAt: number;
    updatedAt: number;
    tags: string[];
}
/** Node definition for the palette */
export interface NodeDefinition {
    type: string;
    name: string;
    category: NodeCategory;
    description: string;
    inputs: NodePort[];
    outputs: NodePort[];
    defaultParams: Record<string, unknown>;
    /** Maps this node to an action type for WorkflowEngine execution */
    actionType?: ActionType;
}
/** Built-in node definitions */
export declare const BUILTIN_NODE_DEFINITIONS: NodeDefinition[];
export interface NodeGraphValidationError {
    type: 'disconnected' | 'cycle' | 'type_mismatch' | 'missing_required' | 'no_entry';
    nodeId?: string;
    portId?: string;
    message: string;
}
/**
 * Validate a node workflow graph.
 * Checks for cycles, disconnected nodes, type mismatches, etc.
 */
export declare function validateNodeWorkflow(workflow: NodeWorkflow): NodeGraphValidationError[];
/**
 * Convert a node-graph workflow to a linear Workflow for WorkflowEngine execution.
 */
export declare function convertToWorkflow(nodeWorkflow: NodeWorkflow): Workflow;
/**
 * Resolve parameter references in node params.
 * Parameters are referenced as {{paramName}} in string values.
 */
export declare function resolveParameters(params: Record<string, unknown>, parameters: WorkflowParameter[], providedValues: Record<string, unknown>): Record<string, unknown>;
/**
 * Validate that all required parameters are provided.
 */
export declare function validateParameters(parameters: WorkflowParameter[], providedValues: Record<string, unknown>): string[];
/** Create a new empty node workflow */
export declare function createNodeWorkflow(name?: string): NodeWorkflow;
/** Create a node from a built-in definition */
export declare function createNodeFromDefinition(def: NodeDefinition, position: NodePosition): WorkflowNode;
/** Add a node to a workflow */
export declare function addNode(workflow: NodeWorkflow, node: WorkflowNode): NodeWorkflow;
/** Remove a node and its connections from a workflow */
export declare function removeNode(workflow: NodeWorkflow, nodeId: string): NodeWorkflow;
/** Connect two nodes */
export declare function connectNodes(workflow: NodeWorkflow, sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string): NodeWorkflow;
/** Disconnect two nodes */
export declare function disconnectNodes(workflow: NodeWorkflow, connectionId: string): NodeWorkflow;
/** Update node params */
export declare function updateNodeParams(workflow: NodeWorkflow, nodeId: string, params: Record<string, unknown>): NodeWorkflow;
/** Move a node on the canvas */
export declare function moveNode(workflow: NodeWorkflow, nodeId: string, position: NodePosition): NodeWorkflow;
export declare const BUILTIN_NODE_TEMPLATES: Array<{
    id: string;
    name: string;
    description: string;
    workflow: NodeWorkflow;
}>;
//# sourceMappingURL=workflow-node-editor.d.ts.map