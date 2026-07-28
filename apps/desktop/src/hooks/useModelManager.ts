import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/** A single file within a local model directory */
export interface LocalModelFile {
  filename: string;
  size: number;
}

/** Status of a locally downloaded model */
export interface LocalModelInfo {
  repoId: string;
  path: string;
  files: LocalModelFile[];
  totalSize: number;
}

/** Metadata for a remote model on HuggingFace */
export interface RemoteModelInfo {
  repoId: string;
  files: Array<{ filename: string; size: number; url: string }>;
  totalSize: number;
}

/** Download progress event from backend */
export interface ModelDownloadProgressPayload {
  repoId: string;
  filename: string;
  fileIndex: number;
  totalFiles: number;
  bytesDownloaded: number;
  totalBytes: number;
  overallProgress: number;
}

/** Completion event from backend */
export interface ModelDownloadCompletedPayload {
  repoId: string;
  path: string;
  totalSize: number;
}

/** State for the model manager hook */
export interface ModelManagerState {
  localModels: LocalModelInfo[];
  remoteModels: RemoteModelInfo[];
  totalLocalSize: number;
  isLoading: boolean;
  downloadingRepoId: string | null;
  downloadProgress: number;
  downloadFilename: string;
  error: string | null;
}

const INITIAL_STATE: ModelManagerState = {
  localModels: [],
  remoteModels: [],
  totalLocalSize: 0,
  isLoading: false,
  downloadingRepoId: null,
  downloadProgress: 0,
  downloadFilename: '',
  error: null,
};

/**
 * Hook for managing LTX-Video model downloads and local storage.
 */
export function useModelManager() {
  const [state, setState] = useState<ModelManagerState>(INITIAL_STATE);

  // Listen for download progress events
  useEffect(() => {
    const unlistenProgress = listen<ModelDownloadProgressPayload>(
      'model-download-progress',
      (event) => {
        const { overallProgress, filename } = event.payload;
        setState((prev) => ({
          ...prev,
          downloadProgress: overallProgress,
          downloadFilename: filename,
        }));
      },
    );

    const unlistenCompleted = listen<ModelDownloadCompletedPayload>(
      'model-download-completed',
      (_event) => {
        setState((prev) => ({
          ...prev,
          downloadingRepoId: null,
          downloadProgress: 1,
          downloadFilename: '',
        }));
        // Reload local models after download
        void loadLocalModels();
      },
    );

    return () => {
      void unlistenProgress.then((fn) => fn());
      void unlistenCompleted.then((fn) => fn());
    };
  }, []);

  const loadLocalModels = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await invoke<{
        models: LocalModelInfo[];
        totalSize: number;
      }>('list_local_models');
      setState((prev) => ({
        ...prev,
        localModels: response.models,
        totalLocalSize: response.totalSize,
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  const loadRemoteModels = useCallback(async () => {
    try {
      const response = await invoke<{ models: RemoteModelInfo[] }>(
        'list_remote_models',
      );
      setState((prev) => ({
        ...prev,
        remoteModels: response.models,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({ ...prev, error: message }));
    }
  }, []);

  const downloadModel = useCallback(async (repoId: string) => {
    setState((prev) => ({
      ...prev,
      downloadingRepoId: repoId,
      downloadProgress: 0,
      downloadFilename: '',
      error: null,
    }));

    try {
      await invoke('download_model', {
        request: { repoId },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({
        ...prev,
        downloadingRepoId: null,
        downloadProgress: 0,
        error: message,
      }));
    }
  }, []);

  const deleteModel = useCallback(
    async (repoId: string) => {
      try {
        await invoke('delete_model', { repoId });
        await loadLocalModels();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({ ...prev, error: message }));
      }
    },
    [loadLocalModels],
  );

  const isModelDownloaded = useCallback(
    (repoId: string) => {
      return state.localModels.some((m) => m.repoId === repoId);
    },
    [state.localModels],
  );

  const isDownloading = state.downloadingRepoId !== null;

  return {
    state,
    loadLocalModels,
    loadRemoteModels,
    downloadModel,
    deleteModel,
    isModelDownloaded,
    isDownloading,
  };
}
