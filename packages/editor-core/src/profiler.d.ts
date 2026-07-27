export type ProfilerRenderPassName = 'composite' | 'color' | 'effects' | 'overlay';
export type ProfilerBottleneckKind = 'cpu' | 'gpu' | 'io' | 'queue' | 'memory' | 'unknown';
export interface ProfilerRenderPassBreakdown {
    compositeMs: number;
    colorMs: number;
    effectsMs: number;
    overlayMs: number;
    totalMs: number;
}
export interface ProfilerFrameSample {
    frameIndex: number;
    timestampMs: number;
    playheadTime: number;
    render: ProfilerRenderPassBreakdown;
    drawCalls: number;
    textureBytes: number;
    reason: string;
}
export interface ProfilerExportSpeedSample {
    timestampMs: number;
    taskId: string;
    expectedFps: number;
    actualFps: number;
    progress: number;
    bottleneck: ProfilerBottleneckKind;
}
export interface ProfilerMemorySample {
    timestampMs: number;
    jsHeapBytes: number;
    webglTextureBytes: number;
    proxyCacheBytes: number;
    undoHistoryBytes: number;
}
export interface ProfilerQueueSample {
    timestampMs: number;
    exportPending: number;
    exportRunning: number;
    mediaPending: number;
    mediaRunning: number;
}
export interface ProfilerTraceEvent {
    id: string;
    name: string;
    category: string;
    startMs: number;
    durationMs: number;
    depth: number;
}
export interface ProfilerFlamegraphNode extends ProfilerTraceEvent {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface ProfilerBottleneckFrame {
    frameIndex: number;
    totalMs: number;
    slowestPass: ProfilerRenderPassName;
    reason: string;
}
export interface PerformanceProfilerReport {
    schemaVersion: 1;
    generatedAt: string;
    recording: {
        startedAtMs: number;
        stoppedAtMs: number;
        durationMs: number;
    };
    summary: {
        frameCount: number;
        averageFrameMs: number;
        slowestFrames: ProfilerBottleneckFrame[];
        exportBottlenecks: ProfilerBottleneckKind[];
        peakMemoryBytes: number;
        peakQueueDepth: number;
    };
    frames: ProfilerFrameSample[];
    exportSpeed: ProfilerExportSpeedSample[];
    memory: ProfilerMemorySample[];
    queues: ProfilerQueueSample[];
    flamegraph: ProfilerFlamegraphNode[];
}
export interface ProfilerReportInput {
    startedAtMs: number;
    stoppedAtMs: number;
    generatedAt?: string;
    frames: ProfilerFrameSample[];
    exportSpeed: ProfilerExportSpeedSample[];
    memory: ProfilerMemorySample[];
    queues: ProfilerQueueSample[];
    traceEvents: ProfilerTraceEvent[];
}
export declare const DEFAULT_PROFILER_MEMORY_SAMPLE_INTERVAL_MS = 1000;
export declare const PROFILER_TOP_FRAME_COUNT = 3;
export declare function normalizeRenderPassBreakdown(input: Partial<ProfilerRenderPassBreakdown>): ProfilerRenderPassBreakdown;
export declare function estimateRenderPassBreakdown(input: {
    totalMs: number;
    drawCalls?: number;
    effectCount?: number;
    overlayActive?: boolean;
}): ProfilerRenderPassBreakdown;
export declare function findSlowestProfilerFrames(frames: ProfilerFrameSample[], limit?: number): ProfilerBottleneckFrame[];
export declare function shouldSampleProfilerMemory(previousTimestampMs: number | undefined, nextTimestampMs: number, intervalMs?: number): boolean;
export declare function appendProfilerMemorySample(samples: ProfilerMemorySample[], sample: ProfilerMemorySample, minIntervalMs?: number): ProfilerMemorySample[];
export declare function calculateProfilerFlamegraphNodes(events: ProfilerTraceEvent[], options?: {
    width?: number;
    rowHeight?: number;
    startMs?: number;
    endMs?: number;
}): ProfilerFlamegraphNode[];
export declare function analyzeExportSpeed(input: {
    durationSeconds: number;
    progressDelta: number;
    elapsedMs: number;
    expectedFps: number;
    hardwareEncoding?: boolean;
    queueDepth?: number;
    availableMemoryBytes?: number;
}): Pick<ProfilerExportSpeedSample, 'expectedFps' | 'actualFps' | 'bottleneck'>;
export declare function buildPerformanceProfilerReport(input: ProfilerReportInput): PerformanceProfilerReport;
export declare function isPerformanceProfilerReport(value: unknown): value is PerformanceProfilerReport;
export declare function formatProfilerFrameReason(frame: ProfilerBottleneckFrame, passLabels: Record<ProfilerRenderPassName, string>): string;
//# sourceMappingURL=profiler.d.ts.map