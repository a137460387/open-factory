import {
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  getEnabledCustomShaderEffect,
  normalizeCustomShaderParams,
  normalizeColorCorrection,
  normalizeClipBlendMode,
  normalizeColorNodeGraph,
  normalizeProjectColorPipeline,
  normalizeThreeWayColor,
  normalizeChromaKey,
  topologicallySortColorNodeGraph,
  clipBlendModeToShaderIndex,
  type ChromaKey,
  type ClipBlendMode,
  type ClipPanoramaView,
  type ClipMask,
  type ColorCorrection,
  type ColorNodeGraph,
  type Effect,
  type ProjectColorPipeline,
  type SubtitleStyle,
  type TextStyle,
  type Transform,
} from '@open-factory/editor-core';

import type { ColorGradingGraph } from '@open-factory/editor-core';

import { zhCN } from '../../i18n/strings';
import { ColorGradingRenderer } from '../color-grading/color-grading-renderer';
import {
  DEFAULT_GPU_PREVIEW_METRICS,
  GPU_TEXTURE_POOL_MAX_BYTES,
  GpuTexturePool,
  calculateInstancedDrawCallCount,
  estimateTextureBytes,
  type GpuPreviewMetrics,
} from './gpu-acceleration';
import { logger } from '@open-factory/editor-core/utils';
import type {WebGlSourceProcessingOptions, ColorNodeGraphPreviewPass, ProgramInfo, CustomShaderProgramInfo, PanoramaProgramInfo} from './webgl-compositor-types.js';

export type {WebGlSourceProcessingOptions, ColorNodeGraphPreviewPass} from './webgl-compositor-types.js';

export {
  buildFullscreenQuadPoints,
  buildChromaKeyColorUniforms,
  buildChromaKeyParamUniforms,
  drawTextBackground,
  buildCurveTextureData,
  wheelOffset,
  wheelValue,
  inputColorSpaceIndex,
  colorPipelineIndex,
  buildPreviewEffectParams,
  buildMaskUniforms,
  resolveTextTransform,
  buildTransformedQuad,
  buildAcesToneMappingShaderInjection,
  buildBlendModeShaderInjection,
} from './webgl-compositor-shaders.js';

export {
  compileShader,
  createProgram,
  createCustomShaderProgram,
  createPanoramaProgram,
  VERTEX_SHADER_SOURCE,
} from './webgl-compositor-programs.js';

import {
  buildFullscreenQuadPoints,
  buildChromaKeyColorUniforms,
  buildChromaKeyParamUniforms,
  drawTextBackground,
  buildCurveTextureData,
  wheelOffset,
  wheelValue,
  inputColorSpaceIndex,
  colorPipelineIndex,
  buildPreviewEffectParams,
  buildMaskUniforms,
  resolveTextTransform,
  buildTransformedQuad,
} from './webgl-compositor-shaders.js';

import {
  compileShader,
  createProgram,
  createCustomShaderProgram,
  createPanoramaProgram,
  VERTEX_SHADER_SOURCE,
} from './webgl-compositor-programs.js';

export interface WebGlResolvedSourceProcessing {
  correction: ColorCorrection;
  colorPipeline: ProjectColorPipeline;
  key: ChromaKey;
  maskUniforms: ReturnType<typeof buildMaskUniforms>;
  effectParams: ReturnType<typeof buildPreviewEffectParams>;
  colorGradingGraph?: ColorGradingGraph;
}

