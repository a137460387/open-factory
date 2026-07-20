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

import type {
  Workflow,
  AutomationWorkflowStep,
  WorkflowCondition,
  WorkflowAction,
  ActionType,
  ConditionOperator,
} from './workflow-engine';
import { createDefaultStep, createDefaultCondition, createDefaultAction } from './workflow-engine';

// ─── Node Types ─────────────────────────────────────────────────

/** Node port data type */
export type PortDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'json'
  | 'media'
  | 'subtitle'
  | 'color'
  | 'audio';

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
export type NodeCategory =
  | 'input'       // Media import, file input
  | 'ai'          // AI processing (ASR, scene detect, etc.)
  | 'transform'   // Cut, trim, reorder
  | 'output'      // Export, subtitle output
  | 'condition'   // Branch, filter
  | 'variable'    // Set/get variables
  | 'custom';     // Plugin-provided

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

// ─── Built-in Node Definitions ──────────────────────────────────

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

const PORT_ID_COUNTER = { value: 1 };
function portId(): string {
  return `port_${PORT_ID_COUNTER.value++}`;
}

function makePort(name: string, dataType: PortDataType, direction: 'input' | 'output', required = false): NodePort {
  return { id: portId(), name, dataType, required, direction };
}

/** Built-in node definitions */
export const BUILTIN_NODE_DEFINITIONS: NodeDefinition[] = [
  {
    type: 'media-import',
    name: 'Media Import',
    category: 'input',
    description: 'Import video/audio/image media files',
    inputs: [],
    outputs: [makePort('media', 'media', 'output', true)],
    defaultParams: {},
  },
  {
    type: 'asr-transcribe',
    name: 'ASR Transcription',
    category: 'ai',
    description: 'Automatic speech recognition transcription',
    inputs: [makePort('media', 'media', 'input', true)],
    outputs: [makePort('subtitles', 'subtitle', 'output', true), makePort('text', 'string', 'output')],
    defaultParams: { language: 'auto' },
    actionType: 'analyze-scene',
  },
  {
    type: 'scene-detect',
    name: 'Scene Detection',
    category: 'ai',
    description: 'Detect scene changes in video',
    inputs: [makePort('media', 'media', 'input', true)],
    outputs: [makePort('scenes', 'json', 'output', true)],
    defaultParams: { threshold: 0.3 },
    actionType: 'analyze-scene',
  },
  {
    type: 'smart-cut',
    name: 'Smart Cut',
    category: 'transform',
    description: 'AI-powered automatic editing',
    inputs: [makePort('media', 'media', 'input', true), makePort('scenes', 'json', 'input')],
    outputs: [makePort('timeline', 'json', 'output', true)],
    defaultParams: { strategy: 'highlight' },
    actionType: 'auto-cut',
  },
  {
    type: 'apply-color-grade',
    name: 'Color Grading',
    category: 'transform',
    description: 'Apply color correction and LUT',
    inputs: [makePort('media', 'media', 'input', true)],
    outputs: [makePort('media', 'media', 'output', true)],
    defaultParams: { preset: 'cinematic' },
    actionType: 'apply-color-grade',
  },
  {
    type: 'apply-effect',
    name: 'Apply Effect',
    category: 'transform',
    description: 'Apply visual effect to media',
    inputs: [makePort('media', 'media', 'input', true)],
    outputs: [makePort('media', 'media', 'output', true)],
    defaultParams: { effectType: 'blur', intensity: 0.5 },
    actionType: 'apply-effect',
  },
  {
    type: 'add-subtitle',
    name: 'Add Subtitles',
    category: 'transform',
    description: 'Add subtitle overlay to video',
    inputs: [makePort('media', 'media', 'input', true), makePort('subtitles', 'subtitle', 'input', true)],
    outputs: [makePort('media', 'media', 'output', true)],
    defaultParams: { style: 'default' },
    actionType: 'add-subtitle',
  },
  {
    type: 'export-media',
    name: 'Export',
    category: 'output',
    description: 'Export final media file',
    inputs: [makePort('media', 'media', 'input', true)],
    outputs: [],
    defaultParams: { format: 'mp4', quality: 'high' },
    actionType: 'export',
  },
  {
    type: 'branch',
    name: 'Condition Branch',
    category: 'condition',
    description: 'Branch workflow based on condition',
    inputs: [makePort('input', 'json', 'input', true)],
    outputs: [makePort('true', 'json', 'output', true), makePort('false', 'json', 'output', true)],
    defaultParams: { field: '', operator: 'equals', value: null },
  },
  {
    type: 'set-variable',
    name: 'Set Variable',
    category: 'variable',
    description: 'Set a workflow variable',
    inputs: [makePort('value', 'json', 'input', true)],
    outputs: [makePort('value', 'json', 'output', true)],
    defaultParams: { variableName: '', value: null },
  },
  {
    type: 'quality-check',
    name: 'Quality Check',
    category: 'ai',
    description: 'Assess media quality score',
    inputs: [makePort('media', 'media', 'input', true)],
    outputs: [makePort('score', 'number', 'output', true), makePort('report', 'json', 'output')],
    defaultParams: {},
    actionType: 'quality-check',
  },
];

