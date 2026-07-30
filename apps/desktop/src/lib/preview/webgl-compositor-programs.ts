import { buildCustomShaderFragmentSource } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import type { ProgramInfo, CustomShaderProgramInfo, PanoramaProgramInfo } from './webgl-compositor-types.js';
import { buildAcesToneMappingShaderInjection, buildBlendModeShaderInjection } from './webgl-compositor-shaders.js';

export type { ProgramInfo, CustomShaderProgramInfo, PanoramaProgramInfo };

export const VERTEX_SHADER_SOURCE = `
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

export function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
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

export function createProgram(gl: WebGLRenderingContext): ProgramInfo {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
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
    `,
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
    motionBlur,
  };
}

export function createCustomShaderProgram(gl: WebGLRenderingContext, sourceCode: string): CustomShaderProgramInfo {
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
    progress: gl.getUniformLocation(program, 'u_progress'),
  };
}

export function createPanoramaProgram(gl: WebGLRenderingContext): PanoramaProgramInfo {
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
    `,
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
    opacity: gl.getUniformLocation(program, 'u_opacity'),
  };
}
