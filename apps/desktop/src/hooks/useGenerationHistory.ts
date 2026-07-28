import { useState, useCallback, useEffect } from 'react';
import {
  saveGenerationEntry,
  getGenerationHistory,
  deleteGenerationEntry,
  clearGenerationHistory,
  type GenerationHistoryEntry,
} from '../lib/generation-history-db';

/** State for the generation history hook */
export interface GenerationHistoryState {
  entries: GenerationHistoryEntry[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for managing generation history stored in IndexedDB.
 */
export function useGenerationHistory() {
  const [state, setState] = useState<GenerationHistoryState>({
    entries: [],
    isLoading: true,
    error: null,
  });

  const loadHistory = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const entries = await getGenerationHistory();
      setState({ entries, isLoading: false, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const saveEntry = useCallback(
    async (entry: GenerationHistoryEntry) => {
      try {
        await saveGenerationEntry(entry);
        await loadHistory();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({ ...prev, error: message }));
      }
    },
    [loadHistory],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      try {
        await deleteGenerationEntry(id);
        await loadHistory();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({ ...prev, error: message }));
      }
    },
    [loadHistory],
  );

  const clearAll = useCallback(async () => {
    try {
      await clearGenerationHistory();
      setState({ entries: [], isLoading: false, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({ ...prev, error: message }));
    }
  }, []);

  return {
    state,
    saveEntry,
    deleteEntry,
    clearAll,
    reload: loadHistory,
  };
}
