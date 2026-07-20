/**
 * 建议列表组件
 *
 * 支持拖拽排序、全选/取消、按类型筛选。
 */
import { useCallback, useRef, useState, type DragEvent, type Key } from 'react';
import type { SmartRoughCutSuggestion, SmartRoughCutSuggestionType } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useSmartRoughCutOrchestratorStore } from '../../store/smartRoughCutOrchestratorStore';
import { SuggestionItem } from './SuggestionItem';

const SUGGESTION_TYPE_LABELS: Record<SmartRoughCutSuggestionType, string> = {
  scene_split: '场景分割',
  silence_remove: '静音删除',
  subtitle_add: '字幕生成',
  dialogue_extract: '对话提取',
  broll_insert: 'B-roll 插入',
  rhythm_cut: '节奏剪辑',
  emotion_highlight: '情感高亮',
  narrative_structure: '叙事结构',
};

export function SuggestionList() {
  const suggestions = useSmartRoughCutOrchestratorStore(
    (s: { suggestions: SmartRoughCutSuggestion[] }) => s.suggestions,
  );
  const toggleSuggestion = useSmartRoughCutOrchestratorStore(
    (s: { toggleSuggestion: (id: string) => void }) => s.toggleSuggestion,
  );
  const setAllSelected = useSmartRoughCutOrchestratorStore(
    (s: { setAllSelected: (selected: boolean) => void }) => s.setAllSelected,
  );
  const selectByType = useSmartRoughCutOrchestratorStore(
    (s: { selectByType: (type: SmartRoughCutSuggestionType, selected: boolean) => void }) => s.selectByType,
  );
  const reorder = useSmartRoughCutOrchestratorStore((s: { reorder: (from: number, to: number) => void }) => s.reorder);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<SmartRoughCutSuggestionType | 'all'>('all');
  const dragOverRef = useRef<number | null>(null);

  const filtered =
    filterType === 'all' ? suggestions : suggestions.filter((s: SmartRoughCutSuggestion) => s.type === filterType);
  const selectedCount = suggestions.filter((s: SmartRoughCutSuggestion) => s.selected).length;
  const types = Array.from(new Set(suggestions.map((s: SmartRoughCutSuggestion) => s.type)));

  const handleDragStart = useCallback((index: number, event: DragEvent) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((index: number, event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dragOverRef.current = index;
  }, []);

  const handleDrop = useCallback(
    (toIndex: number) => {
      if (dragIndex !== null && dragIndex !== toIndex) {
        const fromSuggestion = filtered[dragIndex];
        const toSuggestion = filtered[toIndex];
        if (fromSuggestion && toSuggestion) {
          const fromOriginalIndex = suggestions.findIndex((s: SmartRoughCutSuggestion) => s.id === fromSuggestion.id);
          const toOriginalIndex = suggestions.findIndex((s: SmartRoughCutSuggestion) => s.id === toSuggestion.id);
          if (fromOriginalIndex !== -1 && toOriginalIndex !== -1) {
            reorder(fromOriginalIndex, toOriginalIndex);
          }
        }
      }
      setDragIndex(null);
      dragOverRef.current = null;
    },
    [dragIndex, filtered, suggestions, reorder],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    dragOverRef.current = null;
  }, []);

  if (suggestions.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-500" data-testid="suggestion-list-empty">
        暂无剪辑建议。请先运行分析。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="suggestion-list">
      {/* 工具栏 */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1">
          <button
            className="rounded border border-line bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-panel"
            type="button"
            onClick={() => setAllSelected(true)}
            data-testid="suggestion-select-all"
          >
            {zhCN.smartRoughCut.selectAll}
          </button>
          <button
            className="rounded border border-line bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-panel"
            type="button"
            onClick={() => setAllSelected(false)}
            data-testid="suggestion-select-none"
          >
            {zhCN.smartRoughCut.selectNone}
          </button>
        </div>
        <span className="text-[11px] text-slate-500" data-testid="suggestion-selected-count">
          {selectedCount}/{suggestions.length} 已选
        </span>
      </div>

      {/* 类型筛选 */}
      {types.length > 1 && (
        <div className="flex flex-wrap gap-1 px-1" data-testid="suggestion-type-filter">
          <button
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              filterType === 'all' ? 'bg-brand text-white' : 'bg-panel text-slate-600 hover:bg-slate-200'
            }`}
            type="button"
            onClick={() => setFilterType('all')}
          >
            全部
          </button>
          {types.map((type: SmartRoughCutSuggestionType) => (
            <button
              key={type as Key}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                filterType === type ? 'bg-brand text-white' : 'bg-panel text-slate-600 hover:bg-slate-200'
              }`}
              type="button"
              onClick={() => setFilterType(type)}
            >
              {SUGGESTION_TYPE_LABELS[type] ?? type}
            </button>
          ))}
        </div>
      )}

      {/* 按类型批量操作 */}
      {types.length > 1 && (
        <div className="flex flex-wrap gap-1 px-1">
          {types.map((type: SmartRoughCutSuggestionType) => {
            const typeSuggestions = suggestions.filter((s: SmartRoughCutSuggestion) => s.type === type);
            const allTypeSelected = typeSuggestions.every((s: SmartRoughCutSuggestion) => s.selected);
            return (
              <button
                key={`batch-${type}`}
                className="rounded border border-line bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-panel"
                type="button"
                onClick={() => selectByType(type, !allTypeSelected)}
                data-testid={`suggestion-batch-${type}`}
              >
                {allTypeSelected ? '取消' : '选中'}
                {SUGGESTION_TYPE_LABELS[type] ?? type}
              </button>
            );
          })}
        </div>
      )}

      {/* 建议列表 */}
      <div className="max-h-80 space-y-1 overflow-auto" data-testid="suggestion-items">
        {filtered.map((suggestion: SmartRoughCutSuggestion, index: number) => (
          <SuggestionItem
            key={suggestion.id}
            suggestion={suggestion}
            index={index}
            isDragging={dragIndex === index}
            onToggle={() => toggleSuggestion(suggestion.id)}
            onDragStart={(event: DragEvent) => handleDragStart(index, event)}
            onDragOver={(event: DragEvent) => handleDragOver(index, event)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
    </div>
  );
}
