import type { Clip, MediaAsset, MediaVersionEntry } from '@open-factory/editor-core';
import {
  PackNestedSequenceCommand,
  ReplaceMediaCommand,
  SwitchMediaVersionCommand,
  findMediaVersionOwner,
  isNestedSequenceDepthExceeded,
  listMediaVersionEntries,
  getReplaceMediaCompatibilityWarnings,
} from '@open-factory/editor-core';
import type { ReplaceMediaDialogState } from '../../TimelineDialogs';
import { commandManager, projectAccessor, timelineAccessor } from '../../../../store/commandManager';
import { useEditorStore } from '../../../../store/editorStore';
import { zhCN } from '../../../../i18n/strings';
import { openFileDialog } from '../../../../lib/tauri-bridge';
import { probeMediaPath } from '../../../../lib/media';
import { showToast } from '../../../../lib/toast';
import type { TimelineHandlerParams } from './types';

export function createNestedMediaHandlers(
  params: TimelineHandlerParams,
  helpers: {
    findClip: (clipId: string) => Clip;
    getClipMediaAsset: (clip: Clip) => MediaAsset | undefined;
  },
) {
  const {
    project,
    selectedClipIds,
    setSelectedClipId,
    setSelectedClipIds,
    setClipMenu,
    setReplaceMediaDialog,
    replaceMediaDialog,
    addMedia,
    setActiveSequenceId,
  } = params;

  const { findClip, getClipMediaAsset } = helpers;

  function openNestedSequence(clip: Clip): void {
    if (clip.type !== 'nested-sequence') {
      return;
    }
    setActiveSequenceId(clip.sequenceId);
    if (isNestedSequenceDepthExceeded(useEditorStore.getState().project)) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.nestedSequenceDepthTitle,
        message: zhCN.timeline.nestedSequenceDepthMessage,
      });
    }
  }

  function packClipMenuSelection(clipId: string): void {
    const clipIds = selectedClipIds.includes(clipId) ? selectedClipIds : [clipId];
    try {
      commandManager.execute(
        new PackNestedSequenceCommand(
          projectAccessor,
          clipIds,
          zhCN.timeline.nestedSequenceName(project.sequences.length),
        ),
      );
      setClipMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  async function openReplaceMedia(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    try {
      const [path] = await openFileDialog(false, [
        {
          name: zhCN.fileDialogs.media,
          extensions: ['mp4', 'mov', 'mkv', 'webm', 'm4a', 'mp3', 'wav', 'png', 'jpg', 'jpeg', 'webp'],
        },
      ]);
      if (!path) {
        return;
      }
      const media = await probeMediaPath(path);
      addMedia([media]);
      setReplaceMediaDialog({
        clipId: clip.id,
        media,
        durationMode: 'trim-to-original',
        warnings: getReplaceMediaCompatibilityWarnings(clip, media),
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.replaceMediaFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.replaceMediaChooseFailed,
      });
    }
  }

  function confirmReplaceMedia(): void {
    if (!replaceMediaDialog) {
      return;
    }
    try {
      commandManager.execute(
        new ReplaceMediaCommand(
          timelineAccessor,
          replaceMediaDialog.clipId,
          replaceMediaDialog.media,
          replaceMediaDialog.durationMode,
        ),
      );
      setSelectedClipId(replaceMediaDialog.clipId);
      setReplaceMediaDialog(undefined);
      showToast({
        kind: 'success',
        title: zhCN.timeline.replaceMediaSuccessTitle,
        message: zhCN.timeline.replaceMediaSuccessMessage,
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.replaceMediaFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  function getClipMediaVersionEntries(clip?: Clip): MediaVersionEntry[] {
    if (!clip || !('mediaId' in clip)) {
      return [];
    }
    const owner = findMediaVersionOwner(project, clip.mediaId);
    if (!owner) {
      return [];
    }
    const entries = listMediaVersionEntries(owner, project.mediaMetadata[owner.id], project.media);
    return entries.length > 1 ? entries : [];
  }

  function switchClipMediaVersion(clipId: string, mediaId: string): void {
    const media = project.media.find((asset) => asset.id === mediaId);
    if (!media) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.switchMediaVersionFailedTitle,
        message: zhCN.timeline.switchMediaVersionMissingMedia,
      });
      return;
    }
    try {
      commandManager.execute(new SwitchMediaVersionCommand(timelineAccessor, clipId, media));
      setSelectedClipId(clipId);
      setClipMenu(undefined);
      showToast({
        kind: 'success',
        title: zhCN.timeline.switchMediaVersionSuccessTitle,
        message: zhCN.timeline.switchMediaVersionSuccessMessage,
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.switchMediaVersionFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  return {
    openNestedSequence,
    packClipMenuSelection,
    openReplaceMedia,
    confirmReplaceMedia,
    getClipMediaVersionEntries,
    switchClipMediaVersion,
  };
}
