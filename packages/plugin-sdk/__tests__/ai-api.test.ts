import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginAIAPIImpl } from '../src/api/ai-api';

describe('PluginAIAPIImpl', () => {
  let api: PluginAIAPIImpl;

  beforeEach(() => {
    api = new PluginAIAPIImpl();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('submitTask', () => {
    it('returns task id', async () => {
      const id = await api.submitTask({ type: 'transcription', input: '/audio.wav' });
      expect(id).toMatch(/^ai-task-/);
    });

    it('assigns unique ids', async () => {
      const id1 = await api.submitTask({ type: 'transcription', input: 'a' });
      const id2 = await api.submitTask({ type: 'tts', input: 'b' });
      expect(id1).not.toBe(id2);
    });
  });

  describe('getTaskStatus', () => {
    it('returns pending status initially', async () => {
      const id = await api.submitTask({ type: 'transcription', input: 'a' });
      const status = await api.getTaskStatus(id);
      expect(status.status).toBe('pending');
      expect(status.progress).toBe(0);
    });

    it('throws for unknown task', async () => {
      await expect(api.getTaskStatus('missing')).rejects.toThrow('not found');
    });
  });

  describe('cancelTask', () => {
    it('cancels a pending task', async () => {
      const id = await api.submitTask({ type: 'transcription', input: 'a' });
      await api.cancelTask(id);
      const status = await api.getTaskStatus(id);
      expect(status.status).toBe('cancelled');
    });

    it('throws for unknown task', async () => {
      await expect(api.cancelTask('missing')).rejects.toThrow('not found');
    });
  });

  describe('awaitTask', () => {
    it('throws for unknown task', async () => {
      await expect(api.awaitTask('missing')).rejects.toThrow('not found');
    });

    it('returns result for cancelled task', async () => {
      const id = await api.submitTask({ type: 'transcription', input: 'a' });
      await api.cancelTask(id);
      const result = await api.awaitTask(id);
      expect(result.status).toBe('cancelled');
      expect(result.taskId).toBe(id);
    });
  });

  describe('listModels', () => {
    it('returns available models', async () => {
      const models = await api.listModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models[0]).toHaveProperty('id');
      expect(models[0]).toHaveProperty('name');
      expect(models[0]).toHaveProperty('type');
    });
  });
});
