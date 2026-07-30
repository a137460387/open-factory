import type {Clip} from '@open-factory/editor-core';
import {
  BatchKeyframeEditCommand,
  BatchUpdateKeyframeCommand,
  KEYFRAME_PROPERTY_LIMITS,
  RemoveKeyframeCommand,
  UpdateKeyframeCommand,
  parseKeyframeExpression,
  type BatchKeyframeEditOperation,
  type ClipPatch,
  type Keyframe,
  type KeyframeProperty,
} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {commandManager, timelineAccessor} from '../../store/commandManager';
import {showToast} from '../../lib/toast';
import type {SelectedKeyframeRef} from '../../store/editorStore';
import type {resolveSelectedKeyframeEntries} from './InspectorEditors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseKeyframesStateParams {
  clip: Clip;
  selectedKeyframe: SelectedKeyframeRef | undefined;
  selectedKeyframeFrame: Keyframe<number> | undefined;
  selectedKeyframeEntries: ReturnType<typeof resolveSelectedKeyframeEntries>;
  setSelectedKeyframes: (keyframes: SelectedKeyframeRef[]) => void;
}

export interface UseKeyframesStateReturn {
  updateSelectedKeyframe: (
    patch: Partial<Pick<Keyframe<number>, 'time' | 'value' | 'easing' | 'inHandle' | 'outHandle' | 'handleMode'>>,
  ) => void;
  removeSelectedKeyframe: () => void;
  runBatchKeyframeEdit: (operation: BatchKeyframeEditOperation, clearAfter?: boolean) => void;
  updateSelectedKeyframeExpression: (field: 'time' | 'value', expression: string) => void;
  updateCurveKeyframes: (property: KeyframeProperty, frames: Keyframe<number>[]) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKeyframesState({
  clip,
  selectedKeyframe,
  selectedKeyframeFrame,
  selectedKeyframeEntries,
  setSelectedKeyframes,
}: UseKeyframesStateParams): UseKeyframesStateReturn {
  const updateSelectedKeyframe = (
    patch: Partial<Pick<Keyframe<number>, 'time' | 'value' | 'easing' | 'inHandle' | 'outHandle' | 'handleMode'>>,
  ) => {
    if (!selectedKeyframe) {
      return;
    }
    try {
      commandManager.execute(
        new UpdateKeyframeCommand(
          timelineAccessor,
          clip.id,
          selectedKeyframe.property,
          selectedKeyframe.keyframeId,
          patch,
        ),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.keyframeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.updateKeyframeFailed,
      });
    }
  };

  const removeSelectedKeyframe = () => {
    if (!selectedKeyframe) {
      return;
    }
    try {
      commandManager.execute(
        new RemoveKeyframeCommand(timelineAccessor, clip.id, selectedKeyframe.property, selectedKeyframe.keyframeId),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.keyframeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.removeKeyframeFailed,
      });
    }
  };

  const runBatchKeyframeEdit = (operation: BatchKeyframeEditOperation, clearAfter = false) => {
    const refs = selectedKeyframeEntries.map((entry) => entry.ref);
    if (refs.length === 0) {
      return;
    }
    try {
      commandManager.execute(new BatchKeyframeEditCommand(timelineAccessor, refs, operation));
      if (clearAfter) {
        setSelectedKeyframes([]);
      }
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.keyframeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.updateKeyframeFailed,
      });
    }
  };

  const updateSelectedKeyframeExpression = (field: 'time' | 'value', expression: string) => {
    if (!selectedKeyframe || !selectedKeyframeFrame) {
      return;
    }
    const frames = [...(clip.keyframes?.[selectedKeyframe.property] ?? [])].sort(
      (left, right) => left.time - right.time || left.id.localeCompare(right.id),
    );
    const frameIndex = frames.findIndex((frame) => frame.id === selectedKeyframe.keyframeId);
    const previous = frameIndex > 0 ? frames[frameIndex - 1] : undefined;
    const next = frameIndex >= 0 ? frames[frameIndex + 1] : undefined;
    const limits =
      field === 'time' ? { min: 0, max: clip.duration } : KEYFRAME_PROPERTY_LIMITS[selectedKeyframe.property];
    try {
      const parsed = parseKeyframeExpression(expression, {
        prev: field === 'time' ? previous?.time : previous?.value,
        current: field === 'time' ? selectedKeyframeFrame.time : selectedKeyframeFrame.value,
        next: field === 'time' ? next?.time : next?.value,
        min: limits.min,
        max: limits.max,
      });
      updateSelectedKeyframe({ [field]: parsed });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.keyframeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.updateKeyframeFailed,
      });
    }
  };

  const updateCurveKeyframes = (property: KeyframeProperty, frames: Keyframe<number>[]) => {
    try {
      commandManager.execute(
        new BatchUpdateKeyframeCommand(
          timelineAccessor,
          [
            {
              clipId: clip.id,
              property,
              replace: true,
              keyframes: frames.map((frame) => ({
                id: frame.id,
                time: frame.time,
                value: frame.value,
                easing: frame.easing,
                inHandle: frame.inHandle,
                outHandle: frame.outHandle,
                handleMode: frame.handleMode,
              })),
            },
          ],
          'Edit keyframe curve',
        ),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.keyframeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.updateKeyframeFailed,
      });
    }
  };

  return {
    updateSelectedKeyframe,
    removeSelectedKeyframe,
    runBatchKeyframeEdit,
    updateSelectedKeyframeExpression,
    updateCurveKeyframes,
  };
}
