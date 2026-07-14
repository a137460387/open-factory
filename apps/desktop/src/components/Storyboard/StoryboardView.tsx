import {
  AddClipCommand,
  DeleteClipsCommand,
  MoveClipsCommand,
  buildStoryboardReorderStarts,
  createId,
  getStoryboardCards,
  reorderStoryboardClipIds,
  type Clip,
  type MediaAsset,
  type MediaLabelColor,
} from '@open-factory/editor-core';
import { Copy, Flag, LocateFixed, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { zhCN } from '../../i18n/strings';
import { convertLocalFileSrc } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { useEditorStore } from '../../store/editorStore';

interface MenuState {
  clipId: string;
  x: number;
  y: number;
}

const COLOR_CHOICES: Array<{ color: MediaLabelColor; className: string }> = [
  { color: 'red', className: 'bg-red-500' },
  { color: 'orange', className: 'bg-orange-500' },
  { color: 'yellow', className: 'bg-yellow-400' },
  { color: 'green', className: 'bg-green-500' },
  { color: 'blue', className: 'bg-blue-500' },
  { color: 'purple', className: 'bg-purple-500' },
];

export function StoryboardView() {
  const project = useEditorStore((state) => state.project);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const toggleSelectedClipId = useEditorStore((state) => state.toggleSelectedClipId);
  const clearSelectedClipIds = useEditorStore((state) => state.clearSelectedClipIds);
  const setPlayheadTime = useEditorStore((state) => state.setPlayheadTime);
  const setMediaMetadata = useEditorStore((state) => state.setMediaMetadata);
  const cards = useMemo(() => getStoryboardCards(project.timeline), [project.timeline]);
  const mediaById = useMemo(() => new Map(project.media.map((asset) => [asset.id, asset])), [project.media]);
  const selected = useMemo(() => new Set(selectedClipIds), [selectedClipIds]);
  const [draggedClipId, setDraggedClipId] = useState<string>();
  const [menu, setMenu] = useState<MenuState>();
  const t = zhCN.storyboard;

  function selectCard(clipId: string, additive: boolean): void {
    if (additive) {
      toggleSelectedClipId(clipId);
      return;
    }
    setSelectedClipId(clipId);
  }

  function jumpToClip(clip: Clip): void {
    setPlayheadTime(clip.start);
    setSelectedClipId(clip.id);
    setMenu(undefined);
  }

  function reorderCards(targetClipId: string): void {
    if (!draggedClipId || draggedClipId === targetClipId) {
      return;
    }
    const ids = cards.map((card) => card.clip.id);
    const nextIds = reorderStoryboardClipIds(ids, draggedClipId, targetClipId);
    const starts = buildStoryboardReorderStarts(project.timeline, nextIds);
    try {
      commandManager.execute(new MoveClipsCommand(timelineAccessor, starts));
      setSelectedClipId(draggedClipId);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: t.reorderFailed,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    } finally {
      setDraggedClipId(undefined);
    }
  }

  function deleteSelection(anchorClipId: string): void {
    const ids = selected.has(anchorClipId) ? selectedClipIds : [anchorClipId];
    commandManager.execute(new DeleteClipsCommand(timelineAccessor, ids));
    clearSelectedClipIds();
    setMenu(undefined);
  }

  function duplicateSelection(anchorClipId: string): void {
    const ids = selected.has(anchorClipId) ? selectedClipIds : [anchorClipId];
    const clips = cards
      .map((card) => card.clip)
      .filter((clip) => ids.includes(clip.id))
      .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
    if (clips.length === 0) {
      return;
    }
    let cursor = Math.max(
      ...project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration)),
      0,
    );
    try {
      for (const clip of clips) {
        const clone = { ...clip, id: createId('clip'), name: `${clip.name} ${t.copySuffix}`, start: cursor } as Clip;
        commandManager.execute(new AddClipCommand(timelineAccessor, clone));
        cursor += clip.duration;
      }
      setMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: t.copyFailed,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function setCardColor(anchorClipId: string, color: MediaLabelColor | null): void {
    const clip = cards.find((card) => card.clip.id === anchorClipId)?.clip;
    const mediaId = clip && 'mediaId' in clip ? clip.mediaId : undefined;
    if (!mediaId) {
      return;
    }
    setMediaMetadata(mediaId, color ? { labelColor: color } : undefined);
    setMenu(undefined);
  }

  return (
    <section
      className="h-full min-h-0 overflow-auto bg-white p-3"
      data-testid="storyboard-view"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Delete' && selectedClipIds.length > 0) {
          commandManager.execute(new DeleteClipsCommand(timelineAccessor, selectedClipIds));
          clearSelectedClipIds();
        }
      }}
      onPointerDown={() => setMenu(undefined)}
    >
      {cards.length === 0 ? (
        <div
          className="flex h-full items-center justify-center rounded-md border border-dashed border-line bg-panel text-sm text-slate-500"
          data-testid="storyboard-empty"
        >
          {t.empty}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
          {cards.map(({ clip }) => {
            const asset = 'mediaId' in clip ? mediaById.get(clip.mediaId) : undefined;
            const mediaLabel = asset ? project.mediaMetadata[asset.id]?.labelColor : undefined;
            const active = selected.has(clip.id);
            return (
              <article
                key={clip.id}
                className={`group relative overflow-hidden rounded-md border bg-white shadow-sm transition ${active ? 'border-brand ring-2 ring-brand/25' : 'border-line hover:border-slate-300'}`}
                draggable
                data-testid={`storyboard-card-${clip.id}`}
                data-selected={active ? 'true' : 'false'}
                onClick={(event) => {
                  event.stopPropagation();
                  selectCard(clip.id, event.shiftKey);
                }}
                onDoubleClick={() => jumpToClip(clip)}
                onDragStart={(event) => {
                  setDraggedClipId(clip.id);
                  event.dataTransfer.setData('text/plain', clip.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  reorderCards(clip.id);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectCard(clip.id, event.shiftKey);
                  setMenu({ clipId: clip.id, x: event.clientX, y: event.clientY });
                }}
              >
                <StoryboardThumb asset={asset} name={clip.name} />
                {mediaLabel ? (
                  <span
                    className={`absolute left-2 top-2 h-3 w-3 rounded-full ring-2 ring-white ${COLOR_CHOICES.find((item) => item.color === mediaLabel)?.className ?? 'bg-slate-400'}`}
                  />
                ) : null}
                <div className="space-y-1 p-2">
                  <div
                    className="truncate text-xs font-semibold text-ink"
                    data-testid={`storyboard-card-name-${clip.id}`}
                  >
                    {clip.name}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums text-slate-500">
                    <span data-testid={`storyboard-card-duration-${clip.id}`}>{t.duration(clip.duration)}</span>
                    <span>{clip.start.toFixed(2)}s</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {menu ? (
        <StoryboardMenu
          menu={menu}
          onDelete={() => deleteSelection(menu.clipId)}
          onCopy={() => duplicateSelection(menu.clipId)}
          onJump={() => {
            const clip = cards.find((card) => card.clip.id === menu.clipId)?.clip;
            if (clip) {
              jumpToClip(clip);
            }
          }}
          onColor={(color) => setCardColor(menu.clipId, color)}
        />
      ) : null}
    </section>
  );
}

function StoryboardThumb({ asset, name }: { asset?: MediaAsset; name: string }) {
  const src = asset?.thumbnail || (asset?.type === 'image' ? convertLocalFileSrc(asset.path) : undefined);
  if (src) {
    return (
      <img
        className="aspect-video w-full bg-slate-100 object-cover"
        src={src}
        alt={name}
        draggable={false}
        loading="lazy"
      />
    );
  }
  return (
    <div className="flex aspect-video w-full items-center justify-center bg-slate-100 text-xs font-medium text-slate-500">
      {asset?.type === 'image' ? zhCN.storyboard.image : zhCN.storyboard.video}
    </div>
  );
}

function StoryboardMenu({
  menu,
  onDelete,
  onCopy,
  onJump,
  onColor,
}: {
  menu: MenuState;
  onDelete(): void;
  onCopy(): void;
  onJump(): void;
  onColor(color: MediaLabelColor | null): void;
}) {
  return (
    <div
      className="fixed z-[80] w-48 rounded-md border border-line bg-white p-2 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="storyboard-context-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <MenuButton
        testId="storyboard-menu-jump"
        label={zhCN.storyboard.jump}
        icon={<LocateFixed size={14} />}
        onClick={onJump}
      />
      <MenuButton
        testId="storyboard-menu-copy"
        label={zhCN.storyboard.copy}
        icon={<Copy size={14} />}
        onClick={onCopy}
      />
      <MenuButton
        testId="storyboard-menu-delete"
        label={zhCN.storyboard.delete}
        icon={<Trash2 size={14} />}
        onClick={onDelete}
        danger
      />
      <div className="mt-2 border-t border-line pt-2">
        <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
          <Flag size={12} />
          {zhCN.storyboard.color}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_CHOICES.map((item) => (
            <button
              key={item.color}
              className={`h-5 w-5 rounded-full border border-white ring-1 ring-slate-200 ${item.className}`}
              type="button"
              title={item.color}
              aria-label={item.color}
              data-testid={`storyboard-color-${item.color}`}
              onClick={() => onColor(item.color)}
            />
          ))}
          <button
            className="h-5 rounded border border-line px-1 text-[10px] text-slate-600 hover:bg-panel"
            type="button"
            data-testid="storyboard-color-clear"
            onClick={() => onColor(null)}
          >
            {zhCN.common.clear}
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuButton({
  testId,
  label,
  icon,
  onClick,
  danger = false,
}: {
  testId: string;
  label: string;
  icon: ReactNode;
  onClick(): void;
  danger?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-panel ${danger ? 'text-rose-700' : 'text-slate-700'}`}
      type="button"
      data-testid={testId}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
