import {clamp01} from '@open-factory/editor-core';
import type {Keyframe, KeyframeEasing, KeyframeHandleMode, KeyframeProperty} from '@open-factory/editor-core';
import {zhCN} from '../../../i18n/strings';

export type SpeedCurveFrame = { id: string; time: number; value: number; easing: KeyframeEasing };

export type CurveEditorDrag =
  | { mode: 'box'; start: CanvasPoint; current: CanvasPoint }
  | { mode: 'points'; start: CurveEditorFrame; base: CurveEditorFrame[]; selectedIds: string[] }
  | { mode: 'handle'; keyframeId: string; handle: 'in' | 'out'; base: CurveEditorFrame[] };

export type CanvasPoint = { x: number; y: number };
export type CurveEditorFrame = Keyframe<number>;

export function roundFinite(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
}

/** @deprecated 使用 clamp01 代替 */
export const clampUnit = clamp01;

export function formatKeyframeProperty(property: KeyframeProperty): string {
  return zhCN.inspector.keyframeProperty[property] ?? property;
}

export function formatKeyframeValue(property: KeyframeProperty, value: number): string {
  if (property === 'speed') {
    return `${value.toFixed(2)}x`;
  }
  if (
    property === 'opacity' ||
    property === 'volume' ||
    property === 'scaleX' ||
    property === 'scaleY' ||
    property === 'pathStartOffset'
  ) {
    return `${Math.round(value * 100)}%`;
  }
  if (property === 'yaw' || property === 'pitch' || property === 'roll') {
    return `${Math.round(value)}°`;
  }
  return value.toFixed(2);
}
