// Types and interfaces for WebGL preview compositor

import type {
  ChromaKey,
  ClipBlendMode,
  ClipMask,
  ColorCorrection,
  ColorNode,
  ColorNodeGraph,
  ColorWheelValue,
  EffectType,
  Effect,
  InputColorSpace,
  ProjectColorPipeline,
  SubtitleStyle,
  TextStyle,
  Transform,
  ColorGradingGraph,
} from '@open-factory/editor-core';

interface ProgramInfo {
  program: WebGLProgram;
  position: number;
  texCoord: number;
  resolution: WebGLUniformLocation;
  texture: WebGLUniformLocation;
  baseTexture: WebGLUniformLocation;
  curveLut: WebGLUniformLocation;
  opacity: WebGLUniformLocation;
  blendMode: WebGLUniformLocation;
  inputColorSpace: WebGLUniformLocation;
  colorPipeline: WebGLUniformLocation;
  colorCorrection: WebGLUniformLocation;
  lift: WebGLUniformLocation;
  gamma: WebGLUniformLocation;
  gain: WebGLUniformLocation;
  chromaKeyColors: WebGLUniformLocation;
  chromaKeyParams: WebGLUniformLocation;
  maskCount: WebGLUniformLocation;
  maskData: WebGLUniformLocation;
  maskFlags: WebGLUniformLocation;
  pathTriangleCount: WebGLUniformLocation;
  pathTrianglesA: WebGLUniformLocation;
  pathTrianglesB: WebGLUniformLocation;
  pathMaskInverted: WebGLUniformLocation;
  effectParams: WebGLUniformLocation;
  sharpen: WebGLUniformLocation;
  motionBlur: WebGLUniformLocation;
}

interface CustomShaderProgramInfo {
  program: WebGLProgram;
  position: number;
  texCoord: number;
  resolution: WebGLUniformLocation | null;
  texture: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  progress: WebGLUniformLocation | null;
}

interface PanoramaProgramInfo {
  program: WebGLProgram;
  position: number;
  texCoord: number;
  texture: WebGLUniformLocation | null;
  yaw: WebGLUniformLocation | null;
  pitch: WebGLUniformLocation | null;
  roll: WebGLUniformLocation | null;
  fov: WebGLUniformLocation | null;
  aspect: WebGLUniformLocation | null;
  opacity: WebGLUniformLocation | null;
}

export interface WebGlSourceProcessingOptions {
  bypassProcessing?: boolean;
  customShaderTime?: number;
  customShaderProgress?: number;
  disabledEffectTypes?: EffectType[];
  colorPipeline?: ProjectColorPipeline;
  blendMode?: ClipBlendMode;
  textureCacheKey?: string;
  textureBytes?: number;
}

export interface ColorNodeGraphPreviewPass {
  nodeId: string;
  nodeType: ColorNode['type'];
  correction: ColorCorrection;
}
