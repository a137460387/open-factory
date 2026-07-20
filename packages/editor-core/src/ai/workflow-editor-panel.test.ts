import { describe, it, expect } from 'vitest';
import {
  workflowEditorReducer,
  createInitialWorkflowEditorState,
  getNodeDefinitionsByCategory,
  formatExecutionStatus,
  getLinearWorkflow,
  type WorkflowEditorState,
} from './workflow-editor-panel';
import type { NodeWorkflow, NodePosition } from '../automation/workflow-node-editor';

describe('workflow-editor-panel', () => {
  describe('workflowEditorReducer', () => {
    it('initializes with editing phase', () => {
      const state = createInitialWorkflowEditorState('My Workflow');
      expect(state.phase).toBe('editing');
      expect(state.workflow.name).toBe('My Workflow');
      expect(state.selectedNodeIds).toEqual([]);
    });

    it('adds a node', () => {
      let state = createInitialWorkflowEditorState();
      state = workflowEditorReducer(state, { type: 'ADD_NODE', definitionType: 'media-import', position: { x: 100, y: 100 } });
      expect(state.workflow.nodes.length).toBe(1);
      expect(state.selectedNodeIds.length).toBe(1);
    });

    it('removes a node', () => {
      let state = createInitialWorkflowEditorState();
      state = workflowEditorReducer(state, { type: 'ADD_NODE', definitionType: 'media-import', position: { x: 0, y: 0 } });
      const nodeId = state.workflow.nodes[0].id;
      state = workflowEditorReducer(state, { type: 'REMOVE_NODE', nodeId });
      expect(state.workflow.nodes.length).toBe(0);
    });

    it('selects and deselects nodes', () => {
      let state = createInitialWorkflowEditorState();
      state = workflowEditorReducer(state, { type: 'ADD_NODE', definitionType: 'media-import', position: { x: 0, y: 0 } });
      const nodeId = state.workflow.nodes[0].id;

      state = workflowEditorReducer(state, { type: 'DESELECT_ALL' });
      expect(state.selectedNodeIds).toEqual([]);

      state = workflowEditorReducer(state, { type: 'SELECT_NODE', nodeId });
      expect(state.selectedNodeIds).toEqual([nodeId]);
    });

    it('moves a node', () => {
      let state = createInitialWorkflowEditorState();
      state = workflowEditorReducer(state, { type: 'ADD_NODE', definitionType: 'media-import', position: { x: 0, y: 0 } });
      const nodeId = state.workflow.nodes[0].id;
      state = workflowEditorReducer(state, { type: 'MOVE_NODE', nodeId, position: { x: 300, y: 400 } });
      expect(state.workflow.nodes[0].position).toEqual({ x: 300, y: 400 });
    });

    it('connects nodes', () => {
      let state = createInitialWorkflowEditorState();
      state = workflowEditorReducer(state, { type: 'ADD_NODE', definitionType: 'media-import', position: { x: 0, y: 0 } });
      state = workflowEditorReducer(state, { type: 'ADD_NODE', definitionType: 'apply-effect', position: { x: 200, y: 0 } });
      const n1 = state.workflow.nodes[0];
      const n2 = state.workflow.nodes[1];
      state = workflowEditorReducer(state, { type: 'START_CONNECTION', sourceNodeId: n1.id, sourcePortId: n1.outputs[0].id });
      state = workflowEditorReducer(state, { type: 'COMPLETE_CONNECTION', targetNodeId: n2.id, targetPortId: n2.inputs[0].id });
      expect(state.workflow.connections.length).toBe(1);
    });

    it('updates node params', () => {
      let state = createInitialWorkflowEditorState();
      state = workflowEditorReducer(state, { type: 'ADD_NODE', definitionType: 'scene-detect', position: { x: 0, y: 0 } });
      const nodeId = state.workflow.nodes[0].id;
      state = workflowEditorReducer(state, { type: 'UPDATE_NODE_PARAMS', nodeId, params: { threshold: 0.5 } });
      expect(state.workflow.nodes[0].params.threshold).toBe(0.5);
    });

    it('toggles node enabled state', () => {
      let state = createInitialWorkflowEditorState();
      state = workflowEditorReducer(state, { type: 'ADD_NODE', definitionType: 'media-import', position: { x: 0, y: 0 } });
      const nodeId = state.workflow.nodes[0].id;
      expect(state.workflow.nodes[0].enabled).toBe(true);
      state = workflowEditorReducer(state, { type: 'TOGGLE_NODE_ENABLED', nodeId });
      expect(state.workflow.nodes[0].enabled).toBe(false);
    });

    it('validates workflow', () => {
      let state = createInitialWorkflowEditorState();
      state = workflowEditorReducer(state, { type: 'ADD_NODE', definitionType: 'media-import', position: { x: 0, y: 0 } });
      state = workflowEditorReducer(state, { type: 'VALIDATE' });
      expect(state.validationErrors.length).toBe(0);
    });

    it('loads a template', () => {
      let state = createInitialWorkflowEditorState();
      state = workflowEditorReducer(state, { type: 'LOAD_TEMPLATE', templateId: 'ntpl-auto-subtitle' });
      expect(state.workflow.nodes.length).toBeGreaterThan(0);
      expect(state.phase).toBe('editing');
    });

    it('updates workflow metadata', () => {
      let state = createInitialWorkflowEditorState();
      state = workflowEditorReducer(state, { type: 'UPDATE_WORKFLOW_META', updates: { name: 'Renamed', description: 'A test' } });
      expect(state.workflow.name).toBe('Renamed');
      expect(state.workflow.description).toBe('A test');
    });

    it('adds and removes parameters', () => {
      let state = createInitialWorkflowEditorState();
      state = workflowEditorReducer(state, { type: 'ADD_PARAMETER', param: { id: 'p1', name: 'format', dataType: 'string', required: true } });
      expect(state.workflow.parameters.length).toBe(1);
      state = workflowEditorReducer(state, { type: 'REMOVE_PARAMETER', paramId: 'p1' });
      expect(state.workflow.parameters.length).toBe(0);
    });

    it('sets zoom within bounds', () => {
      let state = createInitialWorkflowEditorState();
      state = workflowEditorReducer(state, { type: 'SET_ZOOM', zoom: 2 });
      expect(state.zoom).toBe(2);
      state = workflowEditorReducer(state, { type: 'SET_ZOOM', zoom: 10 });
      expect(state.zoom).toBe(3); // clamped
      state = workflowEditorReducer(state, { type: 'SET_ZOOM', zoom: 0.01 });
      expect(state.zoom).toBe(0.1); // clamped
    });
  });

  describe('getNodeDefinitionsByCategory', () => {
    it('groups definitions by category', () => {
      const state = createInitialWorkflowEditorState();
      const grouped = getNodeDefinitionsByCategory(state.nodeDefinitions);
      expect(grouped.has('input')).toBe(true);
      expect(grouped.has('ai')).toBe(true);
      expect(grouped.has('transform')).toBe(true);
      expect(grouped.has('output')).toBe(true);
    });
  });

  describe('formatExecutionStatus', () => {
    it('formats completed status', () => {
      const ctx = {
        status: 'completed',
        currentStepIndex: 2,
        stepResults: new Map([
          ['s1', { stepId: 's1', status: 'completed', actionResults: [] }],
          ['s2', { stepId: 's2', status: 'completed', actionResults: [] }],
        ]),
      } as never;
      expect(formatExecutionStatus(ctx)).toContain('Completed');
    });
  });

  describe('getLinearWorkflow', () => {
    it('converts node workflow to linear', () => {
      let state = createInitialWorkflowEditorState();
      state = workflowEditorReducer(state, { type: 'ADD_NODE', definitionType: 'media-import', position: { x: 0, y: 0 } });
      state = workflowEditorReducer(state, { type: 'ADD_NODE', definitionType: 'export-media', position: { x: 200, y: 0 } });
      const linear = getLinearWorkflow(state);
      expect(linear.steps.length).toBe(2);
      expect(linear.triggers[0].type).toBe('manual');
    });
  });
});
