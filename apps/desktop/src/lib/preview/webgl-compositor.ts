import { DEFAULT_COLOR_CORRECTION, normalizeColorCorrection, type ColorCorrection, type SubtitleStyle, type TextStyle, type Transform } from '@open-factory/editor-core';

interface ProgramInfo {
  program: WebGLProgram;
  position: number;
  texCoord: number;
  resolution: WebGLUniformLocation;
  texture: WebGLUniformLocation;
  opacity: WebGLUniformLocation;
  colorCorrection: WebGLUniformLocation;
}

export class WebGlPreviewCompositor {
  private readonly gl: WebGLRenderingContext;
  private readonly program: ProgramInfo;
  private readonly positionBuffer: WebGLBuffer;
  private readonly texCoordBuffer: WebGLBuffer;
  private readonly textures = new WeakMap<TexImageSource, WebGLTexture>();

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: window.__OPEN_FACTORY_NATIVE_PREVIEW_SMOKE_ACTIVE__ === true
    });
    if (!gl) {
      throw new Error('WebGL preview is unavailable.');
    }
    this.gl = gl;
    this.program = createProgram(gl);
    const positionBuffer = gl.createBuffer();
    const texCoordBuffer = gl.createBuffer();
    if (!positionBuffer || !texCoordBuffer) {
      throw new Error('Unable to allocate WebGL buffers.');
    }
    this.positionBuffer = positionBuffer;
    this.texCoordBuffer = texCoordBuffer;
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
  }

  drawSource(source: TexImageSource, mediaWidth: number, mediaHeight: number, transform: Transform, colorCorrection?: Partial<ColorCorrection>): void {
    const gl = this.gl;
    const texture = this.getTexture(source);
    const correction = normalizeColorCorrection(colorCorrection ?? DEFAULT_COLOR_CORRECTION);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1f(this.program.opacity, Math.max(0, Math.min(1, transform.opacity)));
    gl.uniform4f(this.program.colorCorrection, correction.brightness, correction.contrast, correction.saturation, correction.hue);
    this.drawQuad(buildTransformedQuad(gl.canvas.width, gl.canvas.height, mediaWidth, mediaHeight, transform));
  }

  drawText(text: string, transform: Transform, style: TextStyle | SubtitleStyle, colorCorrection?: Partial<ColorCorrection>): void {
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
    this.drawSource(canvas, canvas.width, canvas.height, resolveTextTransform(Number(this.gl.canvas.height), transform, style), colorCorrection);
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
    ctx.fillText(`Missing media: ${name}`, canvas.width / 2, canvas.height / 2);
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

  private getTexture(source: TexImageSource): WebGLTexture {
    const cached = this.textures.get(source);
    if (cached) {
      return cached;
    }
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Unable to allocate WebGL texture.');
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.textures.set(source, texture);
    return texture;
  }

  private drawQuad(points: number[]): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.program.position);
    gl.vertexAttribPointer(this.program.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.program.texCoord);
    gl.vertexAttribPointer(this.program.texCoord, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
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
  const width = Math.max(1, mediaWidth * transform.scale);
  const height = Math.max(1, mediaHeight * transform.scale);
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
    `
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
    `
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform float u_opacity;
      uniform vec4 u_colorCorrection;
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

      vec3 applyColorCorrection(vec3 color) {
        color += vec3(u_colorCorrection.x);
        color = (color - 0.5) * u_colorCorrection.y + 0.5;
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, u_colorCorrection.z);
        color = applyHue(color, u_colorCorrection.w);
        return clamp(color, 0.0, 1.0);
      }

      void main() {
        vec4 color = texture2D(u_texture, v_texCoord);
        gl_FragColor = vec4(applyColorCorrection(color.rgb), color.a * u_opacity);
      }
    `
  );
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Unable to create WebGL program.');
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'Unable to link WebGL program.');
  }
  const resolution = gl.getUniformLocation(program, 'u_resolution');
  const texture = gl.getUniformLocation(program, 'u_texture');
  const opacity = gl.getUniformLocation(program, 'u_opacity');
  const colorCorrection = gl.getUniformLocation(program, 'u_colorCorrection');
  if (!resolution || !texture || !opacity || !colorCorrection) {
    throw new Error('WebGL program is missing uniforms.');
  }
  return {
    program,
    position: gl.getAttribLocation(program, 'a_position'),
    texCoord: gl.getAttribLocation(program, 'a_texCoord'),
    resolution,
    texture,
    opacity,
    colorCorrection
  };
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Unable to create WebGL shader.');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'Unable to compile WebGL shader.');
  }
  return shader;
}
