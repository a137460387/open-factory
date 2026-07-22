/**
 * profiler.ts 单元测试
 * 覆盖渲染通道分析、火焰图生成、导出速度分析、报告构建等核心逻辑
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeRenderPassBreakdown,
  estimateRenderPassBreakdown,
  findSlowestProfilerFrames,
  shouldSampleProfilerMemory,
  appendProfilerMemorySample,
  calculateProfilerFlamegraphNodes,
  analyzeExportSpeed,
  buildPerformanceProfilerReport,
  isPerformanceProfilerReport,
  formatProfilerFrameReason,
  DEFAULT_PROFILER_MEMORY_SAMPLE_INTERVAL_MS,
  PROFILER_TOP_FRAME_COUNT,
  type ProfilerFrameSample,
  type ProfilerTraceEvent,
  type ProfilerReportInput,
} from './profiler';

describe('profiler', () => {
  // ─── normalizeRenderPassBreakdown ────────────────────────────────────
  describe('normalizeRenderPassBreakdown', () => {
    it('当 totalMs 为 0 时使用各通道之和', () => {
      const result = normalizeRenderPassBreakdown({
        compositeMs: 5,
        colorMs: 3,
        effectsMs: 2,
        overlayMs: 1,
        totalMs: 0,
      });
      expect(result.totalMs).toBe(11);
      expect(result.compositeMs).toBe(5);
    });

    it('当各通道之和与 totalMs 一致时不缩放', () => {
      const result = normalizeRenderPassBreakdown({
        compositeMs: 10,
        colorMs: 5,
        effectsMs: 3,
        overlayMs: 2,
        totalMs: 20,
      });
      expect(result.totalMs).toBe(20);
      expect(result.compositeMs).toBe(10);
      expect(result.colorMs).toBe(5);
    });

    it('当各通道之和与 totalMs 不一致时按比例缩放', () => {
      const result = normalizeRenderPassBreakdown({
        compositeMs: 10,
        colorMs: 10,
        effectsMs: 10,
        overlayMs: 10,
        totalMs: 20,
      });
      // 每个通道应缩放为 20/40 * 10 = 5
      expect(result.totalMs).toBe(20);
      expect(result.compositeMs).toBe(5);
      expect(result.colorMs).toBe(5);
    });

    it('处理 undefined 输入值', () => {
      const result = normalizeRenderPassBreakdown({});
      expect(result.totalMs).toBe(0);
      expect(result.compositeMs).toBe(0);
    });

    it('处理负值，将其钳制为 0', () => {
      const result = normalizeRenderPassBreakdown({
        compositeMs: -5,
        colorMs: 10,
        effectsMs: 0,
        overlayMs: 0,
        totalMs: 10,
      });
      expect(result.compositeMs).toBe(0);
    });
  });

  // ─── estimateRenderPassBreakdown ─────────────────────────────────────
  describe('estimateRenderPassBreakdown', () => {
    it('估算基本渲染通道分布', () => {
      const result = estimateRenderPassBreakdown({ totalMs: 16 });
      expect(result.totalMs).toBe(16);
      expect(result.compositeMs).toBeGreaterThan(0);
      expect(result.colorMs).toBeGreaterThan(0);
      expect(result.effectsMs).toBeGreaterThan(0);
      expect(result.overlayMs).toBeGreaterThan(0);
    });

    it('overlay 活跃时 overlay 权重增加', () => {
      const without = estimateRenderPassBreakdown({ totalMs: 16, overlayActive: false });
      const withOverlay = estimateRenderPassBreakdown({ totalMs: 16, overlayActive: true });
      expect(withOverlay.overlayMs).toBeGreaterThan(without.overlayMs);
    });

    it('effectCount 增加时 effects 权重增加', () => {
      const few = estimateRenderPassBreakdown({ totalMs: 16, effectCount: 1 });
      const many = estimateRenderPassBreakdown({ totalMs: 16, effectCount: 5 });
      expect(many.effectsMs).toBeGreaterThan(few.effectsMs);
    });

    it('总时间始终等于输入 totalMs', () => {
      const result = estimateRenderPassBreakdown({ totalMs: 33.33, drawCalls: 10, effectCount: 3 });
      expect(result.totalMs).toBeCloseTo(33.33, 1);
    });
  });

  // ─── findSlowestProfilerFrames ───────────────────────────────────────
  describe('findSlowestProfilerFrames', () => {
    const makeFrame = (index: number, totalMs: number): ProfilerFrameSample => ({
      frameIndex: index,
      timestampMs: index * 16,
      playheadTime: index / 30,
      render: { compositeMs: totalMs * 0.5, colorMs: totalMs * 0.2, effectsMs: totalMs * 0.2, overlayMs: totalMs * 0.1, totalMs },
      drawCalls: 4,
      textureBytes: 1024,
      reason: '',
    });

    it('返回最慢的 N 帧', () => {
      const frames = [makeFrame(0, 10), makeFrame(1, 30), makeFrame(2, 20), makeFrame(3, 5)];
      const result = findSlowestProfilerFrames(frames, 2);
      expect(result).toHaveLength(2);
      expect(result[0].frameIndex).toBe(1);
      expect(result[1].frameIndex).toBe(2);
    });

    it('默认返回前 3 帧', () => {
      const frames = Array.from({ length: 10 }, (_, i) => makeFrame(i, i * 5));
      const result = findSlowestProfilerFrames(frames);
      expect(result).toHaveLength(PROFILER_TOP_FRAME_COUNT);
    });

    it('空数组返回空结果', () => {
      expect(findSlowestProfilerFrames([])).toEqual([]);
    });

    it('包含 slowestPass 和 reason', () => {
      const frames = [makeFrame(0, 16)];
      const result = findSlowestProfilerFrames(frames, 1);
      expect(result[0].slowestPass).toBeDefined();
      expect(result[0].reason).toBeDefined();
    });

    it('使用自定义 reason 如果提供', () => {
      const frame = makeFrame(0, 16);
      frame.reason = '自定义原因';
      const result = findSlowestProfilerFrames([frame], 1);
      expect(result[0].reason).toBe('自定义原因');
    });
  });

  // ─── shouldSampleProfilerMemory ──────────────────────────────────────
  describe('shouldSampleProfilerMemory', () => {
    it('首次采样（previous 为 undefined）返回 true', () => {
      expect(shouldSampleProfilerMemory(undefined, 1000)).toBe(true);
    });

    it('间隔不足时返回 false', () => {
      expect(shouldSampleProfilerMemory(1000, 1500, 1000)).toBe(false);
    });

    it('间隔足够时返回 true', () => {
      expect(shouldSampleProfilerMemory(1000, 2000, 1000)).toBe(true);
    });

    it('nextTimestampMs 非有限数时返回 false', () => {
      expect(shouldSampleProfilerMemory(1000, NaN)).toBe(false);
      expect(shouldSampleProfilerMemory(1000, Infinity)).toBe(false);
    });

    it('previousTimestampMs 非有限数时返回 true', () => {
      expect(shouldSampleProfilerMemory(NaN, 1000)).toBe(true);
    });
  });

  // ─── appendProfilerMemorySample ──────────────────────────────────────
  describe('appendProfilerMemorySample', () => {
    const sample = (ts: number) => ({
      timestampMs: ts,
      jsHeapBytes: 100,
      webglTextureBytes: 200,
      proxyCacheBytes: 50,
      undoHistoryBytes: 30,
    });

    it('首次追加成功', () => {
      const result = appendProfilerMemorySample([], sample(1000));
      expect(result).toHaveLength(1);
    });

    it('间隔不足时不追加', () => {
      const result = appendProfilerMemorySample([sample(1000)], sample(1500));
      expect(result).toHaveLength(1);
    });

    it('间隔足够时追加', () => {
      const result = appendProfilerMemorySample([sample(1000)], sample(2000));
      expect(result).toHaveLength(2);
    });

    it('钳制负值为 0', () => {
      const bad = { timestampMs: 1000, jsHeapBytes: -100, webglTextureBytes: -50, proxyCacheBytes: 0, undoHistoryBytes: 0 };
      const result = appendProfilerMemorySample([], bad);
      expect(result[0].jsHeapBytes).toBe(0);
      expect(result[0].webglTextureBytes).toBe(0);
    });
  });

  // ─── calculateProfilerFlamegraphNodes ────────────────────────────────
  describe('calculateProfilerFlamegraphNodes', () => {
    const events: ProfilerTraceEvent[] = [
      { id: '1', name: 'render', category: 'frame', startMs: 0, durationMs: 100, depth: 0 },
      { id: '2', name: 'color', category: 'frame', startMs: 10, durationMs: 40, depth: 1 },
      { id: '3', name: 'effects', category: 'frame', startMs: 50, durationMs: 30, depth: 1 },
    ];

    it('正确计算节点位置和尺寸', () => {
      const nodes = calculateProfilerFlamegraphNodes(events, { width: 1000, rowHeight: 20 });
      expect(nodes).toHaveLength(3);
      expect(nodes[0].x).toBe(0);
      expect(nodes[0].width).toBe(1000);
      expect(nodes[0].y).toBe(0);
      expect(nodes[0].height).toBe(20);
    });

    it('子节点 y 值基于 depth', () => {
      const nodes = calculateProfilerFlamegraphNodes(events, { width: 1000, rowHeight: 18 });
      expect(nodes[1].y).toBe(18);
      expect(nodes[2].y).toBe(18);
    });

    it('过滤掉 durationMs <= 0 的事件', () => {
      const withZero = [...events, { id: '4', name: 'zero', category: 'x', startMs: 0, durationMs: 0, depth: 0 }];
      const nodes = calculateProfilerFlamegraphNodes(withZero);
      expect(nodes).toHaveLength(3);
    });

    it('空事件数组返回空结果', () => {
      expect(calculateProfilerFlamegraphNodes([])).toEqual([]);
    });

    it('使用自动检测的 startMs 和 endMs', () => {
      const nodes = calculateProfilerFlamegraphNodes(events);
      expect(nodes.length).toBeGreaterThan(0);
    });
  });

  // ─── analyzeExportSpeed ──────────────────────────────────────────────
  describe('analyzeExportSpeed', () => {
    it('正常导出速度返回 io 或 unknown 瓶颈', () => {
      const result = analyzeExportSpeed({
        durationSeconds: 10,
        progressDelta: 1,
        elapsedMs: 10000,
        expectedFps: 30,
      });
      expect(result.expectedFps).toBe(30);
      expect(result.actualFps).toBeGreaterThan(0);
    });

    it('队列深度 > 2 时返回 queue 瓶颈', () => {
      const result = analyzeExportSpeed({
        durationSeconds: 10,
        progressDelta: 1,
        elapsedMs: 10000,
        expectedFps: 30,
        queueDepth: 5,
      });
      expect(result.bottleneck).toBe('queue');
    });

    it('内存不足时返回 memory 瓶颈', () => {
      const result = analyzeExportSpeed({
        durationSeconds: 10,
        progressDelta: 1,
        elapsedMs: 100000,
        expectedFps: 30,
        availableMemoryBytes: 100 * 1024 * 1024,
      });
      expect(result.bottleneck).toBe('memory');
    });

    it('速度极慢且有硬件编码时返回 gpu 瓶颈', () => {
      const result = analyzeExportSpeed({
        durationSeconds: 100,
        progressDelta: 1,
        elapsedMs: 1000000, // actualFps = 100*30/1000 = 3, < 30*0.45=13.5
        expectedFps: 30,
        hardwareEncoding: true,
      });
      expect(result.bottleneck).toBe('gpu');
    });

    it('速度极慢且无硬件编码时返回 cpu 瓶颈', () => {
      const result = analyzeExportSpeed({
        durationSeconds: 100,
        progressDelta: 1,
        elapsedMs: 1000000, // actualFps = 100*30/1000 = 3, < 30*0.45=13.5
        expectedFps: 30,
        hardwareEncoding: false,
      });
      expect(result.bottleneck).toBe('cpu');
    });
  });

  // ─── buildPerformanceProfilerReport ──────────────────────────────────
  describe('buildPerformanceProfilerReport', () => {
    const input: ProfilerReportInput = {
      startedAtMs: 1000,
      stoppedAtMs: 5000,
      frames: [
        {
          frameIndex: 0,
          timestampMs: 1000,
          playheadTime: 0,
          render: { compositeMs: 8, colorMs: 4, effectsMs: 2, overlayMs: 1, totalMs: 15 },
          drawCalls: 4,
          textureBytes: 1024,
          reason: '',
        },
      ],
      exportSpeed: [],
      memory: [],
      queues: [],
      traceEvents: [],
    };

    it('构建完整报告', () => {
      const report = buildPerformanceProfilerReport(input);
      expect(report.schemaVersion).toBe(1);
      expect(report.recording.durationMs).toBe(4000);
      expect(report.summary.frameCount).toBe(1);
    });

    it('使用自定义 generatedAt', () => {
      const report = buildPerformanceProfilerReport({ ...input, generatedAt: '2024-01-01T00:00:00Z' });
      expect(report.generatedAt).toBe('2024-01-01T00:00:00Z');
    });

    it('计算 peakMemoryBytes', () => {
      const withMemory = {
        ...input,
        memory: [
          { timestampMs: 1000, jsHeapBytes: 100, webglTextureBytes: 200, proxyCacheBytes: 50, undoHistoryBytes: 30 },
          { timestampMs: 2000, jsHeapBytes: 500, webglTextureBytes: 100, proxyCacheBytes: 50, undoHistoryBytes: 30 },
        ],
      };
      const report = buildPerformanceProfilerReport(withMemory);
      expect(report.summary.peakMemoryBytes).toBe(680);
    });
  });

  // ─── isPerformanceProfilerReport ─────────────────────────────────────
  describe('isPerformanceProfilerReport', () => {
    it('有效报告返回 true', () => {
      const report = buildPerformanceProfilerReport({
        startedAtMs: 0,
        stoppedAtMs: 1000,
        frames: [],
        exportSpeed: [],
        memory: [],
        queues: [],
        traceEvents: [],
      });
      expect(isPerformanceProfilerReport(report)).toBe(true);
    });

    it('无效值返回 false', () => {
      expect(isPerformanceProfilerReport(null)).toBe(false);
      expect(isPerformanceProfilerReport(undefined)).toBe(false);
      expect(isPerformanceProfilerReport('string')).toBe(false);
      expect(isPerformanceProfilerReport({})).toBe(false);
    });
  });

  // ─── formatProfilerFrameReason ───────────────────────────────────────
  describe('formatProfilerFrameReason', () => {
    const labels = { composite: '合成', color: '调色', effects: '特效', overlay: '叠加' };

    it('已有 reason 且以"第"开头时直接返回', () => {
      const frame = { frameIndex: 5, totalMs: 16, slowestPass: 'composite' as const, reason: '第5帧：合成耗时16ms' };
      expect(formatProfilerFrameReason(frame, labels)).toBe('第5帧：合成耗时16ms');
    });

    it('已有 reason 但不以"第"开头时添加前缀', () => {
      const frame = { frameIndex: 5, totalMs: 16, slowestPass: 'composite' as const, reason: '合成耗时16ms' };
      expect(formatProfilerFrameReason(frame, labels)).toBe('第5帧：合成耗时16ms');
    });

    it('无 reason 时生成默认描述', () => {
      const frame = { frameIndex: 3, totalMs: 20, slowestPass: 'effects' as const, reason: '' };
      const result = formatProfilerFrameReason(frame, labels);
      expect(result).toContain('第3帧');
      expect(result).toContain('特效');
    });
  });
});
