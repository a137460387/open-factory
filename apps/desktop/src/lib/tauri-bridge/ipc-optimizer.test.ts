/**
 * IPC Optimizer Tests
 *
 * Tests the binary invoke wrappers, payload estimation,
 * serialization, and batched invoke logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import {
  invokeBinary,
  invokeBinaryResponse,
  invokeWithBinaryPayload,
  invokeBatched,
  invokeStreamed,
  transferWaveformBinary,
  transferThumbnailBinary,
  transferSpectrumBinary,
} from './ipc-optimizer';

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockInvoke.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ==================== invokeBinary ====================

describe('invokeBinary', () => {
  it('uses standard invoke for small payloads', async () => {
    mockInvoke.mockResolvedValueOnce('ok');
    const result = await invokeBinary('test_cmd', { key: 'value' });
    expect(result).toBe('ok');
    expect(mockInvoke).toHaveBeenCalledWith('test_cmd', { key: 'value' });
  });

  it('uses binary transfer when forceBinary is true', async () => {
    mockInvoke.mockResolvedValueOnce('binary_ok');
    const data = new Uint8Array([1, 2, 3]);
    await invokeBinary('test_cmd', { data }, { forceBinary: true });
    expect(mockInvoke).toHaveBeenCalledWith('test_cmd', { data: [1, 2, 3] });
  });

  it('uses binary transfer for large payloads above threshold', async () => {
    mockInvoke.mockResolvedValueOnce('ok');
    // Create a string payload > 1024 bytes (512 chars * 2 bytes = 1024)
    const largeString = 'x'.repeat(600);
    await invokeBinary('test_cmd', { data: largeString });
    // Should use standard invoke since string size estimation is char*2
    // 600 * 2 = 1200 > 1024 threshold
    expect(mockInvoke).toHaveBeenCalledWith('test_cmd', { data: largeString });
  });

  it('calls invoke with empty args when no args provided', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invokeBinary('test_cmd');
    expect(mockInvoke).toHaveBeenCalledWith('test_cmd', undefined);
  });

  it('converts ArrayBuffer to number array in binary mode', async () => {
    mockInvoke.mockResolvedValueOnce('ok');
    const buffer = new ArrayBuffer(4);
    const view = new Uint8Array(buffer);
    view[0] = 10;
    view[1] = 20;
    view[2] = 30;
    view[3] = 40;
    await invokeBinary('test_cmd', { buffer }, { forceBinary: true });
    expect(mockInvoke).toHaveBeenCalledWith('test_cmd', { buffer: [10, 20, 30, 40] });
  });
});

// ==================== invokeBinaryResponse ====================

describe('invokeBinaryResponse', () => {
  it('converts array response to Uint8Array', async () => {
    mockInvoke.mockResolvedValueOnce([1, 2, 3, 4]);
    const result = await invokeBinaryResponse('test_cmd');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result as Uint8Array)).toEqual([1, 2, 3, 4]);
  });

  it('passes through non-array responses', async () => {
    const buffer = new ArrayBuffer(4);
    mockInvoke.mockResolvedValueOnce(buffer);
    const result = await invokeBinaryResponse('test_cmd');
    expect(result).toBe(buffer);
  });

  it('passes args and signal to invoke', async () => {
    mockInvoke.mockResolvedValueOnce([0]);
    const controller = new AbortController();
    await invokeBinaryResponse('test_cmd', { path: '/test' }, controller.signal);
    expect(mockInvoke).toHaveBeenCalledWith('test_cmd', { path: '/test' });
  });
});

// ==================== invokeWithBinaryPayload ====================

describe('invokeWithBinaryPayload', () => {
  it('converts Uint8Array payload to number array', async () => {
    mockInvoke.mockResolvedValueOnce('ok');
    const payload = new Uint8Array([10, 20, 30]);
    await invokeWithBinaryPayload('test_cmd', payload, { format: 'raw' });
    expect(mockInvoke).toHaveBeenCalledWith('test_cmd', {
      format: 'raw',
      _binary_payload: [10, 20, 30],
      _binary_length: 3,
    });
  });

  it('converts ArrayBuffer payload to number array', async () => {
    mockInvoke.mockResolvedValueOnce('ok');
    const buffer = new ArrayBuffer(2);
    new Uint8Array(buffer)[0] = 0xff;
    new Uint8Array(buffer)[1] = 0xfe;
    await invokeWithBinaryPayload('test_cmd', new Uint8Array(buffer));
    expect(mockInvoke).toHaveBeenCalledWith('test_cmd', {
      _binary_payload: [255, 254],
      _binary_length: 2,
    });
  });

  it('works without metadata', async () => {
    mockInvoke.mockResolvedValueOnce('ok');
    await invokeWithBinaryPayload('test_cmd', new Uint8Array([1]));
    expect(mockInvoke).toHaveBeenCalledWith('test_cmd', {
      _binary_payload: [1],
      _binary_length: 1,
    });
  });
});

// ==================== invokeBatched ====================

describe('invokeBatched', () => {
  it('batches multiple invokes into parallel execution', async () => {
    mockInvoke.mockResolvedValueOnce('a');
    mockInvoke.mockResolvedValueOnce('b');

    const p1 = invokeBatched('cmd1', { id: 1 });
    const p2 = invokeBatched('cmd2', { id: 2 });

    // Advance timer to trigger batch flush
    vi.advanceTimersByTime(10);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('a');
    expect(r2).toBe('b');
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('resolves single-item batch directly', async () => {
    mockInvoke.mockResolvedValueOnce('single');

    const p = invokeBatched('cmd', { id: 1 });
    vi.advanceTimersByTime(10);

    const result = await p;
    expect(result).toBe('single');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('rejects when invoke fails', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('IPC failed'));

    const p = invokeBatched('cmd', { id: 1 });
    vi.advanceTimersByTime(10);

    await expect(p).rejects.toThrow('IPC failed');
  });
});

// ==================== transferWaveformBinary ====================

describe('transferWaveformBinary', () => {
  it('returns Float32Array from invoke response', async () => {
    mockInvoke.mockResolvedValueOnce([0.1, 0.2, 0.3]);
    const result = await transferWaveformBinary('analyze_waveform', { path: '/audio.wav' });
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(3);
    expect(result[0]).toBeCloseTo(0.1, 5);
    expect(result[1]).toBeCloseTo(0.2, 5);
    expect(result[2]).toBeCloseTo(0.3, 5);
  });
});

// ==================== transferThumbnailBinary ====================

describe('transferThumbnailBinary', () => {
  it('returns Uint8Array from invoke response', async () => {
    mockInvoke.mockResolvedValueOnce([255, 216, 255]);
    const result = await transferThumbnailBinary('get_thumbnail', { path: '/thumb.jpg' });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([255, 216, 255]);
  });
});

// ==================== transferSpectrumBinary ====================

describe('transferSpectrumBinary', () => {
  it('returns Float32Array from invoke response', async () => {
    mockInvoke.mockResolvedValueOnce([10.5, 20.3, 30.1]);
    const result = await transferSpectrumBinary('get_spectrum', { path: '/audio.wav' });
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(3);
    expect(result[0]).toBeCloseTo(10.5, 5);
    expect(result[1]).toBeCloseTo(20.3, 5);
    expect(result[2]).toBeCloseTo(30.1, 5);
  });
});
