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
  normalizeInputColorSpace,
  normalizeThreeWayColor,
  normalizeChromaKey,
  normalizeMasks,
  triangulatePathMask,
  sampleColorCurves,
  type ChromaKey,
  type ClipPanoramaView,
  type ClipMask,
  type ColorCorrection,
  type ColorWheelValue,
  type Effect,
  type InputColorSpace,
  type SubtitleStyle,
  type TextStyle,
  type Transform
} from '@open-factory/editor-core';

import { zhCN } from '../../i18n/strings';

interface ProgramInfo {
  program: WebGLProgram;
  position: number;
  texCoord: number;
  resolution: WebGLUniformLocation;
  texture: WebGLUniformLocation;
  curveLut: WebGLUniformLocation;
  opacity: WebGLUniformLocation;
  inputColorSpace: WebGLUniformLocation;
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
}

export interface WebGlResolvedSourceProcessing {
  correction: ColorCorrection;
  key: ChromaKey;
  maskUniforms: ReturnType<typeof buildMaskUniforms>;
  effectParams: ReturnType<typeof buildPreviewEffectParams>;
}

export class WebGlPreviewCompositor {
  private readonly gl: WebGLRenderingContext;
  private readonly program: ProgramInfo;
  private readonly positionBuffer: WebGLBuffer;
  private readonly texCoordBuffer: WebGLBuffer;
  private readonly curveTexture: WebGLTexture;
  private readonly textures = new WeakMap<TexImageSource, WebGLTexture>();
  private readonly customPrograms = new Map<string, CustomShaderProgramInfo | null>();
  private panoramaProgram?: PanoramaProgramInfo | null;

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
    if (!positionBuffer || !texCoordBuffer || !curveTexture) {
      throw new Error(zhCN.errors.webglBufferAllocationFailed);
    }
    this.positionBuffer = positionBuffer;
    this.texCoordBuffer = texCoordBuffer;
    this.curveTexture = curveTexture;
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  begin(width: number, height: number): void {
    const gl = this.gl;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.078, 0.094, 0.125, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program.program);
    gl.uniform2f(this.program.resolution, width, height);
    gl.uniform1i(this.program.texture, 0);
    gl.uniform1i(this.program.curveLut, 1);
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
    const texture = this.getTexture(source);
    const customShader = options.bypassProcessing ? undefined : getEnabledCustomShaderEffect(effects);
    if (customShader) {
      const params = normalizeCustomShaderParams(customShader.params);
      if (this.drawCustomShaderSource(source, texture, mediaWidth, mediaHeight, transform, params.source, options)) {
        return;
      }
    }
    gl.useProgram(this.program.program);
    const { correction, key, maskUniforms, effectParams } = resolveWebGlSourceProcessing(colorCorrection, effects, chromaKey, masks, options);
    const threeWayColor = normalizeThreeWayColor(correction.threeWayColor);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, buildCurveTextureData(correction.colorCurves));
    gl.uniform1f(this.program.opacity, Math.max(0, Math.min(1, transform.opacity)));
    gl.uniform1f(this.program.inputColorSpace, inputColorSpaceIndex(correction.inputColorSpace));
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
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.drawQuad(buildTransformedQuad(gl.canvas.width, gl.canvas.height, mediaWidth, mediaHeight, transform), this.program);
  }

  drawPanoramaSource(source: TexImageSource, mediaWidth: number, mediaHeight: number, transform: Transform, panorama: ClipPanoramaView, options: WebGlSourceProcessingOptions = {}): boolean {
    if (options.bypassProcessing) {
      return false;
    }
    const gl = this.gl;
    const program = this.getPanoramaProgram();
    if (!program) {
      return false;
    }
    const texture = this.getTexture(source);
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
    this.drawSource(canvas, canvas.width, canvas.height, resolveTextTransform(Number(this.gl.canvas.height), transform, style), colorCorrection, effects, undefined, undefined, options);
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

  applyAdjustmentLayer(colorCorrection?: Partial<ColorCorrection>, effects?: Effect[]): void {
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
    this.drawSource(canvas, frame.width, frame.height, DEFAULT_TRANSFORM, colorCorrection, effects);
  }

  private getTexture(source: TexImageSource): WebGLTexture {
    const cached = this.textures.get(source);
    if (cached) {
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
    this.textures.set(source, texture);
    return texture;
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
  }
}

export function resolveWebGlSourceProcessing(
  colorCorrection?: Partial<ColorCorrection>,
  effects?: Effect[],
  chromaKey?: Partial<ChromaKey>,
  masks?: ClipMask[],
  options: WebGlSourceProcessingOptions = {}
): WebGlResolvedSourceProcessing {
  if (options.bypassProcessing) {
    return {
      correction: normalizeColorCorrection(DEFAULT_COLOR_CORRECTION),
      key: normalizeChromaKey(undefined),
      maskUniforms: buildMaskUniforms(undefined),
      effectParams: buildPreviewEffectParams(undefined)
    };
  }
  return {
    correction: normalizeColorCorrection(colorCorrection ?? DEFAULT_COLOR_CORRECTION),
    key: normalizeChromaKey(chromaKey),
    maskUniforms: buildMaskUniforms(masks),
    effectParams: buildPreviewEffectParams(effects)
  };
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

function buildPreviewEffectParams(effects: Effect[] | undefined): { blur: number; grain: number; vignette: number; chromatic: number; sharpen: number } {
  const params = { blur: 0, grain: 0, vignette: 0, chromatic: 0, sharpen: 0 };
  for (const effect of effects ?? []) {
    if (!effect.enabled) {
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
      uniform sampler2D u_curveLut;
      uniform vec2 u_resolution;
      uniform float u_opacity;
      uniform float u_inputColorSpace;
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
        float chromatic = u_effectParams.w / max(u_resolution.x, 1.0);
        vec4 center = texture2D(u_texture, coord);
        if (chromatic > 0.0001) {
          center.r = texture2D(u_texture, coord + vec2(chromatic, 0.0)).r;
          center.b = texture2D(u_texture, coord - vec2(chromatic, 0.0)).b;
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
        gl_FragColor = vec4(corrected, color.a * keyedAlpha * maskAlpha * u_opacity);
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
  const curveLut = gl.getUniformLocation(program, 'u_curveLut');
  const opacity = gl.getUniformLocation(program, 'u_opacity');
  const inputColorSpace = gl.getUniformLocation(program, 'u_inputColorSpace');
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
  if (
    !resolution ||
    !texture ||
    !curveLut ||
    !opacity ||
    !inputColorSpace ||
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
    !sharpen
  ) {
    throw new Error(zhCN.errors.webglProgramUniformsMissing);
  }
  return {
    program,
    position: gl.getAttribLocation(program, 'a_position'),
    texCoord: gl.getAttribLocation(program, 'a_texCoord'),
    resolution,
    texture,
    curveLut,
    opacity,
    inputColorSpace,
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
    sharpen
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
