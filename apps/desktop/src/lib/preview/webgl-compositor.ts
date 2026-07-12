import {
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  buildCustomShaderFragmentSource,
  getEnabledCustomShaderEffect,
  getEffectNumberParam,
  getTransformScaleX,
  getTransformScaleY,
  normalizeCustomShaderParams,
  normalizeColorCorrection,
  normalizeClipBlendMode,
  normalizeInputColorSpace,
  normalizeColorNodeGraph,
  normalizeProjectColorPipeline,
  normalizeThreeWayColor,
  normalizeChromaKey,
  normalizeMasks,
  buildMotionBlurPreviewVector,
  topologicallySortColorNodeGraph,
  triangulatePathMask,
  sampleColorCurves,
  clipBlendModeToShaderIndex,
  NodeGraphEngine,
  type ChromaKey,
  type ClipBlendMode,
  type ClipPanoramaView,
  type ClipMask,
  type ColorCorrection,
  type ColorNode,
  type ColorNodeGraph,
  type ColorWheelValue,
  type EffectType,
  type Effect,
  type InputColorSpace,
  type ProjectColorPipeline,
  type SubtitleStyle,
  type TextStyle,
  type Transform
} from '@open-factory/editor-core';

import type { ColorGradingGraph, UniformValue } from '@open-factory/editor-core';

import { zhCN } from '../../i18n/strings';
import { ColorGradingRenderer } from '../color-grading/color-grading-renderer';
import {
  DEFAULT_GPU_PREVIEW_METRICS,
  GPU_TEXTURE_POOL_MAX_BYTES,
  GpuTexturePool,
  calculateInstancedDrawCallCount,
  estimateTextureBytes,
  type GpuPreviewMetrics
} from './gpu-acceleration';

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

export interface WebGlResolvedSourceProcessing {
  correction: ColorCorrection;
  colorPipeline: ProjectColorPipeline;
  key: ChromaKey;
  maskUniforms: ReturnType<typeof buildMaskUniforms>;
  effectParams: ReturnType<typeof buildPreviewEffectParams>;
  colorGradingGraph?: ColorGradingGraph;
}

