import { useCallback, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { zhCN } from '../../i18n/strings';
import type { CharacterTimeline } from '@open-factory/editor-core';

/**
 * 出镜角色面板：显示 characterTimeline 中识别到的角色列表，
 * 点击角色高亮对应出镜区间，支持手动重命名。
 */
export function CharacterTimelinePanel() {
  const project = useEditorStore((s) => s.project);
  const setPlayheadTime = useEditorStore((s) => s.setPlayheadTime);
  const [highlightedCharId, setHighlightedCharId] = useState<string | null>(null);
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const timeline: CharacterTimeline | undefined = project?.characterTimeline;

  const handleRename = useCallback(
    (charId: string) => {
      if (!editLabel.trim() || !project || !timeline) return;
      const updated: CharacterTimeline = {
        ...timeline,
        characters: {
          ...timeline.characters,
          [charId]: { ...timeline.characters[charId], label: editLabel.trim() },
        },
      };
      const current = useEditorStore.getState().project;
      if (current) {
        useEditorStore.getState().setProject({ ...current, characterTimeline: updated });
      }
      setEditingCharId(null);
    },
    [editLabel, timeline, project],
  );

  if (!timeline || Object.keys(timeline.characters).length === 0) {
    return null;
  }

  const entries = Object.entries(timeline.characters);

  return (
    <div className="border-t border-line bg-panel" data-testid="character-panel">
      <div className="px-3 py-1.5 text-xs font-medium text-muted select-none">{zhCN.characterTimeline.title}</div>
      <div className="px-2 pb-2 space-y-1">
        {entries.map(([charId, entry]) => {
          const isHighlighted = highlightedCharId === charId;
          const isEditing = editingCharId === charId;
          return (
            <div
              key={charId}
              className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer text-xs transition-colors ${
                isHighlighted ? 'bg-accent/20 text-accent' : 'hover:bg-hover text-fg'
              }`}
              data-testid={`character-entry-${charId}`}
              onClick={() => {
                setHighlightedCharId(isHighlighted ? null : charId);
                if (entry.appearances.length > 0 && !isHighlighted) {
                  setPlayheadTime(entry.appearances[0].startTime);
                }
              }}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
              {isEditing ? (
                <input
                  className="flex-1 bg-surface border border-line rounded px-1 py-0.5 text-xs outline-none"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onBlur={() => handleRename(charId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(charId);
                    if (e.key === 'Escape') setEditingCharId(null);
                  }}
                  autoFocus
                  data-testid={`character-rename-input-${charId}`}
                />
              ) : (
                <span className="flex-1 truncate">{entry.label}</span>
              )}
              <span className="text-[10px] text-muted flex-shrink-0">{entry.appearances.length}</span>
              <button
                className="text-[10px] text-muted hover:text-fg flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCharId(charId);
                  setEditLabel(entry.label);
                }}
                data-testid={`character-rename-btn-${charId}`}
              >
                {zhCN.characterTimeline.rename}
              </button>
            </div>
          );
        })}
      </div>
      {highlightedCharId && timeline.characters[highlightedCharId] && (
        <div className="px-3 pb-2 text-[10px] text-muted" data-testid="character-highlight-info">
          {zhCN.characterTimeline.appearanceCount.replace(
            '{count}',
            String(timeline.characters[highlightedCharId].appearances.length),
          )}
        </div>
      )}
    </div>
  );
}
