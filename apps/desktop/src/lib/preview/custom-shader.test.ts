import { describe, expect, it } from 'vitest';
import { validateCustomShaderSource } from './custom-shader';

describe('custom shader validation', () => {
  it('captures WebGL compile errors with the shader info log', () => {
    const calls: string[] = [];
    const gl = {
      FRAGMENT_SHADER: 35632,
      COMPILE_STATUS: 35713,
      createShader: () => ({ id: 'shader' }),
      shaderSource: (_shader: unknown, source: string) => calls.push(source),
      compileShader: () => undefined,
      getShaderParameter: () => false,
      getShaderInfoLog: () => 'ERROR: bad fragment shader',
      deleteShader: () => undefined
    } as unknown as WebGLRenderingContext;

    const result = validateCustomShaderSource(gl, 'gl_FragColor = vec4(1.0)');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('ERROR: bad fragment shader');
    expect(calls[0]).toContain('uniform sampler2D u_texture;');
    expect(calls[0]).toContain('uniform vec2 u_resolution;');
    expect(calls[0]).toContain('uniform float u_time;');
    expect(calls[0]).toContain('uniform float u_progress;');
  });

  it('returns a successful compile result when WebGL accepts the shader', () => {
    const gl = {
      FRAGMENT_SHADER: 35632,
      COMPILE_STATUS: 35713,
      createShader: () => ({ id: 'shader' }),
      shaderSource: () => undefined,
      compileShader: () => undefined,
      getShaderParameter: () => true,
      getShaderInfoLog: () => null,
      deleteShader: () => undefined
    } as unknown as WebGLRenderingContext;

    expect(validateCustomShaderSource(gl, 'gl_FragColor = texture2D(u_texture, v_texCoord);')).toMatchObject({ ok: true });
  });
});
