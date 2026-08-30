import { useState, useCallback, useEffect } from 'react';
import type { VideoPreset } from '../lib/video-presets';
import { BUILT_IN_PRESETS } from '../lib/video-presets';
import { savePreset, getUserPresets, deletePreset } from '../lib/generation-history-db';

interface PresetState {
  presets: VideoPreset[];
  isLoading: boolean;
}

/**
 * Hook for managing video generation presets.
 * Combines built-in presets with user-created presets from IndexedDB.
 */
export function usePresets() {
  const [state, setState] = useState<PresetState>({
    presets: BUILT_IN_PRESETS,
    isLoading: true,
  });

  const loadPresets = useCallback(async () => {
    try {
      const userPresets = await getUserPresets();
      setState({
        presets: [...BUILT_IN_PRESETS, ...userPresets],
        isLoading: false,
      });
    } catch {
      setState({ presets: BUILT_IN_PRESETS, isLoading: false });
    }
  }, []);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  const createPreset = useCallback(async (name: string, params: VideoPreset['params']): Promise<VideoPreset> => {
    const preset: VideoPreset = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      params,
      isBuiltIn: false,
      createdAt: Date.now(),
    };
    await savePreset(preset);
    setState((prev) => ({
      ...prev,
      presets: [...prev.presets, preset],
    }));
    return preset;
  }, []);

  const removePreset = useCallback(async (id: string) => {
    await deletePreset(id);
    setState((prev) => ({
      ...prev,
      presets: prev.presets.filter((p) => p.id !== id),
    }));
  }, []);

  return {
    presets: state.presets,
    isLoading: state.isLoading,
    createPreset,
    removePreset,
    reload: loadPresets,
  };
}
