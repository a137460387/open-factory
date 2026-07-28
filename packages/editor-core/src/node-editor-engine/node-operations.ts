/**
 * Node-operation mixin for the node editor engine.
 *
 * Adds: getNodeDefinitions, getNodeDefinitionsByCategory, registerNodeDefinition,
 *       addNode, removeNode, updateNodePosition, updateNodeConfig,
 *       toggleNodeEnabled, getNode, getNodeDefinition.
 */

import type {WorkflowNode, NodeDefinition, NodeCategory} from '../node-editor-types';
import type {EngineFields} from './node-editor-engine-base';

type GConstructor<T> = new (...args: unknown[]) => T;

export function NodeOps<TBase extends GConstructor<EngineFields>>(Base: TBase) {
  return class NodeOps extends Base {
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
  };
}
