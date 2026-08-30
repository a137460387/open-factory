import type { Clip } from '@open-factory/editor-core';
import {
  AddKeyframeCommand,
  BatchUpdateKeyframeCommand,
  RemoveKeyframeCommand,
  UpdateKeyframeCommand,
  buildVolumeFadeKeyframes,
  volumeEnvelopeControlPointToKeyframe,
} from '@open-factory/editor-core';
import type { VolumeEnvelopeMenuRequest, VolumeEnvelopePointRequest } from '../../TimelineParts';
import { commandManager, timelineAccessor } from '../../../../store/commandManager';
import { zhCN } from '../../../../i18n/strings';
import { showToast } from '../../../../lib/toast';
import type { TimelineHandlerParams } from './types';

export function createVolumeEnvelopeHandlers(
  params: TimelineHandlerParams,
  helpers: {
    findClip: (clipId: string) => Clip;
  },
) {
  const {
    volumeEnvelopeMenu,
    setVolumeEnvelopeMenu,
    setSelectedClipId,
    setSelectedKeyframe,
    setSelectedKeyframes,
    setTransitionMenu,
    setClipMenu,
    setGapMenu,
    setRulerMenu,
  } = params;

  const { findClip } = helpers;

  function addVolumeEnvelopePoint(request: VolumeEnvelopePointRequest): void {
    const clip = findClip(request.clipId);
    if (!('volume' in clip)) {
      return;
    }
    try {
      const keyframe = volumeEnvelopeControlPointToKeyframe(
        { time: request.time, value: request.value },
        clip.duration,
      );
      commandManager.execute(new AddKeyframeCommand(timelineAccessor, clip.id, 'volume', keyframe));
      setSelectedClipId(clip.id);
      setSelectedKeyframe({ clipId: clip.id, property: 'volume', keyframeId: keyframe.id });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.volumeEnvelopeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage,
      });
    }
  }

  function updateVolumeEnvelopePoint(request: Required<VolumeEnvelopePointRequest>): void {
    try {
      commandManager.execute(
        new UpdateKeyframeCommand(timelineAccessor, request.clipId, 'volume', request.keyframeId, {
          time: request.time,
          value: request.value,
        }),
      );
      setSelectedClipId(request.clipId);
      setSelectedKeyframe({ clipId: request.clipId, property: 'volume', keyframeId: request.keyframeId });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.volumeEnvelopeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage,
      });
    }
  }

  function removeVolumeEnvelopePoint(
    request: Required<Pick<VolumeEnvelopePointRequest, 'clipId' | 'keyframeId'>>,
  ): void {
    try {
      commandManager.execute(new RemoveKeyframeCommand(timelineAccessor, request.clipId, 'volume', request.keyframeId));
      setSelectedKeyframes([]);
      setSelectedClipId(request.clipId);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.volumeEnvelopeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage,
      });
    }
  }

  function openVolumeEnvelopeMenu(request: VolumeEnvelopeMenuRequest): void {
    setTransitionMenu(undefined);
    setClipMenu(undefined);
    setGapMenu(undefined);
    setRulerMenu(undefined);
    setSelectedClipId(request.clipId);
    setVolumeEnvelopeMenu({
      ...request,
      x: Math.min(request.x, Math.max(0, window.innerWidth - 180)),
      y: Math.min(request.y, Math.max(0, window.innerHeight - 170)),
    });
  }

  function applyVolumeEnvelopeFade(kind: 'in' | 'out'): void {
    if (!volumeEnvelopeMenu) {
      return;
    }
    const clip = findClip(volumeEnvelopeMenu.clipId);
    if (!('volume' in clip)) {
      return;
    }
    try {
      const keyframes = buildVolumeFadeKeyframes(kind, clip.duration, clip.volume, Math.min(1, clip.duration));
      commandManager.execute(
        new BatchUpdateKeyframeCommand(
          timelineAccessor,
          [{ clipId: clip.id, property: 'volume', keyframes }],
          zhCN.timeline.volumeEnvelopeFadeCommand,
        ),
      );
      setSelectedClipId(clip.id);
      setSelectedKeyframes(keyframes.map((frame) => ({ clipId: clip.id, property: 'volume', keyframeId: frame.id })));
      setVolumeEnvelopeMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.volumeEnvelopeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage,
      });
    }
  }

  function resetVolumeEnvelope(): void {
    if (!volumeEnvelopeMenu) {
      return;
    }
    try {
      commandManager.execute(
        new BatchUpdateKeyframeCommand(
          timelineAccessor,
          [{ clipId: volumeEnvelopeMenu.clipId, property: 'volume', keyframes: [], replace: true }],
          zhCN.timeline.volumeEnvelopeResetCommand,
        ),
      );
      setSelectedKeyframes([]);
      setSelectedClipId(volumeEnvelopeMenu.clipId);
      setVolumeEnvelopeMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.volumeEnvelopeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage,
      });
    }
  }

  return {
    addVolumeEnvelopePoint,
    updateVolumeEnvelopePoint,
    removeVolumeEnvelopePoint,
    openVolumeEnvelopeMenu,
    applyVolumeEnvelopeFade,
    resetVolumeEnvelope,
  };
}