export interface ColorNodeGraphPreviewPass {
  nodeId: string;
  nodeType: ColorNode['type'];
  correction: ColorCorrection;
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
      preserveDrawingBuffer: window.__OPEN_FACTORY_NATIVE_PREVIEW_SMOKE_ACTIVE__ === true
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
      disposeTexture: (texture) => gl.deleteTexture(texture)
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
    options: WebGlSourceProcessingOptions = {}
  ): void {
    const gl = this.gl;
    const texture = this.getTexture(source, options.textureCacheKey, options.textureBytes ?? estimateTextureBytes(mediaWidth, mediaHeight));
    const disabledEffectTypes = new Set(options.disabledEffectTypes ?? []);
    const blendMode = normalizeClipBlendMode(options.blendMode);
    const customShader = options.bypassProcessing || disabledEffectTypes.has('custom-shader') ? undefined : getEnabledCustomShaderEffect(effects);
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
    const { correction, colorPipeline, key, maskUniforms, effectParams } = resolveWebGlSourceProcessing(colorCorrection, effects, chromaKey, masks, options);
    const threeWayColor = normalizeThreeWayColor(correction.threeWayColor);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, buildCurveTextureData(correction.colorCurves));
    gl.uniform1f(this.program.opacity, Math.max(0, Math.min(1, transform.opacity)));
    gl.uniform1f(this.program.blendMode, clipBlendModeToShaderIndex(blendMode));
    gl.uniform1f(this.program.inputColorSpace, inputColorSpaceIndex(correction.inputColorSpace));
    gl.uniform1f(this.program.colorPipeline, colorPipelineIndex(colorPipeline));
    gl.uniform4f(this.program.colorCorrection, correction.brightness, correction.contrast, correction.saturation, correction.hue);
    gl.uniform3f(this.program.lift, wheelOffset(threeWayColor.lift, 'r'), wheelOffset(threeWayColor.lift, 'g'), wheelOffset(threeWayColor.lift, 'b'));
    gl.uniform3f(this.program.gamma, wheelValue(threeWayColor.gamma, 'r'), wheelValue(threeWayColor.gamma, 'g'), wheelValue(threeWayColor.gamma, 'b'));
    gl.uniform3f(this.program.gain, wheelValue(threeWayColor.gain, 'r'), wheelValue(threeWayColor.gain, 'g'), wheelValue(threeWayColor.gain, 'b'));
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
    gl.uniform4f(this.program.effectParams, effectParams.blur, effectParams.grain, effectParams.vignette, effectParams.chromatic);
    gl.uniform1f(this.program.sharpen, effectParams.sharpen);
    gl.uniform4f(this.program.motionBlur, effectParams.motionX, effectParams.motionY, effectParams.motionSamples, effectParams.motionJitter);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.drawQuad(buildTransformedQuad(gl.canvas.width, gl.canvas.height, mediaWidth, mediaHeight, transform), this.program);
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
    colorGradingGraph?: ColorGradingGraph
  ): boolean {
    if (options.bypassProcessing || !colorNodeGraph) {
      this.drawSource(source, mediaWidth, mediaHeight, transform, fallbackColorCorrection, effects, chromaKey, masks, options);
      return true;
    }

    let passes: ColorNodeGraphPreviewPass[];
    try {
      passes = resolveColorNodeGraphPreviewPasses(colorNodeGraph, fallbackColorCorrection);
    } catch (error) {
      console.warn('Unable to resolve color node graph preview passes', error);
      this.drawSource(source, mediaWidth, mediaHeight, transform, fallbackColorCorrection, effects, chromaKey, masks, options);
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
      console.warn('Unable to allocate color node graph preview compositor', error);
      this.drawSource(source, mediaWidth, mediaHeight, transform, fallbackColorCorrection, effects, chromaKey, masks, options);
      return false;
    }

    scratchCompositor.begin(width, height, [0, 0, 0, 0]);
    scratchCompositor.drawSource(source, mediaWidth, mediaHeight, transform, undefined, undefined, chromaKey, masks, {
      ...options,
      blendMode: 'normal',
      colorPipeline: 'sdr-srgb'
    });
    for (const pass of passes) {
      scratchCompositor.applyAdjustmentLayer(pass.correction, undefined, { colorPipeline: 'sdr-srgb' });
    }
    if ((effects?.length ?? 0) > 0 || options.colorPipeline) {
      scratchCompositor.applyAdjustmentLayer(undefined, effects, { disabledEffectTypes: options.disabledEffectTypes, colorPipeline: options.colorPipeline });
    }
    scratchCompositor.finish();

    this.drawSource(scratch, width, height, DEFAULT_TRANSFORM, undefined, undefined, undefined, undefined, {
      bypassProcessing: true,
      blendMode: options.blendMode
    });

    // Apply color grading graph as a post-processing pass if present
    if (colorGradingGraph && colorGradingGraph.nodes.length > 0 && !options.bypassProcessing) {
      this.applyColorGradingPass(colorGradingGraph, width, height);
    }

    return true;
  }

  drawPanoramaSource(source: TexImageSource, mediaWidth: number, mediaHeight: number, transform: Transform, panorama: ClipPanoramaView, options: WebGlSourceProcessingOptions = {}): boolean {
    if (options.bypassProcessing || normalizeClipBlendMode(options.blendMode) !== 'normal') {
      return false;
    }
    const gl = this.gl;
    const program = this.getPanoramaProgram();
    if (!program) {
      return false;
    }
    const texture = this.getTexture(source, options.textureCacheKey, options.textureBytes ?? estimateTextureBytes(mediaWidth, mediaHeight));
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
    this.drawQuad(buildTransformedQuad(gl.canvas.width, gl.canvas.height, Math.max(1, Number(gl.canvas.width)), Math.max(1, Number(gl.canvas.height)), transform), program);
    return mediaWidth > 0 && mediaHeight > 0;
  }

  drawText(
    text: string,
    transform: Transform,
    style: TextStyle | SubtitleStyle,
    colorCorrection?: Partial<ColorCorrection>,
    effects?: Effect[],
    colorNodeGraph?: Partial<ColorNodeGraph>,
    options: WebGlSourceProcessingOptions = {}
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
      options
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
      timerQuerySupported: this.timerQuerySupported
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
      console.warn('Unable to preload GPU preview texture', error);
      return false;
    }
  }

  readCenterPixel(): number[] {
    const gl = this.gl;
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.canvas.width / 2), Math.floor(gl.canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
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

  applyAdjustmentLayer(colorCorrection?: Partial<ColorCorrection>, effects?: Effect[], options: WebGlSourceProcessingOptions = {}): void {
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
    this.drawSource(canvas, frame.width, frame.height, DEFAULT_TRANSFORM, colorCorrection, effects, undefined, undefined, options);
  }

  applyColorNodeGraph(colorNodeGraph: Partial<ColorNodeGraph> | undefined, fallbackColorCorrection?: Partial<ColorCorrection>, effects?: Effect[], options: WebGlSourceProcessingOptions = {}, colorGradingGraph?: ColorGradingGraph): boolean {
    if (options.bypassProcessing || !colorNodeGraph) {
      this.applyAdjustmentLayer(fallbackColorCorrection, effects, options);
      return true;
    }

    let passes: ColorNodeGraphPreviewPass[];
    try {
      passes = resolveColorNodeGraphPreviewPasses(colorNodeGraph, fallbackColorCorrection);
    } catch (error) {
      console.warn('Unable to resolve adjustment color node graph preview passes', error);
      this.applyAdjustmentLayer(fallbackColorCorrection, effects, options);
      return false;
    }

    for (const pass of passes) {
      this.applyAdjustmentLayer(pass.correction, undefined, { colorPipeline: 'sdr-srgb' });
    }
    if ((effects?.length ?? 0) > 0 || options.colorPipeline) {
      this.applyAdjustmentLayer(undefined, effects, { disabledEffectTypes: options.disabledEffectTypes, colorPipeline: options.colorPipeline });
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
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, Math.max(1, Number(gl.canvas.width)), Math.max(1, Number(gl.canvas.height)), 0);
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
    options: WebGlSourceProcessingOptions
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
      console.warn('Unable to compile custom preview shader', error);
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
      console.warn('Unable to compile panorama preview shader', error);
      this.panoramaProgram = null;
      return null;
    }
  }

  private drawQuad(points: number[], program: Pick<ProgramInfo, 'position' | 'texCoord'> | Pick<CustomShaderProgramInfo, 'position' | 'texCoord'>): void {
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
         }`
      );
      const program = gl.createProgram();
      if (!program) { this.blitProgram = null; return null; }
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
        progress: null
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
  colorGradingGraph?: ColorGradingGraph
): WebGlResolvedSourceProcessing {
  if (options.bypassProcessing) {
    return {
      correction: normalizeColorCorrection(DEFAULT_COLOR_CORRECTION),
      colorPipeline: normalizeProjectColorPipeline(undefined),
      key: normalizeChromaKey(undefined),
      maskUniforms: buildMaskUniforms(undefined),
      effectParams: buildPreviewEffectParams(undefined)
    };
  }
  return {
    correction: normalizeColorCorrection(colorCorrection ?? DEFAULT_COLOR_CORRECTION),
    colorPipeline: normalizeProjectColorPipeline(options.colorPipeline),
    key: normalizeChromaKey(chromaKey),
    maskUniforms: buildMaskUniforms(masks),
    effectParams: buildPreviewEffectParams(effects, options.disabledEffectTypes, colorGradingGraph),
    colorGradingGraph
  };
}

export function resolveColorNodeGraphPreviewPasses(
  colorNodeGraph: Partial<ColorNodeGraph> | undefined,
  fallbackColorCorrection?: Partial<ColorCorrection>
): ColorNodeGraphPreviewPass[] {
  const normalized = normalizeColorNodeGraph(colorNodeGraph, fallbackColorCorrection);
  return topologicallySortColorNodeGraph(normalized)
    .filter((node) => node.enabled !== false && node.type !== 'input' && node.type !== 'output')
    .map((node) => ({
      nodeId: node.id,
      nodeType: node.type,
      correction: normalizeColorCorrection({
        ...node.correction,
        lutPath: node.type === 'lut' ? node.lutPath ?? node.correction.lutPath : node.correction.lutPath
      })
    }));
}

function buildFullscreenQuadPoints(width: number, height: number): number[] {
  return [0, 0, width, 0, 0, height, 0, height, width, 0, width, height];
}

function buildChromaKeyColorUniforms(chromaKey: ChromaKey): Float32Array {
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

function buildChromaKeyParamUniforms(chromaKey: ChromaKey): [number, number, number, number] {
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

function drawTextBackground(context: CanvasRenderingContext2D, centerX: number, centerY: number, text: string, style: TextStyle | SubtitleStyle): void {
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

function buildCurveTextureData(colorCurves: Partial<NonNullable<ColorCorrection['colorCurves']>> | undefined): Uint8Array {
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

function wheelOffset(value: ColorWheelValue, channel: 'r' | 'g' | 'b'): number {
  return value[channel] + value.intensity - 1;
}

function wheelValue(value: ColorWheelValue, channel: 'r' | 'g' | 'b'): number {
  return Math.max(0.001, value[channel] + value.intensity);
}

function inputColorSpaceIndex(value: InputColorSpace | undefined): number {
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

function colorPipelineIndex(value: ProjectColorPipeline | undefined): number {
  switch (normalizeProjectColorPipeline(value)) {
    case 'hdr-rec2020':
      return 1;
    case 'aces':
      return 2;
    default:
      return 0;
  }
}

function buildPreviewEffectParams(effects: Effect[] | undefined, disabledEffectTypes: EffectType[] = [], colorGradingGraph?: ColorGradingGraph): { blur: number; grain: number; vignette: number; chromatic: number; sharpen: number; motionX: number; motionY: number; motionSamples: number; motionJitter: number; colorGradingUniforms?: Record<string, UniformValue> } {
  const params: { blur: number; grain: number; vignette: number; chromatic: number; sharpen: number; motionX: number; motionY: number; motionSamples: number; motionJitter: number; colorGradingUniforms?: Record<string, UniformValue> } = { blur: 0, grain: 0, vignette: 0, chromatic: 0, sharpen: 0, motionX: 0, motionY: 0, motionSamples: 0, motionJitter: 0 };
  const disabled = new Set(disabledEffectTypes);
  for (const effect of effects ?? []) {
    if (!effect.enabled || disabled.has(effect.type)) {
      continue;
    }
    if (effect.type === 'blur') {
      params.blur = Math.max(params.blur, Math.min(12, Math.max(0, getEffectNumberParam(effect.params, 'radius', 0))));
    } else if (effect.type === 'film-grain') {
      params.grain = Math.max(params.grain, Math.min(1, Math.max(0, getEffectNumberParam(effect.params, 'strength', 0))));
    } else if (effect.type === 'vignette') {
      params.vignette = Math.max(params.vignette, Math.min(1, Math.max(0, getEffectNumberParam(effect.params, 'intensity', 0))));
    } else if (effect.type === 'chromatic-aberration') {
      params.chromatic = Math.max(params.chromatic, Math.min(20, Math.max(0, getEffectNumberParam(effect.params, 'strength', 0))));
    } else if (effect.type === 'sharpen') {
      params.sharpen = Math.max(params.sharpen, Math.min(3, Math.max(0, getEffectNumberParam(effect.params, 'strength', 0))));
    } else if (effect.type === 'motion-blur') {
      const motion = buildMotionBlurPreviewVector(effect.params);
      if (motion.samples > params.motionSamples || Math.hypot(motion.x, motion.y) > Math.hypot(params.motionX, params.motionY)) {
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

function buildMaskUniforms(masks: ClipMask[] | undefined): {
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
    pathMaskInverted: pathMask?.inverted ? 1 : 0
  };
}

function resolveTextTransform(canvasHeight: number, transform: Transform, style: TextStyle | SubtitleStyle): Transform {
  if (!('yOffset' in style)) {
    return transform;
  }
  return {
    ...transform,
    x: 0,
    y: canvasHeight / 2 - style.yOffset - style.fontSize / 2
  };
}

function buildTransformedQuad(canvasWidth: number, canvasHeight: number, mediaWidth: number, mediaHeight: number, transform: Transform): number[] {
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
    [width / 2, height / 2]
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

function createProgram(gl: WebGLRenderingContext): ProgramInfo {
  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    VERTEX_SHADER_SOURCE
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform sampler2D u_baseTexture;
      uniform sampler2D u_curveLut;
      uniform vec2 u_resolution;
      uniform float u_opacity;
      uniform float u_blendMode;
      uniform float u_inputColorSpace;
      uniform float u_colorPipeline;
      uniform vec4 u_colorCorrection;
      uniform vec3 u_lift;
      uniform vec3 u_gamma;
      uniform vec3 u_gain;
      uniform vec3 u_chromaKeyColors[3];
      uniform vec4 u_chromaKeyParams;
      uniform int u_maskCount;
      uniform vec4 u_maskData[8];
      uniform vec4 u_maskFlags[8];
      uniform int u_pathTriangleCount;
      uniform vec4 u_pathTrianglesA[24];
      uniform vec4 u_pathTrianglesB[24];
      uniform float u_pathMaskInverted;
      uniform vec4 u_effectParams;
      uniform float u_sharpen;
      uniform vec4 u_motionBlur;
      varying vec2 v_texCoord;

      vec3 applyHue(vec3 color, float degrees) {
        float angle = radians(degrees);
        float s = sin(angle);
        float c = cos(angle);
        mat3 hueMatrix = mat3(
          0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
          0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
          0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072
        );
        return clamp(hueMatrix * color, 0.0, 1.0);
      }

      vec3 expandLogChannel(vec3 color, float lift, float gamma, float exposure, vec3 shadowTint, vec3 highlightTint, float saturation) {
        vec3 normalized = max((color - vec3(lift)) / max(1.0 - lift, 0.001), vec3(0.0));
        vec3 expanded = pow(normalized, vec3(gamma)) * exposure;
        vec3 tint = mix(shadowTint, highlightTint, color);
        expanded = clamp(expanded * tint, 0.0, 1.0);
        float luma = dot(expanded, vec3(0.2126, 0.7152, 0.0722));
        return clamp(vec3(luma) + (expanded - vec3(luma)) * saturation, 0.0, 1.0);
      }

      vec3 applyInputColorSpace(vec3 color) {
        if (u_inputColorSpace < 0.5) {
          return color;
        }
        if (u_inputColorSpace < 1.5) {
          return expandLogChannel(color, 0.028, 1.48, 1.10, vec3(1.02, 1.0, 0.98), vec3(1.01, 1.0, 0.99), 1.08);
        }
        if (u_inputColorSpace < 2.5) {
          return expandLogChannel(color, 0.035, 1.55, 1.12, vec3(1.01, 1.0, 0.99), vec3(1.02, 1.01, 0.98), 1.10);
        }
        if (u_inputColorSpace < 3.5) {
          return expandLogChannel(color, 0.040, 1.42, 1.08, vec3(1.0), vec3(1.01, 1.0, 0.99), 1.06);
        }
        if (u_inputColorSpace < 4.5) {
          return expandLogChannel(color, 0.045, 1.50, 1.10, vec3(1.0, 1.01, 1.0), vec3(1.01, 1.0, 0.99), 1.08);
        }
        if (u_inputColorSpace < 5.5) {
          return expandLogChannel(color, 0.032, 1.46, 1.09, vec3(1.0, 1.01, 1.02), vec3(1.01, 1.0, 1.0), 1.07);
        }
        return expandLogChannel(color, 0.038, 1.52, 1.11, vec3(0.99, 1.0, 1.02), vec3(1.02, 1.01, 1.0), 1.09);
      }

      ${buildAcesToneMappingShaderInjection('aces')}
      ${buildBlendModeShaderInjection()}

      vec3 applyProjectColorPipeline(vec3 color) {
        if (u_colorPipeline > 1.5) {
          return hillAcesToneMap(color);
        }
        return color;
      }

      vec3 applyColorCorrection(vec3 color) {
        color += vec3(u_colorCorrection.x);
        color = (color - 0.5) * u_colorCorrection.y + 0.5;
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, u_colorCorrection.z);
        color = applyHue(color, u_colorCorrection.w);
        return clamp(color, 0.0, 1.0);
      }

      vec3 applyThreeWay(vec3 color) {
        return pow(clamp(color * max(u_gain, vec3(0.001)) + u_lift, 0.0, 1.0), vec3(1.0) / max(u_gamma, vec3(0.001)));
      }

      vec3 applyCurveLut(vec3 color) {
        return vec3(
          texture2D(u_curveLut, vec2(color.r, 0.5)).r,
          texture2D(u_curveLut, vec2(color.g, 0.5)).g,
          texture2D(u_curveLut, vec2(color.b, 0.5)).b
        );
      }

      float random(vec2 position) {
        return fract(sin(dot(position, vec2(12.9898, 78.233))) * 43758.5453);
      }

      vec4 sampleSource(vec2 coord) {
        float jitter = u_motionBlur.w;
        if (jitter > 0.001) {
          vec2 jitterPixels = vec2(
            random(coord * u_resolution + vec2(17.13, 3.71)) - 0.5,
            random(coord * u_resolution + vec2(8.41, 29.67)) - 0.5
          ) * jitter * 2.0;
          coord += jitterPixels / max(u_resolution, vec2(1.0));
        }
        float chromatic = u_effectParams.w / max(u_resolution.x, 1.0);
        vec4 center = texture2D(u_texture, coord);
        if (chromatic > 0.0001) {
          center.r = texture2D(u_texture, coord + vec2(chromatic, 0.0)).r;
          center.b = texture2D(u_texture, coord - vec2(chromatic, 0.0)).b;
        }

        float motionSamples = u_motionBlur.z;
        if (motionSamples > 1.0) {
          vec2 motionStep = u_motionBlur.xy / max(u_resolution, vec2(1.0));
          vec4 motionSum = vec4(0.0);
          float motionCount = 0.0;
          for (int index = 0; index < 32; index++) {
            if (float(index) >= motionSamples) {
              break;
            }
            float offset = motionSamples <= 1.0 ? 0.0 : float(index) / (motionSamples - 1.0) - 0.5;
            motionSum += texture2D(u_texture, coord + motionStep * offset);
            motionCount += 1.0;
          }
          center = motionSum / max(motionCount, 1.0);
        }

        float blur = u_effectParams.x;
        if (blur > 0.001) {
          vec2 texel = vec2(blur) / max(u_resolution, vec2(1.0));
          vec4 sum = center * 4.0;
          sum += texture2D(u_texture, coord + vec2(texel.x, 0.0)) * 2.0;
          sum += texture2D(u_texture, coord - vec2(texel.x, 0.0)) * 2.0;
          sum += texture2D(u_texture, coord + vec2(0.0, texel.y)) * 2.0;
          sum += texture2D(u_texture, coord - vec2(0.0, texel.y)) * 2.0;
          sum += texture2D(u_texture, coord + texel);
          sum += texture2D(u_texture, coord - texel);
          sum += texture2D(u_texture, coord + vec2(texel.x, -texel.y));
          sum += texture2D(u_texture, coord + vec2(-texel.x, texel.y));
          center = sum / 16.0;
        }

        if (u_sharpen > 0.001) {
          vec2 texel = vec2(1.0) / max(u_resolution, vec2(1.0));
          vec3 neighbor =
            texture2D(u_texture, coord + vec2(texel.x, 0.0)).rgb +
            texture2D(u_texture, coord - vec2(texel.x, 0.0)).rgb +
            texture2D(u_texture, coord + vec2(0.0, texel.y)).rgb +
            texture2D(u_texture, coord - vec2(0.0, texel.y)).rgb;
          center.rgb = clamp(center.rgb * (1.0 + u_sharpen) - neighbor * (0.25 * u_sharpen), 0.0, 1.0);
        }
        return center;
      }

      vec3 applyPreviewEffects(vec3 color, vec2 coord) {
        float vignette = u_effectParams.z;
        if (vignette > 0.001) {
          float distanceFromCenter = distance(coord, vec2(0.5));
          color *= 1.0 - smoothstep(0.25, 0.75, distanceFromCenter) * vignette;
        }
        float grain = u_effectParams.y;
        if (grain > 0.001) {
          color += vec3((random(coord * u_resolution) - 0.5) * grain * 0.18);
        }
        return clamp(color, 0.0, 1.0);
      }

      float applyChromaKey(vec3 color) {
        float mode = u_chromaKeyParams.x;
        if (mode < 0.5) {
          return 1.0;
        }
        if (mode > 1.5 && mode < 2.5) {
          float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
          float threshold = clamp(u_chromaKeyParams.y, 0.0, 1.0);
          float tolerance = clamp(u_chromaKeyParams.z, 0.0, 1.0);
          float softness = max(u_chromaKeyParams.w, 0.0001);
          float keyed = smoothstep(threshold - tolerance - softness, threshold - tolerance, luma);
          return 1.0 - keyed * (1.0 - smoothstep(threshold + tolerance, threshold + tolerance + softness, luma));
        }
        if (mode > 2.5) {
          float delta = distance(color, vec3(0.5));
          return smoothstep(clamp(u_chromaKeyParams.y, 0.0, 1.0), clamp(u_chromaKeyParams.y + 0.05, 0.0, 1.0), delta);
        }
        float delta = distance(color, u_chromaKeyColors[0]);
        if (u_chromaKeyParams.w > 1.5) {
          delta = min(delta, distance(color, u_chromaKeyColors[1]));
        }
        if (u_chromaKeyParams.w > 2.5) {
          delta = min(delta, distance(color, u_chromaKeyColors[2]));
        }
        float similarity = clamp(u_chromaKeyParams.y, 0.0, 1.0);
        float blend = max(u_chromaKeyParams.z, 0.0001);
        return smoothstep(similarity, similarity + blend, delta);
      }

      float rectMask(vec2 coord, vec4 mask, float feather) {
        float left = mask.x;
        float top = mask.y;
        float right = mask.x + mask.z;
        float bottom = mask.y + mask.w;
        float edge = min(feather, min(mask.z, mask.w) * 0.5);
        if (edge <= 0.0001) {
          return step(left, coord.x) * step(coord.x, right) * step(top, coord.y) * step(coord.y, bottom);
        }
        float horizontal = smoothstep(left, left + edge, coord.x) * (1.0 - smoothstep(right - edge, right, coord.x));
        float vertical = smoothstep(top, top + edge, coord.y) * (1.0 - smoothstep(bottom - edge, bottom, coord.y));
        return horizontal * vertical;
      }

      float ellipseMask(vec2 coord, vec4 mask, float feather) {
        vec2 radius = max(mask.zw * 0.5, vec2(0.0001));
        vec2 center = mask.xy + radius;
        vec2 normalized = (coord - center) / radius;
        float distanceFromCenter = length(normalized);
        float edge = min(feather, 0.99);
        if (edge <= 0.0001) {
          return 1.0 - step(1.0, distanceFromCenter);
        }
        return 1.0 - smoothstep(1.0 - edge, 1.0, distanceFromCenter);
      }

      float triangleSide(vec2 point, vec2 a, vec2 b) {
        return (point.x - b.x) * (a.y - b.y) - (a.x - b.x) * (point.y - b.y);
      }

      float triangleMask(vec2 coord, vec2 a, vec2 b, vec2 c) {
        float d1 = triangleSide(coord, a, b);
        float d2 = triangleSide(coord, b, c);
        float d3 = triangleSide(coord, c, a);
        bool hasNegative = d1 < 0.0 || d2 < 0.0 || d3 < 0.0;
        bool hasPositive = d1 > 0.0 || d2 > 0.0 || d3 > 0.0;
        return hasNegative && hasPositive ? 0.0 : 1.0;
      }

      float pathMask(vec2 coord) {
        if (u_pathTriangleCount <= 0) {
          return 1.0;
        }
        float inside = 0.0;
        for (int index = 0; index < 24; index++) {
          if (index >= u_pathTriangleCount) {
            break;
          }
          vec4 firstPair = u_pathTrianglesA[index];
          vec4 third = u_pathTrianglesB[index];
          inside = max(inside, triangleMask(coord, firstPair.xy, firstPair.zw, third.xy));
        }
        return u_pathMaskInverted > 0.5 ? 1.0 - inside : inside;
      }

      float applyMasks(vec2 coord) {
        float alpha = 1.0;
        for (int index = 0; index < 8; index++) {
          if (index >= u_maskCount) {
            break;
          }
          vec4 mask = u_maskData[index];
          vec4 flags = u_maskFlags[index];
          float shapeAlpha = flags.x > 0.5 ? ellipseMask(coord, mask, flags.z) : rectMask(coord, mask, flags.z);
          if (flags.y > 0.5) {
            shapeAlpha = 1.0 - shapeAlpha;
          }
          alpha *= shapeAlpha;
        }
        return alpha * pathMask(coord);
      }

      void main() {
        vec4 color = sampleSource(v_texCoord);
        float keyedAlpha = applyChromaKey(color.rgb);
        float maskAlpha = applyMasks(v_texCoord);
        vec3 corrected = applyInputColorSpace(color.rgb);
        corrected = applyColorCorrection(corrected);
        corrected = applyThreeWay(corrected);
        corrected = applyCurveLut(corrected);
        corrected = applyPreviewEffects(corrected, v_texCoord);
        corrected = applyProjectColorPipeline(corrected);
        vec4 source = vec4(corrected, color.a * keyedAlpha * maskAlpha * u_opacity);
        if (u_blendMode > 0.5) {
          vec2 baseCoord = gl_FragCoord.xy / max(u_resolution, vec2(1.0));
          vec4 base = texture2D(u_baseTexture, baseCoord);
          vec3 blended = applyBlendMode(base.rgb, source.rgb, u_blendMode);
          float alpha = source.a + base.a * (1.0 - source.a);
          gl_FragColor = vec4(mix(base.rgb, blended, source.a), alpha);
          return;
        }
        gl_FragColor = source;
      }
    `
  );
  const program = gl.createProgram();
  if (!program) {
    throw new Error(zhCN.errors.webglProgramCreateFailed);
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? zhCN.errors.webglProgramLinkFailed);
  }
  const resolution = gl.getUniformLocation(program, 'u_resolution');
  const texture = gl.getUniformLocation(program, 'u_texture');
  const baseTexture = gl.getUniformLocation(program, 'u_baseTexture');
  const curveLut = gl.getUniformLocation(program, 'u_curveLut');
  const opacity = gl.getUniformLocation(program, 'u_opacity');
  const blendMode = gl.getUniformLocation(program, 'u_blendMode');
  const inputColorSpace = gl.getUniformLocation(program, 'u_inputColorSpace');
  const colorPipeline = gl.getUniformLocation(program, 'u_colorPipeline');
  const colorCorrection = gl.getUniformLocation(program, 'u_colorCorrection');
  const lift = gl.getUniformLocation(program, 'u_lift');
  const gamma = gl.getUniformLocation(program, 'u_gamma');
  const gain = gl.getUniformLocation(program, 'u_gain');
  const chromaKeyColors = gl.getUniformLocation(program, 'u_chromaKeyColors[0]');
  const chromaKeyParams = gl.getUniformLocation(program, 'u_chromaKeyParams');
  const maskCount = gl.getUniformLocation(program, 'u_maskCount');
  const maskData = gl.getUniformLocation(program, 'u_maskData[0]');
  const maskFlags = gl.getUniformLocation(program, 'u_maskFlags[0]');
  const pathTriangleCount = gl.getUniformLocation(program, 'u_pathTriangleCount');
  const pathTrianglesA = gl.getUniformLocation(program, 'u_pathTrianglesA[0]');
  const pathTrianglesB = gl.getUniformLocation(program, 'u_pathTrianglesB[0]');
  const pathMaskInverted = gl.getUniformLocation(program, 'u_pathMaskInverted');
  const effectParams = gl.getUniformLocation(program, 'u_effectParams');
  const sharpen = gl.getUniformLocation(program, 'u_sharpen');
  const motionBlur = gl.getUniformLocation(program, 'u_motionBlur');
  if (
    !resolution ||
    !texture ||
    !baseTexture ||
    !curveLut ||
    !opacity ||
    !blendMode ||
    !inputColorSpace ||
    !colorPipeline ||
    !colorCorrection ||
    !lift ||
    !gamma ||
    !gain ||
    !chromaKeyColors ||
    !chromaKeyParams ||
    !maskCount ||
    !maskData ||
    !maskFlags ||
    !pathTriangleCount ||
    !pathTrianglesA ||
    !pathTrianglesB ||
    !pathMaskInverted ||
    !effectParams ||
    !sharpen ||
    !motionBlur
  ) {
    throw new Error(zhCN.errors.webglProgramUniformsMissing);
  }
  return {
    program,
    position: gl.getAttribLocation(program, 'a_position'),
    texCoord: gl.getAttribLocation(program, 'a_texCoord'),
    resolution,
    texture,
    baseTexture,
    curveLut,
    opacity,
    blendMode,
    inputColorSpace,
    colorPipeline,
    colorCorrection,
    lift,
    gamma,
    gain,
    chromaKeyColors,
    chromaKeyParams,
    maskCount,
    maskData,
    maskFlags,
    pathTriangleCount,
    pathTrianglesA,
    pathTrianglesB,
    pathMaskInverted,
    effectParams,
    sharpen,
    motionBlur
  };
}

