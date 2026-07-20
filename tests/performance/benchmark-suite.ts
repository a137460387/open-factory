/**
 * 性能基准测试套件
 *
 * 测试范围：
 * 1. 渲染管线性能 - 帧缓存命中率、预加载效率
 * 2. AI 推理性能 - 各后端推理耗时、量化效果
 * 3. 内存管理性能 - 内存池分配/释放效率、GC 影响
 * 4. 任务调度性能 - 优先级调度延迟、吞吐量
 */

// ==================== 类型定义 ====================

export interface BenchmarkResult {
  name: string;
  category: string;
  iterations: number;
  totalTimeMs: number;
  averageTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  p95TimeMs: number;
  p99TimeMs: number;
  throughput: number; // ops/sec
  memoryUsedBytes: number;
  timestamp: string;
}

export interface BenchmarkSuiteConfig {
  iterations: number;
  warmupIterations: number;
  timeoutMs: number;
  collectMemoryStats: boolean;
}

export const DEFAULT_BENCHMARK_CONFIG: BenchmarkSuiteConfig = {
  iterations: 100,
  warmupIterations: 10,
  timeoutMs: 30000,
  collectMemoryStats: true,
};

export interface ComparisonResult {
  baseline: BenchmarkResult;
  optimized: BenchmarkResult;
  speedup: number; // baseline / optimized
  memoryReduction: number; // (baseline - optimized) / baseline
  significant: boolean; // p < 0.05
}

// ==================== 基准测试运行器 ====================

export class BenchmarkRunner {
  private config: BenchmarkSuiteConfig;
  private results: BenchmarkResult[] = [];

  constructor(config: Partial<BenchmarkSuiteConfig> = {}) {
    this.config = { ...DEFAULT_BENCHMARK_CONFIG, ...config };
  }

  async run<T>(
    name: string,
    category: string,
    setup: () => Promise<T> | T,
    execute: (context: T) => Promise<void> | void,
    teardown?: (context: T) => Promise<void> | void,
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    let memoryBefore = 0;
    let memoryAfter = 0;

    // Warmup
    const context = await setup();
    for (let i = 0; i < this.config.warmupIterations; i++) {
      await execute(context);
    }
    if (teardown) await teardown(context);

    // Collect memory before
    if (this.config.collectMemoryStats) {
      memoryBefore = this.getMemoryUsage();
    }

    // Run benchmark
    const startTime = performance.now();
    let iteration = 0;

    while (iteration < this.config.iterations) {
      const context = await setup();
      const iterStart = performance.now();

      await execute(context);

      const iterEnd = performance.now();
      times.push(iterEnd - iterStart);

      if (teardown) await teardown(context);

      // Check timeout
      if (performance.now() - startTime > this.config.timeoutMs) {
        break;
      }

      iteration++;
    }

    // Collect memory after
    if (this.config.collectMemoryStats) {
      memoryAfter = this.getMemoryUsage();
    }

    // Calculate statistics
    times.sort((a, b) => a - b);
    const totalTime = times.reduce((a, b) => a + b, 0);

    const result: BenchmarkResult = {
      name,
      category,
      iterations: times.length,
      totalTimeMs: totalTime,
      averageTimeMs: totalTime / times.length,
      minTimeMs: times[0],
      maxTimeMs: times[times.length - 1],
      p95TimeMs: this.percentile(times, 95),
      p99TimeMs: this.percentile(times, 99),
      throughput: (times.length / totalTime) * 1000,
      memoryUsedBytes: Math.max(0, memoryAfter - memoryBefore),
      timestamp: new Date().toISOString(),
    };

    this.results.push(result);
    return result;
  }

  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  compareResults(
    baseline: BenchmarkResult,
    optimized: BenchmarkResult,
  ): ComparisonResult {
    const speedup = baseline.averageTimeMs / optimized.averageTimeMs;
    const memoryReduction = baseline.memoryUsedBytes > 0
      ? (baseline.memoryUsedBytes - optimized.memoryUsedBytes) / baseline.memoryUsedBytes
      : 0;

    // Simple significance check (compare p95)
    const significant = baseline.p95TimeMs > optimized.p95TimeMs * 1.1;

    return {
      baseline,
      optimized,
      speedup,
      memoryReduction,
      significant,
    };
  }