// ─── Graph Validation ───────────────────────────────────────────

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
export function validateNodeWorkflow(workflow: NodeWorkflow): NodeGraphValidationError[] {
  const errors: NodeGraphValidationError[] = [];
  const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]));

  // Check entry nodes exist
  if (workflow.entryNodeIds.length === 0 && workflow.nodes.length > 0) {
    errors.push({ type: 'no_entry', message: 'Workflow has no entry nodes' });
  }

  // Check for cycles using DFS
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const adjacency = new Map<string, string[]>();

  for (const conn of workflow.connections) {
    const existing = adjacency.get(conn.sourceNodeId) ?? [];
    existing.push(conn.targetNodeId);
    adjacency.set(conn.sourceNodeId, existing);
  }

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      if (inStack.has(neighbor)) return true;
      if (!visited.has(neighbor) && hasCycle(neighbor)) return true;
    }
    inStack.delete(nodeId);
    return false;
  }

  for (const node of workflow.nodes) {
    if (!visited.has(node.id) && hasCycle(node.id)) {
      errors.push({ type: 'cycle', nodeId: node.id, message: `Cycle detected involving node "${node.name}"` });
      break;
    }
  }

  // Check type mismatches on connections
  for (const conn of workflow.connections) {
    const source = nodeMap.get(conn.sourceNodeId);
    const target = nodeMap.get(conn.targetNodeId);
    if (!source || !target) continue;

    const sourcePort = source.outputs.find((p) => p.id === conn.sourcePortId);
    const targetPort = target.inputs.find((p) => p.id === conn.targetPortId);
    if (sourcePort && targetPort && sourcePort.dataType !== targetPort.dataType && targetPort.dataType !== 'json') {
      errors.push({
        type: 'type_mismatch',
        nodeId: conn.targetNodeId,
        portId: conn.targetPortId,
        message: `Type mismatch: "${sourcePort.dataType}" → "${targetPort.dataType}" on ${source.name} → ${target.name}`,
      });
    }
  }

  // Check required inputs
  for (const node of workflow.nodes) {
    const connectedInputPorts = new Set(
      workflow.connections
        .filter((c) => c.targetNodeId === node.id)
        .map((c) => c.targetPortId),
    );
    for (const port of node.inputs) {
      if (port.required && !connectedInputPorts.has(port.id) && port.defaultValue === undefined) {
        errors.push({
          type: 'missing_required',
          nodeId: node.id,
          portId: port.id,
          message: `Required input "${port.name}" on node "${node.name}" is not connected`,
        });
      }
    }
  }

  return errors;
}

