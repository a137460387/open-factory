/**
 * LUT 层标准化工具
 *
 * 从 model/clip-normalize.ts 中提取，消除 color-node-graph.ts 对
 * model/clip-normalize.ts 的依赖，打断循环依赖链。
 */

import type { LUTLayer } from './model-types-primitives';
import { round } from './time';

export function normalizeLutLayers(
  luts: LUTLayer[] | undefined,
  lutPath?: string | null,
): LUTLayer[] {
  // If luts array is explicitly provided, normalize it (max 3, filter intensity=0)
  if (luts && luts.length > 0) {
    return luts
      .slice(0, 3)
      .map((l) => ({
        path: (typeof l.path === 'string' ? l.path.trim() : '') || '',
        intensity: round(Math.min(1, Math.max(0, typeof l.intensity === 'number' ? l.intensity : 1))),
      }))
      .filter((l) => l.path.length > 0);
  }
  // Backward compat: upgrade legacy lutPath string to single LUTLayer
  const normalizedPath = normalizeLutPath(lutPath);
  if (normalizedPath) {
    return [{ path: normalizedPath, intensity: 1 }];
  }
  return [];
}

function normalizeLutPath(path: string | null | undefined): string | null {
  const trimmed = path?.trim();
  return trimmed ? trimmed : null;
}
