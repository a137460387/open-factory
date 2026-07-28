/**
 * Node Editor Engine - Core engine for visual node-based workflow editor
 */

import type {
  WorkflowGraph, WorkflowNode, NodeConnection, NodeDefinition, NodeCategory, NodeEditorState,
} from '../node-editor-types';
import {BUILTIN_NODES} from './builtin-nodes';
import {arePortsCompatible, wouldCreateCycle, validateGraphData, type ValidationResult} from './validation';
import {generateId, createEmptyGraph, createInitialState, isValidGraph, getGraphBounds, topologicalSort} from './graph-utils';

export class NodeEditorEngine {
  private graph: WorkflowGraph;
  private nodeDefinitions: Map<string, NodeDefinition>;
  private state: NodeEditorState;
  private listeners: Array<(graph: WorkflowGraph) => void> = [];
  private stateListeners: Array<(state: NodeEditorState) => void> = [];

  constructor(graph?: WorkflowGraph) {
    this.graph = graph ?? createEmptyGraph();
    this.nodeDefinitions = new Map();
    this.state = createInitialState();
    for (const def of BUILTIN_NODES) {
      this.nodeDefinitions.set(def.type, def);
    }
  }

  // ─── Graph Management ────────────────────────────────────────────────────

  getGraph(): WorkflowGraph {
    return { ...this.graph };
  }

