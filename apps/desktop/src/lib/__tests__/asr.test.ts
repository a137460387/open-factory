import { describe, it, expect, vi } from 'vitest';
import { createAsrEngine, WhisperRsEngine } from '../asr';

describe('ASR Engine', () => {
  describe('createAsrEngine', () => {
    it('should create whisper-rs engine', () => {
      const engine = createAsrEngine('whisper-rs', {
        whisperRsModelPath: '/path/to/model',
        whisperCppExecutablePath: '',
        whisperCppModelPath: '',
      });
      expect(engine).toBeInstanceOf(WhisperRsEngine);
      expect(engine.name).toBe('whisper-rs');
    });

    it('should throw for unsupported engine', () => {
      expect(() =>
        createAsrEngine('unsupported', {
          whisperRsModelPath: '',
          whisperCppExecutablePath: '',
          whisperCppModelPath: '',
        })
      ).toThrow('不支持的 ASR 引擎: unsupported');
    });
  });

  describe('WhisperRsEngine', () => {
    it('should have correct name', () => {
      const engine = new WhisperRsEngine('/path/to/model');
      expect(engine.name).toBe('whisper-rs');
    });

    it('should check availability', async () => {
      const engine = new WhisperRsEngine('/path/to/model');
      // Mock fsExists
      vi.mock('../../lib/tauri-bridge', () => ({
        fsExists: vi.fn().mockResolvedValue(true),
      }));
      const available = await engine.isAvailable();
      expect(available).toBe(true);
    });

    it('should handle unavailable model', async () => {
      const engine = new WhisperRsEngine('/nonexistent/path');
      vi.mock('../../lib/tauri-bridge', () => ({
        fsExists: vi.fn().mockResolvedValue(false),
      }));
      const available = await engine.isAvailable();
      expect(available).toBe(false);
    });
  });
});
