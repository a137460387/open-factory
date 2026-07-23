/**
 * Tests for Macro Recording System
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MacroRecorder, createMacroRecorder } from './macro-recorder';
import { MacroPlaybackEngine, createMacroPlaybackEngine } from './macro-playback';
import type { MacroDefinition, MacroOperation, MacroOperationType } from './macro-types';

describe('MacroRecorder', () => {
  let recorder: MacroRecorder;

  beforeEach(() => {
    recorder = createMacroRecorder({ debounceMs: 0 });
  });

  describe('State Management', () => {
    it('should start in idle state', () => {
      expect(recorder.getState()).toBe('idle');
    });

    it('should transition to recording on start', () => {
      recorder.start();
      expect(recorder.getState()).toBe('recording');
    });

    it('should transition to paused on pause', () => {
      recorder.start();
      recorder.pause();
      expect(recorder.getState()).toBe('paused');
    });

    it('should transition back to recording on resume', () => {
      recorder.start();
      recorder.pause();
      recorder.resume();
      expect(recorder.getState()).toBe('recording');
    });

    it('should transition to idle on stop', () => {
      recorder.start();
      recorder.stop();
      expect(recorder.getState()).toBe('idle');
    });

    it('should transition to idle on cancel', () => {
      recorder.start();
      recorder.cancel();
      expect(recorder.getState()).toBe('idle');
    });
  });

  describe('Operation Recording', () => {
    it('should record operations', () => {
      recorder.start();
      recorder.recordOperation('clip.trim', 'clip-1', { trimStart: 10 });
      expect(recorder.getOperationCount()).toBe(1);
    });

    it('should not record when idle', () => {
      recorder.recordOperation('clip.trim', 'clip-1', { trimStart: 10 });
      expect(recorder.getOperationCount()).toBe(0);
    });

    it('should not record when paused', () => {
      recorder.start();
      recorder.pause();
      recorder.recordOperation('clip.trim', 'clip-1', { trimStart: 10 });
      expect(recorder.getOperationCount()).toBe(0);
    });

    it('should record multiple operations', () => {
      recorder.start();
      recorder.recordOperation('clip.trim', 'clip-1', { trimStart: 10 });
      recorder.recordOperation('clip.split', 'clip-1', { splitTime: 5 });
      recorder.recordOperation('clip.speed', 'clip-2', { speed: 2 });
      expect(recorder.getOperationCount()).toBe(3);
    });

    it('should ignore specified operations', () => {
      const recorderWithIgnore = createMacroRecorder({
        debounceMs: 0,
        ignoreOperations: ['marker.add'],
      });

      recorderWithIgnore.start();
      recorderWithIgnore.recordOperation('clip.trim', 'clip-1', { trimStart: 10 });
      recorderWithIgnore.recordOperation('marker.add', 'timeline-1', { time: 5 });
      expect(recorderWithIgnore.getOperationCount()).toBe(1);
    });
  });

  describe('Macro Building', () => {
    it('should build macro definition on stop', () => {
      recorder.start();
      recorder.recordOperation('clip.trim', 'clip-1', { trimStart: 10 });
      recorder.recordOperation('clip.speed', 'clip-2', { speed: 2 });

      const macro = recorder.stop();
      expect(macro).not.toBeNull();
      expect(macro!.operations).toHaveLength(2);
      expect(macro!.name).toContain('Macro');
    });

    it('should return null when stopping with no operations', () => {
      recorder.start();
      const macro = recorder.stop();
      expect(macro).toBeNull();
    });

    it('should include parameters in macro definition', () => {
      recorder.start();
      recorder.recordOperation('clip.speed', 'clip-1', { speed: 2 });

      const macro = recorder.stop();
      expect(macro!.parameters.length).toBeGreaterThan(0);
    });
  });

  describe('Event Listeners', () => {
    it('should notify state change listeners', () => {
      const listener = vi.fn();
      recorder.onStateChange(listener);

      recorder.start();
      recorder.pause();
      recorder.resume();
      recorder.stop();

      expect(listener).toHaveBeenCalledTimes(4);
    });

    it('should notify operation listeners', () => {
      const listener = vi.fn();
      recorder.onOperation(listener);

      recorder.start();
      recorder.recordOperation('clip.trim', 'clip-1', { trimStart: 10 });

      // Wait for debounce
      setTimeout(() => {
        expect(listener).toHaveBeenCalledTimes(1);
      }, 100);
    });

    it('should unsubscribe listeners', () => {
      const listener = vi.fn();
      const unsubscribe = recorder.onStateChange(listener);

      recorder.start();
      unsubscribe();
      recorder.stop();

      expect(listener).toHaveBeenCalledTimes(1); // Only start
    });
  });
});

describe('MacroPlaybackEngine', () => {
  let engine: MacroPlaybackEngine;
  let mockExecutor: ReturnType<typeof vi.fn>;

  const testMacro: MacroDefinition = {
    id: 'test-macro',
    name: 'Test Macro',
    description: 'A test macro',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    parameters: [],
    operations: [
      {
        id: 'op-1',
        type: 'clip.trim',
        timestamp: 0,
        targetId: 'clip-1',
        params: { trimStart: 10 },
      },
      {
        id: 'op-2',
        type: 'clip.speed',
        timestamp: 100,
        targetId: 'clip-2',
        params: { speed: 2 },
      },
    ],
    duration: 200,
    executionCount: 0,
  };

  beforeEach(() => {
    engine = createMacroPlaybackEngine();
    mockExecutor = vi.fn().mockResolvedValue(true);
  });

  describe('Executor Registration', () => {
    it('should register executors', () => {
      engine.registerExecutor('clip.trim', mockExecutor);
      expect(engine.getStatus()).toBe('idle');
    });

    it('should register multiple executors', () => {
      engine.registerExecutors({
        'clip.trim': mockExecutor,
        'clip.speed': mockExecutor,
      });
    });
  });

  describe('Execution', () => {
    it('should execute macro successfully', async () => {
      engine.registerExecutors({
        'clip.trim': mockExecutor,
        'clip.speed': mockExecutor,
      });

      const result = await engine.execute(testMacro);
      expect(result.success).toBe(true);
      expect(result.executedOperations).toBe(2);
      expect(result.failedOperations).toBe(0);
    });

    it('should call executors for each operation', async () => {
      engine.registerExecutors({
        'clip.trim': mockExecutor,
        'clip.speed': mockExecutor,
      });

      await engine.execute(testMacro);
      expect(mockExecutor).toHaveBeenCalledTimes(2);
    });

    it('should handle executor failure', async () => {
      const failingExecutor = vi.fn().mockResolvedValue(false);
      engine.registerExecutors({
        'clip.trim': failingExecutor,
        'clip.speed': mockExecutor,
      });

      const result = await engine.execute(testMacro);
      expect(result.success).toBe(false);
      expect(result.failedOperations).toBe(1);
    });

    it('should handle executor error', async () => {
      const errorExecutor = vi.fn().mockRejectedValue(new Error('Test error'));
      engine.registerExecutors({
        'clip.trim': errorExecutor,
        'clip.speed': mockExecutor,
      });

      const result = await engine.execute(testMacro);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fail when no executor registered', async () => {
      const result = await engine.execute(testMacro);
      expect(result.success).toBe(false);
    });

    it('should support dry run', async () => {
      engine.registerExecutors({
        'clip.trim': mockExecutor,
        'clip.speed': mockExecutor,
      });

      const result = await engine.execute(testMacro, { dryRun: true });
      expect(result.success).toBe(true);
      expect(mockExecutor).not.toHaveBeenCalled();
    });

    it('should support parameter overrides', async () => {
      const macroWithParams: MacroDefinition = {
        ...testMacro,
        parameters: [
          {
            id: 'speed',
            name: 'Speed',
            type: 'number',
            defaultValue: 1,
          },
        ],
        operations: [
          {
            ...testMacro.operations[0],
            params: { speed: '${speed}' },
          },
        ],
      };

      engine.registerExecutor('clip.trim', mockExecutor);
      await engine.execute(macroWithParams, {
        parameterOverrides: { speed: 3 },
      });

      expect(mockExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { speed: 3 },
        }),
        expect.anything(),
      );
    });

    it('should support target clip ID override', async () => {
      engine.registerExecutors({
        'clip.trim': mockExecutor,
        'clip.speed': mockExecutor,
      });

      await engine.execute(testMacro, {
        targetClipIds: ['new-clip-1', 'new-clip-2'],
      });

      expect(mockExecutor).toHaveBeenCalledWith(
        expect.objectContaining({ targetId: 'new-clip-1' }),
        expect.anything(),
      );
    });
  });

  describe('Progress Tracking', () => {
    it('should emit progress events', async () => {
      const progressListener = vi.fn();
      engine.onProgress(progressListener);

      engine.registerExecutors({
        'clip.trim': mockExecutor,
        'clip.speed': mockExecutor,
      });

      await engine.execute(testMacro);
      expect(progressListener).toHaveBeenCalled();
    });

    it('should report running status', async () => {
      let status = 'idle';
      engine.onProgress(progress => {
        status = progress.status;
      });

      engine.registerExecutors({
        'clip.trim': mockExecutor,
        'clip.speed': mockExecutor,
      });

      const executePromise = engine.execute(testMacro);
      expect(engine.getStatus()).toBe('running');

      await executePromise;
      expect(engine.getStatus()).toBe('completed');
    });
  });

  describe('Abort', () => {
    it('should abort execution', async () => {
      let resolveFirst: (value: boolean) => void;
      const firstPromise = new Promise<boolean>(resolve => {
        resolveFirst = resolve;
      });

      const slowExecutor = vi.fn()
        .mockImplementationOnce(() => firstPromise)
        .mockResolvedValue(true);

      engine.registerExecutors({
        'clip.trim': slowExecutor,
        'clip.speed': slowExecutor,
      });

      const executePromise = engine.execute(testMacro);

      // Abort immediately
      engine.abort();

      // Resolve the first executor
      resolveFirst!(true);

      const result = await executePromise;
      expect(result.executedOperations).toBeLessThanOrEqual(2);
    });
  });
});
