import { useState } from 'react';
import type { SubtitleBatchOperationsViewProps } from './types';

export function SubtitleBatchOperationsView({
  selectedCount,
  onSelectAll,
  onInvertSelection,
  onDelete,
  onDuplicate,
  onMerge,
  onTimeShift,
  tracks,
}: SubtitleBatchOperationsViewProps) {
  const [timeShift, setTimeShift] = useState(0);
  const [mergeSeparator, setMergeSeparator] = useState(' ');

  return (
    <div className="space-y-4 p-3">
      {/* Selection */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-ink">选择操作</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onSelectAll()}
            className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel"
            data-testid="batch-select-all"
          >
            全选
          </button>
          <button
            onClick={() => onInvertSelection()}
            className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel"
            data-testid="batch-invert-selection"
          >
            反选
          </button>
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => onSelectAll(track.id)}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel"
              data-testid={`batch-select-track-${track.id}`}
            >
              选择: {track.name || '未命名轨道'}
            </button>
          ))}
        </div>
      </div>

      {/* Edit Operations */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-ink">
          编辑操作
          {selectedCount > 0 && <span className="ml-2 text-[var(--color-text-muted)]">({selectedCount} 条选中)</span>}
        </h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={onDelete}
              disabled={selectedCount === 0}
              className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50"
              data-testid="batch-delete"
            >
              删除选中
            </button>
            <button
              onClick={() => onDuplicate(1)}
              disabled={selectedCount === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
              data-testid="batch-duplicate"
            >
              复制选中
            </button>
            <button
              onClick={() => onMerge(mergeSeparator)}
              disabled={selectedCount < 2}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
              data-testid="batch-merge"
            >
              合并选中
            </button>
          </div>

          {/* Merge Separator */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--color-text-muted)]">合并分隔符</label>
            <input
              type="text"
              value={mergeSeparator}
              onChange={(e) => setMergeSeparator(e.target.value)}
              className="w-20 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1 text-xs"
              placeholder="空格"
            />
          </div>
        </div>
      </div>

      {/* Time Operations */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-ink">时间调整</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--color-text-muted)]">时间偏移（秒）</label>
            <input
              type="number"
              value={timeShift}
              onChange={(e) => setTimeShift(Number(e.target.value))}
              step="0.1"
              className="w-24 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1 text-xs"
            />
            <button
              onClick={() => onTimeShift(timeShift)}
              disabled={selectedCount === 0 || timeShift === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
              data-testid="batch-time-shift"
            >
              应用偏移
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onTimeShift(-0.5)}
              disabled={selectedCount === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
            >
              -0.5s
            </button>
            <button
              onClick={() => onTimeShift(-0.1)}
              disabled={selectedCount === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
            >
              -0.1s
            </button>
            <button
              onClick={() => onTimeShift(0.1)}
              disabled={selectedCount === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
            >
              +0.1s
            </button>
            <button
              onClick={() => onTimeShift(0.5)}
              disabled={selectedCount === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
            >
              +0.5s
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
