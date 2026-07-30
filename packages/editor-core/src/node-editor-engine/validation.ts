/**
 * Validation types and helper functions for graph validation.
 */

import type {NodePort, NodeDefinition, WorkflowNode, WorkflowGraph} from '../node-editor-types';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ValidationError {
  nodeId: string;
  message: string;
}

export interface ValidationWarning {
  nodeId: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// ─── Port Compatibility ───────────────────────────────────────────────────

/** Check if two ports are compatible by data type. */
export function arePortsCompatible(sourcePort: NodePort, targetPort: NodePort): boolean {
  if (sourcePort.dataType === 'any' || targetPort.dataType === 'any') return true;
  return sourcePort.dataType === targetPort.dataType;
}

// ─── Cycle Detection ──────────────────────────────────────────────────────

/** Check if adding sourceNodeId -> targetNodeId would create a cycle. */
export function wouldCreateCycle(
  connections: Array<{sourceNodeId: string; targetNodeId: string}>,
  sourceNodeId: string,
  targetNodeId: string,
): boolean {
  const visited = new Set<string>();
  const stack = [targetNodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceNodeId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const conn of connections) {
      if (conn.sourceNodeId === current) {
        stack.push(conn.targetNodeId);
      }
    }
  }

  return false;
}

/** Check if the graph has cycles using DFS. */
export function hasCycles(graph: WorkflowGraph): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const outgoing = (nodeId: string) =>
    graph.connections
      .filter(c => c.sourceNodeId === nodeId)
      .map(c => c.targetNodeId);

  const dfs = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    for (const target of outgoing(nodeId)) {
      if (!visited.has(target)) {
        if (dfs(target)) return true;
      } else if (recursionStack.has(target)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }

  return false;
}

// ─── Full Graph Validation ────────────────────────────────────────────────

/** Validate graph nodes and structure. */
export function validateGraphData(
  nodes: WorkflowNode[],
  connections: Array<{sourceNodeId: string; targetNodeId: string; targetPortId: string}>,
  getNodeDef: (type: string) => NodeDefinition | undefined,
  getIncoming: (nodeId: string) => Array<{targetPortId: string}>,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const node of nodes) {
    const def = getNodeDef(node.type);
    if (!def) {
      errors.push({ nodeId: node.id, message: `Unknown node type: ${node.type}` });
      continue;
    }

    const requiredInputs = def.inputs.filter(p => p.required);
    const incoming = getIncoming(node.id);

    for (const input of requiredInputs) {
      if (!incoming.some(c => c.targetPortId === input.id)) {
        warnings.push({
          nodeId: node.id,
          message: `Required input "${input.name}" is not connected`,
        });
      }
    }
  }

  if (hasCycles({
    id: '', name: '', description: '', version: '', createdAt: '', updatedAt: '',
    nodes, connections: connections as WorkflowGraph['connections'],
    viewport: {x: 0, y: 0, zoom: 1}, tags: [],
  })) {
    errors.push({ nodeId: '', message: 'Graph contains cycles' });
  }

  return { valid: errors.length === 0, errors, warnings };
}
