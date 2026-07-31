/**
 * Graph utility functions extracted from the node editor engine.
 */

import type {WorkflowGraph, NodeEditorState} from '../node-editor-types';

// ─── ID Generation ────────────────────────────────────────────────────────

export function generateId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Factory Functions ────────────────────────────────────────────────────

export function createEmptyGraph(): WorkflowGraph {
  return {
    id: generateId(),
    name: 'New Workflow',
    description: '',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    tags: [],
  };
}

export function createInitialState(): NodeEditorState {
  return {
    selectedNodeIds: [],
    selectedConnectionIds: [],
    clipboard: null,
    isDragging: false,
    isConnecting: false,
  };
}

// ─── Graph Validation Helper ──────────────────────────────────────────────

export function isValidGraph(obj: unknown): obj is WorkflowGraph {
  if (typeof obj !== 'object' || obj === null) return false;
  const graph = obj as Record<string, unknown>;
  return Array.isArray(graph.nodes) && Array.isArray(graph.connections);
}

// ─── Viewport Helpers ─────────────────────────────────────────────────────

export function getGraphBounds(
  nodes: Array<{position: {x: number; y: number}}>,
): {x: number; y: number; width: number; height: number} {
  const positions = nodes.map(n => n.position);
  const minX = Math.min(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y));
  const maxX = Math.max(...positions.map(p => p.x + 200)); // Assume node width ~200
  const maxY = Math.max(...positions.map(p => p.y + 100)); // Assume node height ~100

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ─── Topological Sort ─────────────────────────────────────────────────────

/** Kahn's algorithm for topological ordering of nodes. */
export function topologicalSort(
  nodes: Array<{id: string}>,
  connections: Array<{sourceNodeId: string; targetNodeId: string}>,
): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const conn of connections) {
    adjacency.get(conn.sourceNodeId)?.push(conn.targetNodeId);
    inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return order;
}
