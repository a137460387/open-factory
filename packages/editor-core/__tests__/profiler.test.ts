import { describe, expect, it } from 'vitest';
import {
  analyzeExportSpeed,
  appendProfilerMemorySample,
  buildPerformanceProfilerReport,
  calculateProfilerFlamegraphNodes,
  estimateRenderPassBreakdown,
  findSlowestProfilerFrames,
  isPerformanceProfilerReport,
  normalizeRenderPassBreakdown,
  formatProfilerFrameReason,
  shouldSampleProfilerMemory,
  type ProfilerFrameSample
} from '../src/profiler';

function frame(frameIndex: number, totalMs: number, effectsMs = totalMs * 0.4): ProfilerFrameSample {
  return {
    frameIndex,
    timestampMs: frameIndex * 16,
    playheadTime: frameIndex / 30,
    render: normalizeRenderPassBreakdown({
      compositeMs: totalMs * 0.2,
      colorMs: totalMs * 0.25,
      effectsMs,
      overlayMs: totalMs * 0.15,
      totalMs
    }),
    drawCalls: 4,
    textureBytes: 1024,
    reason: `第${frameIndex}帧`
  };
}

describe('performance profiler core', () => {
  it('normalizes frame render pass breakdown totals', () => {
    const breakdown = normalizeRenderPassBreakdown({
      compositeMs: 10,
      colorMs: 20,
      effectsMs: 30,
      overlayMs: 40,
      totalMs: 50
    });

    expect(breakdown).toEqual({
      compositeMs: 5,
      colorMs: 10,
      effectsMs: 15,
      overlayMs: 20,
      totalMs: 50
    });
  });

  it('estimates render pass breakdown from total GPU frame time', () => {
    const breakdown = estimateRenderPassBreakdown({ totalMs: 25, drawCalls: 8, effectCount: 3, overlayActive: true });

    expect(breakdown.totalMs).toBe(25);
    expect(breakdown.effectsMs).toBeGreaterThan(breakdown.compositeMs);
    expect(breakdown.overlayMs).toBeGreaterThan(0);
  });

  it('sorts the slowest top three frames by total frame time', () => {
    const slowest = findSlowestProfilerFrames([frame(1, 12), frame(2, 42), frame(3, 20), frame(4, 87), frame(5, 42)]);

    expect(slowest.map((item) => item.frameIndex)).toEqual([4, 2, 5]);
    expect(slowest[0]).toMatchObject({ totalMs: 87, slowestPass: 'effects' });
  });

  it('builds a fallback reason for slow frames without a custom reason', () => {
    const sample = frame(12, 87, 70);
    sample.reason = '';

    const [slowest] = findSlowestProfilerFrames([sample], 1);

    expect(slowest).toEqual({
      frameIndex: 12,
      totalMs: 87,
      slowestPass: 'effects',
      reason: 'effects耗时49.8ms'
    });
  });

  it('respects the memory sampling interval', () => {
    expect(shouldSampleProfilerMemory(undefined, 100, 1000)).toBe(true);
    expect(shouldSampleProfilerMemory(100, 900, 1000)).toBe(false);
    expect(shouldSampleProfilerMemory(100, 1100, 1000)).toBe(true);

    const samples = appendProfilerMemorySample(
      [
        {
          timestampMs: 100,
          jsHeapBytes: 10,
          webglTextureBytes: 20,
          proxyCacheBytes: 30,
          undoHistoryBytes: 40
        }
      ],
      {
        timestampMs: 900,
        jsHeapBytes: 100,
        webglTextureBytes: 200,
        proxyCacheBytes: 300,
        undoHistoryBytes: 400
      },
      1000
    );

    expect(samples).toHaveLength(1);
  });

  it('clamps memory samples and rejects invalid timestamps', () => {
    expect(shouldSampleProfilerMemory(100, Number.NaN, 1000)).toBe(false);

    const samples = appendProfilerMemorySample(
      [],
      {
        timestampMs: 100,
        jsHeapBytes: -10,
        webglTextureBytes: Number.NaN,
        proxyCacheBytes: 25.4,
        undoHistoryBytes: -1
      },
      1000
    );

    expect(samples).toEqual([
      {
        timestampMs: 100,
        jsHeapBytes: 0,
        webglTextureBytes: 0,
        proxyCacheBytes: 25,
        undoHistoryBytes: 0
      }
    ]);
  });

  it('calculates SVG flamegraph data points from trace events', () => {
    const nodes = calculateProfilerFlamegraphNodes(
      [
        { id: 'root', name: 'render', category: 'preview', startMs: 1000, durationMs: 100, depth: 0 },
        { id: 'child', name: 'custom-shader', category: 'effect', startMs: 1025, durationMs: 50, depth: 1 }
      ],
      { width: 500, rowHeight: 20, startMs: 1000, endMs: 1100 }
    );

    expect(nodes[0]).toMatchObject({ x: 0, y: 0, width: 500, height: 20 });
    expect(nodes[1]).toMatchObject({ x: 125, y: 20, width: 250, height: 20 });
  });

  it('calculates default flamegraph bounds and filters zero-duration events', () => {
    const nodes = calculateProfilerFlamegraphNodes(
      [
        { id: 'skip', name: 'skip', category: 'preview', startMs: -10, durationMs: 0, depth: 0 },
        { id: 'late', name: 'late', category: 'preview', startMs: 200, durationMs: 10, depth: 2 }
      ],
      { width: Number.NaN, rowHeight: Number.NaN }
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ id: 'late', x: 0.95, y: 36, width: 1, height: 18 });
  });

  it('identifies export speed bottlenecks from actual fps versus expected fps', () => {
    expect(analyzeExportSpeed({ durationSeconds: 10, progressDelta: 0.1, elapsedMs: 5000, expectedFps: 30, hardwareEncoding: false })).toMatchObject({
      expectedFps: 30,
      actualFps: 6,
      bottleneck: 'cpu'
    });
    expect(analyzeExportSpeed({ durationSeconds: 10, progressDelta: 0.1, elapsedMs: 5000, expectedFps: 30, hardwareEncoding: true })).toMatchObject({
      bottleneck: 'gpu'
    });
    expect(analyzeExportSpeed({ durationSeconds: 10, progressDelta: 0.5, elapsedMs: 5000, expectedFps: 30, queueDepth: 3 })).toMatchObject({
      bottleneck: 'queue'
    });
    expect(analyzeExportSpeed({ durationSeconds: 10, progressDelta: 0.5, elapsedMs: 5000, expectedFps: 30, availableMemoryBytes: 128 })).toMatchObject({
      bottleneck: 'memory'
    });
    expect(analyzeExportSpeed({ durationSeconds: 10, progressDelta: 0.5, elapsedMs: 25000, expectedFps: 30 })).toMatchObject({
      actualFps: 6,
      bottleneck: 'cpu'
    });
    expect(analyzeExportSpeed({ durationSeconds: 10, progressDelta: 0.5, elapsedMs: 8000, expectedFps: 30 })).toMatchObject({
      actualFps: 18.75,
      bottleneck: 'io'
    });
    expect(analyzeExportSpeed({ durationSeconds: 10, progressDelta: 1, elapsedMs: 5000, expectedFps: Number.NaN })).toMatchObject({
      expectedFps: 30,
      actualFps: 60,
      bottleneck: 'unknown'
    });
  });

  it('builds a complete JSON report shape', () => {
    const report = buildPerformanceProfilerReport({
      startedAtMs: 1000,
      stoppedAtMs: 2500,
      generatedAt: '2026-06-18T00:00:00.000Z',
      frames: [frame(1, 15), frame(2, 40), frame(3, 25)],
      exportSpeed: [
        {
          timestampMs: 1400,
          taskId: 'export-1',
          expectedFps: 30,
          actualFps: 12,
          progress: 0.25,
          bottleneck: 'cpu'
        }
      ],
      memory: [
        {
          timestampMs: 1300,
          jsHeapBytes: 100,
          webglTextureBytes: 200,
          proxyCacheBytes: 300,
          undoHistoryBytes: 400
        }
      ],
      queues: [
        {
          timestampMs: 1300,
          exportPending: 1,
          exportRunning: 1,
          mediaPending: 2,
          mediaRunning: 1
        }
      ],
      traceEvents: [{ id: 'trace-1', name: 'render', category: 'preview', startMs: 1100, durationMs: 60, depth: 0 }]
    });

    expect(isPerformanceProfilerReport(report)).toBe(true);
    expect(report).toMatchObject({
      schemaVersion: 1,
      generatedAt: '2026-06-18T00:00:00.000Z',
      recording: { startedAtMs: 1000, stoppedAtMs: 2500, durationMs: 1500 },
      summary: {
        frameCount: 3,
        averageFrameMs: 26.67,
        peakMemoryBytes: 1000,
        peakQueueDepth: 5,
        exportBottlenecks: ['cpu']
      }
    });
    expect(report.frames).toHaveLength(3);
    expect(report.flamegraph[0]).toMatchObject({ name: 'render' });
  });

  it('builds an empty report and validates report candidates', () => {
    const report = buildPerformanceProfilerReport({
      startedAtMs: 2000,
      stoppedAtMs: 1000,
      frames: [],
      exportSpeed: [{ timestampMs: 1, taskId: 'a', expectedFps: 30, actualFps: 30, progress: 1, bottleneck: 'unknown' }],
      memory: [],
      queues: [],
      traceEvents: []
    });

    expect(report.recording).toMatchObject({ startedAtMs: 2000, stoppedAtMs: 2000, durationMs: 0 });
    expect(report.summary).toMatchObject({ frameCount: 0, averageFrameMs: 0, peakMemoryBytes: 0, peakQueueDepth: 0, exportBottlenecks: [] });
    expect(isPerformanceProfilerReport(null)).toBe(false);
    expect(isPerformanceProfilerReport({ schemaVersion: 1 })).toBe(false);
  });

  it('formats slow frame reasons with fallback labels', () => {
    expect(
      formatProfilerFrameReason(
        { frameIndex: 12, totalMs: 87, slowestPass: 'effects', reason: 'custom-shader耗时87.0ms' },
        { composite: '合成', color: '色彩', effects: '特效', overlay: '叠加' }
      )
    ).toBe('第12帧：custom-shader耗时87.0ms');
    expect(
      formatProfilerFrameReason(
        { frameIndex: 3, totalMs: 20, slowestPass: 'overlay', reason: '第3帧：叠加耗时20.0ms' },
        { composite: '合成', color: '色彩', effects: '特效', overlay: '叠加' }
      )
    ).toBe('第3帧：叠加耗时20.0ms');
    expect(
      formatProfilerFrameReason(
        { frameIndex: 4, totalMs: 15, slowestPass: 'color', reason: '' },
        { composite: '合成', color: '色彩', effects: '特效', overlay: '叠加' }
      )
    ).toBe('第4帧：色彩耗时15.0ms');
  });
});