  onGraphChange(listener: (graph: WorkflowGraph) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  onStateChange(listener: (state: NodeEditorState) => void): () => void {
    this.stateListeners.push(listener);
    return () => { this.stateListeners = this.stateListeners.filter(l => l !== listener); };
  }

  private emitGraphChange(): void {
    this.graph.updatedAt = new Date().toISOString();
    this.listeners.forEach(l => l(this.getGraph()));
  }

  private emitStateChange(): void {
    this.stateListeners.forEach(l => l({ ...this.state }));
  }

  // ─── Node Operations ─────────────────────────────────────────────────────

  getNodeDefinitions(): NodeDefinition[] {
    return Array.from(this.nodeDefinitions.values());
  }

  getNodeDefinitionsByCategory(category: NodeCategory): NodeDefinition[] {
    return Array.from(this.nodeDefinitions.values()).filter(d => d.category === category);
  }

  registerNodeDefinition(definition: NodeDefinition): void {
    this.nodeDefinitions.set(definition.type, definition);
  }

  addNode(type: string, position: { x: number; y: number }): WorkflowNode | null {
    const definition = this.nodeDefinitions.get(type);
    if (!definition) return null;
    const node: WorkflowNode = {
      id: generateId(), type, position,
      config: { ...definition.defaultConfig }, enabled: true,
    };
    this.graph.nodes = [...this.graph.nodes, node];
    this.emitGraphChange();
    return node;
  }

  removeNode(nodeId: string): boolean {
    const initialLength = this.graph.nodes.length;
    this.graph.nodes = this.graph.nodes.filter(n => n.id !== nodeId);
    if (this.graph.nodes.length < initialLength) {
      this.graph.connections = this.graph.connections.filter(
        c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId,
      );
      this.emitGraphChange();
      return true;
    }
    return false;
  }

  updateNodePosition(nodeId: string, position: { x: number; y: number }): void {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (node) { node.position = position; this.emitGraphChange(); }
  }

  updateNodeConfig(nodeId: string, config: Record<string, unknown>): void {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (node) { node.config = { ...node.config, ...config }; this.emitGraphChange(); }
  }

  toggleNodeEnabled(nodeId: string): void {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (node) { node.enabled = !node.enabled; this.emitGraphChange(); }
  }

  getNode(nodeId: string): WorkflowNode | undefined {
    return this.graph.nodes.find(n => n.id === nodeId);
  }

  getNodeDefinition(nodeType: string): NodeDefinition | undefined {
    return this.nodeDefinitions.get(nodeType);
  }

  // ─── Connection Operations ───────────────────────────────────────────────

  addConnection(
    sourceNodeId: string, sourcePortId: string,
    targetNodeId: string, targetPortId: string,
  ): NodeConnection | null {
    const sourceNode = this.getNode(sourceNodeId);
    const targetNode = this.getNode(targetNodeId);
    if (!sourceNode || !targetNode) return null;

    const sourceDef = this.getNodeDefinition(sourceNode.type);
    const targetDef = this.getNodeDefinition(targetNode.type);
    if (!sourceDef || !targetDef) return null;

    const sourcePort = sourceDef.outputs.find(p => p.id === sourcePortId);
    const targetPort = targetDef.inputs.find(p => p.id === targetPortId);
    if (!sourcePort || !targetPort) return null;

    if (!arePortsCompatible(sourcePort, targetPort)) return null;

    const existingConnection = this.graph.connections.find(
      c => c.targetNodeId === targetNodeId && c.targetPortId === targetPortId,
    );
    if (existingConnection && !targetPort.multiple) {
      this.removeConnection(existingConnection.id);
    }

    if (wouldCreateCycle(this.graph.connections, sourceNodeId, targetNodeId)) return null;

    const connection: NodeConnection = {
      id: generateId(), sourceNodeId, sourcePortId, targetNodeId, targetPortId,
    };
    this.graph.connections = [...this.graph.connections, connection];
    this.emitGraphChange();
    return connection;
  }

  removeConnection(connectionId: string): boolean {
    const initialLength = this.graph.connections.length;
    this.graph.connections = this.graph.connections.filter(c => c.id !== connectionId);
    if (this.graph.connections.length < initialLength) {
      this.emitGraphChange();
      return true;
    }
    return false;
  }

  getConnectionsForNode(nodeId: string): NodeConnection[] {
    return this.graph.connections.filter(
      c => c.sourceNodeId === nodeId || c.targetNodeId === nodeId,
    );
  }

  getIncomingConnections(nodeId: string): NodeConnection[] {
    return this.graph.connections.filter(c => c.targetNodeId === nodeId);
  }

  getOutgoingConnections(nodeId: string): NodeConnection[] {
    return this.graph.connections.filter(c => c.sourceNodeId === nodeId);
  }

  // ─── Validation ──────────────────────────────────────────────────────────

  validateGraph(): ValidationResult {
    return validateGraphData(
      this.graph.nodes, this.graph.connections,
      (type) => this.getNodeDefinition(type),
      (nodeId) => this.getIncomingConnections(nodeId),
    );
  }

  // ─── Execution Order ─────────────────────────────────────────────────────

  getExecutionOrder(): string[] {
    return topologicalSort(this.graph.nodes, this.graph.connections);
  }

  // ─── Selection State ─────────────────────────────────────────────────────

  getState(): NodeEditorState {
    return { ...this.state };
  }

  selectNode(nodeId: string, addToSelection: boolean = false): void {
    if (addToSelection) {
      this.state.selectedNodeIds = [...this.state.selectedNodeIds, nodeId];
    } else {
      this.state.selectedNodeIds = [nodeId];
    }
    this.emitStateChange();
  }

  deselectNode(nodeId: string): void {
    this.state.selectedNodeIds = this.state.selectedNodeIds.filter(id => id !== nodeId);
    this.emitStateChange();
  }

  clearSelection(): void {
    this.state.selectedNodeIds = [];
    this.state.selectedConnectionIds = [];
    this.emitStateChange();
  }

  selectAll(): void {
    this.state.selectedNodeIds = this.graph.nodes.map(n => n.id);
    this.emitStateChange();
  }

  // ─── Clipboard Operations ────────────────────────────────────────────────

  copy(): void {
    const selectedNodes = this.graph.nodes.filter(n =>
      this.state.selectedNodeIds.includes(n.id),
    );
    const selectedConnections = this.graph.connections.filter(
      c =>
        this.state.selectedNodeIds.includes(c.sourceNodeId) &&
        this.state.selectedNodeIds.includes(c.targetNodeId),
    );
    this.state.clipboard = { nodes: selectedNodes, connections: selectedConnections };
    this.emitStateChange();
  }

  paste(offset: { x: number; y: number } = { x: 20, y: 20 }): WorkflowNode[] {
    if (!this.state.clipboard) return [];
    const idMap = new Map<string, string>();
    const newNodes: WorkflowNode[] = [];
    for (const node of this.state.clipboard.nodes) {
      const newId = generateId();
      idMap.set(node.id, newId);
      newNodes.push({
        ...node, id: newId,
        position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
      });
    }
    const newConnections: NodeConnection[] = [];
    for (const conn of this.state.clipboard.connections) {
      const newSourceId = idMap.get(conn.sourceNodeId);
      const newTargetId = idMap.get(conn.targetNodeId);
      if (newSourceId && newTargetId) {
        newConnections.push({
          ...conn, id: generateId(),
          sourceNodeId: newSourceId, targetNodeId: newTargetId,
        });
      }
    }
    this.graph.nodes = [...this.graph.nodes, ...newNodes];
    this.graph.connections = [...this.graph.connections, ...newConnections];
    this.state.selectedNodeIds = newNodes.map(n => n.id);
    this.emitGraphChange();
    this.emitStateChange();
    return newNodes;
  }

  deleteSelected(): void {
    for (const nodeId of this.state.selectedNodeIds) { this.removeNode(nodeId); }
    for (const connId of this.state.selectedConnectionIds) { this.removeConnection(connId); }
    this.clearSelection();
  }

  // ─── Viewport ────────────────────────────────────────────────────────────

  updateViewport(viewport: { x: number; y: number; zoom: number }): void {
    this.graph.viewport = viewport;
    this.emitGraphChange();
  }

  fitToView(containerWidth: number, containerHeight: number): void {
    if (this.graph.nodes.length === 0) return;
    const bounds = getGraphBounds(this.graph.nodes);
    const padding = 50;
    const scaleX = (containerWidth - padding * 2) / bounds.width;
    const scaleY = (containerHeight - padding * 2) / bounds.height;
    const zoom = Math.min(scaleX, scaleY, 1);
    this.graph.viewport = {
      x: -bounds.x * zoom + padding, y: -bounds.y * zoom + padding, zoom,
    };
    this.emitGraphChange();
  }

  // ─── Serialization ───────────────────────────────────────────────────────

  exportGraph(): string {
    return JSON.stringify(this.graph, null, 2);
  }

  importGraph(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (isValidGraph(parsed)) {
        this.graph = parsed;
        this.emitGraphChange();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
