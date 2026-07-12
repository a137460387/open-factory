import { NodeGraphEngine } from '@open-factory/editor-core';
import type { ColorGradingGraph } from '@open-factory/editor-core';
import { compileColorGradingShader } from './node-shader-compiler';

const FULLSCREEN_QUAD_VERTICES = new Float32Array([
  -1, -1, 1, -1, -1, 1,
  -1, 1, 1, -1, 1, 1,
]);

const FULLSCREEN_QUAD_TEX_COORDS = new Float32Array([
  0, 0, 1, 0, 0, 1,
  0, 1, 1, 0, 1, 1,
]);

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

/**
 * WebGL color grading renderer.
 *
 * Uses ping-pong framebuffer technique to chain color grading node shaders.
 * Each node in the execution order reads from the current input texture and
 * writes to the alternate framebuffer, so the final output contains all
 * corrections applied in topological order.
 */
export class ColorGradingRenderer {
  private readonly gl: WebGLRenderingContext;
  private program: WebGLProgram | null = null;
  private framebuffers: [WebGLFramebuffer, WebGLFramebuffer] | null = null;
  private textures: [WebGLTexture, WebGLTexture] | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private currentPreamble = '';
  private currentCalls = '';
  private currentWidth = 0;
  private currentHeight = 0;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }

  /**
   * Render the color grading node graph.
   *
   * @param graph   - The color grading graph to execute.
   * @param inputTexture - Source texture to grade.
   * @param width   - Texture width in pixels.
   * @param height  - Texture height in pixels.
   * @returns The output texture (one of the internal ping-pong textures),
   *          or `inputTexture` when there are no enabled nodes.
   */
  render(
    graph: ColorGradingGraph,
    inputTexture: WebGLTexture,
    width: number,
    height: number
  ): WebGLTexture {
    const enabledNodes = graph.nodes.filter(n => n.enabled);
    if (enabledNodes.length === 0) return inputTexture;

    const execution = NodeGraphEngine.execute(graph);
    if (execution.nodeResults.length === 0) return inputTexture;

    this.ensureResources(width, height);

    const compiled = compileColorGradingShader(enabledNodes);
    this.ensureProgram(compiled.preamble, compiled.calls);

    const gl = this.gl;
    let currentInput = inputTexture;
    let bufferIndex = 0;

    for (const result of execution.nodeResults) {
      // Bind output framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers![bufferIndex]);
      gl.viewport(0, 0, width, height);

      // Bind input texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentInput);

      // Use the compiled program and set the sampler uniform
      gl.useProgram(this.program!);
      const textureLoc = gl.getUniformLocation(this.program!, 'u_texture');
      if (textureLoc) gl.uniform1i(textureLoc, 0);

      // Set per-node uniforms
      for (const [name, value] of Object.entries(result.uniforms)) {
        const loc = gl.getUniformLocation(this.program!, name);
        if (loc === null) continue;

        // Unwrap structured descriptors (e.g. { type: 'lut', value: ... })
        let v: unknown = value;
        if (v !== null && typeof v === 'object' && !Array.isArray(v) && 'value' in v && !('buffer' in v)) {
          v = (v as { value: unknown }).value;
        }
        if (v === null || v === undefined) continue;

        if (v instanceof Float32Array) {
          if (v.length === 4) gl.uniform4fv(loc, Array.from(v));
          else if (v.length === 3) gl.uniform3fv(loc, Array.from(v));
          else if (v.length === 2) gl.uniform2fv(loc, Array.from(v));
          else if (v.length >= 1) gl.uniform1f(loc, v[0]);
        } else if (Array.isArray(v)) {
          if (v.length === 4) gl.uniform4fv(loc, v);
          else if (v.length === 3) gl.uniform3fv(loc, v);
          else if (v.length === 2) gl.uniform2fv(loc, v);
          else if (v.length === 1) gl.uniform1f(loc, v[0]);
        } else if (typeof v === 'number') {
          gl.uniform1f(loc, v);
        }
      }

      // Draw fullscreen quad
      this.drawFullscreenQuad();

      // Swap: output becomes next input
      currentInput = this.textures![bufferIndex];
      bufferIndex = 1 - bufferIndex;
    }

    return currentInput;
  }

  // ---------------------------------------------------------------------------
  // Resource management
  // ---------------------------------------------------------------------------

  private ensureResources(width: number, height: number): void {
    if (this.framebuffers && this.currentWidth === width && this.currentHeight === height) {
      return;
    }

    this.disposeResources();

    const gl = this.gl;

    this.framebuffers = [gl.createFramebuffer()!, gl.createFramebuffer()!];
    this.textures = [gl.createTexture()!, gl.createTexture()!];

    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[i], 0);
    }

    // Restore default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Create vertex buffers once
    if (!this.positionBuffer) {
      this.positionBuffer = gl.createBuffer();
      this.texCoordBuffer = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD_VERTICES, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD_TEX_COORDS, gl.STATIC_DRAW);
    }

    this.currentWidth = width;
    this.currentHeight = height;
  }

  private ensureProgram(preamble: string, calls: string): void {
    if (this.program && this.currentPreamble === preamble && this.currentCalls === calls) {
      return;
    }

    const gl = this.gl;

    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }

    const fragmentSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      varying vec2 v_texCoord;

      ${preamble}

      void main() {
        vec4 color = texture2D(u_texture, v_texCoord);
        ${calls}
        gl_FragColor = color;
      }
    `;

    this.program = this.createProgram(VERTEX_SHADER_SOURCE, fragmentSource);
    this.currentPreamble = preamble;
    this.currentCalls = calls;
  }

  // ---------------------------------------------------------------------------
  // GL helpers
  // ---------------------------------------------------------------------------

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Color grading program link failed: ${log}`);
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    return program;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Color grading shader compile failed: ${log}`);
    }

    return shader;
  }

  private drawFullscreenQuad(): void {
    const gl = this.gl;
    const posLoc = gl.getAttribLocation(this.program!, 'a_position');
    const texLoc = gl.getAttribLocation(this.program!, 'a_texCoord');

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ---------------------------------------------------------------------------
  // Disposal
  // ---------------------------------------------------------------------------

  private disposeResources(): void {
    const gl = this.gl;
    if (this.framebuffers) {
      gl.deleteFramebuffer(this.framebuffers[0]);
      gl.deleteFramebuffer(this.framebuffers[1]);
      this.framebuffers = null;
    }
    if (this.textures) {
      gl.deleteTexture(this.textures[0]);
      gl.deleteTexture(this.textures[1]);
      this.textures = null;
    }
    this.currentWidth = 0;
    this.currentHeight = 0;
  }

  dispose(): void {
    const gl = this.gl;
    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }
    if (this.positionBuffer) {
      gl.deleteBuffer(this.positionBuffer);
      this.positionBuffer = null;
    }
    if (this.texCoordBuffer) {
      gl.deleteBuffer(this.texCoordBuffer);
      this.texCoordBuffer = null;
    }
    this.disposeResources();
  }
}
