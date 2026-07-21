// Workflow Node Registration
// Manages plugin-contributed workflow nodes: registration, lookup, validation, and catalog.

import type { WorkflowNodeDefinition, WorkflowPortDefinition } from './types.js';

/** Resolved workflow node with its owning plugin. */
export interface RegisteredWorkflowNode {
  readonly pluginId: string;
  readonly definition: WorkflowNodeDefinition;
}

/** Workflow node catalog entry for discovery. */
export interface WorkflowNodeCatalogEntry {
  readonly type: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly pluginId: string;
  readonly inputCount: number;
  readonly outputCount: number;
}

/**
 * Registry for plugin-contributed workflow nodes.
 * Supports registration, category browsing, type lookup, and validation.
 */
export class WorkflowNodeRegistry {
  private readonly nodes = new Map<string, RegisteredWorkflowNode>();

  /** Register workflow nodes from a plugin manifest. */
  register(pluginId: string, definitions: readonly WorkflowNodeDefinition[]): void {
    for (const def of definitions) {
      const key = def.type.toLowerCase();
      if (this.nodes.has(key)) {
        const existing = this.nodes.get(key)!;
        throw new Error(
          `Workflow node type '${def.type}' already registered by plugin '${existing.pluginId}'`,
        );
      }
      this.nodes.set(key, { pluginId, definition: def });
    }
  }

  /** Unregister all workflow nodes for a plugin. */
  unregister(pluginId: string): void {
    for (const [key, node] of this.nodes) {
      if (node.pluginId === pluginId) {
        this.nodes.delete(key);
      }
    }
  }

  /** Look up a node by type. */
  get(type: string): RegisteredWorkflowNode | undefined {
    return this.nodes.get(type.toLowerCase());
  }

  /** List all registered nodes. */
  listAll(): readonly RegisteredWorkflowNode[] {
    return [...this.nodes.values()];
  }

  /** List nodes registered by a specific plugin. */
  listByPlugin(pluginId: string): readonly RegisteredWorkflowNode[] {
    return [...this.nodes.values()].filter((n) => n.pluginId === pluginId);
  }

  /** List nodes in a specific category. */
  listByCategory(category: string): readonly RegisteredWorkflowNode[] {
    return [...this.nodes.values()].filter(
      (n) => n.definition.category.toLowerCase() === category.toLowerCase(),
    );
  }

  /** Get all unique categories. */
  getCategories(): readonly string[] {
    const cats = new Set<string>();
    for (const node of this.nodes.values()) {
      cats.add(node.definition.category);
    }
    return [...cats].sort();
  }

  /** Build a catalog for discovery UI. */
  getCatalog(): readonly WorkflowNodeCatalogEntry[] {
    return [...this.nodes.values()].map((n) => ({
      type: n.definition.type,
      name: n.definition.name,
      description: n.definition.description,
      category: n.definition.category,
      pluginId: n.pluginId,
      inputCount: n.definition.inputs.length,
      outputCount: n.definition.outputs.length,
    }));
  }

  /** Build a catalog grouped by category. */
  getCatalogByCategory(): Readonly<Record<string, readonly WorkflowNodeCatalogEntry[]>> {
    const catalog = this.getCatalog();
    const grouped: Record<string, WorkflowNodeCatalogEntry[]> = {};
    for (const entry of catalog) {
      const cat = entry.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(entry);
    }
    return grouped;
  }

  /** Validate that a node can be connected to downstream nodes. */
  validateConnection(
    sourceType: string,
    sourceOutput: string,
    targetType: string,
    targetInput: string,
  ): ConnectionValidationResult {
    const source = this.nodes.get(sourceType.toLowerCase());
    const target = this.nodes.get(targetType.toLowerCase());

    if (!source) return { valid: false, error: `Unknown source node type: ${sourceType}` };
    if (!target) return { valid: false, error: `Unknown target node type: ${targetType}` };

    const output = source.definition.outputs.find((o) => o.name === sourceOutput);
    const input = target.definition.inputs.find((i) => i.name === targetInput);

    if (!output) return { valid: false, error: `Unknown output '${sourceOutput}' on node '${sourceType}'` };
    if (!input) return { valid: false, error: `Unknown input '${targetInput}' on node '${targetType}'` };

    // Type compatibility check
    if (!areTypesCompatible(output.type, input.type)) {
      return {
        valid: false,
        error: `Type mismatch: output '${sourceOutput}' is '${output.type}' but input '${targetInput}' expects '${input.type}'`,
      };
    }

    return { valid: true };
  }

  /** Get the number of registered nodes. */
  get size(): number {
    return this.nodes.size;
  }

  /** Clear all registered nodes. */
  clear(): void {
    this.nodes.clear();
  }
}

export interface ConnectionValidationResult {
  readonly valid: boolean;
  readonly error?: string;
}

/** Validate a workflow node definition for well-formedness. */
export function validateWorkflowNode(def: WorkflowNodeDefinition): string[] {
  const errors: string[] = [];

  if (!def.type || def.type.trim().length === 0) {
    errors.push('Node type cannot be empty');
  }
  if (def.type.includes(' ')) {
    errors.push('Node type cannot contain spaces');
  }
  if (!def.name || def.name.trim().length === 0) {
    errors.push('Node name cannot be empty');
  }
  if (!def.description || def.description.trim().length === 0) {
    errors.push('Node description cannot be empty');
  }
  if (!def.category || def.category.trim().length === 0) {
    errors.push('Node category cannot be empty');
  }
  if (!def.handler || def.handler.trim().length === 0) {
    errors.push('Node handler cannot be empty');
  }

  // Validate ports
  const validPortTypes = ['string', 'number', 'boolean', 'object', 'array', 'media'];

  for (let i = 0; i < def.inputs.length; i++) {
    const port = def.inputs[i];
    if (!port.name || port.name.trim().length === 0) {
      errors.push(`Input[${i}]: name cannot be empty`);
    }
    if (!validPortTypes.includes(port.type)) {
      errors.push(`Input[${i}]: invalid type '${port.type}'`);
    }
  }

  for (let i = 0; i < def.outputs.length; i++) {
    const port = def.outputs[i];
    if (!port.name || port.name.trim().length === 0) {
      errors.push(`Output[${i}]: name cannot be empty`);
    }
    if (!validPortTypes.includes(port.type)) {
      errors.push(`Output[${i}]: invalid type '${port.type}'`);
    }
  }

  return errors;
}

/** Check if two port types are compatible for connection. */
function areTypesCompatible(sourceType: string, targetType: string): boolean {
  if (sourceType === targetType) return true;
  // 'object' and 'array' can be connected to each other in some contexts
  if ((sourceType === 'object' && targetType === 'array') ||
      (sourceType === 'array' && targetType === 'object')) {
    return true;
  }
  return false;
}
