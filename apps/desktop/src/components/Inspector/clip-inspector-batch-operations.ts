import {useEffect, useMemo, useState} from 'react';
import type {Clip, MediaAsset, Project} from '@open-factory/editor-core';
import {
  ApplyTextAnimationCommand,
  type ClipPatch,
  type KeyframeEasing,
  type KeyframeProperty,
  type TextAnimationDirection,
  type TextAnimationPreset,
} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {timelineAccessor} from '../../store/commandManager';
import {buildClipColorMatchCurves} from '../../lib/colorMatch';
import {showToast} from '../../lib/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseBatchOperationsStateParams {
  clip: Clip;
  project: Project;
  media: MediaAsset[];
  commit: (patch: ClipPatch) => void;
  runEffectCommand: (command: Parameters<typeof import('../../store/commandManager').commandManager.execute>[0]) => void;
}

export interface UseBatchOperationsStateReturn {
  batchShiftSeconds: number;
  setBatchShiftSeconds: React.Dispatch<React.SetStateAction<number>>;
  batchScaleFactor: number;
  setBatchScaleFactor: React.Dispatch<React.SetStateAction<number>>;
  batchEasing: KeyframeEasing;
  setBatchEasing: React.Dispatch<React.SetStateAction<KeyframeEasing>>;
  colorMatchReferenceClipId: string;
  setColorMatchReferenceClipId: React.Dispatch<React.SetStateAction<string>>;
  colorMatchBusy: boolean;
  setColorMatchBusy: React.Dispatch<React.SetStateAction<boolean>>;
  textAnimationPreset: TextAnimationPreset;
  setTextAnimationPreset: React.Dispatch<React.SetStateAction<TextAnimationPreset>>;
  textAnimationDuration: number;
  setTextAnimationDuration: React.Dispatch<React.SetStateAction<number>>;
  textAnimationDirection: TextAnimationDirection;
  setTextAnimationDirection: React.Dispatch<React.SetStateAction<TextAnimationDirection>>;
  colorMatchReferenceClips: Clip[];
  textAnimationKeyframeCount: number;
  applyColorMatch: () => Promise<void>;
  applyTextAnimation: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBatchOperationsState({
  clip,
  project,
  media,
  commit,
  runEffectCommand,
}: UseBatchOperationsStateParams): UseBatchOperationsStateReturn {
  const [batchShiftSeconds, setBatchShiftSeconds] = useState(0.1);
  const [batchScaleFactor, setBatchScaleFactor] = useState(1);
  const [batchEasing, setBatchEasing] = useState<KeyframeEasing>('linear');
  const [colorMatchReferenceClipId, setColorMatchReferenceClipId] = useState<string>('');
  const [colorMatchBusy, setColorMatchBusy] = useState(false);
  const [textAnimationPreset, setTextAnimationPreset] = useState<TextAnimationPreset>('fade');
  const [textAnimationDuration, setTextAnimationDuration] = useState(0.5);
  const [textAnimationDirection, setTextAnimationDirection] = useState<TextAnimationDirection>('in');

  const colorMatchReferenceClips = useMemo(
    () =>
      project.timeline.tracks
        .flatMap((track) => track.clips)
        .filter((item) => item.id !== clip.id && (item.type === 'video' || item.type === 'image')),
    [clip.id, project.timeline.tracks],
  );

  const textAnimationKeyframeCount = ['opacity', 'x', 'y', 'scaleX', 'scaleY'].reduce(
    (total, property) => total + (clip.keyframes?.[property as KeyframeProperty]?.length ?? 0),
    0,
  );

  useEffect(() => {
    if (!colorMatchReferenceClips.some((item) => item.id === colorMatchReferenceClipId)) {
      setColorMatchReferenceClipId(colorMatchReferenceClips[0]?.id ?? '');
    }
  }, [colorMatchReferenceClipId, colorMatchReferenceClips]);

  const applyTextAnimation = () => {
    if (clip.type !== 'text') {
      return;
    }
    runEffectCommand(
      new ApplyTextAnimationCommand(timelineAccessor, clip.id, {
        preset: textAnimationPreset,
        duration: textAnimationDuration,
        direction: textAnimationDirection,
      }),
    );
  };

  const applyColorMatch = async () => {
    const referenceClip = colorMatchReferenceClips.find((item) => item.id === colorMatchReferenceClipId);
    if (!referenceClip) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.colorMatch.failed,
        message: zhCN.inspector.colorMatch.referenceRequired,
      });
      return;
    }
    try {
      setColorMatchBusy(true);
      const colorCurves = await buildClipColorMatchCurves(clip, referenceClip, media);
      commit({ colorCorrection: { colorCurves } });
      showToast({ kind: 'success', title: zhCN.inspector.colorMatch.applied });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.colorMatch.failed,
        message: error instanceof Error ? error.message : zhCN.inspector.colorMatch.failedMessage,
      });
    } finally {
      setColorMatchBusy(false);
    }
  };

  return {
    batchShiftSeconds,
    setBatchShiftSeconds,
    batchScaleFactor,
    setBatchScaleFactor,
    batchEasing,
    setBatchEasing,
    colorMatchReferenceClipId,
    setColorMatchReferenceClipId,
    colorMatchBusy,
    setColorMatchBusy,
    textAnimationPreset,
    setTextAnimationPreset,
    textAnimationDuration,
    setTextAnimationDuration,
    textAnimationDirection,
    setTextAnimationDirection,
    colorMatchReferenceClips,
    textAnimationKeyframeCount,
    applyColorMatch,
    applyTextAnimation,
  };
}
