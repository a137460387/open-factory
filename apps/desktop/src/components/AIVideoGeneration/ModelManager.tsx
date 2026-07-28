import React, { useEffect } from 'react';
import {
  Download,
  Trash2,
  HardDrive,
  Loader2,
  CheckCircle,
  AlertCircle,
  Package,
  RefreshCcw,
} from 'lucide-react';
import { useModelManager, type LocalModelInfo } from '../../hooks/useModelManager';

/** ModelManager props */
export interface ModelManagerProps {
  /** Callback when a model is selected */
  onModelSelect?: (repoId: string) => void;
}

/** Format bytes to human-readable string */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

/**
 * Model management panel for LTX-Video models.
 * Shows available/installed models, download progress, and disk usage.
 */
export function ModelManager({ onModelSelect }: ModelManagerProps) {
  const {
    state,
    loadLocalModels,
    loadRemoteModels,
    downloadModel,
    deleteModel,
    isModelDownloaded,
    isDownloading,
  } = useModelManager();

  useEffect(() => {
    void loadLocalModels();
    void loadRemoteModels();
  }, [loadLocalModels, loadRemoteModels]);

  const handleDownload = async (repoId: string) => {
    await downloadModel(repoId);
  };

  const handleDelete = async (repoId: string) => {
    if (window.confirm(`Delete model "${repoId}"? This will free disk space.`)) {
      await deleteModel(repoId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-semibold">Model Manager</h2>
        </div>
        <button
          onClick={() => {
            void loadLocalModels();
            void loadRemoteModels();
          }}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
          aria-label="Refresh"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Disk Usage */}
        <div className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg">
          <HardDrive className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-400">
            Local storage: {formatBytes(state.totalLocalSize)}
          </span>
          <span className="text-xs text-gray-500">
            ({state.localModels.length} model{state.localModels.length !== 1 ? 's' : ''})
          </span>
        </div>

        {/* Error */}
        {state.error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{state.error}</p>
          </div>
        )}

        {/* Download Progress */}
        {isDownloading && (
          <div className="space-y-2 p-3 bg-purple-900/20 border border-purple-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              <span className="text-xs text-purple-300">
                Downloading {state.downloadingRepoId}
              </span>
            </div>
            {state.downloadFilename && (
              <p className="text-xs text-gray-500 truncate">
                {state.downloadFilename}
              </p>
            )}
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.round(state.downloadProgress * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-right">
              {Math.round(state.downloadProgress * 100)}%
            </p>
          </div>
        )}

        {/* Remote Models (Available) */}
        {state.remoteModels.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Available Models
            </h3>
            {state.remoteModels.map((model) => {
              const downloaded = isModelDownloaded(model.repoId);
              return (
                <div
                  key={model.repoId}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{model.repoId}</p>
                    <p className="text-xs text-gray-500">
                      {formatBytes(model.totalSize)} &middot;{' '}
                      {model.files.length} files
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {downloaded ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        {onModelSelect && (
                          <button
                            onClick={() => onModelSelect(model.repoId)}
                            className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700
                                       rounded-md transition-colors"
                          >
                            Use
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => void handleDownload(model.repoId)}
                        disabled={isDownloading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                   bg-gray-700 hover:bg-gray-600 disabled:opacity-50
                                   rounded-md transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Local Models (Installed) */}
        {state.localModels.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Installed Models
            </h3>
            {state.localModels.map((model) => (
              <LocalModelCard
                key={model.repoId}
                model={model}
                onDelete={() => void handleDelete(model.repoId)}
                onSelect={
                  onModelSelect
                    ? () => onModelSelect(model.repoId)
                    : undefined
                }
              />
            ))}
          </div>
        )}

        {/* Loading */}
        {state.isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!state.isLoading &&
          state.localModels.length === 0 &&
          state.remoteModels.length === 0 && (
            <div className="text-center py-8">
              <Package className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No models available</p>
              <p className="text-xs text-gray-500 mt-1">
                Check your internet connection and try refreshing.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}

/** Card component for a locally installed model */
function LocalModelCard({
  model,
  onDelete,
  onSelect,
}: {
  model: LocalModelInfo;
  onDelete: () => void;
  onSelect?: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{model.repoId}</p>
        <p className="text-xs text-gray-500">
          {formatBytes(model.totalSize)} &middot; {model.files.length} files
        </p>
      </div>
      <div className="flex items-center gap-2 ml-3">
        {onSelect && (
          <button
            onClick={onSelect}
            className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700
                       rounded-md transition-colors"
          >
            Use
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 hover:bg-red-900/30 rounded-md transition-colors"
          aria-label="Delete model"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>
    </div>
  );
}
