/**
 * Node Editor Engine - Core engine for visual node-based workflow editor
 *
 * Manages node graph, connections, validation, and serialization.
 * Provides the foundation for workflow execution.
 */

import type {WorkflowGraph} from '../node-editor-types';
import {NodeEditorEngineBase} from './node-editor-engine-base';
import {NodeOps} from './node-operations';
import {ConnectionOps} from './connection-operations';
import {StateOps} from './state-operations';

export class NodeEditorEngine extends StateOps(ConnectionOps(NodeOps(NodeEditorEngineBase))) {}

export {BUILTIN_NODES} from './builtin-nodes';
export type {ValidationError, ValidationWarning, ValidationResult} from './validation';

/**
 * Create a node editor engine
 */
export function createNodeEditorEngine(graph?: WorkflowGraph): NodeEditorEngine {
  return new NodeEditorEngine(graph);
}
