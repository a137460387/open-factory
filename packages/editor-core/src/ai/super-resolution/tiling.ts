/**
 * Tile-based processing for large images
 */

import type { ImageData, TileResult } from './types';

/**
 * 将大图像分割为重叠瓦片
 */
export function splitIntoTiles(image: ImageData, tileSize: number, overlap: number): ImageData[] {
  const { data, width, height } = image;
  const tiles: ImageData[] = [];
  const step = tileSize - overlap;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const tw = Math.min(tileSize, width - x);
      const th = Math.min(tileSize, height - y);
      const tileData = new Uint8ClampedArray(tw * th * 4);

      for (let ty = 0; ty < th; ty++) {
        for (let tx = 0; tx < tw; tx++) {
          const srcIdx = ((y + ty) * width + (x + tx)) * 4;
          const dstIdx = (ty * tw + tx) * 4;
          tileData[dstIdx] = data[srcIdx];
          tileData[dstIdx + 1] = data[srcIdx + 1];
          tileData[dstIdx + 2] = data[srcIdx + 2];
          tileData[dstIdx + 3] = data[srcIdx + 3];
        }
      }

      tiles.push({ data: tileData, width: tw, height: th });
    }
  }

  return tiles;
}

/**
 * 将瓦片拼接回完整图像，使用 alpha 融合处理重叠区域
 */
export function mergeTiles(tiles: TileResult[], outputWidth: number, outputHeight: number, overlap: number): ImageData {
  const outData = new Uint8ClampedArray(outputWidth * outputHeight * 4);
  const weightMap = new Float32Array(outputWidth * outputHeight);

  for (const tile of tiles) {
    const { data, x, y, width: tw, height: th } = tile;
    for (let ty = 0; ty < th; ty++) {
      for (let tx = 0; tx < tw; tx++) {
        const dstX = x + tx;
        const dstY = y + ty;
        if (dstX >= outputWidth || dstY >= outputHeight) continue;

        // 边缘衰减权重
        const wx = Math.min(tx + 1, tw - tx, overlap) / overlap;
        const wy = Math.min(ty + 1, th - ty, overlap) / overlap;
        const weight = Math.max(0.01, wx * wy);

        const srcIdx = (ty * tw + tx) * 4;
        const dstIdx = (dstY * outputWidth + dstX) * 4;

        for (let c = 0; c < 4; c++) {
          outData[dstIdx + c] += data[srcIdx + c] * weight;
        }
        weightMap[dstY * outputWidth + dstX] += weight;
      }
    }
  }

  // 归一化
  for (let i = 0; i < outData.length; i += 4) {
    const w = weightMap[i / 4];
    if (w > 0) {
      for (let c = 0; c < 4; c++) {
        outData[i + c] = Math.round(outData[i + c] / w);
      }
    }
  }

  return { data: outData, width: outputWidth, height: outputHeight };
}
