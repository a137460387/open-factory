import { useCallback } from 'react';
import type { SubtitleClip } from '@open-factory/editor-core';
import { formatTime } from '@open-factory/editor-core';
import type { SubtitleListViewProps } from './types';

export function SubtitleListView({
  tracks,
  selectedIds,
  editingClipId,
  editText,
  onSelectionChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditTextChange,
  textAreaRef,
}: SubtitleListViewProps) {
  const handleToggleSelect = useCallback(
    (clipId: string, multiSelect: boolean) => {
      if (multiSelect) {
        const selectedSet = new Set(selectedIds);
        onSelectionChange(
          selectedSet.has(clipId) ? selectedIds.filter((id) => id !== clipId) : [...selectedIds, clipId],
        );
      } else {
        onSelectionChange([clipId]);
      }
    },
    [selectedIds, onSelectionChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSaveEdit();
      } else if (e.key === 'Escape') {
        onCancelEdit();
      }
    },
    [onSaveEdit, onCancelEdit],
  );

  return (
    <div className="divide-y divide-line">
      {tracks.map((track) => (
        <div key={track.id} className="p-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink">
              {track.name || '未命名轨道'}
              {track.language && ` (${track.language})`}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {track.clips.filter((c) => c.type === 'subtitle').length} 条
            </span>
          </div>

          <div className="space-y-1">
            {track.clips
              .filter((clip) => clip.type === 'subtitle')
              .sort((a, b) => a.start - b.start)
              .map((clip) => {
                const subtitleClip = clip as SubtitleClip;
                const isSelected = selectedIds.includes(clip.id);
                const isEditing = editingClipId === clip.id;

                return (
                  <div
                    key={clip.id}
                    className={`group flex items-start gap-2 rounded px-2 py-1.5 text-xs transition-colors ${
                      isSelected
                        ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30'
                        : 'hover:bg-panel border border-transparent'
                    }`}
                    onClick={(e) => handleToggleSelect(clip.id, e.ctrlKey || e.metaKey)}
                    data-testid={`subtitle-item-${clip.id}`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(clip.id, true)}
                      className="mt-0.5 rounded border-line"
                      onClick={(e) => e.stopPropagation()}
                    />

                    {/* Timecode */}
                    <div className="flex-shrink-0 font-mono text-[var(--color-text-muted)]">
                      <div>{formatTime(subtitleClip.start)}</div>
                      <div>{formatTime(subtitleClip.start + subtitleClip.duration)}</div>
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      {/* Speaker label */}
                      {subtitleClip.speaker && (
                        <div className="mb-1 flex items-center gap-1">
                          <span
                            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `hsl(${(subtitleClip.speakerId ?? 0) * 60}, 70%, 90%)`,
                              color: `hsl(${(subtitleClip.speakerId ?? 0) * 60}, 70%, 30%)`,
                            }}
                          >
                            {subtitleClip.speaker}
                          </span>
                        </div>
                      )}
                      {isEditing ? (
                        <textarea
                          ref={textAreaRef}
                          value={editText}
                          onChange={(e) => onEditTextChange(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={onSaveEdit}
                          className="w-full rounded border border-[var(--color-accent)] bg-[var(--color-bg-primary)] px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                          rows={2}
                        />
                      ) : (
                        <div
                          className="cursor-text truncate"
                          onDoubleClick={() => onStartEdit(clip.id, subtitleClip.text)}
                          title={subtitleClip.text}
                        >
                          {subtitleClip.text || '(空字幕)'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
