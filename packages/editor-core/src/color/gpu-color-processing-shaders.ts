/**
 * GPU color processing shader generation functions.
 */

// ==================== GLSL Shader Code ====================

/** Generate the full GPU color processing fragment shader */
export function generateColorProcessingFragmentShader(): string {
  return `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_inputTexture;
uniform sampler3D u_lutTexture;

// Color correction uniforms
uniform vec4 u_lift;       // rgb + master
uniform vec4 u_gamma;      // rgb + master
uniform vec4 u_gain;       // rgb + master
uniform vec4 u_offset;     // rgb + master
uniform float u_temperature;
uniform float u_tint;
uniform float u_contrast;
uniform float u_pivot;
uniform float u_saturation;
uniform float u_hueRotation;

// Tone mapping uniforms
uniform int u_toneMappingMethod;
uniform float u_exposure;
uniform float u_whitePoint;

// LUT uniforms
uniform float u_lutIntensity;
uniform int u_enableLUT;
uniform int u_enableColorCorrection;
uniform int u_enableToneMapping;

// === Color correction functions ===

vec3 applyLiftGammaGain(vec3 color, vec4 lift, vec4 gamma, vec4 gain, vec4 offset) {
  vec3 lifted = color + lift.rgb * (1.0 - color) + lift.a;
  vec3 gained = lifted * (1.0 + gain.rgb) + gain.a;
  vec3 gammaCorrected = pow(max(gained, vec3(0.0001)), 1.0 / (1.0 + gamma.rgb + gamma.a));
  return clamp(gammaCorrected + offset.rgb + offset.a, 0.0, 1.0);
}

vec3 applyTemperatureTint(vec3 color, float temperature, float tint) {
  float tempFactor = temperature / 100.0;
  float tintFactor = tint / 100.0;
  color.r += tempFactor * 0.1;
  color.b -= tempFactor * 0.1;
  color.g += tintFactor * 0.05;
  return clamp(color, 0.0, 1.0);
}

vec3 applyContrast(vec3 color, float contrast, float pivot) {
  float factor = 1.0 + contrast / 100.0;
  return clamp((color - pivot) * factor + pivot, 0.0, 1.0);
}

vec3 applySaturation(vec3 color, float saturation) {
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float sat = saturation / 100.0;
  return clamp(mix(vec3(lum), color, sat), 0.0, 1.0);
}

vec3 applyHueRotation(vec3 color, float degrees) {
  float rad = radians(degrees);
  float cosA = cos(rad);
  float sinA = sin(rad);
  mat3 hueMatrix = mat3(
    0.213 + cosA * 0.787 - sinA * 0.213,
    0.715 - cosA * 0.715 - sinA * 0.715,
    0.072 - cosA * 0.072 + sinA * 0.928,
    0.213 - cosA * 0.213 + sinA * 0.143,
    0.715 + cosA * 0.285 + sinA * 0.140,
    0.072 - cosA * 0.072 - sinA * 0.283,
    0.213 - cosA * 0.213 - sinA * 0.787,
    0.715 - cosA * 0.715 + sinA * 0.715,
    0.072 + cosA * 0.928 + sinA * 0.072
  );
  return clamp(hueMatrix * color, 0.0, 1.0);
}

// === Tone mapping functions ===

vec3 toneMapReinhard(vec3 color) {
  return color / (1.0 + color);
}

vec3 toneMapFilmic(vec3 color) {
  vec3 x = max(vec3(0.0), color - 0.004);
  return (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);
}

vec3 toneMapAcesHill(vec3 color) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
}

vec3 toneMapAcesNarkowicz(vec3 color) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
}

vec3 toneMapAgx(vec3 color) {
  const vec3 agxOffset = vec3(0.008);
  const float agxMinEv = -12.47;
  const float agxMaxEv = 6.5;
  vec3 logColor = log2(max(color, vec3(0.0001)));
  vec3 normalized = (logColor - agxMinEv) / (agxMaxEv - agxMinEv);
  return clamp(normalized + agxOffset, 0.0, 1.0);
}

vec3 applyToneMapping(vec3 color, int method, float exposure) {
  color *= pow(2.0, exposure);
  if (method == 0) return color; // none
  if (method == 1) return toneMapReinhard(color);
  if (method == 2) return toneMapFilmic(color);
  if (method == 3) return toneMapAcesHill(color);
  if (method == 4) return toneMapAcesNarkowicz(color);
  if (method == 7) return toneMapAgx(color);
  return toneMapAcesHill(color); // default
}

// === Main processing ===

void main() {
  vec4 color = texture(u_inputTexture, v_texCoord);

  // Color correction
  if (u_enableColorCorrection == 1) {
    color.rgb = applyLiftGammaGain(color.rgb, u_lift, u_gamma, u_gain, u_offset);
    color.rgb = applyTemperatureTint(color.rgb, u_temperature, u_tint);
    color.rgb = applyContrast(color.rgb, u_contrast, u_pivot);
    color.rgb = applySaturation(color.rgb, u_saturation);
    if (abs(u_hueRotation) > 0.01) {
      color.rgb = applyHueRotation(color.rgb, u_hueRotation);
    }
  }

  // Tone mapping
  if (u_enableToneMapping == 1) {
    color.rgb = applyToneMapping(color.rgb, u_toneMappingMethod, u_exposure);
  }

  // 3D LUT
  if (u_enableLUT == 1) {
    vec3 lutColor = texture(u_lutTexture, color.rgb).rgb;
    color.rgb = mix(color.rgb, lutColor, u_lutIntensity);
  }

  fragColor = vec4(clamp(color.rgb, 0.0, 1.0), color.a);
}`;
}

