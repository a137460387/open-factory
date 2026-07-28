/**
 * ACES色彩管理模块 - LUT管理器
 */

import type { RGBColor, LUTData, LUTLibrary } from './types';
import { clamp, lerp } from './math-utils';

/**
 * LUT管理器
 */
export class LUTManager implements LUTLibrary {
  luts: Map<string, LUTData> = new Map();

  addLUT(lut: LUTData): void {
    this.luts.set(lut.id, lut);
  }

  getLUT(id: string): LUTData | undefined {
    return this.luts.get(id);
  }

  removeLUT(id: string): boolean {
    return this.luts.delete(id);
  }

  listLUTs(): LUTData[] {
    return Array.from(this.luts.values());
  }

  /**
   * 应用3D LUT
   */
  apply3DLUT(lut: LUTData, color: RGBColor): RGBColor {
    if (lut.type !== '3d') {
      throw new Error('只能应用3D LUT');
    }

    const { size, data, domainMin, domainMax } = lut;

    // 归一化到LUT域
    const normalized: RGBColor = {
      r: (color.r - domainMin.r) / (domainMax.r - domainMin.r),
      g: (color.g - domainMin.g) / (domainMax.g - domainMin.g),
      b: (color.b - domainMin.b) / (domainMax.b - domainMin.b),
    };

    // 钳制到[0, 1]
    const clamped: RGBColor = {
      r: clamp(normalized.r, 0, 1),
      g: clamp(normalized.g, 0, 1),
      b: clamp(normalized.b, 0, 1),
    };

    // 计算LUT索引
    const rIdx = clamped.r * (size - 1);
    const gIdx = clamped.g * (size - 1);
    const bIdx = clamped.b * (size - 1);

    // 三线性插值
    const r0 = Math.floor(rIdx);
    const g0 = Math.floor(gIdx);
    const b0 = Math.floor(bIdx);
    const r1 = Math.min(r0 + 1, size - 1);
    const g1 = Math.min(g0 + 1, size - 1);
    const b1 = Math.min(b0 + 1, size - 1);

    const rf = rIdx - r0;
    const gf = gIdx - g0;
    const bf = bIdx - b0;

    // 获取LUT值
    const getLUTValue = (ri: number, gi: number, bi: number, channel: number): number => {
      const idx = (bi * size * size + gi * size + ri) * 3 + channel;
      return data[idx];
    };

    // 三线性插值
    const interpolate = (channel: number): number => {
      const c000 = getLUTValue(r0, g0, b0, channel);
      const c001 = getLUTValue(r0, g0, b1, channel);
      const c010 = getLUTValue(r0, g1, b0, channel);
      const c011 = getLUTValue(r0, g1, b1, channel);
      const c100 = getLUTValue(r1, g0, b0, channel);
      const c101 = getLUTValue(r1, g0, b1, channel);
      const c110 = getLUTValue(r1, g1, b0, channel);
      const c111 = getLUTValue(r1, g1, b1, channel);

      const c00 = lerp(c000, c100, rf);
      const c01 = lerp(c001, c101, rf);
      const c10 = lerp(c010, c110, rf);
      const c11 = lerp(c011, c111, rf);

      const c0 = lerp(c00, c10, gf);
      const c1 = lerp(c01, c11, gf);

      return lerp(c0, c1, bf);
    };

    return {
      r: interpolate(0),
      g: interpolate(1),
      b: interpolate(2),
    };
  }

  /**
   * 应用1D LUT
   */
  apply1DLUT(lut: LUTData, color: RGBColor): RGBColor {
    if (lut.type !== '1d') {
      throw new Error('只能应用1D LUT');
    }

    const { size, data, domainMin, domainMax } = lut;

    const interpolate1D = (value: number, channel: number): number => {
      const normalized = (value - domainMin.r) / (domainMax.r - domainMin.r);
      const clamped = clamp(normalized, 0, 1);
      const idx = clamped * (size - 1);
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, size - 1);
      const f = idx - i0;

      return lerp(data[i0 * 3 + channel], data[i1 * 3 + channel], f);
    };

    return {
      r: interpolate1D(color.r, 0),
      g: interpolate1D(color.g, 1),
      b: interpolate1D(color.b, 2),
    };
  }
}
