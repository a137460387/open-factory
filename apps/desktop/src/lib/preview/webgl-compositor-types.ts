// Types and interfaces for WebGL preview compositor

import type {
  ClipBlendMode,
  ColorCorrection,
  ColorNode,
  EffectType,
  ProjectColorPipeline,
} from '@open-factory/editor-core';

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
