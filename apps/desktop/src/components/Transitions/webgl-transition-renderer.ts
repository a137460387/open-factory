/**
 * WebGL 转场预览渲染器 — 使用 GPU 加速的 shader 实现转场效果预览。
 *
 * 支持的转场效果：
 * - dissolve: 交叉溶解 (混合)
 * - wipe-left/right/up/down: 方向擦除
 * - push-left/right/up/down: 推拉
 * - zoom-dissolve: 缩放溶解
 * - fade-black/flash-white/flash-black: 闪光
 * - glitch: 故障风
 * - flip-horizontal/flip-vertical: 翻转
 * - portal: 门户
 *
 * @module webgl-transition-renderer
 */

/** 转场渲染器实例 */
export interface WebGLTransitionRenderer {
  /** 渲染一帧转场预览 */
  render(progress: number): void;
  /** 释放 WebGL 资源 */
  destroy(): void;
  /** canvas 元素 */
  canvas: HTMLCanvasElement;
}

/** 通用顶点着色器 */
const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

/** 转场片段着色器库 */
const FRAGMENT_SHADERS: Record<string, string> = {
  dissolve: `
precision mediump float;
varying vec2 v_texCoord;
uniform float u_progress;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
void main() {
  gl_FragColor = vec4(mix(u_colorA, u_colorB, u_progress), 1.0);
}
`,
  'wipe-left': `
precision mediump float;
varying vec2 v_texCoord;
uniform float u_progress;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
void main() {
  float edge = 1.0 - u_progress;
  vec3 color = v_texCoord.x < edge ? u_colorA : u_colorB;
  gl_FragColor = vec4(color, 1.0);
}
`,
  'wipe-right': `
precision mediump float;
varying vec2 v_texCoord;
uniform float u_progress;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
void main() {
  vec3 color = v_texCoord.x < u_progress ? u_colorB : u_colorA;
  gl_FragColor = vec4(color, 1.0);
}
`,
  'wipe-up': `
precision mediump float;
varying vec2 v_texCoord;
uniform float u_progress;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
void main() {
  vec3 color = v_texCoord.y < u_progress ? u_colorB : u_colorA;
  gl_FragColor = vec4(color, 1.0);
}
`,
  'wipe-down': `
precision mediump float;
varying vec2 v_texCoord;
uniform float u_progress;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
void main() {
  float edge = 1.0 - u_progress;
  vec3 color = v_texCoord.y < edge ? u_colorA : u_colorB;
  gl_FragColor = vec4(color, 1.0);
}
`,
  'push-left': `
precision mediump float;
varying vec2 v_texCoord;
uniform float u_progress;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
void main() {
  vec2 uv = v_texCoord;
  vec3 color;
  if (uv.x < 1.0 - u_progress) {
    uv.x += u_progress;
    color = u_colorA;
  } else {
    uv.x -= (1.0 - u_progress);
    color = u_colorB;
  }
  gl_FragColor = vec4(color, 1.0);
}
`,
  'zoom-dissolve': `
precision mediump float;
varying vec2 v_texCoord;
uniform float u_progress;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
void main() {
  vec2 center = vec2(0.5, 0.5);
  float dist = distance(v_texCoord, center);
  float radius = u_progress * 0.8;
  float alpha = smoothstep(radius - 0.1, radius + 0.1, dist);
  vec3 color = mix(u_colorB, u_colorA, alpha);
  gl_FragColor = vec4(color, 1.0);
}
`,
  'flash-white': `
precision mediump float;
varying vec2 v_texCoord;
uniform float u_progress;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
void main() {
  float flash = sin(u_progress * 3.14159);
  vec3 base = mix(u_colorA, u_colorB, u_progress);
  vec3 color = mix(base, vec3(1.0), flash * 0.8);
  gl_FragColor = vec4(color, 1.0);
}
`,
  'flash-black': `
precision mediump float;
varying vec2 v_texCoord;
uniform float u_progress;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
void main() {
  float flash = sin(u_progress * 3.14159);
  vec3 base = mix(u_colorA, u_colorB, u_progress);
  vec3 color = mix(base, vec3(0.0), flash * 0.8);
  gl_FragColor = vec4(color, 1.0);
}
`,
  glitch: `
precision mediump float;
varying vec2 v_texCoord;
uniform float u_progress;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
  vec2 uv = v_texCoord;
  float blockY = floor(uv.y * 10.0) / 10.0;
  float offset = (rand(vec2(blockY, floor(u_progress * 5.0))) - 0.5) * u_progress * 0.3;
  uv.x += offset;
  vec3 color;
  if (u_progress < 0.5) {
    float t = u_progress * 2.0;
    color = mix(u_colorA, vec3(u_colorA.r + 0.3, u_colorA.g, u_colorA.b + 0.2), t * step(0.5, rand(vec2(uv.x * 10.0, uv.y * 10.0))));
  } else {
    float t = (u_progress - 0.5) * 2.0;
    color = mix(vec3(u_colorB.r + 0.2, u_colorB.g, u_colorB.b + 0.3), u_colorB, t * step(0.5, rand(vec2(uv.x * 10.0, uv.y * 10.0))));
  }
  gl_FragColor = vec4(color, 1.0);
}
`,
  'flip-horizontal': `
precision mediump float;
varying vec2 v_texCoord;
uniform float u_progress;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
void main() {
  float t = u_progress;
  float scaleX = abs(1.0 - 2.0 * t);
  float x = (v_texCoord.x - 0.5) / max(scaleX, 0.01) + 0.5;
  vec3 color;
  if (x >= 0.0 && x <= 1.0) {
    color = t < 0.5 ? u_colorA : u_colorB;
  } else {
    color = t < 0.5 ? u_colorB : u_colorA;
  }
  float fade = smoothstep(0.0, 0.1, scaleX) * smoothstep(0.0, 0.1, 1.0 - scaleX);
  color = mix(color, mix(u_colorA, u_colorB, t), fade);
  gl_FragColor = vec4(color, 1.0);
}
`,
  portal: `
precision mediump float;
varying vec2 v_texCoord;
uniform float u_progress;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
void main() {
  vec2 center = vec2(0.5, 0.5);
  float dist = distance(v_texCoord, center);
  float radius = u_progress * 0.7;
  float edge = smoothstep(radius - 0.05, radius + 0.05, dist);
  vec3 color = mix(u_colorB, u_colorA, edge);
  float ring = smoothstep(radius - 0.02, radius, dist) * smoothstep(radius + 0.02, radius, dist);
  color += vec3(0.3, 0.5, 1.0) * ring * (1.0 - u_progress);
  gl_FragColor = vec4(color, 1.0);
}
`,
};