  generateReport(): string {
    const lines: string[] = [
      '# 性能基准测试报告',
      `生成时间: ${new Date().toISOString()}`,
      '',
      '## 测试结果汇总',
      '',
      '| 测试名称 | 类别 | 迭代次数 | 平均耗时(ms) | P95耗时(ms) | 吞吐量(ops/s) | 内存(MB) |',
      '|----------|------|----------|--------------|-------------|---------------|----------|',
    ];

    for (const result of this.results) {
      const memMB = (result.memoryUsedBytes / (1024 * 1024)).toFixed(2);
      lines.push(
        `| ${result.name} | ${result.category} | ${result.iterations} | ${result.averageTimeMs.toFixed(2)} | ${result.p95TimeMs.toFixed(2)} | ${result.throughput.toFixed(0)} | ${memMB} |`
      );
    }

    return lines.join('\n');
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }
}

// ==================== 渲染管线基准测试 ====================

export class RenderPipelineBenchmark {
  private runner: BenchmarkRunner;

  constructor(runner: BenchmarkRunner) {
    this.runner = runner;
  }

  async benchmarkFrameCacheHit(): Promise<BenchmarkResult> {
    const { FrameCacheManager } = await import('../engine/render-pipeline');

    return this.runner.run(
      'Frame Cache Hit',
      'Render Pipeline',
      () => {
        const cache = new FrameCacheManager(100);
        // Pre-populate cache
        for (let i = 0; i < 50; i++) {
          cache.put({
            frame: i,
            bitmap: null,
            decodeTime: 5,
            fromCache: false,
            quality: 'full',
          }, 1024 * 1024);
        }
        return cache;
      },
      (cache) => {
        // Access cached frames
        for (let i = 0; i < 50; i++) {
          cache.get(i);
        }
      },
      (cache) => cache.clear(),
    );
  }

  async benchmarkFrameCacheMiss(): Promise<BenchmarkResult> {
    const { FrameCacheManager } = await import('../engine/render-pipeline');

    return this.runner.run(
      'Frame Cache Miss',
      'Render Pipeline',
      () => new FrameCacheManager(100),
      (cache) => {
        for (let i = 0; i < 50; i++) {
          cache.put({
            frame: i,
            bitmap: null,
            decodeTime: 5,
            fromCache: false,
            quality: 'full',
          }, 1024 * 1024);
        }
      },
      (cache) => cache.clear(),
    );
  }

  async benchmarkPredictivePrefetch(): Promise<BenchmarkResult> {
    const { PredictivePrefetcher } = await import('../engine/render-pipeline');

    return this.runner.run(
      'Predictive Prefetch',
      'Render Pipeline',
      () => new PredictivePrefetcher(),
      (prefetcher) => {
        // Simulate playback
        for (let i = 0; i < 60; i++) {
          prefetcher.recordPlaybackPosition(i / 30);
        }
        prefetcher.getPredictedFrames(60, 30, 30);
      },
    );
  }

  async benchmarkViewportCulling(): Promise<BenchmarkResult> {
    const { ViewportCuller } = await import('../engine/render-pipeline');

    return this.runner.run(
      'Viewport Culling',
      'Render Pipeline',
      () => {
        const culler = new ViewportCuller();
        const timeline = {
          tracks: Array.from({ length: 10 }, (_, i) => ({
            id: `track-${i}`,
            type: 'video' as const,
            clips: Array.from({ length: 100 }, (_, j) => ({
              id: `clip-${i}-${j}`,
              start: j * 2,
              duration: 2,
              type: 'video' as const,
              trackId: `track-${i}`,
            })),
          })),
        };
        return { culler, timeline };
      },
      ({ culler, timeline }) => {
        culler.getVisibleClips(timeline, {
          x: 0,
          y: 0,
          width: 1920,
          height: 1080,
          scrollTop: 0,
          scrollLeft: 1000,
          zoom: 1,
        }, 100);
      },
    );
  }
}

