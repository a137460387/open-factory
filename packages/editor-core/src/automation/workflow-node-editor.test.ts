import { describe, it, expect } from 'vitest';
import {
  validateNodeWorkflow,
  convertToWorkflow,
  resolveParameters,
  validateParameters,
  createNodeWorkflow,
  createNodeFromDefinition,
  addNode,
  removeNode,
  connectNodes,
  disconnectNodes,
  updateNodeParams,
  moveNode,
  BUILTIN_NODE_DEFINITIONS,
  type NodeWorkflow,
  type WorkflowNode,
  type NodeConnection,
  type NodeGraphValidationError,
} from './workflow-node-editor';

// ─── Test Helpers ───────────────────────────────────────────────

function getDef(type: string) {
  return BUILTIN_NODE_DEFINITIONS.find((d) => d.type === type)!;
}

function makeSimplePipeline(): NodeWorkflow {
  const wf = createNodeWorkflow('Test Pipeline');
  const n1 = createNodeFromDefinition(getDef('media-import'), { x: 0, y: 0 });
  const n2 = createNodeFromDefinition(getDef('apply-effect'), { x: 200, y: 0 });
  const n3 = createNodeFromDefinition(getDef('export-media'), { x: 400, y: 0 });

  let result = addNode(wf, n1);
  result = addNode(result, n2);
  result = addNode(result, n3);
  result = connectNodes(result, n1.id, n1.outputs[0].id, n2.id, n2.inputs[0].id);
  result = connectNodes(result, n2.id, n2.outputs[0].id, n3.id, n3.inputs[0].id);

  return result;
}

// ─── Tests ──────────────────────────────────────────────────────

