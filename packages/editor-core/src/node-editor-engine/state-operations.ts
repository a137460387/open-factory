/**
 * State, clipboard, viewport, and serialization mixin for the node editor engine.
 *
 * Adds: getState, selectNode, deselectNode, clearSelection, selectAll,
 *       copy, paste, deleteSelected,
 *       updateViewport, fitToView,
 *       exportGraph, importGraph.
 *
 * Depends on NodeOps + ConnectionOps being applied before this mixin.
 */

import type {WorkflowGraph, WorkflowNode, NodeConnection, NodeDefinition, NodeEditorState} from '../node-editor-types';
import type {EngineFields} from './node-editor-engine-base';
import {hasCycles, arePortsCompatible} from './validation';

type GConstructor<T> = new (...args: unknown[]) => T;

/** Fields required from prior mixins (NodeOps + ConnectionOps). */
interface PriorOpsFields {
  removeNode(nodeId: string): boolean;
  removeConnection(connectionId: string): boolean;
  getNode(id: string): WorkflowNode | undefined;
  getNodeDefinition(type: string): NodeDefinition | undefined;
}

export function StateOps<TBase extends GConstructor<EngineFields & PriorOpsFields>>(
  Base: TBase,
) {
  return class StateOps extends Base {
    // ─── Validation ──────────────────────────────────────────────────────

    /** Validate the entire graph */
    validateGraph(): ValidationResult {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      for (const node of this.graph.nodes) {
        const def = this.getNodeDefinition(node.type);
        if (!def) {
          errors.push({ nodeId: node.id, message: `Unknown node type: ${node.type}` });
          continue;
        }

        const requiredInputs = def.inputs.filter(p => p.required);
        const connections = this.graph.connections.filter(c => c.targetNodeId === node.id);

        for (const input of requiredInputs) {
          const hasConnection = connections.some(c => c.targetPortId === input.id);
          if (!hasConnection) {
            warnings.push({
              nodeId: node.id,
              message: `Required input "${input.name}" is not connected`,
            });
          }
        }
      }

      const nodeIds = this.graph.nodes.map(n => n.id);
      const getOutgoingTargets = (nodeId: string): string[] =>
        this.graph.connections
          .filter(c => c.sourceNodeId === nodeId)
          .map(c => c.targetNodeId);

      if (hasCycles(nodeIds, getOutgoingTargets)) {
        errors.push({ nodeId: '', message: 'Graph contains cycles' });
      }

      return { valid: errors.length === 0, errors, warnings };
    }

    // ─── Selection State ─────────────────────────────────────────────────

    /** Get editor state */
    getState(): NodeEditorState {
      return { ...this.state };
    }

    /** Select a node */
    selectNode(nodeId: string, addToSelection: boolean = false): void {
      if (addToSelection) {
        this.state.selectedNodeIds = [...this.state.selectedNodeIds, nodeId];
      } else {
        this.state.selectedNodeIds = [nodeId];
      }
      this.emitStateChange();
    }

    /** Deselect a node */
    deselectNode(nodeId: string): void {
      this.state.selectedNodeIds = this.state.selectedNodeIds.filter(id => id !== nodeId);
      this.emitStateChange();
    }

    /** Clear selection */
    clearSelection(): void {
      this.state.selectedNodeIds = [];
      this.state.selectedConnectionIds = [];
      this.emitStateChange();
    }

    /** Select all nodes */
    selectAll(): void {
      this.state.selectedNodeIds = this.graph.nodes.map(n => n.id);
      this.emitStateChange();
    }

    // ─── Clipboard Operations ────────────────────────────────────────────

    /** Copy selected nodes to clipboard */
    copy(): void {
      const selectedNodes = this.graph.nodes.filter(n =>
        this.state.selectedNodeIds.includes(n.id),
      );
      const selectedConnections = this.graph.connections.filter(
        c =>
          this.state.selectedNodeIds.includes(c.sourceNodeId) &&
          this.state.selectedNodeIds.includes(c.targetNodeId),
      );

      this.state.clipboard = {
        nodes: selectedNodes,
        connections: selectedConnections,
      };
      this.emitStateChange();
    }

    /** Paste from clipboard */
    paste(offset: { x: number; y: number } = { x: 20, y: 20 }): WorkflowNode[] {
      if (!this.state.clipboard) return [];

      const idMap = new Map<string, string>();
      const newNodes: WorkflowNode[] = [];

      // Create new nodes
      for (const node of this.state.clipboard.nodes) {
        const newId = this.generateId();
        idMap.set(node.id, newId);

        newNodes.push({
          ...node,
          id: newId,
          position: {
            x: node.position.x + offset.x,
            y: node.position.y + offset.y,
          },
        });
      }

      // Create new connections
      const newConnections: NodeConnection[] = [];
      for (const conn of this.state.clipboard.connections) {
        const newSourceId = idMap.get(conn.sourceNodeId);
        const newTargetId = idMap.get(conn.targetNodeId);
        if (newSourceId && newTargetId) {
          newConnections.push({
            ...conn,
            id: this.generateId(),
            sourceNodeId: newSourceId,
            targetNodeId: newTargetId,
          });
        }
      }

      this.graph.nodes = [...this.graph.nodes, ...newNodes];
      this.graph.connections = [...this.graph.connections, ...newConnections];

      // Select pasted nodes
      this.state.selectedNodeIds = newNodes.map(n => n.id);
      this.emitGraphChange();
      this.emitStateChange();

      return newNodes;
    }

    /** Delete selected nodes */
    deleteSelected(): void {
      for (const nodeId of this.state.selectedNodeIds) {
        this.removeNode(nodeId);
      }
      for (const connId of this.state.selectedConnectionIds) {
        this.removeConnection(connId);
      }
      this.clearSelection();
    }

    // ─── Viewport ────────────────────────────────────────────────────────

    /** Update viewport */
    updateViewport(viewport: { x: number; y: number; zoom: number }): void {
      this.graph.viewport = viewport;
      this.emitGraphChange();
    }

    /** Fit graph to view */
    fitToView(containerWidth: number, containerHeight: number): void {
      if (this.graph.nodes.length === 0) return;

      const bounds = this.getGraphBounds();
      const padding = 50;

      const scaleX = (containerWidth - padding * 2) / bounds.width;
      const scaleY = (containerHeight - padding * 2) / bounds.height;
      const zoom = Math.min(scaleX, scaleY, 1);

      this.graph.viewport = {
        x: -bounds.x * zoom + padding,
        y: -bounds.y * zoom + padding,
        zoom,
      };
      this.emitGraphChange();
    }

    private getGraphBounds(): { x: number; y: number; width: number; height: number } {
      const positions = this.graph.nodes.map(n => n.position);
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

    // ─── Serialization ───────────────────────────────────────────────────

    /** Export graph to JSON */
    exportGraph(): string {
      return JSON.stringify(this.graph, null, 2);
    }

    /** Import graph from JSON */
    importGraph(json: string): boolean {
      try {
        const parsed = JSON.parse(json);
        if (this.isValidGraph(parsed)) {
          this.graph = parsed;
          this.emitGraphChange();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }

    private isValidGraph(obj: unknown): obj is WorkflowGraph {
      if (typeof obj !== 'object' || obj === null) return false;
      const graph = obj as Record<string, unknown>;
      return Array.isArray(graph.nodes) && Array.isArray(graph.connections);
    }
  };
}

// ─── Validation result types (used by validateGraph) ──────────────────────

interface ValidationError {
  nodeId: string;
  message: string;
}

interface ValidationWarning {
  nodeId: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