// ==================== AI 推理基准测试 ====================

export class InferenceBenchmark {
  private runner: BenchmarkRunner;

  constructor(runner: BenchmarkRunner) {
    this.runner = runner;
  }

  async benchmarkQuantizationInt8(): Promise<BenchmarkResult> {
    const { QuantizationTool } = await import('../ai/inference-engine');

    return this.runner.run(
      'INT8 Quantization',
      'AI Inference',
      () => new Float32Array(1024 * 1024).fill(0).map(() => Math.random() * 2 - 1),
      (data) => {
        QuantizationTool.float32ToInt8(data);
      },
    );
  }

  async benchmarkQuantizationFP16(): Promise<BenchmarkResult> {
    const { QuantizationTool } = await import('../ai/inference-engine');

    return this.runner.run(
      'FP16 Quantization',
      'AI Inference',
      () => new Float32Array(1024 * 1024).fill(0).map(() => Math.random() * 2 - 1),
      (data) => {
        QuantizationTool.float32ToFloat16(data);
      },
    );
  }

  async benchmarkOperatorFusion(): Promise<BenchmarkResult> {
    const { OperatorFusionOptimizer } = await import('../ai/inference-engine');

    return this.runner.run(
      'Operator Fusion',
      'AI Inference',
      () => new OperatorFusionOptimizer(),
      (optimizer) => {
        optimizer.optimize(['conv2d', 'batchNorm', 'relu', 'matmul', 'add', 'relu']);
      },
    );
  }

  async benchmarkInferenceEngineInit(): Promise<BenchmarkResult> {
    const { InferenceEngine } = await import('../ai/inference-engine');

    return this.runner.run(
      'Inference Engine Init',
      'AI Inference',
      () => null,
      async () => {
        const engine = new InferenceEngine();
        await engine.initialize();
        engine.destroy();
      },
    );
  }
}

// ==================== 内存管理基准测试 ====================

export class MemoryBenchmark {
  private runner: BenchmarkRunner;

  constructor(runner: BenchmarkRunner) {
    this.runner = runner;
  }

  async benchmarkPoolAllocation(): Promise<BenchmarkResult> {
    const { MemoryPool } = await import('../core/memory-pool');

    return this.runner.run(
      'Pool Allocation',
      'Memory Management',
      () => new MemoryPool({ maxTotalBytes: 100 * 1024 * 1024 }),
      (pool) => {
        for (let i = 0; i < 100; i++) {
          pool.acquire(`obj-${i}`, 'generic', () => new ArrayBuffer(1024 * 1024), 1024 * 1024);
        }
      },
      (pool) => pool.clear(),
    );
  }

  async benchmarkPoolRelease(): Promise<BenchmarkResult> {
    const { MemoryPool } = await import('../core/memory-pool');

    return this.runner.run(
      'Pool Release',
      'Memory Management',
      () => {
        const pool = new MemoryPool({ maxTotalBytes: 100 * 1024 * 1024 });
        for (let i = 0; i < 100; i++) {
          pool.acquire(`obj-${i}`, 'generic', () => new ArrayBuffer(1024 * 1024), 1024 * 1024);
        }
        return pool;
      },
      (pool) => {
        for (let i = 0; i < 100; i++) {
          pool.release(`obj-${i}`);
        }
      },
      (pool) => pool.clear(),
    );
  }

