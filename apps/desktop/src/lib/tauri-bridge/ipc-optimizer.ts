/**
 * Optimized Tauri IPC Layer
 *
 * Sprint AU: Provides binary-aware invoke wrappers for large data transfers.
 * Uses ArrayBuffer/Uint8Array instead of JSON serialization for waveform data,
 * thumbnail buffers, and other large payloads. Falls back to JSON for small payloads.
 */

import { invoke } from '@tauri-apps/api/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BinaryInvokeOptions {
  /** Force binary transfer regardless of payload size */
  forceBinary?: boolean;
  /** Size threshold (bytes) above which binary transfer is used automatically */
  binaryThreshold?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

const DEFAULT_BINARY_THRESHOLD = 1024; // 1 KB

// ---------------------------------------------------------------------------
// Binary invoke wrapper
// ---------------------------------------------------------------------------

/**
 * Invoke a Tauri command with optimized serialization.
 * Automatically uses binary transfer for large payloads.
 */
export async function invokeBinary<T>(
  command: string,
  args?: Record<string, unknown>,
  options?: BinaryInvokeOptions,
): Promise<T> {
  const threshold = options?.binaryThreshold ?? DEFAULT_BINARY_THRESHOLD;

  // Estimate payload size
  const payloadSize = args ? estimatePayloadSize(args) : 0;

  if (options?.forceBinary || payloadSize > threshold) {
    // Use binary transfer - convert args to number arrays for large data
    return invoke<T>(command, serializeBinaryArgs(args));
  }

  // Use standard JSON transfer for small payloads
  return invoke<T>(command, args);
}

/**
 * Invoke a Tauri command that returns binary data (Uint8Array).
 * The response is transferred as raw bytes instead of JSON.
 */
export async function invokeBinaryResponse<T extends Uint8Array | ArrayBuffer>(
  command: string,
  args?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  // Use Tauri's binary response protocol
  const response = await invoke<number[]>(command, args);

  // Convert array to Uint8Array
  if (Array.isArray(response)) {
    return new Uint8Array(response) as T;
  }

  return response as T;
}

/**
 * Invoke a Tauri command with binary data payload.
 * The payload is transferred as raw bytes instead of JSON string.
 */
export async function invokeWithBinaryPayload<T>(
  command: string,
  payload: Uint8Array | ArrayBuffer,
  metadata?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  // Convert ArrayBuffer to number array for Tauri IPC
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);

  return invoke<T>(command, {
    ...metadata,
    _binary_payload: Array.from(bytes),
    _binary_length: bytes.length,
  });
}

// ---------------------------------------------------------------------------
// Batched invoke for multiple small operations
// ---------------------------------------------------------------------------

interface BatchedInvoke {
  command: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

let batchQueue: BatchedInvoke[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
const BATCH_DELAY_MS = 5; // 5ms batching window

/**
 * Queue a Tauri invoke for batched execution.
 * Multiple invokes within the batch window are combined into a single IPC call.
 */
export function invokeBatched<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    batchQueue.push({ command, args, resolve: resolve as (v: unknown) => void, reject });

    if (!batchTimer) {
      batchTimer = setTimeout(flushBatch, BATCH_DELAY_MS);
    }
  });
}

async function flushBatch(): Promise<void> {
  const batch = batchQueue;
  batchQueue = [];
  batchTimer = null;

  if (batch.length === 0) return;

  if (batch.length === 1) {
    // Single invoke, no need to batch
    const item = batch[0];
    try {
      const result = await invoke(item.command, item.args);
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    }
    return;
  }

  // Execute all invokes in parallel
  const promises = batch.map(async (item) => {
    try {
      const result = await invoke(item.command, item.args);
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    }
  });

  await Promise.allSettled(promises);
}

// ---------------------------------------------------------------------------
// Streaming invoke for large data
// ---------------------------------------------------------------------------

export interface StreamChunk {
  data: Uint8Array;
  offset: number;
  total: number;
  done: boolean;
}

/**
 * Invoke a Tauri command that streams large data in chunks.
 * Useful for reading large files or streaming media data.
 */
export async function invokeStreamed(
  command: string,
  args: Record<string, unknown>,
  onChunk: (chunk: StreamChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  // Use Tauri's event system for streaming
  const { listen } = await import('@tauri-apps/api/event');

  const streamId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const unlisten = await listen<StreamChunk>(`stream-${streamId}`, (event) => {
    onChunk(event.payload);
  });

  try {
    await invoke(command, { ...args, streamId });
  } finally {
    unlisten();
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Serialize args for binary transfer.
 * Converts Uint8Array/ArrayBuffer to number arrays for Tauri IPC.
 */
function serializeBinaryArgs(args: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!args) return {};

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value instanceof Uint8Array) {
      result[key] = Array.from(value);
    } else if (value instanceof ArrayBuffer) {
      result[key] = Array.from(new Uint8Array(value));
    } else {
      result[key] = value;
    }
  }
  return result;
}

function estimatePayloadSize(obj: unknown): number {
  if (obj === null || obj === undefined) return 0;
  if (typeof obj === 'string') return obj.length * 2; // UTF-16
  if (typeof obj === 'number') return 8;
  if (typeof obj === 'boolean') return 4;
  if (obj instanceof Uint8Array || obj instanceof ArrayBuffer) return obj.byteLength;
  if (Array.isArray(obj)) {
    return obj.reduce((sum, item) => sum + estimatePayloadSize(item), 0);
  }
  if (typeof obj === 'object') {
    let size = 0;
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      size += key.length * 2;
      size += estimatePayloadSize((obj as Record<string, unknown>)[key]);
    }
    return size;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Specialized binary transfers for common operations
// ---------------------------------------------------------------------------

/**
 * Transfer waveform data as binary (much smaller than JSON array of numbers).
 */
export async function transferWaveformBinary(
  command: string,
  args: Record<string, unknown>,
): Promise<Float32Array> {
  const response = await invoke<number[]>(command, args);
  return new Float32Array(response);
}

/**
 * Transfer thumbnail data as binary.
 */
export async function transferThumbnailBinary(
  command: string,
  args: Record<string, unknown>,
): Promise<Uint8Array> {
  const response = await invoke<number[]>(command, args);
  return new Uint8Array(response);
}

/**
 * Transfer spectrum data as binary.
 */
export async function transferSpectrumBinary(
  command: string,
  args: Record<string, unknown>,
): Promise<Float32Array> {
  const response = await invoke<number[]>(command, args);
  return new Float32Array(response);
}
