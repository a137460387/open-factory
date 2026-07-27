/**
 * WebGPU WGSL 着色器定义
 */
/** 全屏四边形顶点着色器 */
export const FULLSCREEN_VERTEX_SHADER = `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0)
  );

  var uv = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0)
  );

  var output: VertexOutput;
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = uv[vertexIndex];
  return output;
}
`;
/** 色彩处理片段着色器 */
export const COLOR_PROCESSING_FRAGMENT_SHADER = `
struct ColorCorrectionParams {
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
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var lutTexture: texture_3d<f32>;
@group(0) @binding(3) var<uniform> params: ColorCorrectionParams;

struct FragmentOutput {
  @location(0) color: vec4<f32>,
}

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

fn applyHueRotation(color: vec3<f32>, degrees: f32) -> vec3<f32> {
  let rad = radians(degrees);
  let cosA = cos(rad);
  let sinA = sin(rad);
  let hueMatrix = mat3x3<f32>(
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
  return clamp(hueMatrix * color, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn toneMapReinhard(color: vec3<f32>) -> vec3<f32> {
  return color / (vec3<f32>(1.0) + color);
}

fn toneMapFilmic(color: vec3<f32>) -> vec3<f32> {
  let x = max(vec3<f32>(0.0), color - vec3<f32>(0.004));
  return (x * (6.2 * x + vec3<f32>(0.5))) / (x * (6.2 * x + vec3<f32>(1.7)) + vec3<f32>(0.06));
}

fn toneMapAcesHill(color: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((color * (a * color + vec3<f32>(b))) / (color * (c * color + vec3<f32>(d)) + vec3<f32>(e)), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn toneMapAgx(color: vec3<f32>) -> vec3<f32> {
  let agxOffset = vec3<f32>(0.008);
  let agxMinEv = -12.47;
  let agxMaxEv = 6.5;
  let logColor = log2(max(color, vec3<f32>(0.0001)));
  let normalized = (logColor - vec3<f32>(agxMinEv)) / (vec3<f32>(agxMaxEv - agxMinEv));
  return clamp(normalized + agxOffset, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyToneMapping(color: vec3<f32>, method: i32, exposure: f32) -> vec3<f32> {
  var c = color * pow(2.0, exposure);
  if (method == 0) { return c; } // none
  if (method == 1) { return toneMapReinhard(c); }
  if (method == 2) { return toneMapFilmic(c); }
  if (method == 3) { return toneMapAcesHill(c); }
  if (method == 4) { return toneMapAcesHill(c); } // fallback
  if (method == 5) { return toneMapAgx(c); }
  return toneMapAcesHill(c); // default
}

@fragment
fn main(@location(0) uv: vec2<f32>) -> FragmentOutput {
  var color = textureSample(inputTexture, textureSampler, uv);

  // 色彩校正
  if ((params.enableFlags & 2) != 0) {
    color.rgb = applyLiftGammaGain(color.rgb, params.lift, params.gamma, params.gain, params.offset);
    color.rgb = applyTemperatureTint(color.rgb, params.temperature, params.tint);
    color.rgb = applyContrast(color.rgb, params.contrast, params.pivot);
    color.rgb = applySaturation(color.rgb, params.saturation);
    if (abs(params.hueRotation) > 0.01) {
      color.rgb = applyHueRotation(color.rgb, params.hueRotation);
    }
  }

  // 色调映射
  if ((params.enableFlags & 4) != 0) {
    color.rgb = applyToneMapping(color.rgb, params.toneMappingMethod, params.exposure);
  }

  // 3D LUT
  if ((params.enableFlags & 1) != 0) {
    let lutColor = textureSample(lutTexture, textureSampler, color.rgb).rgb;
    color.rgb = mix(color.rgb, lutColor, params.lutIntensity);
  }

  var output: FragmentOutput;
  output.color = vec4<f32>(clamp(color.rgb, vec3<f32>(0.0), vec3<f32>(1.0)), color.a);
  return output;
}
`;
//# sourceMappingURL=webgpu-shaders.js.map