export class WebGlPreviewCompositor {
  private readonly gl: WebGLRenderingContext;
  private readonly program: ProgramInfo;
  private readonly positionBuffer: WebGLBuffer;
  private readonly texCoordBuffer: WebGLBuffer;
  private readonly curveTexture: WebGLTexture;
  private readonly blendBaseTexture: WebGLTexture;
  private readonly textures = new WeakMap<TexImageSource, WebGLTexture>();
  private readonly texturePool: GpuTexturePool<WebGLTexture>;
  private readonly customPrograms = new Map<string, CustomShaderProgramInfo | null>();
  private panoramaProgram?: PanoramaProgramInfo | null;
  private frameStartedAt = 0;
  private drawCalls = 0;
  private readonly timerQuerySupported: boolean;
  private lastMetrics: GpuPreviewMetrics = DEFAULT_GPU_PREVIEW_METRICS;
  private colorGradingRenderer?: ColorGradingRenderer;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: window.__OPEN_FACTORY_NATIVE_PREVIEW_SMOKE_ACTIVE__ === true,
    });
    if (!gl) {
      throw new Error(zhCN.errors.webglPreviewUnavailable);
    }
    this.gl = gl;
    this.program = createProgram(gl);
    const positionBuffer = gl.createBuffer();
    const texCoordBuffer = gl.createBuffer();
    const curveTexture = gl.createTexture();
    const blendBaseTexture = gl.createTexture();
    if (!positionBuffer || !texCoordBuffer || !curveTexture || !blendBaseTexture) {
      throw new Error(zhCN.errors.webglBufferAllocationFailed);
    }
    this.positionBuffer = positionBuffer;
    this.texCoordBuffer = texCoordBuffer;
    this.curveTexture = curveTexture;
    this.blendBaseTexture = blendBaseTexture;
    this.texturePool = new GpuTexturePool<WebGLTexture>({
      maxBytes: GPU_TEXTURE_POOL_MAX_BYTES,
      disposeTexture: (texture) => gl.deleteTexture(texture),
    });
    this.timerQuerySupported = Boolean(gl.getExtension('EXT_disjoint_timer_query'));
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, this.blendBaseTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  begin(width: number, height: number, clearColor: [number, number, number, number] = [0.078, 0.094, 0.125, 1]): void {
    const gl = this.gl;
    this.frameStartedAt = performance.now();
    this.drawCalls = 0;
    gl.viewport(0, 0, width, height);
    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program.program);
    gl.uniform2f(this.program.resolution, width, height);
    gl.uniform1i(this.program.texture, 0);
    gl.uniform1i(this.program.curveLut, 1);
    gl.uniform1i(this.program.baseTexture, 2);
    gl.uniform1f(this.program.blendMode, 0);
  }

  drawSource(
    source: TexImageSource,
    mediaWidth: number,
    mediaHeight: number,
    transform: Transform,
    colorCorrection?: Partial<ColorCorrection>,
    effects?: Effect[],
    chromaKey?: Partial<ChromaKey>,
    masks?: ClipMask[],
    options: WebGlSourceProcessingOptions = {},
  ): void {
    const gl = this.gl;
    const texture = this.getTexture(
      source,
      options.textureCacheKey,
      options.textureBytes ?? estimateTextureBytes(mediaWidth, mediaHeight),
    );
    const disabledEffectTypes = new Set(options.disabledEffectTypes ?? []);
    const blendMode = normalizeClipBlendMode(options.blendMode);
    const customShader =
      options.bypassProcessing || disabledEffectTypes.has('custom-shader')
        ? undefined
        : getEnabledCustomShaderEffect(effects);
    if (customShader && blendMode === 'normal') {
      const params = normalizeCustomShaderParams(customShader.params);
      if (this.drawCustomShaderSource(source, texture, mediaWidth, mediaHeight, transform, params.source, options)) {
        return;
      }
    }
    if (blendMode !== 'normal') {
      this.prepareBlendPass();
    } else {
      this.finishBlendPass();
    }
    gl.useProgram(this.program.program);
    const { correction, colorPipeline, key, maskUniforms, effectParams } = resolveWebGlSourceProcessing(
      colorCorrection,
      effects,
      chromaKey,
      masks,
      options,
    );
    const threeWayColor = normalizeThreeWayColor(correction.threeWayColor);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      buildCurveTextureData(correction.colorCurves),
    );
    gl.uniform1f(this.program.opacity, Math.max(0, Math.min(1, transform.opacity)));
    gl.uniform1f(this.program.blendMode, clipBlendModeToShaderIndex(blendMode));
    gl.uniform1f(this.program.inputColorSpace, inputColorSpaceIndex(correction.inputColorSpace));
    gl.uniform1f(this.program.colorPipeline, colorPipelineIndex(colorPipeline));
    gl.uniform4f(
      this.program.colorCorrection,
      correction.brightness,
      correction.contrast,
      correction.saturation,
      correction.hue,
    );
    gl.uniform3f(
      this.program.lift,
      wheelOffset(threeWayColor.lift, 'r'),
      wheelOffset(threeWayColor.lift, 'g'),
      wheelOffset(threeWayColor.lift, 'b'),
    );
    gl.uniform3f(
      this.program.gamma,
      wheelValue(threeWayColor.gamma, 'r'),
      wheelValue(threeWayColor.gamma, 'g'),
      wheelValue(threeWayColor.gamma, 'b'),
    );
    gl.uniform3f(
      this.program.gain,
      wheelValue(threeWayColor.gain, 'r'),
      wheelValue(threeWayColor.gain, 'g'),
      wheelValue(threeWayColor.gain, 'b'),
    );
    gl.uniform3fv(this.program.chromaKeyColors, buildChromaKeyColorUniforms(key));
    const keyParams = buildChromaKeyParamUniforms(key);
    gl.uniform4f(this.program.chromaKeyParams, keyParams[0], keyParams[1], keyParams[2], keyParams[3]);
    gl.uniform1i(this.program.maskCount, maskUniforms.count);
    gl.uniform4fv(this.program.maskData, maskUniforms.data);
    gl.uniform4fv(this.program.maskFlags, maskUniforms.flags);
    gl.uniform1i(this.program.pathTriangleCount, maskUniforms.pathTriangleCount);
    gl.uniform4fv(this.program.pathTrianglesA, maskUniforms.pathTrianglesA);
    gl.uniform4fv(this.program.pathTrianglesB, maskUniforms.pathTrianglesB);
    gl.uniform1f(this.program.pathMaskInverted, maskUniforms.pathMaskInverted);
    gl.uniform4f(
      this.program.effectParams,
      effectParams.blur,
      effectParams.grain,
      effectParams.vignette,
      effectParams.chromatic,
    );
    gl.uniform1f(this.program.sharpen, effectParams.sharpen);
    gl.uniform4f(
      this.program.motionBlur,
      effectParams.motionX,
      effectParams.motionY,
      effectParams.motionSamples,
      effectParams.motionJitter,
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.drawQuad(
      buildTransformedQuad(gl.canvas.width, gl.canvas.height, mediaWidth, mediaHeight, transform),
      this.program,
    );
    this.finishBlendPass();
  }

  drawSourceWithColorNodeGraph(
    source: TexImageSource,
    mediaWidth: number,
    mediaHeight: number,
    transform: Transform,
    colorNodeGraph: Partial<ColorNodeGraph> | undefined,
    fallbackColorCorrection?: Partial<ColorCorrection>,
    effects?: Effect[],
    chromaKey?: Partial<ChromaKey>,
    masks?: ClipMask[],
    options: WebGlSourceProcessingOptions = {},
    colorGradingGraph?: ColorGradingGraph,
  ): boolean {
    if (options.bypassProcessing || !colorNodeGraph) {
      this.drawSource(
        source,
        mediaWidth,
        mediaHeight,
        transform,
        fallbackColorCorrection,
        effects,
        chromaKey,
        masks,
        options,
      );
      return true;
    }

    let passes: ColorNodeGraphPreviewPass[];
    try {
      passes = resolveColorNodeGraphPreviewPasses(colorNodeGraph, fallbackColorCorrection);
    } catch (error) {
      logger.warn('Unable to resolve color node graph preview passes', error);
      this.drawSource(
        source,
        mediaWidth,
        mediaHeight,
        transform,
        fallbackColorCorrection,
        effects,
        chromaKey,
        masks,
        options,
      );
      return false;
    }

    const width = Math.max(1, Number(this.gl.canvas.width));
    const height = Math.max(1, Number(this.gl.canvas.height));
    const scratch = document.createElement('canvas');
    scratch.width = width;
    scratch.height = height;

    let scratchCompositor: WebGlPreviewCompositor;
    try {
      scratchCompositor = new WebGlPreviewCompositor(scratch);
    } catch (error) {
      logger.warn('Unable to allocate color node graph preview compositor', error);
      this.drawSource(
        source,
        mediaWidth,
        mediaHeight,
        transform,
        fallbackColorCorrection,
        effects,
        chromaKey,
        masks,
        options,
      );
      return false;
    }

    scratchCompositor.begin(width, height, [0, 0, 0, 0]);
    scratchCompositor.drawSource(source, mediaWidth, mediaHeight, transform, undefined, undefined, chromaKey, masks, {
      ...options,
      blendMode: 'normal',
      colorPipeline: 'sdr-srgb',
    });
    for (const pass of passes) {
      scratchCompositor.applyAdjustmentLayer(pass.correction, undefined, { colorPipeline: 'sdr-srgb' });
    }
    if ((effects?.length ?? 0) > 0 || options.colorPipeline) {
      scratchCompositor.applyAdjustmentLayer(undefined, effects, {
        disabledEffectTypes: options.disabledEffectTypes,
        colorPipeline: options.colorPipeline,
      });
    }
    scratchCompositor.finish();

    this.drawSource(scratch, width, height, DEFAULT_TRANSFORM, undefined, undefined, undefined, undefined, {
      bypassProcessing: true,
      blendMode: options.blendMode,
    });

    // Apply color grading graph as a post-processing pass if present
    if (colorGradingGraph && colorGradingGraph.nodes.length > 0 && !options.bypassProcessing) {
      this.applyColorGradingPass(colorGradingGraph, width, height);
    }

    return true;
  }

  drawPanoramaSource(
    source: TexImageSource,
    mediaWidth: number,
    mediaHeight: number,
    transform: Transform,
    panorama: ClipPanoramaView,
    options: WebGlSourceProcessingOptions = {},
  ): boolean {
    if (options.bypassProcessing || normalizeClipBlendMode(options.blendMode) !== 'normal') {
      return false;
    }
    const gl = this.gl;
    const program = this.getPanoramaProgram();
    if (!program) {
      return false;
    }
    const texture = this.getTexture(
      source,
      options.textureCacheKey,
      options.textureBytes ?? estimateTextureBytes(mediaWidth, mediaHeight),
    );
    gl.useProgram(program.program);
    if (program.texture) {
      gl.uniform1i(program.texture, 0);
    }
    if (program.yaw) {
      gl.uniform1f(program.yaw, (panorama.yaw * Math.PI) / 180);
    }
    if (program.pitch) {
      gl.uniform1f(program.pitch, (panorama.pitch * Math.PI) / 180);
    }
    if (program.roll) {
      gl.uniform1f(program.roll, (panorama.roll * Math.PI) / 180);
    }
    if (program.fov) {
      gl.uniform1f(program.fov, (panorama.fov * Math.PI) / 180);
    }
    if (program.aspect) {
      gl.uniform1f(program.aspect, Math.max(0.001, Number(gl.canvas.width) / Math.max(1, Number(gl.canvas.height))));
    }
    if (program.opacity) {
      gl.uniform1f(program.opacity, Math.max(0, Math.min(1, transform.opacity)));
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.drawQuad(
      buildTransformedQuad(
        gl.canvas.width,
        gl.canvas.height,
        Math.max(1, Number(gl.canvas.width)),
        Math.max(1, Number(gl.canvas.height)),
        transform,
      ),
      program,
    );
    return mediaWidth > 0 && mediaHeight > 0;
  }

  drawText(
    text: string,
    transform: Transform,
    style: TextStyle | SubtitleStyle,
    colorCorrection?: Partial<ColorCorrection>,
    effects?: Effect[],
    colorNodeGraph?: Partial<ColorNodeGraph>,
    options: WebGlSourceProcessingOptions = {},
  ): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${style.italic ? 'italic ' : ''}${style.bold ? '700 ' : '400 '}${style.fontSize}px ${style.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawTextBackground(ctx, canvas.width / 2, canvas.height / 2, text, style);
    ctx.fillStyle = style.color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    this.drawSourceWithColorNodeGraph(
      canvas,
      canvas.width,
      canvas.height,
      resolveTextTransform(Number(this.gl.canvas.height), transform, style),
      colorNodeGraph,
      colorCorrection,
      effects,
      undefined,
      undefined,
      options,
    );
  }

  drawMissing(name: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 680;
    canvas.height = 136;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9f1239';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 36px Inter, Arial, sans-serif';
    ctx.fillText(zhCN.preview.missingMedia(name), canvas.width / 2, canvas.height / 2);
    this.drawSource(canvas, canvas.width, canvas.height, { x: 0, y: 0, scale: 0.5, rotation: 0, opacity: 1 });
  }

  finish(): void {
    this.gl.flush();
    this.lastMetrics = {
      gpuFrameMs: Math.max(0, performance.now() - this.frameStartedAt),
      textureBytes: this.texturePool.sizeBytes,
      textureCount: this.texturePool.size,
      drawCalls: this.drawCalls,
      instancedDrawCalls: calculateInstancedDrawCallCount(this.drawCalls, true),
      offscreenWorkerSupported: false,
      offscreenWorkerActive: false,
      timerQuerySupported: this.timerQuerySupported,
    };
  }

  getMetrics(): GpuPreviewMetrics {
    return this.lastMetrics;
  }

  preloadSourceTexture(source: TexImageSource, mediaWidth: number, mediaHeight: number, cacheKey: string): boolean {
    if (!cacheKey.trim()) {
      return false;
    }
    try {
      const gl = this.gl;
      const texture = this.getTexture(source, cacheKey, estimateTextureBytes(mediaWidth, mediaHeight));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      return true;
    } catch (error) {
      logger.warn('Unable to preload GPU preview texture', error);
      return false;
    }
  }

  readCenterPixel(): number[] {
    const gl = this.gl;
    const pixel = new Uint8Array(4);
    gl.readPixels(
      Math.floor(gl.canvas.width / 2),
      Math.floor(gl.canvas.height / 2),
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel,
    );
    return Array.from(pixel);
  }

  readFramePixels(): { width: number; height: number; data: Uint8Array } {
    const gl = this.gl;
    const width = Number(gl.canvas.width);
    const height = Number(gl.canvas.height);
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return { width, height, data: pixels };
  }

  applyAdjustmentLayer(
    colorCorrection?: Partial<ColorCorrection>,
    effects?: Effect[],
    options: WebGlSourceProcessingOptions = {},
  ): void {
    const frame = this.readFramePixels();
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const image = context.createImageData(frame.width, frame.height);
    for (let y = 0; y < frame.height; y += 1) {
      const sourceStart = (frame.height - y - 1) * frame.width * 4;
      const targetStart = y * frame.width * 4;
      image.data.set(frame.data.subarray(sourceStart, sourceStart + frame.width * 4), targetStart);
    }
    context.putImageData(image, 0, 0);
    this.begin(frame.width, frame.height);
    this.drawSource(
      canvas,
      frame.width,
      frame.height,
      DEFAULT_TRANSFORM,
      colorCorrection,
      effects,
      undefined,
      undefined,
      options,
    );
  }

  applyColorNodeGraph(
    colorNodeGraph: Partial<ColorNodeGraph> | undefined,
    fallbackColorCorrection?: Partial<ColorCorrection>,
    effects?: Effect[],
    options: WebGlSourceProcessingOptions = {},
    colorGradingGraph?: ColorGradingGraph,
  ): boolean {
    if (options.bypassProcessing || !colorNodeGraph) {
      this.applyAdjustmentLayer(fallbackColorCorrection, effects, options);
      return true;
    }

    let passes: ColorNodeGraphPreviewPass[];
    try {
      passes = resolveColorNodeGraphPreviewPasses(colorNodeGraph, fallbackColorCorrection);
    } catch (error) {
      logger.warn('Unable to resolve adjustment color node graph preview passes', error);
      this.applyAdjustmentLayer(fallbackColorCorrection, effects, options);
      return false;
    }

    for (const pass of passes) {
      this.applyAdjustmentLayer(pass.correction, undefined, { colorPipeline: 'sdr-srgb' });
    }
    if ((effects?.length ?? 0) > 0 || options.colorPipeline) {
      this.applyAdjustmentLayer(undefined, effects, {
        disabledEffectTypes: options.disabledEffectTypes,
        colorPipeline: options.colorPipeline,
      });
    }
    if (colorGradingGraph && colorGradingGraph.nodes.length > 0 && !options.bypassProcessing) {
      const gl = this.gl;
      const w = Math.max(1, Number(gl.canvas.width));
      const h = Math.max(1, Number(gl.canvas.height));
      this.applyColorGradingPass(colorGradingGraph, w, h);
    }
    return true;
  }

  private getTexture(source: TexImageSource, cacheKey?: string, bytes?: number): WebGLTexture {
    const key = cacheKey?.trim();
    if (key) {
      const pooled = this.texturePool.get(key);
      if (pooled) {
        return pooled;
      }
    }
    const cached = this.textures.get(source);
    if (cached) {
      if (key) {
        this.texturePool.put({ key, texture: cached, bytes: bytes ?? 1 });
      }
      return cached;
    }
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error(zhCN.errors.webglTextureAllocationFailed);
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (!key || !this.texturePool.put({ key, texture, bytes: bytes ?? 1 })) {
      this.textures.set(source, texture);
    }
    return texture;
  }

  private prepareBlendPass(): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.blendBaseTexture);
    gl.copyTexImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      0,
      0,
      Math.max(1, Number(gl.canvas.width)),
      Math.max(1, Number(gl.canvas.height)),
      0,
    );
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
  }

  private finishBlendPass(): void {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private drawCustomShaderSource(
    source: TexImageSource,
    texture: WebGLTexture,
    mediaWidth: number,
    mediaHeight: number,
    transform: Transform,
    sourceCode: string,
    options: WebGlSourceProcessingOptions,
  ): boolean {
    const gl = this.gl;
    const program = this.getCustomProgram(sourceCode);
    if (!program) {
      return false;
    }
    gl.useProgram(program.program);
    if (program.resolution) {
      gl.uniform2f(program.resolution, Number(gl.canvas.width), Number(gl.canvas.height));
    }
    if (program.texture) {
      gl.uniform1i(program.texture, 0);
    }
    if (program.time) {
      gl.uniform1f(program.time, options.customShaderTime ?? performance.now() / 1000);
    }
    if (program.progress) {
      gl.uniform1f(program.progress, Math.min(1, Math.max(0, options.customShaderProgress ?? 0)));
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.drawQuad(buildTransformedQuad(gl.canvas.width, gl.canvas.height, mediaWidth, mediaHeight, transform), program);
    return true;
  }

  private getCustomProgram(sourceCode: string): CustomShaderProgramInfo | null {
    const cached = this.customPrograms.get(sourceCode);
    if (cached !== undefined) {
      return cached;
    }
    try {
      const program = createCustomShaderProgram(this.gl, sourceCode);
      this.customPrograms.set(sourceCode, program);
      return program;
    } catch (error) {
      logger.warn('Unable to compile custom preview shader', error);
      this.customPrograms.set(sourceCode, null);
      return null;
    }
  }

  private getPanoramaProgram(): PanoramaProgramInfo | null {
    if (this.panoramaProgram !== undefined) {
      return this.panoramaProgram;
    }
    try {
      this.panoramaProgram = createPanoramaProgram(this.gl);
      return this.panoramaProgram;
    } catch (error) {
      logger.warn('Unable to compile panorama preview shader', error);
      this.panoramaProgram = null;
      return null;
    }
  }

  private drawQuad(
    points: number[],
    program: Pick<ProgramInfo, 'position' | 'texCoord'> | Pick<CustomShaderProgramInfo, 'position' | 'texCoord'>,
  ): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(program.position);
    gl.vertexAttribPointer(program.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(program.texCoord);
    gl.vertexAttribPointer(program.texCoord, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.drawCalls += 1;
  }

  /**
   * Apply a color grading graph as a post-processing pass.
   *
   * Copies the current framebuffer content into a texture, runs it through
   * the {@link ColorGradingRenderer} ping-pong pipeline, and draws the
   * result back as a full-screen quad.
   */
  private applyColorGradingPass(graph: ColorGradingGraph, width: number, height: number): void {
    const gl = this.gl;

    if (!this.colorGradingRenderer) {
      this.colorGradingRenderer = new ColorGradingRenderer(gl);
    }

    // Copy current framebuffer into a temporary texture
    const inputTexture = gl.createTexture();
    if (!inputTexture) return;

    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, width, height, 0);

    // Run color grading
    const outputTexture = this.colorGradingRenderer.render(graph, inputTexture, width, height);

    // Draw the output texture back to the current framebuffer
    if (outputTexture !== inputTexture) {
      const savedProgram = this.program;
      const savedViewport = gl.getParameter(gl.VIEWPORT);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, outputTexture);

      // Use a minimal passthrough shader to blit the result
      const blitProgram = this.getBlitProgram();
      if (blitProgram) {
        gl.useProgram(blitProgram.program);
        if (blitProgram.texture) gl.uniform1i(blitProgram.texture, 0);
        this.drawQuad(buildFullscreenQuadPoints(width, height), blitProgram);
      }

      gl.viewport(savedViewport[0], savedViewport[1], savedViewport[2], savedViewport[3]);
      gl.useProgram(savedProgram?.program ?? null);
    }

    gl.deleteTexture(inputTexture);
  }

  private blitProgram?: CustomShaderProgramInfo | null;

  private getBlitProgram(): CustomShaderProgramInfo | null {
    if (this.blitProgram !== undefined) {
      return this.blitProgram;
    }
    try {
      const gl = this.gl;
      const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
      const fs = compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        `precision mediump float;
         uniform sampler2D u_texture;
         varying vec2 v_texCoord;
         void main() {
           gl_FragColor = texture2D(u_texture, v_texCoord);
         }`,
      );
      const program = gl.createProgram();
      if (!program) {
        this.blitProgram = null;
        return null;
      }
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        this.blitProgram = null;
        return null;
      }
      this.blitProgram = {
        program,
        position: gl.getAttribLocation(program, 'a_position'),
        texCoord: gl.getAttribLocation(program, 'a_texCoord'),
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        texture: gl.getUniformLocation(program, 'u_texture'),
        time: null,
        progress: null,
      };
      return this.blitProgram;
    } catch {
      this.blitProgram = null;
      return null;
    }
  }
}

