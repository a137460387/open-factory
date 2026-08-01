/**
 * Node Editor Engine - Public API
 *
 * Re-exports the engine class and factory function.
 * Consumers import from './node-editor-engine' which resolves here.
 */

import type {WorkflowGraph} from '../node-editor-types';
import {NodeEditorEngine} from './node-editor-engine';

export {NodeEditorEngine} from './node-editor-engine';
export {BUILTIN_NODES} from './builtin-nodes';
export type {ValidationError, ValidationWarning, ValidationResult} from './validation';

/**
 * Create a node editor engine
 */
export function createNodeEditorEngine(graph?: WorkflowGraph): NodeEditorEngine {
  return new NodeEditorEngine(graph);
}
