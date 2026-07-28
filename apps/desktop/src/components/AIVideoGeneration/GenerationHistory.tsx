import React, { useCallback } from 'react';
import {
  Trash2,
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useGenerationHistory } from '../../hooks/useGenerationHistory';
import type { GenerationHistoryEntry } from '../../lib/generation-history-db';

/** GenerationHistory props */
export interface GenerationHistoryProps {
  /** Callback when a task is retried */
  onRetry?: (entry: GenerationHistoryEntry) => void;
}

/**
 * Displays generation history with retry and delete capabilities.
 */
export function GenerationHistory({ onRetry }: GenerationHistoryProps) {
  const { state, deleteEntry, clearAll } = useGenerationHistory();
  const { entries, isLoading, error } = state;

  const handleRetry = useCallback(
    (entry: GenerationHistoryEntry) => {
      if (onRetry) {
        onRetry(entry);
      }
    },
    [onRetry],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteEntry(id);
    },
    [deleteEntry],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700 rounded-lg">
        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <p className="text-sm text-red-300">{error}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <Clock className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">No generation history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Generation History
        </h3>
        <button
          onClick={clearAll}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Entries */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {entries.map((entry) => (
          <HistoryEntryRow
            key={entry.id}
            entry={entry}
            onRetry={handleRetry}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

/** Single history entry row */
function HistoryEntryRow({
  entry,
  onRetry,
  onDelete,
}: {
  entry: GenerationHistoryEntry;
  onRetry: (entry: GenerationHistoryEntry) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const statusIcon =
    entry.status === 'completed' ? (
      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
    ) : entry.status === 'failed' ? (
      <XCircle className="w-3.5 h-3.5 text-red-400" />
    ) : (
      <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
    );

  const timeAgo = formatTimeAgo(entry.createdAt);

  return (
    <div className="group flex items-start gap-2 p-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
      <div className="mt-0.5 flex-shrink-0">{statusIcon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-200 truncate">{entry.prompt}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-500">{timeAgo}</span>
          <span className="text-[10px] text-gray-600">
            {entry.resolution}p / {Math.round((entry.numFrames / entry.fps) * 10) / 10}s
          </span>
          {entry.durationMs && (
            <span className="text-[10px] text-gray-600">
              {(entry.durationMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {entry.status === 'failed' && (
          <button
            onClick={() => onRetry(entry)}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Retry"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-400 hover:text-purple-400" />
          </button>
        )}
        <button
          onClick={() => onDelete(entry.id)}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
        </button>
      </div>
    </div>
  );
}

/** Format a timestamp as relative time ago */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