// ─── Graph → Workflow Conversion ────────────────────────────────

/**
 * Topological sort of nodes (execution order).
 */
function topologicalSort(nodes: WorkflowNode[], connections: NodeConnection[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const conn of connections) {
    const existing = adjacency.get(conn.sourceNodeId) ?? [];
    existing.push(conn.targetNodeId);
    adjacency.set(conn.sourceNodeId, existing);
    inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: WorkflowNode[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodeMap.get(nodeId);
    if (node) sorted.push(node);
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return sorted;
}

/**
 * Convert a node-graph workflow to a linear Workflow for WorkflowEngine execution.
 */
export function convertToWorkflow(nodeWorkflow: NodeWorkflow): Workflow {
  const sortedNodes = topologicalSort(
    nodeWorkflow.nodes.filter((n) => n.enabled),
    nodeWorkflow.connections,
  );

  const steps: AutomationWorkflowStep[] = sortedNodes.map((node) => {
    const conditions: WorkflowCondition[] = [];
    const actions: WorkflowAction[] = [];

    if (node.type === 'branch') {
      // Branch nodes become conditions on subsequent steps
      const config = node.params as Record<string, unknown>;
      conditions.push({
        id: `cond_${node.id}`,
        field: typeof config.field === 'string' ? config.field : '',
        operator: (typeof config.operator === 'string' ? config.operator : 'equals') as ConditionOperator,
        value: config.value,
        logic: 'and',
      });
    } else {
      // Regular nodes become actions
      const def = BUILTIN_NODE_DEFINITIONS.find((d) => d.type === node.type);
      const actionType = def?.actionType ?? ('custom' as ActionType);
      actions.push({
        id: `action_${node.id}`,
        type: actionType,
        params: { ...node.params, _nodeId: node.id },
        continueOnError: false,
      });
    }

    return {
      id: `step_${node.id}`,
      name: node.name,
      description: node.description,
      conditions,
      actions,
      skipOnError: false,
    };
  });

  const now = Date.now();
  return {
    id: nodeWorkflow.id,
    name: nodeWorkflow.name,
    description: nodeWorkflow.description,
    version: nodeWorkflow.version,
    triggers: [{ id: 'trigger-manual', type: 'manual', params: {}, enabled: true }],
    steps,
    enabled: true,
    createdAt: nodeWorkflow.createdAt ?? now,
    updatedAt: now,
    tags: nodeWorkflow.tags,
  };
}

// ─── Parameterized Workflow ─────────────────────────────────────

/**
 * Resolve parameter references in node params.
 * Parameters are referenced as {{paramName}} in string values.
 */
export function resolveParameters(
  params: Record<string, unknown>,
  parameters: WorkflowParameter[],
  providedValues: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      resolved[key] = value.replace(/\{\{(\w+)\}\}/g, (_match, paramName: string) => {
        if (paramName in providedValues) return String(providedValues[paramName]);
        const param = parameters.find((p) => p.name === paramName);
        if (param?.defaultValue !== undefined) return String(param.defaultValue);
        return `{{${paramName}}}`;
      });
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

/**
 * Validate that all required parameters are provided.
 */
export function validateParameters(
  parameters: WorkflowParameter[],
  providedValues: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  for (const param of parameters) {
    if (param.required && !(param.name in providedValues) && param.defaultValue === undefined) {
      errors.push(`Required parameter "${param.name}" is missing`);
    }
  }
  return errors;
}

// ─── Factory Functions ──────────────────────────────────────────

let _nodeIdCounter = 1;
function nodeGenId(prefix: string): string {
  return `${prefix}_${Date.now()}_${_nodeIdCounter++}`;
}

/** Create a new empty node workflow */
export function createNodeWorkflow(name: string = 'New Workflow'): NodeWorkflow {
  return {
    id: nodeGenId('nwf'),
    name,
    version: '1.0.0',
    parameters: [],
    nodes: [],
    connections: [],
    entryNodeIds: [],
    canvas: { zoom: 1, offsetX: 0, offsetY: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
  };
}

/** Create a node from a built-in definition */
export function createNodeFromDefinition(
  def: NodeDefinition,
  position: NodePosition,
): WorkflowNode {
  const nodeId = nodeGenId('node');
  const inputs = def.inputs.map((p) => ({ ...p, id: portId() }));
  const outputs = def.outputs.map((p) => ({ ...p, id: portId() }));
  return {
    id: nodeId,
    type: def.type,
    name: def.name,
    category: def.category,
    position,
    inputs,
    outputs,
    params: { ...def.defaultParams },
    enabled: true,
    description: def.description,
  };
}

/** Add a node to a workflow */
export function addNode(workflow: NodeWorkflow, node: WorkflowNode): NodeWorkflow {
  const nodes = [...workflow.nodes, node];
  const entryNodeIds = findEntryNodes(nodes, workflow.connections);
  return { ...workflow, nodes, entryNodeIds, updatedAt: Date.now() };
}

/** Remove a node and its connections from a workflow */
export function removeNode(workflow: NodeWorkflow, nodeId: string): NodeWorkflow {
  const nodes = workflow.nodes.filter((n) => n.id !== nodeId);
  const connections = workflow.connections.filter(
    (c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId,
  );
  const entryNodeIds = findEntryNodes(nodes, connections);
  return { ...workflow, nodes, connections, entryNodeIds, updatedAt: Date.now() };
}

/** Connect two nodes */
export function connectNodes(
  workflow: NodeWorkflow,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
): NodeWorkflow {
  const connection: NodeConnection = {
    id: nodeGenId('conn'),
    sourceNodeId,
    sourcePortId,
    targetNodeId,
    targetPortId,
  };
  const connections = [...workflow.connections, connection];
  const entryNodeIds = findEntryNodes(workflow.nodes, connections);
  return { ...workflow, connections, entryNodeIds, updatedAt: Date.now() };
}

/** Disconnect two nodes */
export function disconnectNodes(workflow: NodeWorkflow, connectionId: string): NodeWorkflow {
  const connections = workflow.connections.filter((c) => c.id !== connectionId);
  const entryNodeIds = findEntryNodes(workflow.nodes, connections);
  return { ...workflow, connections, entryNodeIds, updatedAt: Date.now() };
}

/** Update node params */
export function updateNodeParams(
  workflow: NodeWorkflow,
  nodeId: string,
  params: Record<string, unknown>,
): NodeWorkflow {
  const nodes = workflow.nodes.map((n) =>
    n.id === nodeId ? { ...n, params: { ...n.params, ...params } } : n,
  );
  return { ...workflow, nodes, updatedAt: Date.now() };
}

/** Move a node on the canvas */
export function moveNode(
  workflow: NodeWorkflow,
  nodeId: string,
  position: NodePosition,
): NodeWorkflow {
  const nodes = workflow.nodes.map((n) =>
    n.id === nodeId ? { ...n, position } : n,
  );
  return { ...workflow, nodes };
}

function findEntryNodes(nodes: WorkflowNode[], connections: NodeConnection[]): string[] {
  const hasIncoming = new Set(connections.map((c) => c.targetNodeId));
  return nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id);
}

// ─── Built-in Templates ─────────────────────────────────────────

export const BUILTIN_NODE_TEMPLATES: Array<{ id: string; name: string; description: string; workflow: NodeWorkflow }> = [
  {
    id: 'ntpl-auto-subtitle',
    name: 'Auto Subtitle Pipeline',
    description: 'Import media → ASR → Add subtitles → Export',
    workflow: (() => {
      const wf = createNodeWorkflow('Auto Subtitle Pipeline');
      const importDef = BUILTIN_NODE_DEFINITIONS.find((d) => d.type === 'media-import')!;
      const asrDef = BUILTIN_NODE_DEFINITIONS.find((d) => d.type === 'asr-transcribe')!;
      const subDef = BUILTIN_NODE_DEFINITIONS.find((d) => d.type === 'add-subtitle')!;
      const exportDef = BUILTIN_NODE_DEFINITIONS.find((d) => d.type === 'export-media')!;

      const n1 = createNodeFromDefinition(importDef, { x: 100, y: 200 });
      const n2 = createNodeFromDefinition(asrDef, { x: 350, y: 200 });
      const n3 = createNodeFromDefinition(subDef, { x: 600, y: 200 });
      const n4 = createNodeFromDefinition(exportDef, { x: 850, y: 200 });

      return {
        ...wf,
        nodes: [n1, n2, n3, n4],
        connections: [
          { id: 'c1', sourceNodeId: n1.id, sourcePortId: n1.outputs[0].id, targetNodeId: n2.id, targetPortId: n2.inputs[0].id },
          { id: 'c2', sourceNodeId: n2.id, sourcePortId: n2.outputs[0].id, targetNodeId: n3.id, targetPortId: n3.inputs[1].id },
          { id: 'c3', sourceNodeId: n1.id, sourcePortId: n1.outputs[0].id, targetNodeId: n3.id, targetPortId: n3.inputs[0].id },
          { id: 'c4', sourceNodeId: n3.id, sourcePortId: n3.outputs[0].id, targetNodeId: n4.id, targetPortId: n4.inputs[0].id },
        ],
        entryNodeIds: [n1.id],
      };
    })(),
  },
  {
    id: 'ntpl-smart-highlight',
    name: 'Smart Highlight Reel',
    description: 'Import → Scene detect → Smart cut → Color grade → Export',
    workflow: (() => {
      const wf = createNodeWorkflow('Smart Highlight Reel');
      const importDef = BUILTIN_NODE_DEFINITIONS.find((d) => d.type === 'media-import')!;
      const sceneDef = BUILTIN_NODE_DEFINITIONS.find((d) => d.type === 'scene-detect')!;
      const cutDef = BUILTIN_NODE_DEFINITIONS.find((d) => d.type === 'smart-cut')!;
      const gradeDef = BUILTIN_NODE_DEFINITIONS.find((d) => d.type === 'apply-color-grade')!;
      const exportDef = BUILTIN_NODE_DEFINITIONS.find((d) => d.type === 'export-media')!;

      const n1 = createNodeFromDefinition(importDef, { x: 100, y: 200 });
      const n2 = createNodeFromDefinition(sceneDef, { x: 350, y: 200 });
      const n3 = createNodeFromDefinition(cutDef, { x: 600, y: 200 });
      const n4 = createNodeFromDefinition(gradeDef, { x: 850, y: 200 });
      const n5 = createNodeFromDefinition(exportDef, { x: 1100, y: 200 });

      return {
        ...wf,
        nodes: [n1, n2, n3, n4, n5],
        connections: [
          { id: 'c1', sourceNodeId: n1.id, sourcePortId: n1.outputs[0].id, targetNodeId: n2.id, targetPortId: n2.inputs[0].id },
          { id: 'c2', sourceNodeId: n2.id, sourcePortId: n2.outputs[0].id, targetNodeId: n3.id, targetPortId: n3.inputs[1].id },
          { id: 'c3', sourceNodeId: n1.id, sourcePortId: n1.outputs[0].id, targetNodeId: n3.id, targetPortId: n3.inputs[0].id },
          { id: 'c4', sourceNodeId: n3.id, sourcePortId: n3.outputs[0].id, targetNodeId: n4.id, targetPortId: n4.inputs[0].id },
          { id: 'c5', sourceNodeId: n4.id, sourcePortId: n4.outputs[0].id, targetNodeId: n5.id, targetPortId: n5.inputs[0].id },
        ],
        entryNodeIds: [n1.id],
      };
    })(),
  },
];
