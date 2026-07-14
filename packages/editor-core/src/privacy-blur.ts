import { createId, normalizeMask, normalizePrivacyBlurEffect, type ClipMask, type PrivacyBlurEffect } from './model';
import { round } from './time';

export interface DetectedPrivacyBox {
  time: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  confidence?: number;
}

export interface BuildPrivacyMasksOptions {
  effect?: PrivacyBlurEffect;
  color?: string;
  idPrefix?: string;
}

export function buildPrivacyMasksFromDetections(
  detections: readonly DetectedPrivacyBox[],
  options: BuildPrivacyMasksOptions = {},
): ClipMask[] {
  const keyframes = detections
    .flatMap((box) => normalizePrivacyBox(box))
    .sort((left, right) => left.time - right.time || left.x - right.x || left.y - right.y);
  if (keyframes.length === 0) {
    return [];
  }
  const first = keyframes[0];
  return [
    normalizeMask({
      id: createId(options.idPrefix ?? 'privacy-mask'),
      type: 'rect',
      x: first.x,
      y: first.y,
      w: first.w,
      h: first.h,
      keyframes,
      inverted: false,
      feather: 0,
      enabled: true,
      privacyBlur: {
        enabled: true,
        effect: normalizePrivacyBlurEffect(options.effect),
        color: options.color,
      },
    }),
  ];
}

function normalizePrivacyBox(
  box: DetectedPrivacyBox,
): Array<{ time: number; x: number; y: number; w: number; h: number }> {
  if (!Number.isFinite(box.time)) {
    return [];
  }
  const w = clampPositiveUnit(box.w, 0.1);
  const h = clampPositiveUnit(box.h, 0.1);
  return [
    {
      time: round(Math.max(0, box.time)),
      x: round(Math.min(1 - w, Math.max(0, finiteOrDefault(box.x, 0)))),
      y: round(Math.min(1 - h, Math.max(0, finiteOrDefault(box.y, 0)))),
      w,
      h,
    },
  ];
}

function clampPositiveUnit(value: number | undefined, fallback: number): number {
  return round(Math.min(1, Math.max(0.001, finiteOrDefault(value, fallback))));
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
