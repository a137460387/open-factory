import {memo} from 'react';
import {CLIP_GROUP_COLOR_HEX, DEFAULT_TIMELINE_LABEL_COLOR_HEX, getEffectiveClipColorLabel, getTimelineLabelColorHex, shouldShowWaveform, isFrameRateMismatch, buildTrimDurationBubble, DEFAULT_TRACK_HEIGHT} from '@open-factory/editor-core';
import {AlertTriangle} from 'lucide-react';
import {clsx} from 'clsx';
import {zhCN} from '../../i18n/strings';
import {formatTransitionBadge, getClipToneClass, getTrackWaveformColor, formatFrameRateLabel} from './clip-helpers';
import {VolumeEnvelopeOverlay} from './VolumeEnvelopeOverlay';
import {DeferredClipAssetStrips, DeferredWaveformStrip, ClipAssetStrips} from './ClipAssetStrips';
import {WaveformStrip} from './WaveformStrip';
import {ClipKeyframeMarkers} from './ClipKeyframeMarkers';
import {ClipBadges} from './ClipBadges';
import type {ClipBlockProps} from './clip-block-types';

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
}: ClipBlockProps) {
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
      <ClipBadges clip={clip} transitionRightOffset={Boolean(transition)} />
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
      <ClipKeyframeMarkers
        clip={clip}
        selectedKeyframe={selectedKeyframe}
        selectedKeyframes={selectedKeyframes}
        drag={drag}
        locked={locked}
        onSelect={onSelect}
        onKeyframeSelect={onKeyframeSelect}
        onDragStart={onDragStart}
      />
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
  previous: ClipBlockProps,
  next: ClipBlockProps,
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
