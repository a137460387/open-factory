import type {MediaAsset} from '@open-factory/editor-core';
import {ChevronDown, ChevronRight, Scissors, Trash2} from 'lucide-react';
import {useContext} from 'react';
import {zhCN} from '../../i18n/strings';
import {SubclipCtx, SUBCLIP_DRAG_MIME} from './MediaCardTypes';
import {formatDuration} from './MediaCardUtils';

// ---------------------------------------------------------------------------
// MediaCardSubclipList
// ---------------------------------------------------------------------------

export function MediaCardSubclipList({ asset }: { asset: MediaAsset }) {
  const sc = useContext(SubclipCtx);
  if (!sc || sc.subclips.filter((s) => s.sourceMediaId === asset.id).length === 0) {
    return null;
  }

  return (
    <div className="mt-2">
      <button
        className="inline-flex w-full items-center gap-1 rounded border border-line bg-panel px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
        type="button"
        data-testid={`toggle-subclips-${asset.id}`}
        onClick={(e) => {
          e.stopPropagation();
          sc.onToggleSubclipExpanded(asset.id);
        }}
      >
        {sc.expandedSubclipAssetIds.has(asset.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Scissors size={11} />
        {zhCN.subclip.subclipCount(sc.subclips.filter((s) => s.sourceMediaId === asset.id).length)}
      </button>
      {sc.expandedSubclipAssetIds.has(asset.id) ? (
        <div className="mt-1 space-y-1" data-testid={`subclip-list-${asset.id}`}>
          {sc.subclips
            .filter((s) => s.sourceMediaId === asset.id)
            .map((sub) => (
              <div
                key={sub.id}
                className="rounded border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-[11px] shadow-sm"
                draggable
                data-testid={`subclip-card-${sub.id}`}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'copy';
                  event.dataTransfer.setData(
                    SUBCLIP_DRAG_MIME,
                    JSON.stringify({ assetId: asset.id, subclip: sub }),
                  );
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-semibold text-[var(--color-text-secondary)]" title={sub.name}>
                    {sub.name}
                  </span>
                  <span className="shrink-0 text-[var(--color-text-muted)]">
                    {formatDuration(sub.inPoint)} \u2013 {formatDuration(sub.outPoint)}
                  </span>
                </div>
                {sub.color ? (
                  <span
                    className="mt-0.5 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: sub.color }}
                  />
                ) : null}
                <div className="mt-1 flex items-center gap-1">
                  <button
                    className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                    type="button"
                    data-testid={`add-subclip-to-timeline-${sub.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      sc.onAddSubclipToTimeline(asset.id, sub);
                    }}
                  >
                    {zhCN.subclip.addToTimeline}
                  </button>
                  <button
                    className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                    type="button"
                    data-testid={`edit-subclip-${sub.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      sc.onOpenSubclipDialog(asset.id, sub.id);
                    }}
                  >
                    {zhCN.subclip.editSubclip}
                  </button>
                  <button
                    className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-rose-600 hover:bg-panel"
                    type="button"
                    data-testid={`delete-subclip-${sub.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      sc.onDeleteSubclip(sub.id);
                    }}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}
