import { buildCustomShaderFragmentSource } from '@open-factory/editor-core';
import { t } from '../../i18n/strings';

export interface CustomShaderCompileResult {
  ok: boolean;
  error?: string;
  fragmentSource: string;
}

export function validateCustomShaderSource(gl: WebGLRenderingContext, source: string): CustomShaderCompileResult {
  const fragmentSource = buildCustomShaderFragmentSource(source);
  const shader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!shader) {
    return {
      ok: false,
      error: t('inspector.customShader.compileFailed'),
      fragmentSource
    };
  }
  gl.shaderSource(shader, fragmentSource);
  gl.compileShader(shader);
  const ok = Boolean(gl.getShaderParameter(shader, gl.COMPILE_STATUS));
  const infoLog = gl.getShaderInfoLog(shader);
  const error: string | undefined = ok ? undefined : infoLog || t<string>('inspector.customShader.compileFailed');
  gl.deleteShader(shader);
  return { ok, error, fragmentSource };
}
