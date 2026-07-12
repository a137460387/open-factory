// packages/editor-core/src/color-grading/lut.ts

/** LUT 数据 */
export interface LUTData {
  size: number;         // 3D LUT 尺寸（如 17, 33, 65）
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  data: Float32Array;   // RGB 值数组，size^3 * 3
}

/** LUT 图层 */
export interface LUTLayer {
  id: string;
  lutId: string;        // 引用 LUTLibrary 中的ID
  intensity: number;    // 0 ~ 1 混合强度
  enabled: boolean;
}

/** LUT 库条目 */
export interface LUTLibraryEntry {
  id: string;
  name: string;
  filePath: string;
  format: 'cube' | '3dl';
  size: number;
  thumbnail?: string;   // 预览缩略图
  tags: string[];
  createdAt: string;
}

/** 创建 LUT 图层 */
export function createLUTLayer(lutId: string): LUTLayer {
  return {
    id: `lut-layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    lutId,
    intensity: 1,
    enabled: true,
  };
}

/** 验证 LUT 数据 */
export function validateLUTData(data: LUTData): boolean {
  if (data.size < 2 || data.size > 256) return false;
  const expectedLength = data.size * data.size * data.size * 3;
  if (data.data.length !== expectedLength) return false;
  if (data.domainMin.some(v => v < -10 || v > 10)) return false;
  if (data.domainMax.some(v => v < -10 || v > 10)) return false;
  return true;
}

/** 归一化 LUT 图层 */
export function normalizeLUTLayer(layer: unknown): LUTLayer | null {
  if (!layer || typeof layer !== 'object') return null;
  const l = layer as Record<string, unknown>;
  if (typeof l.lutId !== 'string') return null;
  return {
    id: typeof l.id === 'string' ? l.id : `lut-layer-${Date.now()}`,
    lutId: l.lutId,
    intensity: typeof l.intensity === 'number' ? Math.max(0, Math.min(1, l.intensity)) : 1,
    enabled: l.enabled !== false,
  };
}