describe('workflow-node-editor', () => {
  describe('createNodeWorkflow', () => {
    it('creates an empty workflow', () => {
      const wf = createNodeWorkflow('My Workflow');
      expect(wf.name).toBe('My Workflow');
      expect(wf.nodes).toEqual([]);
      expect(wf.connections).toEqual([]);
      expect(wf.parameters).toEqual([]);
      expect(wf.version).toBe('1.0.0');
    });
  });

  describe('createNodeFromDefinition', () => {
    it('creates a node from a built-in definition', () => {
      const def = getDef('media-import');
      const node = createNodeFromDefinition(def, { x: 100, y: 200 });
      expect(node.type).toBe('media-import');
      expect(node.position).toEqual({ x: 100, y: 200 });
      expect(node.inputs).toEqual([]);
      expect(node.outputs.length).toBe(1);
      expect(node.enabled).toBe(true);
    });

    it('assigns unique port IDs', () => {
      const def = getDef('asr-transcribe');
      const node = createNodeFromDefinition(def, { x: 0, y: 0 });
      const portIds = [...node.inputs, ...node.outputs].map((p) => p.id);
      expect(new Set(portIds).size).toBe(portIds.length);
    });
  });

  describe('addNode / removeNode', () => {
    it('adds a node to workflow', () => {
      const wf = createNodeWorkflow('Test');
      const node = createNodeFromDefinition(getDef('media-import'), { x: 0, y: 0 });
      const result = addNode(wf, node);
      expect(result.nodes.length).toBe(1);
      expect(result.entryNodeIds).toContain(node.id);
    });

    it('removes a node and its connections', () => {
      const wf = makeSimplePipeline();
      const nodeToRemove = wf.nodes[1]; // scene-detect
      const result = removeNode(wf, nodeToRemove.id);
      expect(result.nodes.length).toBe(2);
      expect(result.connections.every(
        (c) => c.sourceNodeId !== nodeToRemove.id && c.targetNodeId !== nodeToRemove.id,
      )).toBe(true);
    });
  });

  describe('connectNodes / disconnectNodes', () => {
    it('creates a connection between nodes', () => {
      const wf = createNodeWorkflow('Test');
      const n1 = createNodeFromDefinition(getDef('media-import'), { x: 0, y: 0 });
      const n2 = createNodeFromDefinition(getDef('scene-detect'), { x: 200, y: 0 });
      let result = addNode(wf, n1);
      result = addNode(result, n2);
      result = connectNodes(result, n1.id, n1.outputs[0].id, n2.id, n2.inputs[0].id);
      expect(result.connections.length).toBe(1);
      expect(result.entryNodeIds).toEqual([n1.id]);
    });

    it('removes a connection', () => {
      const wf = makeSimplePipeline();
      const connId = wf.connections[0].id;
      const result = disconnectNodes(wf, connId);
      expect(result.connections.length).toBe(1);
    });
  });

  describe('updateNodeParams', () => {
    it('updates node parameters', () => {
      const wf = createNodeWorkflow('Test');
      const node = createNodeFromDefinition(getDef('scene-detect'), { x: 0, y: 0 });
      let result = addNode(wf, node);
      result = updateNodeParams(result, node.id, { threshold: 0.5 });
      const updated = result.nodes.find((n) => n.id === node.id)!;
      expect(updated.params.threshold).toBe(0.5);
    });
  });

  describe('moveNode', () => {
    it('moves a node on the canvas', () => {
      const wf = createNodeWorkflow('Test');
      const node = createNodeFromDefinition(getDef('media-import'), { x: 0, y: 0 });
      let result = addNode(wf, node);
      result = moveNode(result, node.id, { x: 300, y: 400 });
      expect(result.nodes[0].position).toEqual({ x: 300, y: 400 });
    });
  });

  describe('validateNodeWorkflow', () => {
    it('validates a correct workflow', () => {
      const wf = makeSimplePipeline();
      const errors = validateNodeWorkflow(wf);
      expect(errors.length).toBe(0);
    });

    it('detects cycles', () => {
      const wf = createNodeWorkflow('Cycle Test');
      const n1 = createNodeFromDefinition(getDef('apply-effect'), { x: 0, y: 0 });
      const n2 = createNodeFromDefinition(getDef('apply-effect'), { x: 200, y: 0 });
      let result = addNode(wf, n1);
      result = addNode(result, n2);
      result = connectNodes(result, n1.id, n1.outputs[0].id, n2.id, n2.inputs[0].id);
      result = connectNodes(result, n2.id, n2.outputs[0].id, n1.id, n1.inputs[0].id);

      const errors = validateNodeWorkflow(result);
      expect(errors.some((e: NodeGraphValidationError) => e.type === 'cycle')).toBe(true);
    });

    it('detects missing required inputs', () => {
      const wf = createNodeWorkflow('Missing Input');
      const n1 = createNodeFromDefinition(getDef('scene-detect'), { x: 0, y: 0 });
      // scene-detect requires 'media' input, but nothing is connected
      const result = addNode(wf, n1);
      const errors = validateNodeWorkflow(result);
      expect(errors.some((e: NodeGraphValidationError) => e.type === 'missing_required')).toBe(true);
    });

    it('detects type mismatches', () => {
      const wf = createNodeWorkflow('Type Mismatch');
      const n1 = createNodeFromDefinition(getDef('quality-check'), { x: 0, y: 0 }); // outputs 'number'
      const n2 = createNodeFromDefinition(getDef('scene-detect'), { x: 200, y: 0 }); // expects 'media' input
      let result = addNode(wf, n1);
      result = addNode(result, n2);
      result = connectNodes(result, n1.id, n1.outputs[0].id, n2.id, n2.inputs[0].id);

      const errors = validateNodeWorkflow(result);
      expect(errors.some((e: NodeGraphValidationError) => e.type === 'type_mismatch')).toBe(true);
    });
  });

  describe('convertToWorkflow', () => {
    it('converts node graph to linear workflow', () => {
      const wf = makeSimplePipeline();
      const workflow = convertToWorkflow(wf);
      expect(workflow.name).toBe('Test Pipeline');
      expect(workflow.steps.length).toBe(3);
      expect(workflow.triggers[0].type).toBe('manual');
    });

    it('skips disabled nodes', () => {
      const wf = makeSimplePipeline();
      const disabledNode = { ...wf.nodes[1], enabled: false };
      const updated = { ...wf, nodes: [wf.nodes[0], disabledNode, wf.nodes[2]] };
      const workflow = convertToWorkflow(updated);
      expect(workflow.steps.length).toBe(2);
    });
  });

  describe('resolveParameters', () => {
    it('resolves parameter references in string values', () => {
      const params = { format: '{{outputFormat}}', quality: '{{quality}}' };
      const workflowParams = [
        { id: 'p1', name: 'outputFormat', dataType: 'string' as const, required: true },
        { id: 'p2', name: 'quality', dataType: 'string' as const, defaultValue: 'high', required: false },
      ];
      const result = resolveParameters(params, workflowParams, { outputFormat: 'mp4' });
      expect(result.format).toBe('mp4');
      expect(result.quality).toBe('high'); // falls back to default
    });

    it('leaves unresolved parameters as-is', () => {
      const params = { format: '{{unknown}}' };
      const result = resolveParameters(params, [], {});
      expect(result.format).toBe('{{unknown}}');
    });
  });

  describe('validateParameters', () => {
    it('returns errors for missing required parameters', () => {
      const params = [
        { id: 'p1', name: 'format', dataType: 'string' as const, required: true },
      ];
      const errors = validateParameters(params, {});
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain('format');
    });

    it('returns no errors when required params are provided', () => {
      const params = [
        { id: 'p1', name: 'format', dataType: 'string' as const, required: true },
      ];
      const errors = validateParameters(params, { format: 'mp4' });
      expect(errors.length).toBe(0);
    });

    it('accepts default values as satisfying required', () => {
      const params = [
        { id: 'p1', name: 'format', dataType: 'string' as const, required: true, defaultValue: 'mp4' },
      ];
      const errors = validateParameters(params, {});
      expect(errors.length).toBe(0);
    });
  });
});
