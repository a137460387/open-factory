import type {Clip, KeyframeProperty, Track, TransitionType, VolumeEnvelopePoint} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import type {SelectedKeyframeRef} from '../../store/editorStore';

export function formatTransitionBadge(type: TransitionType): string {
  if (type === 'dissolve') {
    return 'DS';
  }
  if (type === 'fade-black') {
    return 'FB';
  }
  return type
    .split('-')
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3);
}

export function envelopePointX(point: Pick<VolumeEnvelopePoint, 'time'>, duration: number): number {
  return Math.min(100, Math.max(0, (point.time / Math.max(0.001, duration)) * 100));
}

export function envelopePointY(point: Pick<VolumeEnvelopePoint, 'value'>): number {
  return Math.min(100, Math.max(0, 100 - (point.value / 2) * 100));
}

export function getClipKeyframeMarkers(clip: Clip): Array<{ id: string; property: KeyframeProperty; time: number }> {
  return (Object.keys(clip.keyframes ?? {}) as KeyframeProperty[]).flatMap((property) =>
    (clip.keyframes?.[property] ?? []).map((frame) => ({
      id: frame.id,
      property,
      time: frame.time,
    })),
  );
}

export function getKeyframeMarkerTime(clip: Clip, ref: SelectedKeyframeRef): number | undefined {
  if (clip.id !== ref.clipId) {
    return undefined;
  }
  return clip.keyframes?.[ref.property]?.find((frame) => frame.id === ref.keyframeId)?.time;
}

export function sameSelectedKeyframe(left: SelectedKeyframeRef, right: SelectedKeyframeRef): boolean {
  return left.clipId === right.clipId && left.property === right.property && left.keyframeId === right.keyframeId;
}

export function selectedKeyframeKey(keyframe: SelectedKeyframeRef): string {
  return `${keyframe.clipId}\0${keyframe.property}\0${keyframe.keyframeId}`;
}

export function getClipToneClass(type: Clip['type']): string {
  if (type === 'audio') {
    return 'bg-emerald-900/40 text-emerald-200';
  }
  if (type === 'text' || type === 'credits') {
    return 'bg-amber-900/40 text-amber-200';
  }
  if (type === 'subtitle') {
    return 'bg-amber-900/40 text-amber-200';
  }
  if (type === 'nested-sequence') {
    return 'bg-violet-900/40 text-violet-200';
  }
  return 'bg-sky-900/40 text-sky-200';
}

export function getTrackWaveformColor(trackType: Track['type']): string {
  if (trackType === 'audio') {
    return '#92400e';
  }
  if (trackType === 'video') {
    return '#0f766e';
  }
  return '#047857';
}

export function formatFrameRateLabel(frameRate: number): string {
  const rounded = Math.round(frameRate * 100) / 100;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}fps`;
}

export function formatTimelineKeyframeProperty(property: KeyframeProperty): string {
  return zhCN.inspector.keyframeProperty[property] ?? property;
}

export function drawWaveform(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  peaks: number[] | undefined,
  color: string,
): void {
  context.clearRect(0, 0, width, height);
  const values =
    peaks && peaks.length > 0 ? peaks : Array.from({ length: Math.max(16, Math.min(width, 64)) }, () => 0.2);
  const center = height / 2;
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const peak = values[Math.min(values.length - 1, Math.floor((x / Math.max(1, width)) * values.length))] ?? 0;
    const halfHeight = Math.max(1, peak * center);
    context.moveTo(x + 0.5, center - halfHeight);
    context.lineTo(x + 0.5, center + halfHeight);
  }
  context.stroke();
}
