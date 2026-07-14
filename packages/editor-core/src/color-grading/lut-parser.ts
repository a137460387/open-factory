// packages/editor-core/src/color-grading/lut-parser.ts
import type { LUTData } from './lut';

/** 解析 .cube 文件 */
export function parseCubeFile(content: string): LUTData {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const dataPoints: number[] = [];

  for (const line of lines) {
    if (line.startsWith('TITLE')) continue;

    if (line.startsWith('LUT_3D_SIZE')) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }

    if (line.startsWith('LUT_1D_SIZE')) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }

    if (line.startsWith('DOMAIN_MIN')) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      domainMin = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
      continue;
    }

    if (line.startsWith('DOMAIN_MAX')) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      domainMax = [parts[0] || 1, parts[1] || 1, parts[2] || 1];
      continue;
    }

    // 数据行
    const parts = line.split(/\s+/).map(Number);
    if (parts.length >= 3 && !isNaN(parts[0])) {
      dataPoints.push(parts[0], parts[1], parts[2]);
    }
  }

  if (size === 0) {
    throw new Error('Invalid .cube file: missing LUT_3D_SIZE or LUT_1D_SIZE');
  }

  const expectedLength = size * size * size * 3;
  if (dataPoints.length !== expectedLength) {
    // 尝试 1D LUT
    if (dataPoints.length === size * 3) {
      // 1D LUT，扩展为 3D
      const expanded = new Float32Array(size * size * size * 3);
      for (let b = 0; b < size; b++) {
        for (let g = 0; g < size; g++) {
          for (let r = 0; r < size; r++) {
            const idx = (b * size * size + g * size + r) * 3;
            expanded[idx] = dataPoints[r * 3];
            expanded[idx + 1] = dataPoints[r * 3 + 1];
            expanded[idx + 2] = dataPoints[r * 3 + 2];
          }
        }
      }
      return { size, domainMin, domainMax, data: expanded };
    }
    throw new Error(`Invalid .cube file: expected ${expectedLength} values, got ${dataPoints.length}`);
  }

  return {
    size,
    domainMin,
    domainMax,
    data: new Float32Array(dataPoints),
  };
}

/** 解析 .3dl 文件 */
export function parse3dlFile(content: string): LUTData {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  let size = 0;
  const dataPoints: number[] = [];

  for (const line of lines) {
    // .3dl 文件第一行通常是尺寸
    const parts = line.split(/\s+/).map(Number);

    if (parts.length === 1 && !isNaN(parts[0]) && size === 0) {
      size = parts[0];
      continue;
    }

    if (parts.length >= 3 && !isNaN(parts[0])) {
      dataPoints.push(parts[0], parts[1], parts[2]);
    }
  }

  if (size === 0) {
    // 尝试从数据量推断尺寸
    const cubeRoot = Math.round(Math.cbrt(dataPoints.length / 3));
    if (cubeRoot * cubeRoot * cubeRoot * 3 === dataPoints.length) {
      size = cubeRoot;
    } else {
      throw new Error('Invalid .3dl file: cannot determine LUT size');
    }
  }

  // .3dl 文件的值通常是 10-bit (0-1023) 或 12-bit (0-4095)
  const maxVal = Math.max(...dataPoints);
  const scale = maxVal > 1 ? 1 / 1023 : 1; // 假设 10-bit

  return {
    size,
    domainMin: [0, 0, 0],
    domainMax: [1, 1, 1],
    data: new Float32Array(dataPoints.map((v) => v * scale)),
  };
}

/** 导出为 .cube 格式 */
export function exportToCube(lut: LUTData, title?: string): string {
  const lines: string[] = [];

  if (title) {
    lines.push(`TITLE "${title}"`);
  }

  lines.push(`LUT_3D_SIZE ${lut.size}`);
  lines.push(`DOMAIN_MIN ${lut.domainMin[0]} ${lut.domainMin[1]} ${lut.domainMin[2]}`);
  lines.push(`DOMAIN_MAX ${lut.domainMax[0]} ${lut.domainMax[1]} ${lut.domainMax[2]}`);
  lines.push('');

  for (let b = 0; b < lut.size; b++) {
    for (let g = 0; g < lut.size; g++) {
      for (let r = 0; r < lut.size; r++) {
        const idx = (b * lut.size * lut.size + g * lut.size + r) * 3;
        lines.push(`${lut.data[idx].toFixed(6)} ${lut.data[idx + 1].toFixed(6)} ${lut.data[idx + 2].toFixed(6)}`);
      }
    }
  }

  return lines.join('\n');
}

/** 生成 LUT 预览缩略图数据 */
export function generateLUTPreview(lut: LUTData, width = 256, height = 32): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = x / (width - 1);

      // 在 LUT 中查找对应颜色
      const r = t;
      const g = t;
      const b = t;

      const ri = Math.min(lut.size - 1, Math.floor(r * (lut.size - 1)));
      const gi = Math.min(lut.size - 1, Math.floor(g * (lut.size - 1)));
      const bi = Math.min(lut.size - 1, Math.floor(b * (lut.size - 1)));

      const idx = (bi * lut.size * lut.size + gi * lut.size + ri) * 3;

      const pixelIdx = (y * width + x) * 4;
      pixels[pixelIdx] = Math.round(lut.data[idx] * 255);
      pixels[pixelIdx + 1] = Math.round(lut.data[idx + 1] * 255);
      pixels[pixelIdx + 2] = Math.round(lut.data[idx + 2] * 255);
      pixels[pixelIdx + 3] = 255;
    }
  }

  return pixels;
}