export function resolveWebGlSourceProcessing(
  colorCorrection?: Partial<ColorCorrection>,
  effects?: Effect[],
  chromaKey?: Partial<ChromaKey>,
  masks?: ClipMask[],
  options: WebGlSourceProcessingOptions = {},
  colorGradingGraph?: ColorGradingGraph,
): WebGlResolvedSourceProcessing {
  if (options.bypassProcessing) {
    return {
      correction: normalizeColorCorrection(DEFAULT_COLOR_CORRECTION),
      colorPipeline: normalizeProjectColorPipeline(undefined),
      key: normalizeChromaKey(undefined),
      maskUniforms: buildMaskUniforms(undefined),
      effectParams: buildPreviewEffectParams(undefined),
    };
  }
  return {
    correction: normalizeColorCorrection(colorCorrection ?? DEFAULT_COLOR_CORRECTION),
    colorPipeline: normalizeProjectColorPipeline(options.colorPipeline),
    key: normalizeChromaKey(chromaKey),
    maskUniforms: buildMaskUniforms(masks),
    effectParams: buildPreviewEffectParams(effects, options.disabledEffectTypes, colorGradingGraph),
    colorGradingGraph,
  };
}

export function resolveColorNodeGraphPreviewPasses(
  colorNodeGraph: Partial<ColorNodeGraph> | undefined,
  fallbackColorCorrection?: Partial<ColorCorrection>,
): ColorNodeGraphPreviewPass[] {
  const normalized = normalizeColorNodeGraph(colorNodeGraph, fallbackColorCorrection);
  return topologicallySortColorNodeGraph(normalized)
    .filter((node) => node.enabled !== false && node.type !== 'input' && node.type !== 'output')
    .map((node) => ({
      nodeId: node.id,
      nodeType: node.type,
      correction: normalizeColorCorrection({
        ...node.correction,
        lutPath: node.type === 'lut' ? (node.lutPath ?? node.correction.lutPath) : node.correction.lutPath,
      }),
    }));
}