/** 默认 fallback shader（dissolve） */
const DEFAULT_FRAGMENT_SHADER = FRAGMENT_SHADERS.dissolve;

/** 预设颜色 A（暖色渐变） */
const COLOR_A: [number, number, number] = [0.231, 0.51, 0.965];
/** 预设颜色 B（冷色渐变） */
const COLOR_B: [number, number, number] = [0.976, 0.451, 0.086];

/**
 * 创建 WebGL 转场渲染器。
 * 如果 WebGL 不可用，返回 null。
 */
export function createWebGLTransitionRenderer(
  canvas: HTMLCanvasElement,
  transitionType: string,
): WebGLTransitionRenderer | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: false });
  if (!gl) {
    return null;
  }

  // 选择 shader
  const shaderKey = normalizeShaderKey(transitionType);
  const fragmentSource = FRAGMENT_SHADERS[shaderKey] ?? DEFAULT_FRAGMENT_SHADER;

  // 编译 shader
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) {
    return null;
  }

  // 链接程序
  const program = gl.createProgram()!;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  gl.useProgram(program);

  // 顶点数据：全屏四边形
  const vertices = new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, 'a_position');
  const texLoc = gl.getAttribLocation(program, 'a_texCoord');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(texLoc);
  gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

  // Uniform locations
  const progressLoc = gl.getUniformLocation(program, 'u_progress');
  const colorALoc = gl.getUniformLocation(program, 'u_colorA');
  const colorBLoc = gl.getUniformLocation(program, 'u_colorB');

  gl.uniform3fv(colorALoc, COLOR_A);
  gl.uniform3fv(colorBLoc, COLOR_B);

  return {
    canvas,
    render(progress: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(progressLoc, Math.min(1, Math.max(0, progress)));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(buffer);
    },
  };
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** 将 TransitionType 映射到 shader key */
function normalizeShaderKey(type: string): string {
  // 直接匹配
  if (FRAGMENT_SHADERS[type]) return type;
  // 推拉类共用 push-left shader
  if (type.startsWith('push-')) return 'push-left';
  // 擦除类
  if (type.startsWith('wipe-')) return type;
  // 形状类、胶片类、运动模糊等 fallback 到 dissolve
  return 'dissolve';
}
