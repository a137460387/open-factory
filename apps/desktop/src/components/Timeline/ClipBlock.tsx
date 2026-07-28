import {memo} from 'react';
import {CLIP_GROUP_COLOR_HEX, DEFAULT_TIMELINE_LABEL_COLOR_HEX, getEffectiveClipColorLabel, getTimelineLabelColorHex, shouldShowWaveform, isFrameRateMismatch, buildTrimDurationBubble, type Clip, type CollaborationClipLock, type AnomalyInterval, type ClipGroup, type MediaAsset, type TimelineLabelColor, type TimelineLargeProjectMode, type Track, type Transition, DEFAULT_TRACK_HEIGHT, EMOTION_COLORS} from '@open-factory/editor-core';
import {AlertTriangle} from 'lucide-react';
import {clsx} from 'clsx';
import {zhCN} from '../../i18n/strings';
import type {SelectedKeyframeRef} from '../../store/editorStore';
import type {DragState, VolumeEnvelopePointRequest, VolumeEnvelopeMenuRequest, TransitionMenuRequest, ClipMenuRequest} from './timeline-parts-types';
import {formatTransitionBadge, getClipKeyframeMarkers, getKeyframeMarkerTime, sameSelectedKeyframe, selectedKeyframeKey, getClipToneClass, getTrackWaveformColor, formatFrameRateLabel, formatTimelineKeyframeProperty} from './clip-helpers';
import {VolumeEnvelopeOverlay} from './VolumeEnvelopeOverlay';
import {DeferredClipAssetStrips, DeferredWaveformStrip, ClipAssetStrips} from './ClipAssetStrips';
import {WaveformStrip} from './WaveformStrip';

