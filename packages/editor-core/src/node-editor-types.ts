/**
 * Node Editor Types - Type system for visual node-based workflow editor
 *
 * Defines node types, connections, and data flow for AI workflow orchestration.
 */

// ─── Node Categories ───────────────────────────────────────────────────────

/** Node category for grouping */
export type NodeCategory = 'input' | 'ai-engine' | 'transform' | 'output' | 'control' | 'utility';

// ─── Port Types ────────────────────────────────────────────────────────────

/** Data types that can flow through ports */
export type PortDataType =
  | 'video'
  | 'audio'
  | 'image'
  | 'text'
  | 'subtitle'
  | 'metadata'
  | 'timeline'
  | 'clip'
  | 'any';

/** Port direction */
export type PortDirection = 'input' | 'output';

/** Node port definition */
export interface NodePort {
  id: string;
  name: string;
  direction: PortDirection;
  dataType: PortDataType;
  /** Whether this port accepts multiple connections */
  multiple?: boolean;
  /** Default value when not connected */
  defaultValue?: unknown;
  /** Whether this port is required */
  required?: boolean;
}

// ─── Node Definition ───────────────────────────────────────────────────────

/** Node definition template */
export interface NodeDefinition {
  type: string;
  name: string;
  description: string;
  category: NodeCategory;
  icon?: string;
  color?: string;
  inputs: NodePort[];
  outputs: NodePort[];
  /** Default configuration values */
  defaultConfig?: Record<string, unknown>;
  /** Configuration schema for the node */
  configSchema?: NodeConfigSchema;
}

/** Configuration schema for node parameters */
export interface NodeConfigSchema {
  properties: Record<string, ConfigProperty>;
  required?: string[];
}

/** Configuration property definition */
export interface ConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'range';
  label: string;
  description?: string;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  min?: number;
  max?: number;
  step?: number;
}

// ─── Node Instance ─────────────────────────────────────────────────────────

/** Node instance in the graph */
export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  /** Runtime configuration values */
  config: Record<string, unknown>;
  /** Whether this node is enabled */
  enabled: boolean;
  /** Custom label override */
  label?: string;
}

// ─── Connections ───────────────────────────────────────────────────────────

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

// ─── Workflow Graph ────────────────────────────────────────────────────────

/** Complete workflow graph */
export interface WorkflowGraph {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  nodes: WorkflowNode[];
  connections: NodeConnection[];
  /** Viewport position and zoom */
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  tags: string[];
}

// ─── Execution ─────────────────────────────────────────────────────────────

/** Workflow execution status */
export type WorkflowExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Node execution status */
export type NodeExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** Node execution result */
export interface NodeExecutionResult {
  nodeId: string;
  status: NodeExecutionStatus;
  startedAt?: number;
  completedAt?: number;
  outputs?: Record<string, unknown>;
  error?: string;
}

/** Workflow execution progress */
export interface WorkflowExecutionProgress {
  status: WorkflowExecutionStatus;
  currentNodeId?: string;
  completedNodes: number;
  totalNodes: number;
  results: Map<string, NodeExecutionResult>;
  startedAt: number;
  estimatedTimeRemaining?: number;
}

// ─── Workflow Template ─────────────────────────────────────────────────────

/** Pre-built workflow template */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  graph: Omit<WorkflowGraph, 'id' | 'createdAt' | 'updatedAt'>;
  thumbnail?: string;
  tags: string[];
  /** Number of times this template has been used */
  usageCount: number;
}

// ─── AI Engine Node Types ──────────────────────────────────────────────────

/** AI engine types available in the system */
export type AIEngineType =
  | 'highlight-detection'
  | 'smart-trim'
  | 'auto-subtitle'
  | 'color-grading'
  | 'audio-enhance'
  | 'scene-detection'
  | 'object-tracking'
  | 'face-detection'
  | 'speech-to-text'
  | 'text-to-speech'
  | 'style-transfer'
  | 'super-resolution'
  | 'background-removal'
  | 'motion-stabilization'
  | 'noise-reduction';

/** AI engine node configuration */
export interface AIEngineConfig {
  engineType: AIEngineType;
  model?: string;
  parameters: Record<string, unknown>;
  gpuAcceleration?: boolean;
  batchSize?: number;
}

// ─── Control Flow Types ────────────────────────────────────────────────────

/** Control flow node types */
export type ControlFlowType = 'if' | 'switch' | 'loop' | 'merge' | 'split' | 'delay' | 'gate';

/** Condition for control flow */
export interface FlowCondition {
  type: 'equals' | 'not-equals' | 'greater' | 'less' | 'contains' | 'exists';
  left: string;
  right: unknown;
}

/** Loop configuration */
export interface LoopConfig {
  type: 'count' | 'while' | 'foreach';
  count?: number;
  condition?: FlowCondition;
  collection?: string;
  maxIterations?: number;
}

// ─── Node Editor State ─────────────────────────────────────────────────────

/** Node editor UI state */
export interface NodeEditorState {
  selectedNodeIds: string[];
  selectedConnectionIds: string[];
  clipboard: {
    nodes: WorkflowNode[];
    connections: NodeConnection[];
  } | null;
  isDragging: boolean;
  isConnecting: boolean;
  connectingFrom?: {
    nodeId: string;
    portId: string;
    portDirection: PortDirection;
  };
}