const VERTEX_SHADER_SOURCE = `
  precision mediump float;
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  uniform vec2 u_resolution;
  varying vec2 v_texCoord;
  void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;
    gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

function createCustomShaderProgram(gl: WebGLRenderingContext, sourceCode: string): CustomShaderProgramInfo {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, buildCustomShaderFragmentSource(sourceCode));
  const program = gl.createProgram();
  if (!program) {
    throw new Error(zhCN.errors.webglProgramCreateFailed);
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? zhCN.errors.webglProgramLinkFailed);
  }
  return {
    program,
    position: gl.getAttribLocation(program, 'a_position'),
    texCoord: gl.getAttribLocation(program, 'a_texCoord'),
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    texture: gl.getUniformLocation(program, 'u_texture'),
    time: gl.getUniformLocation(program, 'u_time'),
    progress: gl.getUniformLocation(program, 'u_progress')
  };
}

function createPanoramaProgram(gl: WebGLRenderingContext): PanoramaProgramInfo {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform float u_yaw;
      uniform float u_pitch;
      uniform float u_roll;
      uniform float u_fov;
      uniform float u_aspect;
      uniform float u_opacity;
      varying vec2 v_texCoord;

      const float PI = 3.141592653589793;

      vec3 rotateX(vec3 value, float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return vec3(value.x, value.y * c - value.z * s, value.y * s + value.z * c);
      }

      vec3 rotateY(vec3 value, float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return vec3(value.x * c + value.z * s, value.y, -value.x * s + value.z * c);
      }

      vec3 rotateZ(vec3 value, float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return vec3(value.x * c - value.y * s, value.x * s + value.y * c, value.z);
      }

      void main() {
        float scale = tan(u_fov * 0.5);
        vec2 view = vec2((v_texCoord.x - 0.5) * 2.0 * u_aspect * scale, (0.5 - v_texCoord.y) * 2.0 * scale);
        vec3 direction = normalize(vec3(view.x, view.y, 1.0));
        direction = rotateZ(direction, u_roll);
        direction = rotateX(direction, u_pitch);
        direction = rotateY(direction, u_yaw);
        float longitude = atan(direction.x, direction.z);
        float latitude = asin(clamp(direction.y, -1.0, 1.0));
        vec2 sampleCoord = vec2(longitude / (2.0 * PI) + 0.5, 0.5 - latitude / PI);
        vec4 color = texture2D(u_texture, sampleCoord);
        gl_FragColor = vec4(color.rgb, color.a * u_opacity);
      }
    `
  );
  const program = gl.createProgram();
  if (!program) {
    throw new Error(zhCN.errors.webglProgramCreateFailed);
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? zhCN.errors.webglProgramLinkFailed);
  }
  return {
    program,
    position: gl.getAttribLocation(program, 'a_position'),
    texCoord: gl.getAttribLocation(program, 'a_texCoord'),
    texture: gl.getUniformLocation(program, 'u_texture'),
    yaw: gl.getUniformLocation(program, 'u_yaw'),
    pitch: gl.getUniformLocation(program, 'u_pitch'),
    roll: gl.getUniformLocation(program, 'u_roll'),
    fov: gl.getUniformLocation(program, 'u_fov'),
    aspect: gl.getUniformLocation(program, 'u_aspect'),
    opacity: gl.getUniformLocation(program, 'u_opacity')
  };
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error(zhCN.errors.webglShaderCreateFailed);
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? zhCN.errors.webglShaderCompileFailed);
  }
  return shader;
}
