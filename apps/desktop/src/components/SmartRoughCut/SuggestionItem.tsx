/**
 * 单个建议项组件
 *
 * 支持拖拽手柄、选中切换、优先级/置信度展示。
 */
import type { DragEvent } from 'react';
import type { SmartRoughCutSuggestion, SmartRoughCutSuggestionType } from '@open-factory/editor-core';
import { round } from '@open-factory/editor-core';

const TYPE_ICONS: Record<SmartRoughCutSuggestionType, string> = {
  scene_split: '🎬',
  silence_remove: '🔇',
  subtitle_add: '💬',
  dialogue_extract: '🗣',
  broll_insert: '🎞',
  rhythm_cut: '🎵',
  emotion_highlight: '💡',
  narrative_structure: '📖',
};

const TYPE_LABELS: Record<SmartRoughCutSuggestionType, string> = {
  scene_split: '场景',
  silence_remove: '静音',
  subtitle_add: '字幕',
  dialogue_extract: '对话',
  broll_insert: 'B-roll',
  rhythm_cut: '节奏',
  emotion_highlight: '情感',
  narrative_structure: '叙事',
};

interface SuggestionItemProps {
  suggestion: SmartRoughCutSuggestion;
  index: number;
  isDragging: boolean;
  onToggle: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

export function SuggestionItem({
  suggestion,
  index,
  isDragging,
  onToggle,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SuggestionItemProps) {
  const confidencePercent = Math.round(suggestion.confidence * 100);

  return (
    <div
      className={`flex items-center gap-2 rounded border p-2 text-xs transition-opacity ${
        isDragging ? 'border-brand bg-brand/5 opacity-50' : 'border-line bg-white hover:border-slate-300'
      } ${suggestion.selected ? '' : 'opacity-60'}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      data-testid={`suggestion-item-${suggestion.id}`}
    >
      {/* 拖拽手柄 */}
      <span
        className="flex-none cursor-grab text-slate-400 select-none active:cursor-grabbing"
        data-testid={`suggestion-drag-${suggestion.id}`}
        title="拖拽排序"
      >
        ⠿
      </span>

      {/* 选中复选框 */}
      <input
        className="h-3.5 w-3.5 flex-none accent-brand"
        type="checkbox"
        checked={suggestion.selected}
        onChange={onToggle}
        data-testid={`suggestion-checkbox-${suggestion.id}`}
      />

      {/* 类型图标 */}
      <span className="flex-none" title={TYPE_LABELS[suggestion.type]}>
        {TYPE_ICONS[suggestion.type]}
      </span>

      {/* 内容 */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-slate-800">{suggestion.reason}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
          <span>{formatTimeRange(suggestion.timeStart, suggestion.timeEnd)}</span>
          <span>·</span>
          <span>优先级 {suggestion.priority}</span>
          <span>·</span>
          <span>置信度 {confidencePercent}%</span>
        </div>
      </div>

      {/* 置信度指示条 */}
      <div
        className="h-1.5 w-12 flex-none overflow-hidden rounded-full bg-slate-200"
        title={`置信度 ${confidencePercent}%`}
      >
        <div
          className={`h-full rounded-full ${
            confidencePercent >= 70 ? 'bg-green-500' : confidencePercent >= 40 ? 'bg-amber-500' : 'bg-red-400'
          }`}
          style={{ width: `${confidencePercent}%` }}
        />
      </div>
    </div>
  );
}

function formatTimeRange(start: number, end: number): string {
  if (Math.abs(start - end) < 0.01) {
    return `${round(start, 2)}s`;
  }
  return `${round(start, 2)}s - ${round(end, 2)}s`;
}
