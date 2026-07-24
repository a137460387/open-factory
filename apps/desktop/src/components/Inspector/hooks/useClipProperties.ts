import { useCallback } from 'react';
import type { Clip, ClipPatch } from '@open-factory/editor-core';
import {
  getClipSpeed,
  getTransformScaleX,
  getTransformScaleY,
} from '@open-factory/editor-core';

export interface UseClipPropertiesOptions {
  clip: Clip;
  commit: (patch: ClipPatch) => void;
}

export function useClipProperties({ clip, commit }: UseClipPropertiesOptions) {
  const speed = getClipSpeed(clip);
  const transformScaleX = getTransformScaleX(clip.transform);
  const transformScaleY = getTransformScaleY(clip.transform);

  const commitTransform = useCallback(
    (patch: Partial<Clip['transform']>) => commit({ transform: patch }),
    [commit],
  );

  const commitColorCorrection = useCallback(
    (patch: Record<string, unknown>) => commit({ colorCorrection: patch } as ClipPatch),
    [commit],
  );

  const commitStyle = useCallback(
    (patch: Record<string, unknown>) => commit({ style: patch } as ClipPatch),
    [commit],
  );

  const commitChromaKey = useCallback(
    (patch: Record<string, unknown>) => commit({ chromaKey: patch } as ClipPatch),
    [commit],
  );

  return {
    speed,
    transformScaleX,
    transformScaleY,
    commit,
    commitTransform,
    commitColorCorrection,
    commitStyle,
    commitChromaKey,
  };
}
