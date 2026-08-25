import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  backgroundMediaPool,
  defaultBackgroundPoolLimit,
  uiFeedbackPool,
  UI_FEEDBACK_POOL_LIMIT,
} from '../media/media-concurrency';
import { resolveBackgroundConcurrency, useMediaJobSettingsStore } from './mediaJobSettingsStore';

const STORAGE_KEY = 'open-factory:media-job-settings';

describe('mediaJobSettingsStore', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    } as Storage);
    useMediaJobSettingsStore.setState({
      backgroundConcurrency: 'auto',
      uiFeedbackConcurrency: 3,
      paused: false,
      autoGenerateWaveform: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    backgroundMediaPool.setLimit(defaultBackgroundPoolLimit());
    uiFeedbackPool.setLimit(UI_FEEDBACK_POOL_LIMIT);
  });

  it('setBackgroundConcurrency updates state and persists', () => {
    useMediaJobSettingsStore.getState().setBackgroundConcurrency(2);
    expect(useMediaJobSettingsStore.getState().backgroundConcurrency).toBe(2);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').backgroundConcurrency).toBe(2);
  });

  it('setBackgroundConcurrency applies the limit to the background pool', () => {
    useMediaJobSettingsStore.getState().setBackgroundConcurrency(2);
    expect(backgroundMediaPool.limit).toBe(2);
  });

  it('setPaused toggles and persists', () => {
    useMediaJobSettingsStore.getState().setPaused(true);
    expect(useMediaJobSettingsStore.getState().paused).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').paused).toBe(true);
  });

  it('reset restores defaults', () => {
    useMediaJobSettingsStore.getState().setBackgroundConcurrency(4);
    useMediaJobSettingsStore.getState().setPaused(true);
    useMediaJobSettingsStore.getState().setAutoGenerateWaveform(false);
    useMediaJobSettingsStore.getState().reset();
    expect(useMediaJobSettingsStore.getState().backgroundConcurrency).toBe('auto');
    expect(useMediaJobSettingsStore.getState().paused).toBe(false);
    expect(useMediaJobSettingsStore.getState().uiFeedbackConcurrency).toBe(3);
    expect(useMediaJobSettingsStore.getState().autoGenerateWaveform).toBe(true);
  });

  it('setAutoGenerateWaveform toggles and persists', () => {
    useMediaJobSettingsStore.getState().setAutoGenerateWaveform(false);
    expect(useMediaJobSettingsStore.getState().autoGenerateWaveform).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').autoGenerateWaveform).toBe(false);
  });

  it('resolveBackgroundConcurrency maps auto and passes through numbers', () => {
    expect(resolveBackgroundConcurrency('auto')).toBeGreaterThanOrEqual(1);
    expect(resolveBackgroundConcurrency('auto')).toBeLessThanOrEqual(4);
    expect(resolveBackgroundConcurrency(1)).toBe(1);
    expect(resolveBackgroundConcurrency(4)).toBe(4);
  });
});