export function ClipBlock({
  clip,
  asset,
  left,
  width,
  selected,
  selectedKeyframe,
  selectedKeyframes,
  drag,
  onSelect,
  onKeyframeSelect,
  onDragStart,
  selectedClipIds,
  locked,
  clipPixelWidth,
  trackMuted,
  trackType,
  trackHeight,
  nextAdjacentClip,
  transition,
  onTransitionMenu,
  onClipMenu,
  onVolumeEnvelopeAdd,
  onVolumeEnvelopeUpdate,
  onVolumeEnvelopeRemove,
  onVolumeEnvelopeMenu,
  onClipDoubleClick,
  rollingTrimActive,
  slipEditActive,
  slideEditActive,
  clipGroup,
  trackColor,
  projectFrameRate,
  envelopeEditMode,
  reduceMotion,
  loadAssets,
  largeProjectMode,
  collaborationLock,
  onRemoveAnomaly,
}: {
  clip: Clip;
  asset?: MediaAsset;
  left: number;
  width: number;
  selected: boolean;
  selectedKeyframe?: SelectedKeyframeRef;
  selectedKeyframes: SelectedKeyframeRef[];
  drag?: DragState;
  onSelect(clipId: string, additive: boolean, forceSingle?: boolean): void;
  onKeyframeSelect(keyframe: SelectedKeyframeRef, additive: boolean): void;
  onDragStart(drag: DragState): void;
  selectedClipIds: string[];
  locked: boolean;
  clipPixelWidth: number;
  trackMuted: boolean;
  trackType: Track['type'];
  trackHeight?: number;
  nextAdjacentClip?: Clip;
  transition?: Transition;
  onTransitionMenu(request: TransitionMenuRequest): void;
  onClipMenu(request: ClipMenuRequest): void;
  onVolumeEnvelopeAdd(request: VolumeEnvelopePointRequest): void;
  onVolumeEnvelopeUpdate(request: Required<VolumeEnvelopePointRequest>): void;
  onVolumeEnvelopeRemove(request: Required<Pick<VolumeEnvelopePointRequest, 'clipId' | 'keyframeId'>>): void;
  onVolumeEnvelopeMenu(request: VolumeEnvelopeMenuRequest): void;
  onClipDoubleClick(clip: Clip): void;
  rollingTrimActive: boolean;
  slipEditActive: boolean;
  slideEditActive: boolean;
  clipGroup?: ClipGroup;
  trackColor: TimelineLabelColor | null;
  projectFrameRate: number;
  envelopeEditMode: boolean;
  reduceMotion: boolean;
  loadAssets: boolean;
  largeProjectMode: TimelineLargeProjectMode;
  collaborationLock?: CollaborationClipLock;
  onRemoveAnomaly(clipId: string, anomaly: AnomalyInterval): void;
}) {
  const waveformColor = getTrackWaveformColor(trackType);
  const effectiveColor = getEffectiveClipColorLabel(clip, { color: trackColor });
  const effectiveColorHex = effectiveColor
    ? getTimelineLabelColorHex(effectiveColor)
    : DEFAULT_TIMELINE_LABEL_COLOR_HEX;
  const isMoveDragging = drag?.mode === 'move' && (drag.clipIds?.includes(clip.id) || drag.clip?.id === clip.id);
  const showWaveform = shouldShowWaveform(trackHeight ?? DEFAULT_TRACK_HEIGHT);
  const trimBubble =
    drag?.clip?.id === clip.id && (drag.mode === 'trim-left' || drag.mode === 'trim-right')
      ? buildTrimDurationBubble(drag.clip.duration, drag.previewDuration ?? clip.duration)
      : undefined;
  const frameRateMismatch = asset?.type === 'video' && isFrameRateMismatch(asset.frameRate, projectFrameRate);
  const frameRateWarningTitle =
    frameRateMismatch && asset?.frameRate
      ? zhCN.timeline.frameRateMismatchTooltip(
          formatFrameRateLabel(asset.frameRate),
          formatFrameRateLabel(projectFrameRate),
        )
      : undefined;
  return (
    <div
      className={clsx(
        'group absolute top-2 flex h-10 select-none items-center overflow-hidden rounded-md border px-2.5 text-xs font-medium shadow-sm',
        getClipToneClass(clip.type),
        asset?.missing
          ? 'border-rose-500 bg-[repeating-linear-gradient(135deg,rgba(244,63,94,0.18)_0,rgba(244,63,94,0.18)_6px,transparent_6px,transparent_12px)]'
          : selected
            ? 'border-coral ring-2 ring-coral/30'
            : 'border-white/80',
        locked
          ? 'cursor-not-allowed opacity-70'
          : slipEditActive
            ? 'cursor-ew-resize'
            : slideEditActive
              ? 'cursor-grab'
              : rollingTrimActive
                ? 'cursor-col-resize'
                : 'cursor-grab',
        isMoveDragging && 'opacity-80 shadow-[0_12px_22px_rgba(15,23,42,0.24)] ring-2 ring-brand/30',
        !reduceMotion && !largeProjectMode.disableAnimations && 'transition-all duration-150 ease-out',
        clip.type === 'video' && clip.platformFitRemoved && 'opacity-40 grayscale',
      )}
      style={{ left, width }}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.button === 2) {
          return;
        }
        if (locked) {
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        onSelect(clip.id, event.shiftKey, event.altKey);
        const advancedMode = slideEditActive ? 'slide' : slipEditActive ? 'slip' : undefined;
        const clipIds = advancedMode
          ? [clip.id]
          : event.altKey
            ? selectedClipIds.includes(clip.id)
              ? selectedClipIds
              : [clip.id]
            : selectedClipIds.includes(clip.id)
              ? selectedClipIds
              : (clipGroup?.clipIds ?? [clip.id]);
        onDragStart({
          mode: advancedMode ?? 'move',
          clip,
          clipIds,
          startX: event.clientX,
          previewStart: clip.start,
          previewDuration: clip.duration,
          previewTrimStart: clip.trimStart,
          previewTrimEnd: clip.trimEnd,
        });
      }}
      onContextMenu={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const isRightEdge = bounds.right - event.clientX <= 14;
        if (locked) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (nextAdjacentClip && isRightEdge) {
          onTransitionMenu({
            x: event.clientX,
            y: event.clientY,
            fromClipId: clip.id,
            toClipId: nextAdjacentClip.id,
            existingTransitionId: transition?.id,
            existingType: transition?.type,
            existingDuration: transition?.duration,
          });
          return;
        }
        onClipMenu({ x: event.clientX, y: event.clientY, clipId: clip.id, clipType: clip.type });
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onClipDoubleClick(clip);
      }}
      title={
        asset?.missing
          ? zhCN.timeline.mediaMissing
          : (frameRateWarningTitle ?? `${clip.name} (${clip.duration.toFixed(2)}s)`)
      }
      role="gridcell"
      aria-label={`${clip.name} ${clip.start.toFixed(1)}s-${(clip.start + clip.duration).toFixed(1)}s`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onSelect(clip.id, event.shiftKey);
        }
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          onSelect(clip.id, false, true);
        }
      }}
      data-testid={`timeline-clip-${clip.id}`}
      data-clip-type={clip.type}
      data-clip-id={clip.id}
      data-clip-group-id={clipGroup?.id}
      data-color-label={effectiveColor ?? 'default'}
      data-dragging={isMoveDragging ? 'true' : 'false'}
      data-reduce-motion={reduceMotion ? 'true' : 'false'}
      data-collaboration-locked={collaborationLock ? 'true' : 'false'}
      data-platform-fit-removed={clip.type === 'video' && clip.platformFitRemoved ? 'true' : 'false'}
    >
      {trimBubble ? (
        <span
          className="pointer-events-none absolute left-1/2 top-1 z-40 -translate-x-1/2 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow"
          data-testid={`timeline-trim-duration-bubble-${clip.id}`}
        >
          {trimBubble}
        </span>
      ) : null}
      <span
        className="absolute bottom-0 left-0 top-0 z-20 w-1.5"
        style={{ backgroundColor: effectiveColorHex }}
        data-testid={`clip-color-strip-${clip.id}`}
        data-color={effectiveColor ?? 'default'}
      />
      {clipGroup ? (
        <>
          <span
            className="absolute left-0 right-0 top-0 z-20 h-1.5"
            style={{ backgroundColor: CLIP_GROUP_COLOR_HEX[clipGroup.color] }}
            data-testid={`timeline-clip-group-strip-${clip.id}`}
          />
          {width >= 86 ? (
            <span
              className="absolute left-1 top-1.5 z-20 max-w-[70%] truncate rounded-sm bg-panel/80 px-1 text-[9px] font-semibold text-[var(--color-text-secondary)]"
              data-testid={`timeline-clip-group-label-${clip.id}`}
            >
              {clipGroup.name}
            </span>
          ) : null}
        </>
      ) : null}
      {collaborationLock ? (
        <span
          className="absolute right-1 top-1 z-30 max-w-[72%] truncate rounded-sm bg-[var(--color-bg-primary)]/85 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
          title={zhCN.timeline.lockedByUser(collaborationLock.userName)}
          data-testid={`timeline-clip-remote-lock-${clip.id}`}
        >
          {zhCN.timeline.lockedByUser(collaborationLock.userName)}
        </span>
      ) : null}
      {loadAssets && clip.type === 'video' && asset ? (
        largeProjectMode.enabled ? (
          <DeferredClipAssetStrips
            clip={clip}
            asset={asset}
            clipPixelWidth={clipPixelWidth}
            trackMuted={trackMuted}
            waveformColor={waveformColor}
            largeProjectMode={largeProjectMode}
          />
        ) : (
          <ClipAssetStrips
            clip={clip}
            asset={asset}
            clipPixelWidth={clipPixelWidth}
            trackMuted={trackMuted}
            waveformColor={waveformColor}
            largeProjectMode={largeProjectMode}
          />
        )
      ) : null}
      {transition ? (
        <span
          className="absolute right-1 top-1 z-20 rounded bg-brand px-1 text-[10px] font-semibold text-white"
          data-testid={`timeline-transition-${transition.id}`}
        >
          {formatTransitionBadge(transition.type)}
        </span>
      ) : null}
      {frameRateMismatch ? (
        <span
          className="absolute top-1 z-20 inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-white shadow"
          style={{ right: transition ? 28 : 4 }}
          title={frameRateWarningTitle}
          data-testid={`timeline-frame-rate-warning-${clip.id}`}
        >
          <AlertTriangle size={11} />
        </span>
      ) : null}
      {clip.type === 'video' && (clip.stabilization?.shakeScore ?? 0) > 50 ? (
        <span
          className="absolute bottom-1 right-1 z-20 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-white shadow"
          title={zhCN.preview.shakeAnalysisHigh}
          data-testid={`shake-badge-${clip.id}`}
        >
          <AlertTriangle size={11} />
        </span>
      ) : null}
      {'motionType' in clip && (clip as { motionType?: { type: string; confidence: number } }).motionType ? (
        <span
          className="absolute bottom-1 left-1 z-20 inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-white shadow"
          title={
            zhCN.motionType.title +
            ': ' +
            ((zhCN.motionType as Record<string, string>)[(clip as { motionType: { type: string } }).motionType.type] ??
              (clip as { motionType: { type: string } }).motionType.type)
          }
          data-testid={`motion-type-badge-${clip.id}`}
          data-motion-type={(clip as { motionType: { type: string } }).motionType.type}
        >
          <span className="text-[8px] font-bold">M</span>
        </span>
      ) : null}
      {clip.type === 'video' && clip.aiPipSuggestion ? (
        <span
          className="absolute bottom-1 left-5 z-20 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow"
          title={zhCN.preview.pipAvoidanceWarning}
          data-testid={`pip-warning-${clip.id}`}
        >
          <AlertTriangle size={11} />
        </span>
      ) : null}
      {Array.isArray(clip.flashWarnings) && clip.flashWarnings.length > 0 ? (
        <span
          className="absolute bottom-1 right-5 z-20 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white shadow"
          title={zhCN.flashWarning.badge + ' (' + clip.flashWarnings.length + ')'}
          data-testid={`flash-warning-badge-${clip.id}`}
        >
          <AlertTriangle size={11} />
        </span>
      ) : null}
      {'readingSpeedWarning' in clip &&
      (clip as { readingSpeedWarning?: { severity: string } | null }).readingSpeedWarning ? (
        <span
          className={`absolute bottom-1 right-9 z-20 inline-flex h-4 w-4 items-center justify-center rounded-full ${(clip as { readingSpeedWarning: { severity: string } }).readingSpeedWarning.severity === 'critical' ? 'bg-[var(--color-danger)]' : 'bg-yellow-400'} text-white shadow`}
          title={
            zhCN.subtitleReadingSpeed.title +
            ' (' +
            (clip as { readingSpeedWarning: { charsPerSecond: number } }).readingSpeedWarning.charsPerSecond.toFixed(
              1,
            ) +
            ' ' +
            zhCN.subtitleReadingSpeed.charsPerSecond +
            ')'
          }
          data-testid={`reading-speed-warning-${clip.id}`}
        >
          <AlertTriangle size={11} />
        </span>
      ) : null}
      {'emotionAnalysis' in clip &&
      (clip as { emotionAnalysis?: { emotionTone: string; intensity: number } }).emotionAnalysis ? (
        <span
          className="absolute bottom-0 left-0 right-0 z-20 h-[3px]"
          style={{
            backgroundColor:
              EMOTION_COLORS[
                (clip as { emotionAnalysis: { emotionTone: keyof typeof EMOTION_COLORS } }).emotionAnalysis.emotionTone
              ],
          }}
          title={`${zhCN.emotionTone.title}: ${zhCN.emotionTone[(clip as { emotionAnalysis: { emotionTone: string } }).emotionAnalysis.emotionTone as keyof typeof zhCN.emotionTone] ?? (clip as { emotionAnalysis: { emotionTone: string } }).emotionAnalysis.emotionTone} (${Math.round((clip as { emotionAnalysis: { intensity: number } }).emotionAnalysis.intensity * 100)}%)`}
          data-testid={`emotion-bar-${clip.id}`}
        />
      ) : null}
      {locked ? null : (
        <span
          className="absolute left-0 top-0 z-30 h-full w-[4px] cursor-ew-resize bg-black/20 opacity-0 transition group-hover:opacity-100"
          data-testid={`timeline-trim-left-${clip.id}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            onSelect(clip.id, event.shiftKey, event.altKey);
            onDragStart({
              mode: 'trim-left',
              clip,
              startX: event.clientX,
              previewStart: clip.start,
              previewDuration: clip.duration,
              previewTrimStart: clip.trimStart,
              previewTrimEnd: clip.trimEnd,
            });
          }}
        />
      )}
      {loadAssets && clip.type === 'audio' && asset ? (
        largeProjectMode.enabled ? (
          showWaveform ? (
            <DeferredWaveformStrip
              clipId={clip.id}
              asset={asset}
              pixelWidth={clipPixelWidth}
              clipDuration={clip.duration}
              muted={trackMuted || Boolean(clip.muted)}
              color={waveformColor}
              pitchData={clip.pitchData}
              resolutionScale={largeProjectMode.waveformResolutionScale}
            />
          ) : null
        ) : showWaveform ? (
          <WaveformStrip
            clipId={clip.id}
            asset={asset}
            pixelWidth={clipPixelWidth}
            clipDuration={clip.duration}
            muted={trackMuted || Boolean(clip.muted)}
            color={waveformColor}
            pitchData={clip.pitchData}
            resolutionScale={largeProjectMode.waveformResolutionScale}
          />
        ) : null
      ) : null}
      {envelopeEditMode && clip.type === 'audio' && 'volume' in clip ? (
        <VolumeEnvelopeOverlay
          clip={clip}
          disabled={locked}
          onAdd={onVolumeEnvelopeAdd}
          onUpdate={onVolumeEnvelopeUpdate}
          onRemove={onVolumeEnvelopeRemove}
          onMenu={onVolumeEnvelopeMenu}
        />
      ) : null}
      <span className="relative z-10 truncate pl-1">
        {(clip.type === 'text' || clip.type === 'subtitle' || clip.type === 'credits') && 'text' in clip
          ? clip.text.slice(0, 28)
          : clip.name}
      </span>
      <span className="relative z-10 ml-auto pl-2 tabular-nums">{clip.duration.toFixed(1)}s</span>
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
      {Array.isArray(clip.flashWarnings) && clip.flashWarnings.length > 0 ? (
        <span
          className="absolute bottom-1.5 left-0 right-0 z-10 flex h-1"
          data-testid={`flash-warning-bars-${clip.id}`}
        >
          {clip.flashWarnings.map((fw, fi) => {
            const clipDuration = clip.duration || 1;
            const leftPct = Math.max(0, ((fw.startTime - clip.start) / clipDuration) * 100);
            const widthPct = Math.min(100 - leftPct, ((fw.endTime - fw.startTime) / clipDuration) * 100);
            const color =
              fw.severity === 'high'
                ? 'bg-[var(--color-danger)]'
                : fw.severity === 'medium'
                  ? 'bg-orange-400'
                  : 'bg-yellow-300';
            return (
              <span
                key={fi}
                className={`absolute h-1 ${color} opacity-70`}
                style={{ left: leftPct + '%', width: widthPct + '%' }}
                data-testid={`flash-bar-${clip.id}-${fi}`}
              />
            );
          })}
        </span>
      ) : null}
      {(clip.anomalies ?? []).length > 0 && (
        <span className="absolute bottom-0 left-0 right-0 z-10 flex h-1.5" data-testid={'anomaly-markers-' + clip.id}>
          {(clip.anomalies ?? []).map((anomaly, idx) => (
            <span
              key={idx}
              className="cursor-pointer h-1.5 flex-1"
              style={{ backgroundColor: anomaly.type === 'black' ? '#ef4444' : '#eab308' }}
              title={anomaly.type === 'black' ? '黑场' : '静态长镜头'}
              data-testid={'anomaly-marker-' + clip.id + '-' + idx}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onRemoveAnomaly(clip.id, anomaly);
              }}
            />
          ))}
        </span>
      )}
      {locked ? null : (
        <span
          className="absolute right-0 top-0 z-30 h-full w-[4px] cursor-ew-resize bg-black/20 opacity-0 transition group-hover:opacity-100"
          data-testid={`timeline-trim-right-${clip.id}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            onSelect(clip.id, event.shiftKey, event.altKey);
            onDragStart({
              mode: rollingTrimActive && nextAdjacentClip ? 'rolling-trim' : 'trim-right',
              clip,
              rightClip: rollingTrimActive ? nextAdjacentClip : undefined,
              startX: event.clientX,
              previewStart: clip.start,
              previewDuration: clip.duration,
              previewTrimStart: clip.trimStart,
              previewTrimEnd: clip.trimEnd,
            });
          }}
        />
      )}
    </div>
  );
}