/** Generate vertex shader */
export function generateVertexShader(): string {
  return `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}`;
}

/** Generate WebGPU compute shader (WGSL) */
export function generateWebGPUComputeShader(): string {
  return `struct ColorCorrectionParams {
  lift: vec4<f32>,
  gamma: vec4<f32>,
  gain: vec4<f32>,
  offset: vec4<f32>,
  temperature: f32,
  tint: f32,
  contrast: f32,
  pivot: f32,
  saturation: f32,
  hueRotation: f32,
  exposure: f32,
  toneMappingMethod: i32,
  lutIntensity: f32,
  enableFlags: i32,  // bit0=LUT, bit1=CC, bit2=TM
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var lutTexture: texture_3d<f32>;
@group(0) @binding(3) var<uniform> params: ColorCorrectionParams;
@group(0) @binding(4) var inputSampler: sampler;

fn applyLiftGammaGain(color: vec3<f32>, lift: vec4<f32>, gamma: vec4<f32>, gain: vec4<f32>, offset: vec4<f32>) -> vec3<f32> {
  let lifted = color + lift.rgb * (1.0 - color) + lift.a;
  let gained = lifted * (1.0 + gain.rgb) + gain.a;
  let gammaCorrected = pow(max(gained, vec3<f32>(0.0001)), vec3<f32>(1.0) / (vec3<f32>(1.0) + gamma.rgb + gamma.a));
  return clamp(gammaCorrected + offset.rgb + offset.a, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyTemperatureTint(color: vec3<f32>, temperature: f32, tint: f32) -> vec3<f32> {
  var c = color;
  let tempFactor = temperature / 100.0;
  let tintFactor = tint / 100.0;
  c.r += tempFactor * 0.1;
  c.b -= tempFactor * 0.1;
  c.g += tintFactor * 0.05;
  return clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyContrast(color: vec3<f32>, contrast: f32, pivot: f32) -> vec3<f32> {
  let factor = 1.0 + contrast / 100.0;
  return clamp((color - vec3<f32>(pivot)) * factor + vec3<f32>(pivot), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applySaturation(color: vec3<f32>, saturation: f32) -> vec3<f32> {
  let lum = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  let sat = saturation / 100.0;
  return clamp(mix(vec3<f32>(lum), color, sat), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn toneMapAcesHill(color: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((color * (a * color + b)) / (color * (c * color + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn toneMapReinhard(color: vec3<f32>) -> vec3<f32> {
  return color / (vec3<f32>(1.0) + color);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = textureDimensions(inputTexture);
  let coord = vec2<i32>(i32(global_id.x), i32(global_id.y));

  if (coord.x >= i32(dims.x) || coord.y >= i32(dims.y)) {
    return;
  }

  var color = textureLoad(inputTexture, coord, 0);

  // Color correction
  if ((params.enableFlags & 2) != 0) {
    color.rgb = applyLiftGammaGain(color.rgb, params.lift, params.gamma, params.gain, params.offset);
    color.rgb = applyTemperatureTint(color.rgb, params.temperature, params.tint);
    color.rgb = applyContrast(color.rgb, params.contrast, params.pivot);
    color.rgb = applySaturation(color.rgb, params.saturation);
  }

  // Tone mapping
  if ((params.enableFlags & 4) != 0) {
    color.rgb *= pow(2.0, params.exposure);
    if (params.toneMappingMethod == 1) {
      color.rgb = toneMapReinhard(color.rgb);
    } else {
      color.rgb = toneMapAcesHill(color.rgb);
    }
  }

  // 3D LUT
  if ((params.enableFlags & 1) != 0) {
    let lutColor = textureSampleLevel(lutTexture, inputSampler, color.rgb, 0.0).rgb;
    color.rgb = mix(color.rgb, lutColor, params.lutIntensity);
  }

  textureStore(outputTexture, coord, vec4<f32>(clamp(color.rgb, vec3<f32>(0.0), vec3<f32>(1.0)), color.a));
}`;
}
