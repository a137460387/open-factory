import { describe, expect, it } from 'vitest';
import {
  ExportPipelineCycleError,
  createTwoStepExportPipeline,
  getPipelineUpstreamNodeIds,
  normalizeExportPipeline,
  parseExportPipeline,
  serializeExportPipeline,
  shouldRunExportPipelineNode,
  topologicallySortExportPipeline,
  type ExportPipeline
} from '../src';

describe('export pipeline', () => {
  it('topologically sorts nodes with parallel branches', () => {
    const pipeline: ExportPipeline = {
      id: 'pipeline',
      name: 'Parallel',
      nodes: [
        { id: 'export', type: 'export-mp4', name: 'Export' },
        { id: 'gif', type: 'generate-gif', name: 'GIF' },
        { id: 'cover', type: 'extract-cover', name: 'Cover' },
        { id: 'notify', type: 'notification', name: 'Notify' }
      ],
      edges: [
        { from: 'export', to: 'gif' },
        { from: 'export', to: 'cover' },
        { from: 'gif', to: 'notify' },
        { from: 'cover', to: 'notify' }
      ]
    };

    const order = topologicallySortExportPipeline(pipeline).map((node) => node.id);
    expect(order.indexOf('export')).toBeLessThan(order.indexOf('gif'));
    expect(order.indexOf('export')).toBeLessThan(order.indexOf('cover'));
    expect(order.indexOf('gif')).toBeLessThan(order.indexOf('notify'));
    expect(order.indexOf('cover')).toBeLessThan(order.indexOf('notify'));
  });

  it('evaluates conditional node execution', () => {
    expect(shouldRunExportPipelineNode({ condition: 'always' }, ['failed'])).toBe(true);
    expect(shouldRunExportPipelineNode({}, [])).toBe(true);
    expect(shouldRunExportPipelineNode({ condition: 'on-success' }, ['complete', 'complete'])).toBe(true);
    expect(shouldRunExportPipelineNode({ condition: 'on-success' }, ['complete', 'failed'])).toBe(false);
    expect(shouldRunExportPipelineNode({ condition: 'on-failure' }, ['complete', 'failed'])).toBe(true);
    expect(shouldRunExportPipelineNode({ condition: 'on-failure' }, ['complete'])).toBe(false);
  });

  it('serializes and parses a reusable pipeline config', () => {
    const pipeline = createTwoStepExportPipeline('Daily Review');
    const parsed = parseExportPipeline(serializeExportPipeline(pipeline));

    expect(parsed).toEqual(pipeline);
    expect(parsed.nodes.map((node) => node.type)).toEqual(['export-mp4', 'script-hook']);
    expect(parsed.edges).toEqual([{ from: 'node-export-mp4', to: 'node-script-hook' }]);
  });

  it('normalizes invalid nodes, edges, defaults, and upstream ids', () => {
    const pipeline = normalizeExportPipeline({
      id: '  custom  ',
      name: '',
      nodes: [
        { id: ' export ', type: 'unknown' as never, name: '', condition: 'bad' as never, script: '  ' },
        { id: 'notify', type: 'notification', name: ' Notify ', condition: 'always', retryOnFailure: true, script: ' echo done ' },
        { id: '', type: 'script-hook', name: 'Invalid' }
      ],
      edges: [
        { from: 'export', to: 'notify' },
        { from: 'export', to: 'missing' },
        { from: 'notify', to: 'notify' }
      ]
    });

    expect(pipeline).toEqual({
      id: 'custom',
      name: 'Export Pipeline',
      nodes: [
        { id: 'export', type: 'export-mp4', name: 'Export MP4', condition: 'on-success', retryOnFailure: false },
        { id: 'notify', type: 'notification', name: 'Notify', condition: 'always', retryOnFailure: true, script: 'echo done' }
      ],
      edges: [{ from: 'export', to: 'notify' }]
    });
    expect(getPipelineUpstreamNodeIds(pipeline, 'notify')).toEqual(['export']);
  });

  it('detects circular dependencies', () => {
    const pipeline: ExportPipeline = {
      id: 'bad',
      name: 'Bad',
      nodes: [
        { id: 'a', type: 'export-mp4', name: 'A' },
        { id: 'b', type: 'script-hook', name: 'B' }
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' }
      ]
    };

    expect(() => topologicallySortExportPipeline(pipeline)).toThrow(ExportPipelineCycleError);
  });
});
