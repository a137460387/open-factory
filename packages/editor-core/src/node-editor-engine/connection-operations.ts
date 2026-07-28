/**
 * Connection-operation mixin for the node editor engine.
 *
 * Adds: addConnection, removeConnection, getConnectionsForNode,
 *       getIncomingConnections, getOutgoingConnections.
 *
 * Depends on NodeOps being applied before this mixin.
 */

import type {NodeConnection, NodeDefinition, WorkflowNode} from '../node-editor-types';
import type {EngineFields} from './node-editor-engine-base';
import {arePortsCompatible, wouldCreateCycle} from './validation';

type GConstructor<T> = new (...args: unknown[]) => T;

/** Fields required from prior mixins (NodeOps). */
interface NodeOpsFields {
  getNode(id: string): WorkflowNode | undefined;
  getNodeDefinition(type: string): NodeDefinition | undefined;
}

export function ConnectionOps<TBase extends GConstructor<EngineFields & NodeOpsFields>>(
  Base: TBase,
) {
  return class ConnectionOps extends Base {
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
      if (!arePortsCompatible(sourcePort, targetPort)) return null;

      // Check for existing connection to the same input port
      const existingConnection = this.graph.connections.find(
        c => c.targetNodeId === targetNodeId && c.targetPortId === targetPortId,
      );
      if (existingConnection && !targetPort.multiple) {
        // Remove existing connection
        this.removeConnection(existingConnection.id);
      }

      // Check for circular connections
      const getOutgoingTargets = (nodeId: string): string[] =>
        this.graph.connections
          .filter(c => c.sourceNodeId === nodeId)
          .map(c => c.targetNodeId);

      if (wouldCreateCycle(sourceNodeId, targetNodeId, getOutgoingTargets)) return null;

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
  };
}