  async benchmarkGCImpact(): Promise<BenchmarkResult> {
    return this.runner.run(
      'GC Impact',
      'Memory Management',
      () => null,
      () => {
        // Allocate and release to trigger GC
        const arrays: ArrayBuffer[] = [];
        for (let i = 0; i < 100; i++) {
          arrays.push(new ArrayBuffer(1024 * 1024));
        }
        arrays.length = 0;
      },
    );
  }

  async benchmarkTransferableObjects(): Promise<BenchmarkResult> {
    const { MemoryPool } = await import('../core/memory-pool');

    return this.runner.run(
      'Transferable Objects',
      'Memory Management',
      () => {
        const pool = new MemoryPool({
          maxTotalBytes: 100 * 1024 * 1024,
          enableTransferables: true,
        });
        for (let i = 0; i < 10; i++) {
          pool.acquire(`buf-${i}`, 'frame-buffer', () => new ArrayBuffer(1024 * 1024), 1024 * 1024);
        }
        return pool;
      },
      (pool) => {
        for (let i = 0; i < 10; i++) {
          pool.transferOut(`buf-${i}`);
        }
      },
      (pool) => pool.clear(),
    );
  }
}

// ==================== 任务调度基准测试 ====================

export class TaskSchedulerBenchmark {
  private runner: BenchmarkRunner;

  constructor(runner: BenchmarkRunner) {
    this.runner = runner;
  }

  async benchmarkPriorityScheduling(): Promise<BenchmarkResult> {
    const { TaskScheduler } = await import('../core/task-scheduler');

    return this.runner.run(
      'Priority Scheduling',
      'Task Scheduler',
      () => new TaskScheduler({ maxConcurrent: 4 }),
      async (scheduler) => {
        const promises: Promise<any>[] = [];
        const priorities: Array<'immediate' | 'high' | 'normal' | 'low'> = ['low', 'normal', 'high', 'immediate'];

        for (let i = 0; i < 20; i++) {
          const priority = priorities[i % 4];
          promises.push(scheduler.submit({
            id: `task-${i}`,
            priority,
            execute: () => new Promise(resolve => setTimeout(resolve, 1)),
          }));
        }

        await Promise.all(promises);
      },
      (scheduler) => scheduler.clear(),
    );
  }

  async benchmarkPreemption(): Promise<BenchmarkResult> {
    const { TaskScheduler } = await import('../core/task-scheduler');

    return this.runner.run(
      'Task Preemption',
      'Task Scheduler',
      () => new TaskScheduler({ maxConcurrent: 1, enablePreemption: true }),
      async (scheduler) => {
        // Submit low priority task
        const lowTask = scheduler.submit({
          id: 'low-task',
          priority: 'low',
          execute: () => new Promise(resolve => setTimeout(resolve, 100)),
          canInterrupt: true,
        });

        // Submit high priority task (should preempt)
        const highTask = scheduler.submit({
          id: 'high-task',
          priority: 'immediate',
          execute: () => new Promise(resolve => setTimeout(resolve, 10)),
        });

        await Promise.all([lowTask, highTask]);
      },
      (scheduler) => scheduler.clear(),
    );
  }

  async benchmarkThroughput(): Promise<BenchmarkResult> {
    const { TaskScheduler } = await import('../core/task-scheduler');

    return this.runner.run(
      'Task Throughput',
      'Task Scheduler',
      () => new TaskScheduler({ maxConcurrent: 8 }),
      async (scheduler) => {
        const promises: Promise<any>[] = [];

        for (let i = 0; i < 100; i++) {
          promises.push(scheduler.submit({
            id: `task-${i}`,
            priority: 'normal',
            execute: () => Promise.resolve(),
          }));
        }

        await Promise.all(promises);
      },
      (scheduler) => scheduler.clear(),
    );
  }
}

// ==================== 综合基准测试套件 ====================

export class PerformanceBenchmarkSuite {
  private runner: BenchmarkRunner;
  private renderBenchmark: RenderPipelineBenchmark;
  private inferenceBenchmark: InferenceBenchmark;
  private memoryBenchmark: MemoryBenchmark;
  private schedulerBenchmark: TaskSchedulerBenchmark;

