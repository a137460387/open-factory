/**
 * Validation types and helper functions for the node editor engine.
 */

import type {NodePort} from '../node-editor-types';

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

/** Check if two ports are data-type compatible. */
export function arePortsCompatible(sourcePort: NodePort, targetPort: NodePort): boolean {
  if (sourcePort.dataType === 'any' || targetPort.dataType === 'any') return true;
  return sourcePort.dataType === targetPort.dataType;
}

/** Check whether adding an edge sourceNodeId -> targetNodeId would create a cycle. */
export function wouldCreateCycle(
  sourceNodeId: string,
  targetNodeId: string,
  getOutgoingTargets: (nodeId: string) => string[],
): boolean {
  const visited = new Set<string>();
  const stack = [targetNodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceNodeId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const target of getOutgoingTargets(current)) {
      stack.push(target);
    }
  }

  return false;
}

/** Detect cycles using DFS with a recursion stack. */
export function hasCycles(
  nodeIds: string[],
  getOutgoingTargets: (nodeId: string) => string[],
): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycleDFS = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    for (const target of getOutgoingTargets(nodeId)) {
      if (!visited.has(target)) {
        if (hasCycleDFS(target)) return true;
      } else if (recursionStack.has(target)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      if (hasCycleDFS(nodeId)) return true;
    }
  }

  return false;
}
