import {clamp01, clamp} from '@open-factory/editor-core';

export function roundFinite(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
}

/** @deprecated use clamp01 instead */
export const clampUnit = clamp01;

/** @deprecated use clamp(value, -1, 1) instead */
export const clampSigned = (value: number): number => clamp(value, -1, 1);
