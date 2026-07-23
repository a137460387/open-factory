/**
 * Node Editor Engine - Core engine for visual node-based workflow editor
 *
 * Manages node graph, connections, validation, and serialization.
 * Provides the foundation for workflow execution.
 */

import type {
  WorkflowGraph,
  WorkflowNode,
  NodeConnection,
  NodeDefinition,
  NodePort,
  PortDataType,
  PortDirection,
  NodeCategory,
  NodeEditorState,
} from './node-editor-types';

// ─── Built-in Node Definitions ─────────────────────────────────────────────

const BUILTIN_NODES: NodeDefinition[] = [
  // Input nodes
  {
    type: 'input.video',
    name: 'Video Input',
    description: 'Load video from media library',
    category: 'input',
    icon: '🎬',
    color: '#4CAF50',
    inputs: [],
    outputs: [
      { id: 'video', name: 'Video', direction: 'output', dataType: 'video' },
      { id: 'audio', name: 'Audio', direction: 'output', dataType: 'audio' },
    ],
  },
  {
    type: 'input.audio',
    name: 'Audio Input',
    description: 'Load audio from media library',
    category: 'input',
    icon: '🎵',
    color: '#4CAF50',
    inputs: [],
    outputs: [
      { id: 'audio', name: 'Audio', direction: 'output', dataType: 'audio' },
    ],
  },
  {
    type: 'input.image',
    name: 'Image Input',
    description: 'Load image from media library',
    category: 'input',
    icon: '🖼️',
    color: '#4CAF50',
    inputs: [],
    outputs: [
      { id: 'image', name: 'Image', direction: 'output', dataType: 'image' },
    ],
  },
  {
    type: 'input.timeline',
    name: 'Timeline Input',
    description: 'Use current timeline as input',
    category: 'input',
    icon: '⏱️',
    color: '#4CAF50',
    inputs: [],
    outputs: [
      { id: 'timeline', name: 'Timeline', direction: 'output', dataType: 'timeline' },
      { id: 'clips', name: 'Clips', direction: 'output', dataType: 'clip', multiple: true },
    ],
  },

  // AI Engine nodes
  {
    type: 'ai.highlight-detection',
    name: 'Highlight Detection',
    description: 'Detect highlight moments in video',
    category: 'ai-engine',
    icon: '⭐',
    color: '#2196F3',
    inputs: [
      { id: 'video', name: 'Video', direction: 'input', dataType: 'video', required: true },
    ],
    outputs: [
      { id: 'highlights', name: 'Highlights', direction: 'output', dataType: 'metadata' },
      { id: 'timestamps', name: 'Timestamps', direction: 'output', dataType: 'metadata' },
    ],
    defaultConfig: {
      sensitivity: 0.7,
      minDuration: 1,
    },
  },
  {
    type: 'ai.smart-trim',
    name: 'Smart Trim',
    description: 'AI-powered intelligent video trimming',
    category: 'ai-engine',
    icon: '✂️',
    color: '#2196F3',
    inputs: [
      { id: 'video', name: 'Video', direction: 'input', dataType: 'video', required: true },
      { id: 'highlights', name: 'Highlights', direction: 'input', dataType: 'metadata' },
    ],
    outputs: [
      { id: 'trimmed', name: 'Trimmed Video', direction: 'output', dataType: 'video' },
      { id: 'segments', name: 'Segments', direction: 'output', dataType: 'metadata' },
    ],
    defaultConfig: {
      aggressiveness: 'medium',
      keepPace: true,
    },
  },
  {
    type: 'ai.auto-subtitle',
    name: 'Auto Subtitle',
    description: 'Generate subtitles from speech',
    category: 'ai-engine',
    icon: '💬',
    color: '#2196F3',
    inputs: [
      { id: 'audio', name: 'Audio', direction: 'input', dataType: 'audio', required: true },
    ],
    outputs: [
      { id: 'subtitles', name: 'Subtitles', direction: 'output', dataType: 'subtitle' },
    ],
    defaultConfig: {
      language: 'auto',
      maxCharsPerLine: 42,
      style: 'default',
    },
  },
  {
    type: 'ai.color-grading',
    name: 'AI Color Grading',
    description: 'Automatic color correction and grading',
    category: 'ai-engine',
    icon: '🎨',
    color: '#2196F3',
    inputs: [
      { id: 'video', name: 'Video', direction: 'input', dataType: 'video', required: true },
    ],
    outputs: [
      { id: 'graded', name: 'Graded Video', direction: 'output', dataType: 'video' },
    ],
    defaultConfig: {
      style: 'cinematic',
      intensity: 0.8,
    },
  },
  {
    type: 'ai.audio-enhance',
    name: 'Audio Enhance',
    description: 'Enhance audio quality with AI',
    category: 'ai-engine',
    icon: '🔊',
    color: '#2196F3',
    inputs: [
      { id: 'audio', name: 'Audio', direction: 'input', dataType: 'audio', required: true },
    ],
    outputs: [
      { id: 'enhanced', name: 'Enhanced Audio', direction: 'output', dataType: 'audio' },
    ],
    defaultConfig: {
      denoise: true,
      normalize: true,
      targetLoudness: -14,
    },
  },
  {
    type: 'ai.scene-detection',
    name: 'Scene Detection',
    description: 'Detect scene changes in video',
    category: 'ai-engine',
    icon: '🎬',
    color: '#2196F3',
    inputs: [
      { id: 'video', name: 'Video', direction: 'input', dataType: 'video', required: true },
    ],
    outputs: [
      { id: 'scenes', name: 'Scenes', direction: 'output', dataType: 'metadata' },
      { id: 'timestamps', name: 'Timestamps', direction: 'output', dataType: 'metadata' },
    ],
    defaultConfig: {
      threshold: 0.3,
      minSceneLength: 0.5,
    },
  },

  // Transform nodes
  {
    type: 'transform.crop',
    name: 'Crop',
    description: 'Crop video or image',
    category: 'transform',
    icon: '🔲',
    color: '#FF9800',
    inputs: [
      { id: 'input', name: 'Input', direction: 'input', dataType: 'video', required: true },
    ],
    outputs: [
      { id: 'output', name: 'Output', direction: 'output', dataType: 'video' },
    ],
    defaultConfig: {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    },
  },
  {
    type: 'transform.resize',
    name: 'Resize',
    description: 'Resize video or image',
    category: 'transform',
    icon: '↔️',
    color: '#FF9800',
    inputs: [
      { id: 'input', name: 'Input', direction: 'input', dataType: 'video', required: true },
    ],
    outputs: [
      { id: 'output', name: 'Output', direction: 'output', dataType: 'video' },
    ],
    defaultConfig: {
      width: 1920,
      height: 1080,
      maintainAspectRatio: true,
    },
  },
  {
    type: 'transform.speed',
    name: 'Speed Change',
    description: 'Change playback speed',
    category: 'transform',
    icon: '⏩',
    color: '#FF9800',
    inputs: [
      { id: 'input', name: 'Input', direction: 'input', dataType: 'video', required: true },
    ],
    outputs: [
      { id: 'output', name: 'Output', direction: 'output', dataType: 'video' },
    ],
    defaultConfig: {
      speed: 1.0,
      keepAudio: true,
    },
  },

  // Output nodes
  {
    type: 'output.timeline',
    name: 'Timeline Output',
    description: 'Send result to timeline',
    category: 'output',
    icon: '📤',
    color: '#9C27B0',
    inputs: [
      { id: 'video', name: 'Video', direction: 'input', dataType: 'video' },
      { id: 'audio', name: 'Audio', direction: 'input', dataType: 'audio' },
      { id: 'subtitles', name: 'Subtitles', direction: 'input', dataType: 'subtitle' },
    ],
    outputs: [],
    defaultConfig: {
      trackName: 'AI Output',
      autoAlign: true,
    },
  },
  {
    type: 'output.export',
    name: 'Export',
    description: 'Export to file',
    category: 'output',
    icon: '💾',
    color: '#9C27B0',
    inputs: [
      { id: 'video', name: 'Video', direction: 'input', dataType: 'video', required: true },
      { id: 'audio', name: 'Audio', direction: 'input', dataType: 'audio' },
    ],
    outputs: [],
    defaultConfig: {
      format: 'mp4',
      quality: 'high',
      outputPath: '',
    },
  },

  // Control flow nodes
  {
    type: 'control.if',
    name: 'If Condition',
    description: 'Conditional branching',
    category: 'control',
    icon: '❓',
    color: '#607D8B',
    inputs: [
      { id: 'input', name: 'Input', direction: 'input', dataType: 'any', required: true },
      { id: 'condition', name: 'Condition', direction: 'input', dataType: 'metadata' },
    ],
    outputs: [
      { id: 'true', name: 'True', direction: 'output', dataType: 'any' },
      { id: 'false', name: 'False', direction: 'output', dataType: 'any' },
    ],
  },
  {
    type: 'control.merge',
    name: 'Merge',
    description: 'Merge multiple inputs',
    category: 'control',
    icon: '🔀',
    color: '#607D8B',
    inputs: [
      { id: 'input1', name: 'Input 1', direction: 'input', dataType: 'any' },
      { id: 'input2', name: 'Input 2', direction: 'input', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', name: 'Output', direction: 'output', dataType: 'any' },
    ],
  },
  {
    type: 'control.delay',
    name: 'Delay',
    description: 'Add delay between operations',
    category: 'control',
    icon: '⏳',
    color: '#607D8B',
    inputs: [
      { id: 'input', name: 'Input', direction: 'input', dataType: 'any', required: true },
    ],
    outputs: [
      { id: 'output', name: 'Output', direction: 'output', dataType: 'any' },
    ],
    defaultConfig: {
      duration: 1000,
    },
  },
];

// ─── Node Editor Engine ────────────────────────────────────────────────────

/**
 * Node editor engine for managing workflow graphs
 */
export class NodeEditorEngine {
  private graph: WorkflowGraph;
  private nodeDefinitions: Map<string, NodeDefinition>;
  private state: NodeEditorState;
  private listeners: Array<(graph: WorkflowGraph) => void> = [];
  private stateListeners: Array<(state: NodeEditorState) => void> = [];

  constructor(graph?: WorkflowGraph) {
    this.graph = graph ?? this.createEmptyGraph();
    this.nodeDefinitions = new Map();
    this.state = this.createInitialState();

    // Register built-in nodes
    for (const def of BUILTIN_NODES) {
      this.nodeDefinitions.set(def.type, def);
    }
  }

  // ─── Graph Management ────────────────────────────────────────────────────

  /** Get current graph */
  getGraph(): WorkflowGraph {
    return { ...this.graph };
  }

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

  private emitGraphChange(): void {
    this.graph.updatedAt = new Date().toISOString();
    this.listeners.forEach(l => l(this.getGraph()));
  }

  private emitStateChange(): void {
    this.stateListeners.forEach(l => l({ ...this.state }));
  }

  // ─── Node Operations ─────────────────────────────────────────────────────

  /** Get available node definitions */
  getNodeDefinitions(): NodeDefinition[] {
    return Array.from(this.nodeDefinitions.values());
  }

  /** Get node definitions by category */
  getNodeDefinitionsByCategory(category: NodeCategory): NodeDefinition[] {
    return Array.from(this.nodeDefinitions.values()).filter(d => d.category === category);
  }

  /** Register a custom node definition */
  registerNodeDefinition(definition: NodeDefinition): void {
    this.nodeDefinitions.set(definition.type, definition);
  }

  /** Add a node to the graph */
  addNode(type: string, position: { x: number; y: number }): WorkflowNode | null {
    const definition = this.nodeDefinitions.get(type);
    if (!definition) return null;

    const node: WorkflowNode = {
      id: this.generateId(),
      type,
      position,
      config: { ...definition.defaultConfig },
      enabled: true,
    };

    this.graph.nodes = [...this.graph.nodes, node];
    this.emitGraphChange();
    return node;
  }

  /** Remove a node from the graph */
  removeNode(nodeId: string): boolean {
    const initialLength = this.graph.nodes.length;
    this.graph.nodes = this.graph.nodes.filter(n => n.id !== nodeId);

    if (this.graph.nodes.length < initialLength) {
      // Remove connections involving this node
      this.graph.connections = this.graph.connections.filter(
        c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId,
      );
      this.emitGraphChange();
      return true;
    }
    return false;
  }

  /** Update node position */
  updateNodePosition(nodeId: string, position: { x: number; y: number }): void {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (node) {
      node.position = position;
      this.emitGraphChange();
    }
  }

  /** Update node configuration */
  updateNodeConfig(nodeId: string, config: Record<string, unknown>): void {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (node) {
      node.config = { ...node.config, ...config };
      this.emitGraphChange();
    }
  }

  /** Toggle node enabled state */
  toggleNodeEnabled(nodeId: string): void {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (node) {
      node.enabled = !node.enabled;
      this.emitGraphChange();
    }
  }

  /** Get node by ID */
  getNode(nodeId: string): WorkflowNode | undefined {
    return this.graph.nodes.find(n => n.id === nodeId);
  }

  /** Get node definition */
  getNodeDefinition(nodeType: string): NodeDefinition | undefined {
    return this.nodeDefinitions.get(nodeType);
  }

  // ─── Connection Operations ───────────────────────────────────────────────

  /** Add a connection between nodes */
  addConnection(
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string,
  ): NodeConnection | null {
    // Validate nodes exist
    const sourceNode = this.getNode(sourceNodeId);
    const targetNode = this.getNode(targetNodeId);
    if (!sourceNode || !targetNode) return null;

    // Validate ports exist
    const sourceDef = this.getNodeDefinition(sourceNode.type);
    const targetDef = this.getNodeDefinition(targetNode.type);
    if (!sourceDef || !targetDef) return null;

    const sourcePort = sourceDef.outputs.find(p => p.id === sourcePortId);
    const targetPort = targetDef.inputs.find(p => p.id === targetPortId);
    if (!sourcePort || !targetPort) return null;

    // Validate data type compatibility
    if (!this.arePortsCompatible(sourcePort, targetPort)) return null;

    // Check for existing connection to the same input port
    const existingConnection = this.graph.connections.find(
      c => c.targetNodeId === targetNodeId && c.targetPortId === targetPortId,
    );
    if (existingConnection && !targetPort.multiple) {
      // Remove existing connection
      this.removeConnection(existingConnection.id);
    }

    // Check for circular connections
    if (this.wouldCreateCycle(sourceNodeId, targetNodeId)) return null;

    const connection: NodeConnection = {
      id: this.generateId(),
      sourceNodeId,
      sourcePortId,
      targetNodeId,
      targetPortId,
    };

    this.graph.connections = [...this.graph.connections, connection];
    this.emitGraphChange();
    return connection;
  }

  /** Remove a connection */
  removeConnection(connectionId: string): boolean {
    const initialLength = this.graph.connections.length;
    this.graph.connections = this.graph.connections.filter(c => c.id !== connectionId);

    if (this.graph.connections.length < initialLength) {
      this.emitGraphChange();
      return true;
    }
    return false;
  }

  /** Get connections for a node */
  getConnectionsForNode(nodeId: string): NodeConnection[] {
    return this.graph.connections.filter(
      c => c.sourceNodeId === nodeId || c.targetNodeId === nodeId,
    );
  }

  /** Get incoming connections for a node */
  getIncomingConnections(nodeId: string): NodeConnection[] {
    return this.graph.connections.filter(c => c.targetNodeId === nodeId);
  }

  /** Get outgoing connections for a node */
  getOutgoingConnections(nodeId: string): NodeConnection[] {
    return this.graph.connections.filter(c => c.sourceNodeId === nodeId);
  }

  // ─── Validation ──────────────────────────────────────────────────────────

  /** Check if two ports are compatible */
  private arePortsCompatible(sourcePort: NodePort, targetPort: NodePort): boolean {
    if (sourcePort.dataType === 'any' || targetPort.dataType === 'any') return true;
    return sourcePort.dataType === targetPort.dataType;
  }

  /** Check if adding a connection would create a cycle */
  private wouldCreateCycle(sourceNodeId: string, targetNodeId: string): boolean {
    const visited = new Set<string>();
    const stack = [targetNodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === sourceNodeId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const outgoing = this.getOutgoingConnections(current);
      for (const conn of outgoing) {
        stack.push(conn.targetNodeId);
      }
    }

    return false;
  }

  /** Validate the entire graph */
  validateGraph(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for disconnected nodes
    for (const node of this.graph.nodes) {
      const def = this.getNodeDefinition(node.type);
      if (!def) {
        errors.push({ nodeId: node.id, message: `Unknown node type: ${node.type}` });
        continue;
      }

      // Check required inputs
      const requiredInputs = def.inputs.filter(p => p.required);
      const connections = this.getIncomingConnections(node.id);

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

    // Check for cycles
    if (this.hasCycles()) {
      errors.push({ nodeId: '', message: 'Graph contains cycles' });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /** Check if graph has cycles */
  private hasCycles(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleDFS = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoing = this.getOutgoingConnections(nodeId);
      for (const conn of outgoing) {
        if (!visited.has(conn.targetNodeId)) {
          if (hasCycleDFS(conn.targetNodeId)) return true;
        } else if (recursionStack.has(conn.targetNodeId)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of this.graph.nodes) {
      if (!visited.has(node.id)) {
        if (hasCycleDFS(node.id)) return true;
      }
    }

    return false;
  }

  // ─── Execution Order ─────────────────────────────────────────────────────

  /** Get topological order of nodes for execution */
  getExecutionOrder(): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const node of this.graph.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    // Build adjacency list and calculate in-degrees
    for (const conn of this.graph.connections) {
      adjacency.get(conn.sourceNodeId)?.push(conn.targetNodeId);
      inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) ?? 0) + 1);
    }

    // Kahn's algorithm
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

  // ─── Selection State ─────────────────────────────────────────────────────

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

  // ─── Clipboard Operations ────────────────────────────────────────────────

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

  // ─── Viewport ────────────────────────────────────────────────────────────

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

  // ─── Serialization ───────────────────────────────────────────────────────

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

  // ─── Utilities ───────────────────────────────────────────────────────────

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

  private generateId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

// ─── Validation Types ──────────────────────────────────────────────────────

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

/**
 * Create a node editor engine
 */
export function createNodeEditorEngine(graph?: WorkflowGraph): NodeEditorEngine {
  return new NodeEditorEngine(graph);
}
