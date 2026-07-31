import {
  getEffectNumberParam,
  getTransformScaleX,
  getTransformScaleY,
  normalizeInputColorSpace,
  normalizeProjectColorPipeline,
  normalizeMasks,
  buildMotionBlurPreviewVector,
  topologicallySortColorNodeGraph,
  triangulatePathMask,
  sampleColorCurves,
  NodeGraphEngine,
  type ChromaKey,
  type ClipMask,
  type ColorCorrection,
  type ColorNodeGraph,
  type ColorWheelValue,
  type EffectType,
  type Effect,
  type InputColorSpace,
  type ProjectColorPipeline,
  type SubtitleStyle,
  type TextStyle,
  type Transform,
} from '@open-factory/editor-core';

import type { ColorGradingGraph, UniformValue } from '@open-factory/editor-core';

export function buildFullscreenQuadPoints(width: number, height: number): number[] {
  return [0, 0, width, 0, 0, height, 0, height, width, 0, width, height];
}

export function buildChromaKeyColorUniforms(chromaKey: ChromaKey): Float32Array {
  const values = new Float32Array(9);
  const colors = chromaKey.colors.length > 0 ? chromaKey.colors : [chromaKey.color];
  for (let index = 0; index < 3; index += 1) {
    const color = colors[index] ?? colors[0] ?? [0, 255, 0];
    values[index * 3] = color[0] / 255;
    values[index * 3 + 1] = color[1] / 255;
    values[index * 3 + 2] = color[2] / 255;
  }
  return values;
}

export function buildChromaKeyParamUniforms(chromaKey: ChromaKey): [number, number, number, number] {
  if (!chromaKey.enabled) {
    return [0, chromaKey.similarity, chromaKey.blend, chromaKey.colors.length];
  }
  if (chromaKey.mode === 'luma-key') {
    return [2, chromaKey.lumaThreshold, chromaKey.lumaTolerance, chromaKey.lumaSoftness];
  }
  if (chromaKey.mode === 'difference-matte') {
    return [3, chromaKey.differenceThreshold, 0, 0];
  }
  return [1, chromaKey.similarity, chromaKey.blend, chromaKey.colors.length];
}

export function drawTextBackground(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  text: string,
  style: TextStyle | SubtitleStyle,
): void {
  if (style.backgroundOpacity <= 0) {
    return;
  }
  const metrics = context.measureText(text);
  const padding = Math.max(6, style.fontSize * 0.25);
  const width = Math.max(style.fontSize, metrics.width) + padding * 2;
  const height = style.fontSize * 1.35 + padding;
  context.save();
  context.globalAlpha = Math.min(1, Math.max(0, style.backgroundOpacity));
  context.fillStyle = style.backgroundColor;
  context.fillRect(centerX - width / 2, centerY - height / 2, width, height);
  context.restore();
}

export function buildCurveTextureData(
  colorCurves: Partial<NonNullable<ColorCorrection['colorCurves']>> | undefined,
): Uint8Array {
  const data = new Uint8Array(256 * 4);
  for (let index = 0; index < 256; index += 1) {
    const sample = sampleColorCurves(colorCurves, index / 255);
    data[index * 4] = Math.round(sample.r * 255);
    data[index * 4 + 1] = Math.round(sample.g * 255);
    data[index * 4 + 2] = Math.round(sample.b * 255);
    data[index * 4 + 3] = 255;
  }
  return data;
}

export function wheelOffset(value: ColorWheelValue, channel: 'r' | 'g' | 'b'): number {
  return value[channel] + value.intensity - 1;
}

export function wheelValue(value: ColorWheelValue, channel: 'r' | 'g' | 'b'): number {
  return Math.max(0.001, value[channel] + value.intensity);
}

export function inputColorSpaceIndex(value: InputColorSpace | undefined): number {
  switch (normalizeInputColorSpace(value)) {
    case 'slog2':
      return 1;
    case 'slog3':
      return 2;
    case 'clog':
      return 3;
    case 'clog3':
      return 4;
    case 'llog':
      return 5;
    case 'vlog':
      return 6;
    default:
      return 0;
  }
}

export function colorPipelineIndex(value: ProjectColorPipeline | undefined): number {
  switch (normalizeProjectColorPipeline(value)) {
    case 'hdr-rec2020':
      return 1;
    case 'aces':
      return 2;
    default:
      return 0;
  }
}

