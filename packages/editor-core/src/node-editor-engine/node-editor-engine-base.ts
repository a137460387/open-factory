/**
 * Core node editor engine base class.
 *
 * Contains the constructor, private fields, event system, graph management,
 * and execution order computation. Extended by mixins for node/connection/state ops.
 */

import type {WorkflowGraph, WorkflowNode, NodeDefinition, NodeCategory, NodeEditorState} from '../node-editor-types';
import {BUILTIN_NODES} from './builtin-nodes';

/** Internal fields shared with mixin functions. */
export interface EngineFields {
  graph: WorkflowGraph;
  nodeDefinitions: Map<string, NodeDefinition>;
  state: NodeEditorState;
  listeners: Array<(graph: WorkflowGraph) => void>;
  stateListeners: Array<(state: NodeEditorState) => void>;
  emitGraphChange(): void;
  emitStateChange(): void;
  generateId(): string;
}

type GConstructor<T> = new (...args: unknown[]) => T;

// ─── Base class ──────────────────────────────────────────────────────────

export class NodeEditorEngineBase {
  protected graph: WorkflowGraph;
  protected nodeDefinitions: Map<string, NodeDefinition>;
  protected state: NodeEditorState;
  protected listeners: Array<(graph: WorkflowGraph) => void> = [];
  protected stateListeners: Array<(state: NodeEditorState) => void> = [];

  constructor(graph?: WorkflowGraph) {
    this.graph = graph ?? this.createEmptyGraph();
    this.nodeDefinitions = new Map();
    this.state = this.createInitialState();

    for (const def of BUILTIN_NODES) {
      this.nodeDefinitions.set(def.type, def);
    }
  }

  // ─── Event System ─────────────────────────────────────────────────────

  /** Subscribe to graph changes */
  onGraphChange(listener: (graph: WorkflowGraph) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /** Subscribe to state changes */
  onStateChange(listener: (state: NodeEditorState) => void): () => void {
    this.stateListeners.push(listener);
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== listener);
    };
  }

  protected emitGraphChange(): void {
    this.graph.updatedAt = new Date().toISOString();
    this.listeners.forEach(l => l(this.getGraph()));
  }

  protected emitStateChange(): void {
    this.stateListeners.forEach(l => l({ ...this.state }));
  }

  // ─── Graph Management ─────────────────────────────────────────────────

  /** Get current graph */
  getGraph(): WorkflowGraph {
    return { ...this.graph };
  }

  // ─── Execution Order ──────────────────────────────────────────────────

  /** Get topological order of nodes for execution (Kahn's algorithm). */
  getExecutionOrder(): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of this.graph.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    for (const conn of this.graph.connections) {
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

  // ─── Utilities ────────────────────────────────────────────────────────

  protected generateId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private createEmptyGraph(): WorkflowGraph {
    return {
      id: this.generateId(),
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

  private createInitialState(): NodeEditorState {
    return {
      selectedNodeIds: [],
      selectedConnectionIds: [],
      clipboard: null,
      isDragging: false,
      isConnecting: false,
    };
  }
}
