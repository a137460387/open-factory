import type {
  ExportTask,
  ProfilerFrameSample,
  ProfilerTraceEvent,
  ProfilerExportSpeedSample,
  ProfilerMemorySample,
  ProfilerQueueSample,
} from '@open-factory/editor-core';
import { analyzeExportSpeed } from '@open-factory/editor-core';

export interface ProfilerRecordingBuffer {
  startedAtMs: number;
  frames: ProfilerFrameSample[];
  exportSpeed: ProfilerExportSpeedSample[];
  memory: ProfilerMemorySample[];
  queues: ProfilerQueueSample[];
  traceEvents: ProfilerTraceEvent[];
  exportProgressByTaskId: Map<string, { timestampMs: number; progress: number }>;
}

export function sampleProfilerExportSpeed(
  recording: ProfilerRecordingBuffer,
  tasks: ExportTask[],
  now: number,
  fallbackFps: number,
  queueDepth: number,
): void {
  for (const task of tasks) {
    if (task.status !== 'running') {
      recording.exportProgressByTaskId.delete(task.id);
      continue;
    }
    const previous = recording.exportProgressByTaskId.get(task.id);
    if (previous && task.progress > previous.progress) {
      const speed = analyzeExportSpeed({
        durationSeconds: task.plan.duration,
        progressDelta: task.progress - previous.progress,
        elapsedMs: now - previous.timestampMs,
        expectedFps: task.plan.settings?.fps ?? fallbackFps,
        hardwareEncoding: task.plan.settings?.hardwareEncoding,
        queueDepth,
      });
      recording.exportSpeed.push({
        timestampMs: now,
        taskId: task.id,
        progress: task.progress,
        ...speed,
      });
    }
    recording.exportProgressByTaskId.set(task.id, { timestampMs: now, progress: task.progress });
  }
}

export function createProfilerTraceEventsForFrame(sample: ProfilerFrameSample): ProfilerTraceEvent[] {
  const frameStart = Math.max(0, sample.timestampMs - sample.render.totalMs);
  let cursor = frameStart;
  const passes: Array<{ name: string; category: string; durationMs: number; depth: number }> = [
    { name: 'composite', category: 'composite', durationMs: sample.render.compositeMs, depth: 1 },
    { name: 'color', category: 'color', durationMs: sample.render.colorMs, depth: 1 },
    {
      name: sample.reason.includes('custom-shader') ? 'custom-shader' : 'effects',
      category: 'effects',
      durationMs: sample.render.effectsMs,
      depth: 1,
    },
    { name: 'overlay', category: 'overlay', durationMs: sample.render.overlayMs, depth: 1 },
  ];
  const events: ProfilerTraceEvent[] = [
    {
      id: `frame-${sample.frameIndex}`,
      name: `frame ${sample.frameIndex}`,
      category: 'preview',
      startMs: frameStart,
      durationMs: sample.render.totalMs,
      depth: 0,
    },
  ];
  for (const pass of passes) {
    events.push({
      id: `frame-${sample.frameIndex}-${pass.name}`,
      name: pass.name,
      category: pass.category,
      startMs: cursor,
      durationMs: pass.durationMs,
      depth: pass.depth,
    });
    cursor += pass.durationMs;
  }
  return events;
}

export function readBrowserJsHeapBytes(): number {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
  return Number.isFinite(memory?.usedJSHeapSize ?? NaN) ? Math.max(0, memory?.usedJSHeapSize ?? 0) : 0;
}

export function estimateUndoHistoryBytes(historyMeta: { entries: unknown[]; total: number }): number {
  try {
    return Math.max(0, JSON.stringify(historyMeta.entries).length * 2 + historyMeta.total * 256);
  } catch {
    return Math.max(0, historyMeta.total * 256);
  }
}
