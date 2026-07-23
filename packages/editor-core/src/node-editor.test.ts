/**
 * Tests for Node Editor Engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NodeEditorEngine, createNodeEditorEngine } from './node-editor-engine';
import type { WorkflowGraph, WorkflowNode, NodeDefinition } from './node-editor-types';

describe('NodeEditorEngine', () => {
  let engine: NodeEditorEngine;

  beforeEach(() => {
    engine = createNodeEditorEngine();
  });

  describe('Node Management', () => {
    it('should add nodes', () => {
      const node = engine.addNode('input.video', { x: 100, y: 100 });
      expect(node).not.toBeNull();
      expect(engine.getGraph().nodes).toHaveLength(1);
    });

    it('should not add invalid node type', () => {
      const node = engine.addNode('invalid.type', { x: 100, y: 100 });
      expect(node).toBeNull();
    });

    it('should remove nodes', () => {
      const node = engine.addNode('input.video', { x: 100, y: 100 });
      const result = engine.removeNode(node!.id);
      expect(result).toBe(true);
      expect(engine.getGraph().nodes).toHaveLength(0);
    });

    it('should update node position', () => {
      const node = engine.addNode('input.video', { x: 100, y: 100 });
      engine.updateNodePosition(node!.id, { x: 200, y: 200 });

      const updated = engine.getNode(node!.id);
      expect(updated!.position).toEqual({ x: 200, y: 200 });
    });

    it('should update node config', () => {
      const node = engine.addNode('ai.highlight-detection', { x: 100, y: 100 });
      engine.updateNodeConfig(node!.id, { sensitivity: 0.9 });

      const updated = engine.getNode(node!.id);
      expect(updated!.config.sensitivity).toBe(0.9);
    });

    it('should toggle node enabled state', () => {
      const node = engine.addNode('input.video', { x: 100, y: 100 });
      expect(node!.enabled).toBe(true);

      engine.toggleNodeEnabled(node!.id);
      const updated = engine.getNode(node!.id);
      expect(updated!.enabled).toBe(false);
    });

    it('should get node by ID', () => {
      const node = engine.addNode('input.video', { x: 100, y: 100 });
      const found = engine.getNode(node!.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(node!.id);
    });

    it('should get node definition', () => {
      const def = engine.getNodeDefinition('input.video');
      expect(def).toBeDefined();
      expect(def!.name).toBe('Video Input');
    });
  });

  describe('Connection Management', () => {
    it('should add connections between compatible nodes', () => {
      const source = engine.addNode('input.video', { x: 100, y: 100 });
      const target = engine.addNode('ai.color-grading', { x: 300, y: 100 });

      const conn = engine.addConnection(source!.id, 'video', target!.id, 'video');
      expect(conn).not.toBeNull();
      expect(engine.getGraph().connections).toHaveLength(1);
    });

    it('should not add connection between incompatible ports', () => {
      const source = engine.addNode('input.video', { x: 100, y: 100 });
      const target = engine.addNode('ai.auto-subtitle', { x: 300, y: 100 });

      // Video output -> Audio input (incompatible)
      const conn = engine.addConnection(source!.id, 'video', target!.id, 'audio');
      expect(conn).toBeNull();
    });

    it('should allow any-type connections', () => {
      const source = engine.addNode('input.video', { x: 100, y: 100 });
      const target = engine.addNode('control.delay', { x: 300, y: 100 });

      const conn = engine.addConnection(source!.id, 'video', target!.id, 'input');
      expect(conn).not.toBeNull();
    });

    it('should remove connections', () => {
      const source = engine.addNode('input.video', { x: 100, y: 100 });
      const target = engine.addNode('ai.color-grading', { x: 300, y: 100 });

      const conn = engine.addConnection(source!.id, 'video', target!.id, 'video');
      const result = engine.removeConnection(conn!.id);
      expect(result).toBe(true);
      expect(engine.getGraph().connections).toHaveLength(0);
    });

    it('should get connections for a node', () => {
      const source = engine.addNode('input.video', { x: 100, y: 100 });
      const target = engine.addNode('ai.color-grading', { x: 300, y: 100 });

      engine.addConnection(source!.id, 'video', target!.id, 'video');

      const sourceConns = engine.getConnectionsForNode(source!.id);
      const targetConns = engine.getConnectionsForNode(target!.id);

      expect(sourceConns).toHaveLength(1);
      expect(targetConns).toHaveLength(1);
    });

    it('should replace existing connection to same input port', () => {
      const source1 = engine.addNode('input.video', { x: 100, y: 100 });
      const source2 = engine.addNode('input.video', { x: 100, y: 200 });
      const target = engine.addNode('ai.color-grading', { x: 300, y: 100 });

      engine.addConnection(source1!.id, 'video', target!.id, 'video');
      engine.addConnection(source2!.id, 'video', target!.id, 'video');

      expect(engine.getGraph().connections).toHaveLength(1);
      expect(engine.getGraph().connections[0].sourceNodeId).toBe(source2!.id);
    });

    it('should not create circular connections', () => {
      const node1 = engine.addNode('input.video', { x: 100, y: 100 });
      const node2 = engine.addNode('ai.color-grading', { x: 300, y: 100 });
      const node3 = engine.addNode('output.timeline', { x: 500, y: 100 });

      engine.addConnection(node1!.id, 'video', node2!.id, 'video');
      engine.addConnection(node2!.id, 'graded', node3!.id, 'video');

      // Try to create circular connection
      const conn = engine.addConnection(node3!.id, 'video', node1!.id, 'video');
      expect(conn).toBeNull();
    });
  });

  describe('Selection', () => {
    it('should select nodes', () => {
      const node = engine.addNode('input.video', { x: 100, y: 100 });
      engine.selectNode(node!.id);

      expect(engine.getState().selectedNodeIds).toContain(node!.id);
    });

    it('should support multi-select', () => {
      const node1 = engine.addNode('input.video', { x: 100, y: 100 });
      const node2 = engine.addNode('input.audio', { x: 100, y: 200 });

      engine.selectNode(node1!.id);
      engine.selectNode(node2!.id, true);

      expect(engine.getState().selectedNodeIds).toHaveLength(2);
    });

    it('should deselect nodes', () => {
      const node = engine.addNode('input.video', { x: 100, y: 100 });
      engine.selectNode(node!.id);
      engine.deselectNode(node!.id);

      expect(engine.getState().selectedNodeIds).toHaveLength(0);
    });

    it('should clear selection', () => {
      const node1 = engine.addNode('input.video', { x: 100, y: 100 });
      const node2 = engine.addNode('input.audio', { x: 100, y: 200 });

      engine.selectNode(node1!.id);
      engine.selectNode(node2!.id, true);
      engine.clearSelection();

      expect(engine.getState().selectedNodeIds).toHaveLength(0);
    });

    it('should select all nodes', () => {
      engine.addNode('input.video', { x: 100, y: 100 });
      engine.addNode('input.audio', { x: 100, y: 200 });

      engine.selectAll();
      expect(engine.getState().selectedNodeIds).toHaveLength(2);
    });
  });

  describe('Clipboard Operations', () => {
    it('should copy selected nodes', () => {
      const node = engine.addNode('input.video', { x: 100, y: 100 });
      engine.selectNode(node!.id);
      engine.copy();

      expect(engine.getState().clipboard).not.toBeNull();
      expect(engine.getState().clipboard!.nodes).toHaveLength(1);
    });

    it('should paste nodes', () => {
      const node = engine.addNode('input.video', { x: 100, y: 100 });
      engine.selectNode(node!.id);
      engine.copy();

      const pasted = engine.paste();
      expect(pasted).toHaveLength(1);
      expect(engine.getGraph().nodes).toHaveLength(2);
    });

    it('should offset pasted nodes', () => {
      const node = engine.addNode('input.video', { x: 100, y: 100 });
      engine.selectNode(node!.id);
      engine.copy();

      const pasted = engine.paste({ x: 50, y: 50 });
      expect(pasted[0].position.x).toBe(150);
      expect(pasted[0].position.y).toBe(150);
    });

    it('should delete selected nodes', () => {
      const node = engine.addNode('input.video', { x: 100, y: 100 });
      engine.selectNode(node!.id);
      engine.deleteSelected();

      expect(engine.getGraph().nodes).toHaveLength(0);
    });
  });

  describe('Execution Order', () => {
    it('should return topological order', () => {
      const node1 = engine.addNode('input.video', { x: 100, y: 100 });
      const node2 = engine.addNode('ai.color-grading', { x: 300, y: 100 });
      const node3 = engine.addNode('output.timeline', { x: 500, y: 100 });

      engine.addConnection(node1!.id, 'video', node2!.id, 'video');
      engine.addConnection(node2!.id, 'graded', node3!.id, 'video');

      const order = engine.getExecutionOrder();
      expect(order).toHaveLength(3);
      expect(order.indexOf(node1!.id)).toBeLessThan(order.indexOf(node2!.id));
      expect(order.indexOf(node2!.id)).toBeLessThan(order.indexOf(node3!.id));
    });
  });

  describe('Validation', () => {
    it('should validate empty graph', () => {
      const result = engine.validateGraph();
      expect(result.valid).toBe(true);
    });

    it('should warn about disconnected required inputs', () => {
      engine.addNode('ai.color-grading', { x: 300, y: 100 });

      const result = engine.validateGraph();
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect cycles', () => {
      const node1 = engine.addNode('input.video', { x: 100, y: 100 });
      const node2 = engine.addNode('ai.color-grading', { x: 300, y: 100 });

      // Manually create a cycle (bypass validation)
      const graph = engine.getGraph();
      graph.connections = [
        { id: 'c1', sourceNodeId: node1!.id, sourcePortId: 'video', targetNodeId: node2!.id, targetPortId: 'video' },
        { id: 'c2', sourceNodeId: node2!.id, sourcePortId: 'graded', targetNodeId: node1!.id, targetPortId: 'video' },
      ];
      engine.importGraph(JSON.stringify(graph));

      const result = engine.validateGraph();
      expect(result.valid).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('should export graph to JSON', () => {
      engine.addNode('input.video', { x: 100, y: 100 });
      const json = engine.exportGraph();

      expect(json).toBeTruthy();
      const parsed = JSON.parse(json);
      expect(parsed.nodes).toHaveLength(1);
    });

    it('should import graph from JSON', () => {
      const graph: WorkflowGraph = {
        id: 'test',
        name: 'Test Graph',
        description: '',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodes: [
          {
            id: 'node-1',
            type: 'input.video',
            position: { x: 100, y: 100 },
            config: {},
            enabled: true,
          },
        ],
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        tags: [],
      };

      const result = engine.importGraph(JSON.stringify(graph));
      expect(result).toBe(true);
      expect(engine.getGraph().nodes).toHaveLength(1);
    });

    it('should reject invalid JSON', () => {
      const result = engine.importGraph('invalid json');
      expect(result).toBe(false);
    });
  });

  describe('Viewport', () => {
    it('should update viewport', () => {
      engine.updateViewport({ x: 100, y: 200, zoom: 1.5 });
      expect(engine.getGraph().viewport).toEqual({ x: 100, y: 200, zoom: 1.5 });
    });

    it('should fit to view', () => {
      engine.addNode('input.video', { x: 100, y: 100 });
      engine.addNode('output.timeline', { x: 500, y: 300 });

      engine.fitToView(800, 600);
      const viewport = engine.getGraph().viewport;
      expect(viewport.zoom).toBeLessThanOrEqual(1);
    });
  });
});