export function buildPreviewEffectParams(
  effects: Effect[] | undefined,
  disabledEffectTypes: EffectType[] = [],
  colorGradingGraph?: ColorGradingGraph,
): {
  blur: number;
  grain: number;
  vignette: number;
  chromatic: number;
  sharpen: number;
  motionX: number;
  motionY: number;
  motionSamples: number;
  motionJitter: number;
  colorGradingUniforms?: Record<string, UniformValue>;
} {
  const params: {
    blur: number;
    grain: number;
    vignette: number;
    chromatic: number;
    sharpen: number;
    motionX: number;
    motionY: number;
    motionSamples: number;
    motionJitter: number;
    colorGradingUniforms?: Record<string, UniformValue>;
  } = {
    blur: 0,
    grain: 0,
    vignette: 0,
    chromatic: 0,
    sharpen: 0,
    motionX: 0,
    motionY: 0,
    motionSamples: 0,
    motionJitter: 0,
  };
  const disabled = new Set(disabledEffectTypes);
  for (const effect of effects ?? []) {
    if (!effect.enabled || disabled.has(effect.type)) {
      continue;
    }
    if (effect.type === 'blur') {
      params.blur = Math.max(params.blur, Math.min(12, Math.max(0, getEffectNumberParam(effect.params, 'radius', 0))));
    } else if (effect.type === 'film-grain') {
      params.grain = Math.max(
        params.grain,
        Math.min(1, Math.max(0, getEffectNumberParam(effect.params, 'strength', 0))),
      );
    } else if (effect.type === 'vignette') {
      params.vignette = Math.max(
        params.vignette,
        Math.min(1, Math.max(0, getEffectNumberParam(effect.params, 'intensity', 0))),
      );
    } else if (effect.type === 'chromatic-aberration') {
      params.chromatic = Math.max(
        params.chromatic,
        Math.min(20, Math.max(0, getEffectNumberParam(effect.params, 'strength', 0))),
      );
    } else if (effect.type === 'sharpen') {
      params.sharpen = Math.max(
        params.sharpen,
        Math.min(3, Math.max(0, getEffectNumberParam(effect.params, 'strength', 0))),
      );
    } else if (effect.type === 'motion-blur') {
      const motion = buildMotionBlurPreviewVector(effect.params);
      if (
        motion.samples > params.motionSamples ||
        Math.hypot(motion.x, motion.y) > Math.hypot(params.motionX, params.motionY)
      ) {
        params.motionX = motion.x;
        params.motionY = motion.y;
        params.motionSamples = motion.samples;
      }
      params.motionJitter = Math.max(params.motionJitter, motion.jitter);
    }
  }

  // Merge color grading graph uniforms
  if (colorGradingGraph && colorGradingGraph.nodes.length > 0) {
    const execution = NodeGraphEngine.execute(colorGradingGraph);
    if (execution.nodeResults.length > 0) {
      params.colorGradingUniforms = execution.combinedUniforms;
    }
  }

  return params;
}

export function buildMaskUniforms(masks: ClipMask[] | undefined): {
  count: number;
  data: Float32Array;
  flags: Float32Array;
  pathTriangleCount: number;
  pathTrianglesA: Float32Array;
  pathTrianglesB: Float32Array;
  pathMaskInverted: number;
} {
  const enabledMasks = normalizeMasks(masks).filter((mask) => mask.enabled);
  const shapeMasks = enabledMasks.filter((mask) => mask.type !== 'path').slice(0, 8);
  const data = new Float32Array(8 * 4);
  const flags = new Float32Array(8 * 4);
  shapeMasks.forEach((mask, index) => {
    const dataOffset = index * 4;
    data[dataOffset] = mask.x;
    data[dataOffset + 1] = mask.y;
    data[dataOffset + 2] = mask.w;
    data[dataOffset + 3] = mask.h;
    flags[dataOffset] = mask.type === 'ellipse' ? 1 : 0;
    flags[dataOffset + 1] = mask.inverted ? 1 : 0;
    flags[dataOffset + 2] = mask.feather;
    flags[dataOffset + 3] = 1;
  });
  const pathTrianglesA = new Float32Array(24 * 4);
  const pathTrianglesB = new Float32Array(24 * 4);
  const pathMask = enabledMasks.find((mask) => mask.type === 'path');
  const mesh = pathMask ? triangulatePathMask(pathMask.path) : { vertices: [], indices: [] };
  const pathTriangleCount = Math.min(24, Math.floor(mesh.indices.length / 3));
  for (let triangle = 0; triangle < pathTriangleCount; triangle += 1) {
    const dataOffset = triangle * 4;
    const first = mesh.indices[triangle * 3];
    const second = mesh.indices[triangle * 3 + 1];
    const third = mesh.indices[triangle * 3 + 2];
    pathTrianglesA[dataOffset] = mesh.vertices[first * 2] ?? 0;
    pathTrianglesA[dataOffset + 1] = mesh.vertices[first * 2 + 1] ?? 0;
    pathTrianglesA[dataOffset + 2] = mesh.vertices[second * 2] ?? 0;
    pathTrianglesA[dataOffset + 3] = mesh.vertices[second * 2 + 1] ?? 0;
    pathTrianglesB[dataOffset] = mesh.vertices[third * 2] ?? 0;
    pathTrianglesB[dataOffset + 1] = mesh.vertices[third * 2 + 1] ?? 0;
  }
  return {
    count: shapeMasks.length,
    data,
    flags,
    pathTriangleCount,
    pathTrianglesA,
    pathTrianglesB,
    pathMaskInverted: pathMask?.inverted ? 1 : 0,
  };
}