  constructor(config: Partial<BenchmarkSuiteConfig> = {}) {
    this.runner = new BenchmarkRunner(config);
    this.renderBenchmark = new RenderPipelineBenchmark(this.runner);
    this.inferenceBenchmark = new InferenceBenchmark(this.runner);
    this.memoryBenchmark = new MemoryBenchmark(this.runner);
    this.schedulerBenchmark = new TaskSchedulerBenchmark(this.runner);
  }

  async runAll(): Promise<BenchmarkResult[]> {
    console.log('Starting performance benchmark suite...');

    // Render Pipeline
    console.log('Running render pipeline benchmarks...');
    await this.renderBenchmark.benchmarkFrameCacheHit();
    await this.renderBenchmark.benchmarkFrameCacheMiss();
    await this.renderBenchmark.benchmarkPredictivePrefetch();
    await this.renderBenchmark.benchmarkViewportCulling();

    // AI Inference
    console.log('Running AI inference benchmarks...');
    await this.inferenceBenchmark.benchmarkQuantizationInt8();
    await this.inferenceBenchmark.benchmarkQuantizationFP16();
    await this.inferenceBenchmark.benchmarkOperatorFusion();
    await this.inferenceBenchmark.benchmarkInferenceEngineInit();

    // Memory Management
    console.log('Running memory management benchmarks...');
    await this.memoryBenchmark.benchmarkPoolAllocation();
    await this.memoryBenchmark.benchmarkPoolRelease();
    await this.memoryBenchmark.benchmarkGCImpact();
    await this.memoryBenchmark.benchmarkTransferableObjects();

    // Task Scheduler
    console.log('Running task scheduler benchmarks...');
    await this.schedulerBenchmark.benchmarkPriorityScheduling();
    await this.schedulerBenchmark.benchmarkPreemption();
    await this.schedulerBenchmark.benchmarkThroughput();

    console.log('Benchmark suite completed.');
    return this.runner.getResults();
  }

  async runCategory(category: string): Promise<BenchmarkResult[]> {
    switch (category) {
      case 'render':
        await this.renderBenchmark.benchmarkFrameCacheHit();
        await this.renderBenchmark.benchmarkFrameCacheMiss();
        await this.renderBenchmark.benchmarkPredictivePrefetch();
        await this.renderBenchmark.benchmarkViewportCulling();
        break;
      case 'inference':
        await this.inferenceBenchmark.benchmarkQuantizationInt8();
        await this.inferenceBenchmark.benchmarkQuantizationFP16();
        await this.inferenceBenchmark.benchmarkOperatorFusion();
        await this.inferenceBenchmark.benchmarkInferenceEngineInit();
        break;
      case 'memory':
        await this.memoryBenchmark.benchmarkPoolAllocation();
        await this.memoryBenchmark.benchmarkPoolRelease();
        await this.memoryBenchmark.benchmarkGCImpact();
        await this.memoryBenchmark.benchmarkTransferableObjects();
        break;
      case 'scheduler':
        await this.schedulerBenchmark.benchmarkPriorityScheduling();
        await this.schedulerBenchmark.benchmarkPreemption();
        await this.schedulerBenchmark.benchmarkThroughput();
        break;
    }

    return this.runner.getResults();
  }

  generateReport(): string {
    return this.runner.generateReport();
  }

  getResults(): BenchmarkResult[] {
    return this.runner.getResults();
  }
}

// ==================== 工厂函数 ====================

export function createBenchmarkRunner(config?: Partial<BenchmarkSuiteConfig>): BenchmarkRunner {
  return new BenchmarkRunner(config);
}

export function createPerformanceBenchmarkSuite(config?: Partial<BenchmarkSuiteConfig>): PerformanceBenchmarkSuite {
  return new PerformanceBenchmarkSuite(config);
}
