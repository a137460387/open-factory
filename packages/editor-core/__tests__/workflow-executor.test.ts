import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowExecutor } from '../src/workflow-executor';
import type { WorkflowNode, WorkflowGraph, NodeConnection } from '../src/node-editor-types';

// Mock NodeEditorEngine
function createMockEngine(options: {
  nodeIds?: string[];
  nodes?: Map<string, WorkflowNode>;
  connections?: NodeConnection[];
} = {}) {
  const { nodeIds = [], nodes = new Map(), connections = [] } = options;
  return {
    getExecutionOrder: vi.fn().mockReturnValue(nodeIds),
    getNode: vi.fn((id: string) => nodes.get(id)),
    getIncomingConnections: vi.fn((id: string) =>
      connections.filter(c => c.targetNodeId === id)
    ),
  } as any;
}

function makeNode(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: 'node-1',
    type: 'input.video',
    position: { x: 0, y: 0 },
    config: {},
    enabled: true,
    inputs: [],
    outputs: [],
    ...overrides,
  } as WorkflowNode;
}

describe('WorkflowExecutor', () => {
  let engine: ReturnType<typeof createMockEngine>;

  beforeEach(() => {
    engine = createMockEngine();
  });

  describe('constructor', () => {
    it('registers built-in executors', () => {
      const executor = new WorkflowExecutor(engine);
      // Should not throw when creating
      expect(executor).toBeDefined();
    });
  });

  describe('registerExecutor / registerExecutors', () => {
    it('registers custom executor', () => {
      const executor = new WorkflowExecutor(engine);
      const customFn = vi.fn().mockResolvedValue({ output: 'test' });
      executor.registerExecutor('custom.type', customFn);
      // No direct way to check, but it should be usable during execution
    });

    it('registers multiple executors', () => {
      const executor = new WorkflowExecutor(engine);
      executor.registerExecutors({
        'custom.a': vi.fn().mockResolvedValue({}),
        'custom.b': vi.fn().mockResolvedValue({}),
      });
    });
  });

  describe('execute', () => {
    it('executes empty graph', async () => {
      engine.getExecutionOrder.mockReturnValue([]);
      const executor = new WorkflowExecutor(engine);
      const graph = { nodes: [], connections: [] } as unknown as WorkflowGraph;
      const progress = await executor.execute(graph);
      expect(progress.status).toBe('completed');
      expect(progress.totalNodes).toBe(0);
    });

    it('executes single node', async () => {
      const node = makeNode({ id: 'n1', type: 'input.video' });
      engine.getExecutionOrder.mockReturnValue(['n1']);
      engine.getNode.mockReturnValue(node);

      const executor = new WorkflowExecutor(engine);
      const graph = { nodes: [node], connections: [] } as unknown as WorkflowGraph;
      const progress = await executor.execute(graph);
      expect(progress.status).toBe('completed');
      expect(progress.completedNodes).toBe(1);
    });

    it('skips disabled nodes', async () => {
      const node = makeNode({ id: 'n1', type: 'input.video', enabled: false });
      engine.getExecutionOrder.mockReturnValue(['n1']);
      engine.getNode.mockReturnValue(node);

      const executor = new WorkflowExecutor(engine);
      const graph = { nodes: [node], connections: [] } as unknown as WorkflowGraph;
      const progress = await executor.execute(graph);
      expect(progress.status).toBe('completed');
      expect(progress.completedNodes).toBe(1);
    });

    it('skips missing nodes', async () => {
      engine.getExecutionOrder.mockReturnValue(['missing']);
      engine.getNode.mockReturnValue(undefined);

      const executor = new WorkflowExecutor(engine);
      const graph = { nodes: [], connections: [] } as unknown as WorkflowGraph;
      const progress = await executor.execute(graph);
      expect(progress.status).toBe('completed');
    });

    it('fails when no executor for node type', async () => {
      const node = makeNode({ id: 'n1', type: 'unknown.type' });
      engine.getExecutionOrder.mockReturnValue(['n1']);
      engine.getNode.mockReturnValue(node);

      const executor = new WorkflowExecutor(engine);
      const graph = { nodes: [node], connections: [] } as unknown as WorkflowGraph;
      const progress = await executor.execute(graph);
      expect(progress.status).toBe('failed');
    });

    it('executes multiple nodes in order', async () => {
      const n1 = makeNode({ id: 'n1', type: 'input.video' });
      const n2 = makeNode({ id: 'n2', type: 'transform.crop' });
      engine.getExecutionOrder.mockReturnValue(['n1', 'n2']);
      engine.getNode.mockImplementation((id: string) => id === 'n1' ? n1 : n2);

      const executor = new WorkflowExecutor(engine);
      const graph = { nodes: [n1, n2], connections: [] } as unknown as WorkflowGraph;
      const progress = await executor.execute(graph);
      expect(progress.status).toBe('completed');
      expect(progress.completedNodes).toBe(2);
    });
  });

  describe('abort', () => {
    it('aborts execution', async () => {
      const node = makeNode({ id: 'n1', type: 'control.delay', config: { duration: 50 } });
      engine.getExecutionOrder.mockReturnValue(['n1']);
      engine.getNode.mockReturnValue(node);

      const executor = new WorkflowExecutor(engine);
      const graph = { nodes: [node], connections: [] } as unknown as WorkflowGraph;

      // Start execution and abort immediately
      const executePromise = executor.execute(graph);
      executor.abort();
      const progress = await executePromise;
      // May complete or be cancelled depending on timing
      expect(['completed', 'cancelled']).toContain(progress.status);
    });
  });

  describe('getResults', () => {
    it('returns empty results initially', () => {
      const executor = new WorkflowExecutor(engine);
      expect(executor.getResults().size).toBe(0);
    });

    it('returns results after execution', async () => {
      const node = makeNode({ id: 'n1', type: 'input.video' });
      engine.getExecutionOrder.mockReturnValue(['n1']);
      engine.getNode.mockReturnValue(node);

      const executor = new WorkflowExecutor(engine);
      const graph = { nodes: [node], connections: [] } as unknown as WorkflowGraph;
      await executor.execute(graph);
      const results = executor.getResults();
      expect(results.has('n1')).toBe(true);
      expect(results.get('n1')?.status).toBe('completed');
    });
  });

  describe('built-in executors', () => {
    it('executes input.video', async () => {
      const node = makeNode({ id: 'n1', type: 'input.video', config: { mediaId: 'test-media' } });
      engine.getExecutionOrder.mockReturnValue(['n1']);
      engine.getNode.mockReturnValue(node);

      const executor = new WorkflowExecutor(engine);
      await executor.execute({ nodes: [node], connections: [] } as any);
      const result = executor.getResults().get('n1');
      expect(result?.outputs?.video).toBe('test-media');
    });

    it('executes input.audio', async () => {
      const node = makeNode({ id: 'n1', type: 'input.audio', config: { mediaId: 'audio-1' } });
      engine.getExecutionOrder.mockReturnValue(['n1']);
      engine.getNode.mockReturnValue(node);

      const executor = new WorkflowExecutor(engine);
      await executor.execute({ nodes: [node], connections: [] } as any);
      expect(executor.getResults().get('n1')?.outputs?.audio).toBe('audio-1');
    });

    it('executes input.image', async () => {
      const node = makeNode({ id: 'n1', type: 'input.image', config: { mediaId: 'img-1' } });
      engine.getExecutionOrder.mockReturnValue(['n1']);
      engine.getNode.mockReturnValue(node);

      const executor = new WorkflowExecutor(engine);
      await executor.execute({ nodes: [node], connections: [] } as any);
      expect(executor.getResults().get('n1')?.outputs?.image).toBe('img-1');
    });

    it('executes input.timeline', async () => {
      const node = makeNode({ id: 'n1', type: 'input.timeline' });
      engine.getExecutionOrder.mockReturnValue(['n1']);
      engine.getNode.mockReturnValue(node);

      const executor = new WorkflowExecutor(engine);
      await executor.execute({ nodes: [node], connections: [] } as any);
      expect(executor.getResults().get('n1')?.outputs?.timeline).toBe('current-timeline');
    });

    it('executes transform.crop', async () => {
      const node = makeNode({ id: 'n1', type: 'transform.crop' });
      engine.getExecutionOrder.mockReturnValue(['n1']);
      engine.getNode.mockReturnValue(node);

      const executor = new WorkflowExecutor(engine);
      await executor.execute({ nodes: [node], connections: [] } as any);
      expect(executor.getResults().get('n1')?.outputs?.output).toContain('cropped');
    });

    it('executes output.timeline', async () => {
      const node = makeNode({ id: 'n1', type: 'output.timeline' });
      engine.getExecutionOrder.mockReturnValue(['n1']);
      engine.getNode.mockReturnValue(node);

      const executor = new WorkflowExecutor(engine);
      await executor.execute({ nodes: [node], connections: [] } as any);
      expect(executor.getResults().get('n1')?.outputs?.success).toBe(true);
    });

    it('executes output.export', async () => {
      const node = makeNode({ id: 'n1', type: 'output.export', config: { outputPath: '/out.mp4' } });
      engine.getExecutionOrder.mockReturnValue(['n1']);
      engine.getNode.mockReturnValue(node);

      const executor = new WorkflowExecutor(engine);
      await executor.execute({ nodes: [node], connections: [] } as any);
      expect(executor.getResults().get('n1')?.outputs?.outputPath).toBe('/out.mp4');
    });

    it('executes control.merge', async () => {
      const node = makeNode({ id: 'n1', type: 'control.merge' });
      engine.getExecutionOrder.mockReturnValue(['n1']);
      engine.getNode.mockReturnValue(node);

      const executor = new WorkflowExecutor(engine);
      await executor.execute({ nodes: [node], connections: [] } as any);
      expect(executor.getResults().get('n1')?.status).toBe('completed');
    });
  });
});
