import type { Clip, ClipPatch, TimelineScriptExecutionPlan, TimelineScriptOperation, TimelineScriptSnapshot } from '@open-factory/editor-core';

export const TIMELINE_SCRIPT_TIMEOUT_MS = 10_000;
export const TIMELINE_SCRIPT_DISABLED_GLOBALS = ['fetch', 'XMLHttpRequest'] as const;

export interface TimelineScriptRunRequest {
  script: string;
  snapshot: TimelineScriptSnapshot;
  timeoutMs?: number;
}

export type TimelineScriptRunResult = TimelineScriptExecutionPlan;

interface TimelineScriptWorkerMessage {
  ok: boolean;
  result?: TimelineScriptRunResult;
  error?: string;
}

export interface TimelineScriptWorkerLike {
  onmessage: ((event: MessageEvent<TimelineScriptWorkerMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: TimelineScriptRunRequest): void;
  terminate(): void;
}

interface TimelineScriptWorkerConstructor {
  new (url: string): TimelineScriptWorkerLike;
}

interface TimelineScriptWorkerDependencies {
  WorkerCtor?: TimelineScriptWorkerConstructor;
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
}

export async function runTimelineScriptInWorker(request: TimelineScriptRunRequest, dependencies: TimelineScriptWorkerDependencies = {}): Promise<TimelineScriptRunResult> {
  const WorkerCtor = dependencies.WorkerCtor ?? (typeof Worker === 'undefined' ? undefined : Worker);
  if (!WorkerCtor) {
    return executeTimelineScriptInIsolatedScope(request.script, request.snapshot);
  }

  const createObjectUrl = dependencies.createObjectUrl ?? URL.createObjectURL.bind(URL);
  const revokeObjectUrl = dependencies.revokeObjectUrl ?? URL.revokeObjectURL.bind(URL);
  const url = createObjectUrl(new Blob([createTimelineScriptWorkerSource()], { type: 'text/javascript' }));
  const worker = new WorkerCtor(url);
  const timeoutMs = request.timeoutMs ?? TIMELINE_SCRIPT_TIMEOUT_MS;

  return new Promise<TimelineScriptRunResult>((resolve, reject) => {
    let settled = false;
    const settle = (handler: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      revokeObjectUrl(url);
      handler();
    };
    const timeout = setTimeout(() => {
      settle(() => reject(new Error(`Script timed out after ${Math.round(timeoutMs / 1000)}s`)));
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<TimelineScriptWorkerMessage>) => {
      const message = event.data;
      settle(() => {
        if (message.ok && message.result) {
          resolve(message.result);
          return;
        }
        reject(new Error(message.error ?? 'Script failed'));
      });
    };
    worker.onerror = (event: ErrorEvent) => {
      settle(() => reject(new Error(event.message || 'Script worker failed')));
    };
    worker.postMessage(request);
  });
}

export async function executeTimelineScriptInIsolatedScope(script: string, snapshot: TimelineScriptSnapshot): Promise<TimelineScriptRunResult> {
  const startedAt = Date.now();
  const state = createRuntimeState(snapshot);
  const api = createRuntimeApi(state);
  const sandboxGlobal = createSandboxGlobal();
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>;
  const run = new AsyncFunction(
    'getClips',
    'updateClip',
    'addClip',
    'deleteClip',
    'getMarkers',
    'addMarker',
    'exportProject',
    'console',
    'fetch',
    'XMLHttpRequest',
    'globalThis',
    'window',
    'self',
    '"use strict";\n' + script
  );
  await run(api.getClips, api.updateClip, api.addClip, api.deleteClip, api.getMarkers, api.addMarker, api.exportProject, api.console, undefined, undefined, sandboxGlobal, undefined, undefined);
  return {
    operations: state.operations,
    logs: state.logs,
    durationMs: Date.now() - startedAt
  };
}

export function createTimelineScriptWorkerSource(): string {
  return `(${timelineScriptWorkerEntrypoint.toString()})();`;
}

interface RuntimeState {
  clips: Array<Record<string, unknown>>;
  markers: Array<Record<string, unknown>>;
  operations: TimelineScriptOperation[];
  logs: string[];
  nextClipIndex: number;
  nextMarkerIndex: number;
}

function createRuntimeState(snapshot: TimelineScriptSnapshot): RuntimeState {
  return {
    clips: cloneJson(snapshot.clips) as unknown as Array<Record<string, unknown>>,
    markers: cloneJson(snapshot.markers) as unknown as Array<Record<string, unknown>>,
    operations: [],
    logs: [],
    nextClipIndex: 1,
    nextMarkerIndex: 1
  };
}

function createRuntimeApi(state: RuntimeState) {
  return {
    getClips: () => cloneJson(state.clips),
    updateClip: (id: unknown, patch: unknown) => {
      const clipId = requiredString(id, 'clip id');
      const normalizedPatch = record(patch, 'clip patch');
      state.operations.push({ type: 'updateClip', clipId, patch: normalizedPatch as ClipPatch });
      state.clips = state.clips.map((clip) => (clip.id === clipId ? { ...clip, ...normalizedPatch } : clip));
    },
    addClip: (opts: unknown) => {
      const input = record(opts, 'clip');
      const clip = {
        ...input,
        id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : `script-clip-${state.nextClipIndex++}`
      };
      state.operations.push({ type: 'addClip', clip: clip as Clip });
      state.clips.push(clip);
      return clip.id;
    },
    deleteClip: (id: unknown) => {
      const clipId = requiredString(id, 'clip id');
      state.operations.push({ type: 'deleteClip', clipId });
      state.clips = state.clips.filter((clip) => clip.id !== clipId);
    },
    getMarkers: () => cloneJson(state.markers),
    addMarker: (timeValue: unknown, labelValue?: unknown) => {
      const time = Number(timeValue);
      if (!Number.isFinite(time)) {
        throw new Error('Marker time must be finite');
      }
      const marker = {
        id: `script-marker-${state.nextMarkerIndex++}`,
        time,
        ...(typeof labelValue === 'string' ? { label: labelValue } : {})
      };
      state.operations.push({ type: 'addMarker', marker });
      state.markers.push(marker);
      return marker.id;
    },
    exportProject: (presetValue: unknown) => {
      state.operations.push({ type: 'exportProject', preset: requiredString(presetValue, 'export preset') });
    },
    console: {
      log: (...values: unknown[]) => {
        state.logs.push(values.map(formatLogValue).join(' '));
      }
    }
  };
}

function createSandboxGlobal(): Record<string, unknown> {
  return {
    console: undefined,
    fetch: undefined,
    XMLHttpRequest: undefined,
    WebSocket: undefined
  };
}

function timelineScriptWorkerEntrypoint() {
  const workerSelf = self as unknown as {
    onmessage: ((event: MessageEvent) => void) | null;
    postMessage(message: unknown): void;
    [key: string]: unknown;
  };
  const disabledGlobals = ['fetch', 'XMLHttpRequest', 'WebSocket'];
  for (const key of disabledGlobals) {
    try {
      Object.defineProperty(self, key, { value: undefined, configurable: false, writable: false });
    } catch {
      try {
        (workerSelf as unknown as Record<string, unknown>)[key] = undefined;
      } catch {
        // Ignore readonly globals in older engines.
      }
    }
  }

  workerSelf.onmessage = async (event: MessageEvent<{ script: string; snapshot: { clips: unknown[]; markers: unknown[] } }>) => {
    const startedAt = Date.now();
    const state = {
      clips: cloneJson(event.data.snapshot.clips),
      markers: cloneJson(event.data.snapshot.markers),
      operations: [] as unknown[],
      logs: [] as string[],
      nextClipIndex: 1,
      nextMarkerIndex: 1
    };
    const api = {
      getClips: () => cloneJson(state.clips),
      updateClip: (id: unknown, patch: unknown) => {
        const clipId = requiredString(id, 'clip id');
        const normalizedPatch = record(patch, 'clip patch');
        state.operations.push({ type: 'updateClip', clipId, patch: normalizedPatch });
        state.clips = state.clips.map((clip) => ((clip as { id?: unknown }).id === clipId ? { ...(clip as object), ...normalizedPatch } : clip));
      },
      addClip: (opts: unknown) => {
        const input = record(opts, 'clip');
        const clip = {
          ...input,
          id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : `script-clip-${state.nextClipIndex++}`
        };
        state.operations.push({ type: 'addClip', clip });
        state.clips.push(clip);
        return clip.id;
      },
      deleteClip: (id: unknown) => {
        const clipId = requiredString(id, 'clip id');
        state.operations.push({ type: 'deleteClip', clipId });
        state.clips = state.clips.filter((clip) => (clip as { id?: unknown }).id !== clipId);
      },
      getMarkers: () => cloneJson(state.markers),
      addMarker: (timeValue: unknown, labelValue?: unknown) => {
        const time = Number(timeValue);
        if (!Number.isFinite(time)) {
          throw new Error('Marker time must be finite');
        }
        const marker = {
          id: `script-marker-${state.nextMarkerIndex++}`,
          time,
          ...(typeof labelValue === 'string' ? { label: labelValue } : {})
        };
        state.operations.push({ type: 'addMarker', marker });
        state.markers.push(marker);
        return marker.id;
      },
      exportProject: (presetValue: unknown) => {
        state.operations.push({ type: 'exportProject', preset: requiredString(presetValue, 'export preset') });
      },
      console: {
        log: (...values: unknown[]) => {
          state.logs.push(values.map(formatLogValue).join(' '));
        }
      }
    };
    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const run = new AsyncFunction(
        'getClips',
        'updateClip',
        'addClip',
        'deleteClip',
        'getMarkers',
        'addMarker',
        'exportProject',
        'console',
        'fetch',
        'XMLHttpRequest',
        'globalThis',
        'window',
        'self',
        '"use strict";\n' + event.data.script
      );
      await run(api.getClips, api.updateClip, api.addClip, api.deleteClip, api.getMarkers, api.addMarker, api.exportProject, api.console, undefined, undefined, { fetch: undefined, XMLHttpRequest: undefined }, undefined, undefined);
      workerSelf.postMessage({
        ok: true,
        result: {
          operations: state.operations,
          logs: state.logs,
          durationMs: Date.now() - startedAt
        }
      });
    } catch (error) {
      workerSelf.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  };

  function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  function record(value: unknown, label: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Invalid ${label}`);
    }
    return cloneJson(value as Record<string, unknown>);
  }

  function requiredString(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Invalid ${label}`);
    }
    return value.trim();
  }

  function formatLogValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (value instanceof Error) {
      return value.message;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return cloneJson(value as Record<string, unknown>);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid ${label}`);
  }
  return value.trim();
}

function formatLogValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
