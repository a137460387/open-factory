import { useState, useCallback } from 'react';
import { UpdateClipCommand, type Clip, type Project, type Timeline } from '@open-factory/editor-core';
import { loadLutLibrary, toggleLutFavorite, type LutLibraryItem } from '../../lib/lutLibrary';
import { showToast } from '../../lib/toast';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { useEditorStore } from '../../store/editorStore';
import { zhCN } from '../../i18n/strings';

function buildPreviewTimelineWithLut(timeline: Timeline, clipId: string, lutPath: string): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) =>
        clip.id === clipId
          ? {
              ...clip,
              colorCorrection: {
                ...clip.colorCorrection,
                lutPath,
              },
            }
          : clip,
      ),
    })),
  };
}

export function useLutLibrary(selectedClip: Clip | undefined, project: Project) {
  const t = zhCN.settings;
  const setPreviewTimeline = useEditorStore((state) => state.setPreviewTimeline);
  const [items, setItems] = useState<LutLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const selectedClipCanUseLut = selectedClip?.type === 'video' || selectedClip?.type === 'image';

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      setItems(await loadLutLibrary());
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : t.lutLibrary.loadFailedMessage;
      setError(message);
      showToast({ kind: 'warning', title: t.lutLibrary.loadFailed, message });
    } finally {
      setLoading(false);
    }
  }, [t]);

  const preview = useCallback(
    (item: LutLibraryItem) => {
      if (!selectedClipCanUseLut || !selectedClip) {
        showToast({ kind: 'warning', title: t.lutLibrary.noClipSelected, message: t.lutLibrary.noClipSelectedMessage });
        return;
      }
      setPreviewTimeline(buildPreviewTimelineWithLut(project.timeline, selectedClip.id, item.path));
    },
    [selectedClipCanUseLut, selectedClip, project, setPreviewTimeline, t],
  );

  const apply = useCallback(
    (item: LutLibraryItem) => {
      if (!selectedClipCanUseLut || !selectedClip) {
        showToast({ kind: 'warning', title: t.lutLibrary.noClipSelected, message: t.lutLibrary.noClipSelectedMessage });
        return;
      }
      try {
        commandManager.execute(
          new UpdateClipCommand(timelineAccessor, selectedClip.id, { colorCorrection: { lutPath: item.path } }),
        );
        setPreviewTimeline(undefined);
        showToast({ kind: 'success', title: t.lutLibrary.applied, message: item.name });
      } catch (applyError) {
        showToast({
          kind: 'warning',
          title: t.lutLibrary.applyFailed,
          message: applyError instanceof Error ? applyError.message : t.lutLibrary.applyFailedMessage,
        });
      }
    },
    [selectedClipCanUseLut, selectedClip, setPreviewTimeline, t],
  );

  const toggleFavorite = useCallback(
    async (item: LutLibraryItem) => {
      try {
        const favorites = new Set(await toggleLutFavorite(item.path));
        setItems((current) => current.map((entry) => ({ ...entry, favorite: favorites.has(entry.path) })));
      } catch (favoriteError) {
        showToast({
          kind: 'warning',
          title: t.lutLibrary.favoriteFailed,
          message: favoriteError instanceof Error ? favoriteError.message : t.lutLibrary.favoriteFailedMessage,
        });
      }
    },
    [t],
  );

  return { items, loading, error, selectedClipCanUseLut, refresh, preview, apply, toggleFavorite };
}