export const MemoizedClipBlock = memo(ClipBlock, areClipBlockPropsEqual);

function areClipBlockPropsEqual(
  previous: Parameters<typeof ClipBlock>[0],
  next: Parameters<typeof ClipBlock>[0],
): boolean {
  return (
    previous.clip === next.clip &&
    previous.asset === next.asset &&
    previous.left === next.left &&
    previous.width === next.width &&
    previous.selected === next.selected &&
    previous.selectedKeyframe === next.selectedKeyframe &&
    previous.selectedKeyframes === next.selectedKeyframes &&
    previous.drag === next.drag &&
    previous.selectedClipIds === next.selectedClipIds &&
    previous.locked === next.locked &&
    previous.clipPixelWidth === next.clipPixelWidth &&
    previous.trackMuted === next.trackMuted &&
    previous.trackType === next.trackType &&
    previous.nextAdjacentClip === next.nextAdjacentClip &&
    previous.transition === next.transition &&
    previous.rollingTrimActive === next.rollingTrimActive &&
    previous.slipEditActive === next.slipEditActive &&
    previous.slideEditActive === next.slideEditActive &&
    previous.clipGroup === next.clipGroup &&
    previous.trackColor === next.trackColor &&
    previous.projectFrameRate === next.projectFrameRate &&
    previous.envelopeEditMode === next.envelopeEditMode &&
    previous.reduceMotion === next.reduceMotion &&
    previous.loadAssets === next.loadAssets &&
    previous.largeProjectMode === next.largeProjectMode &&
    previous.collaborationLock === next.collaborationLock
  );
}