export function resolveTextTransform(canvasHeight: number, transform: Transform, style: TextStyle | SubtitleStyle): Transform {
  if (!('yOffset' in style)) {
    return transform;
  }
  return {
    ...transform,
    x: 0,
    y: canvasHeight / 2 - style.yOffset - style.fontSize / 2,
  };
}

export function buildTransformedQuad(
  canvasWidth: number,
  canvasHeight: number,
  mediaWidth: number,
  mediaHeight: number,
  transform: Transform,
): number[] {
  const width = Math.max(1, mediaWidth * getTransformScaleX(transform));
  const height = Math.max(1, mediaHeight * getTransformScaleY(transform));
  const centerX = canvasWidth / 2 + transform.x;
  const centerY = canvasHeight / 2 + transform.y;
  const rotation = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const corners = [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [-width / 2, height / 2],
    [-width / 2, height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
  ];
  return corners.flatMap(([x, y]) => [centerX + x * cos - y * sin, centerY + x * sin + y * cos]);
}

export function buildAcesToneMappingShaderInjection(colorPipeline: ProjectColorPipeline): string {
  if (normalizeProjectColorPipeline(colorPipeline) !== 'aces') {
    return '';
  }
  return `
      vec3 hillAcesToneMap(vec3 color) {
        color = max(color, vec3(0.0));
        vec3 numerator = color * (color + vec3(0.0245786)) - vec3(0.000090537);
        vec3 denominator = color * (vec3(0.983729) * color + vec3(0.4329510)) + vec3(0.238081);
        return clamp(numerator / max(denominator, vec3(0.000001)), 0.0, 1.0);
      }
  `;
}

export function buildBlendModeShaderInjection(): string {
  return `
      float blendOverlayChannel(float base, float top) {
        return base < 0.5 ? 2.0 * base * top : 1.0 - 2.0 * (1.0 - base) * (1.0 - top);
      }

      float blendSoftLightChannel(float base, float top) {
        if (top <= 0.5) {
          return base - (1.0 - 2.0 * top) * base * (1.0 - base);
        }
        float d = base <= 0.25 ? ((16.0 * base - 12.0) * base + 4.0) * base : sqrt(base);
        return base + (2.0 * top - 1.0) * (d - base);
      }

      vec3 applyBlendMode(vec3 base, vec3 top, float mode) {
        if (mode < 0.5) {
          return top;
        }
        if (mode < 1.5) {
          return vec3(
            blendOverlayChannel(base.r, top.r),
            blendOverlayChannel(base.g, top.g),
            blendOverlayChannel(base.b, top.b)
          );
        }
        if (mode < 2.5) {
          return 1.0 - (1.0 - base) * (1.0 - top);
        }
        if (mode < 3.5) {
          return base * top;
        }
        if (mode < 4.5) {
          return abs(base - top);
        }
        if (mode < 5.5) {
          return vec3(
            top.r <= 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - base.r) / top.r),
            top.g <= 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - base.g) / top.g),
            top.b <= 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - base.b) / top.b)
          );
        }
        if (mode < 6.5) {
          return vec3(
            top.r >= 1.0 ? 1.0 : min(1.0, base.r / (1.0 - top.r)),
            top.g >= 1.0 ? 1.0 : min(1.0, base.g / (1.0 - top.g)),
            top.b >= 1.0 ? 1.0 : min(1.0, base.b / (1.0 - top.b))
          );
        }
        if (mode < 7.5) {
          return vec3(
            top.r < 0.5 ? 2.0 * base.r * top.r : 1.0 - 2.0 * (1.0 - base.r) * (1.0 - top.r),
            top.g < 0.5 ? 2.0 * base.g * top.g : 1.0 - 2.0 * (1.0 - base.g) * (1.0 - top.g),
            top.b < 0.5 ? 2.0 * base.b * top.b : 1.0 - 2.0 * (1.0 - base.b) * (1.0 - top.b)
          );
        }
        return vec3(
          blendSoftLightChannel(base.r, top.r),
          blendSoftLightChannel(base.g, top.g),
          blendSoftLightChannel(base.b, top.b)
        );
      }
  `;
}
