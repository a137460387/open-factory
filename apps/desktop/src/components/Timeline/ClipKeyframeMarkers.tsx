import type {Clip} from '@open-factory/editor-core';
import {clsx} from 'clsx';
import {zhCN} from '../../i18n/strings';
import type {SelectedKeyframeRef} from '../../store/editorStore';
import type {DragState} from './timeline-parts-types';
import {getClipKeyframeMarkers, getKeyframeMarkerTime, sameSelectedKeyframe, selectedKeyframeKey, formatTimelineKeyframeProperty} from './clip-helpers';

export function ClipKeyframeMarkers({
  clip,
  selectedKeyframe,
  selectedKeyframes,
  drag,
  locked,
  onSelect,
  onKeyframeSelect,
  onDragStart,
}: {
  clip: Clip;
  selectedKeyframe?: SelectedKeyframeRef;
  selectedKeyframes: SelectedKeyframeRef[];
  drag?: DragState;
  locked: boolean;
  onSelect(clipId: string, additive: boolean, forceSingle?: boolean): void;
  onKeyframeSelect(keyframe: SelectedKeyframeRef, additive: boolean): void;
  onDragStart(drag: DragState): void;
}) {
  return (
    <>
      {getClipKeyframeMarkers(clip).map((marker) => {
        const keyframeRef = { clipId: clip.id, property: marker.property, keyframeId: marker.id };
        const isSelectedKeyframe =
          selectedKeyframes.some((item) => sameSelectedKeyframe(item, keyframeRef)) ||
          (selectedKeyframe?.clipId === clip.id &&
            selectedKeyframe.property === marker.property &&
            selectedKeyframe.keyframeId === marker.id);
        const markerKey = selectedKeyframeKey(keyframeRef);
        const previewMarkerTime = drag?.mode === 'keyframe' ? drag.previewKeyframeTimes?.[markerKey] : undefined;
        const markerTime =
          previewMarkerTime !== undefined
            ? previewMarkerTime
            : drag?.mode === 'keyframe' &&
                drag.clip?.id === clip.id &&
                drag.keyframeProperty === marker.property &&
                drag.keyframeId === marker.id
              ? (drag.previewKeyframeTime ?? marker.time)
              : marker.time;
        return (
          <span
            key={`${marker.property}-${marker.id}`}
            className={clsx(
              'absolute bottom-0 z-20 h-2.5 w-2.5 -translate-x-1/2 rotate-45 cursor-ew-resize border shadow',
              isSelectedKeyframe ? 'border-black bg-[var(--color-bg-elevated)]' : 'border-white bg-coral',
            )}
            style={{ left: `${Math.min(100, Math.max(0, (markerTime / Math.max(0.001, clip.duration)) * 100))}%` }}
            title={zhCN.timeline.keyframeTitle(formatTimelineKeyframeProperty(marker.property), marker.time)}
            data-testid={`timeline-keyframe-${clip.id}-${marker.property}-${marker.id}`}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (locked) {
                return;
              }
              event.currentTarget.setPointerCapture(event.pointerId);
              const selectedBeforePointerDown = selectedKeyframes.some((item) =>
                sameSelectedKeyframe(item, keyframeRef),
              );
              if (!event.shiftKey) {
                onSelect(clip.id, false);
              }
              onKeyframeSelect(keyframeRef, event.shiftKey);
              const dragKeyframes = event.shiftKey
                ? selectedBeforePointerDown
                  ? selectedKeyframes.filter((item) => !sameSelectedKeyframe(item, keyframeRef))
                  : [...selectedKeyframes, keyframeRef]
                : selectedBeforePointerDown && selectedKeyframes.length > 1
                  ? selectedKeyframes
                  : [keyframeRef];
              const keyframeSelectionOnly = event.shiftKey && selectedBeforePointerDown;
              onDragStart({
                mode: 'keyframe',
                clip,
                keyframeProperty: marker.property,
                keyframeId: marker.id,
                keyframes: keyframeSelectionOnly ? [] : dragKeyframes.length > 0 ? dragKeyframes : [keyframeRef],
                keyframeSelectionOnly,
                keyframeStartTimes: Object.fromEntries(
                  (keyframeSelectionOnly ? [] : dragKeyframes.length > 0 ? dragKeyframes : [keyframeRef]).map((ref) => [
                    selectedKeyframeKey(ref),
                    getKeyframeMarkerTime(clip, ref) ?? marker.time,
                  ]),
                ),
                startX: event.clientX,
                previewStart: marker.time,
                previewDuration: clip.duration,
                previewTrimStart: clip.trimStart,
                previewTrimEnd: clip.trimEnd,
                previewKeyframeTime: marker.time,
              });
            }}
          />
        );
      })}
    </>
  );
}
