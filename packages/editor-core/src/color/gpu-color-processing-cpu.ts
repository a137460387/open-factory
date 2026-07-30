/**
 * GPU color processing CPU fallback functions.
 */

import type {
  GPUColorCorrectionParams,
  GPUToneMappingParams,
  GPU3DLUTData,
  ToneMappingMethod,
} from './gpu-color-processing-types';

// ==================== Internal Utilities ====================

function clampValue(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ==================== CPU Fallback Implementation ====================

/** CPU fallback: apply Lift/Gamma/Gain/Offset */
export function cpuApplyLiftGammaGain(
  r: number,
  g: number,
  b: number,
  params: GPUColorCorrectionParams,
): [number, number, number] {
  const lr = r + params.lift.r * (1 - r) + params.liftMaster;
  const lg = g + params.lift.g * (1 - g) + params.liftMaster;
  const lb = b + params.lift.b * (1 - b) + params.liftMaster;

  const gr = lr * (1 + params.gain.r) + params.gainMaster;
  const gg = lg * (1 + params.gain.g) + params.gainMaster;
  const gb = lb * (1 + params.gain.b) + params.gainMaster;

  const gammaR = 1 / (1 + params.gamma.r + params.gammaMaster);
  const gammaG = 1 / (1 + params.gamma.g + params.gammaMaster);
  const gammaB = 1 / (1 + params.gamma.b + params.gammaMaster);

  const cr = Math.pow(Math.max(gr, 0.0001), gammaR) + params.offset.r + params.offsetMaster;
  const cg = Math.pow(Math.max(gg, 0.0001), gammaG) + params.offset.g + params.offsetMaster;
  const cb = Math.pow(Math.max(gb, 0.0001), gammaB) + params.offset.b + params.offsetMaster;

  return [clampValue(cr, 0, 1), clampValue(cg, 0, 1), clampValue(cb, 0, 1)];
}

/** CPU fallback: apply temperature/tint */
export function cpuApplyTemperatureTint(
  r: number,
  g: number,
  b: number,
  temperature: number,
  tint: number,
): [number, number, number] {
  const tf = temperature / 100;
  const tt = tint / 100;
  return [clampValue(r + tf * 0.1, 0, 1), clampValue(g + tt * 0.05, 0, 1), clampValue(b - tf * 0.1, 0, 1)];
}

/** CPU fallback: apply contrast */
export function cpuApplyContrast(
  r: number,
  g: number,
  b: number,
  contrast: number,
  pivot: number,
): [number, number, number] {
  const factor = 1 + contrast / 100;
  return [
    clampValue((r - pivot) * factor + pivot, 0, 1),
    clampValue((g - pivot) * factor + pivot, 0, 1),
    clampValue((b - pivot) * factor + pivot, 0, 1),
  ];
}

/** CPU fallback: apply saturation */
export function cpuApplySaturation(r: number, g: number, b: number, saturation: number): [number, number, number] {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const sat = saturation / 100;
  return [
    clampValue(lum + (r - lum) * sat, 0, 1),
    clampValue(lum + (g - lum) * sat, 0, 1),
    clampValue(lum + (b - lum) * sat, 0, 1),
  ];
}

/** CPU fallback: tone mapping - ACES Hill */
export function cpuToneMapAcesHill(r: number, g: number, b: number): [number, number, number] {
  const a = 2.51,
    bb = 0.03,
    c = 2.43,
    d = 0.59,
    e = 0.14;
  return [
    clampValue((r * (a * r + bb)) / (r * (c * r + d) + e), 0, 1),
    clampValue((g * (a * g + bb)) / (g * (c * g + d) + e), 0, 1),
    clampValue((b * (a * b + bb)) / (b * (c * b + d) + e), 0, 1),
  ];
}

/** CPU fallback: tone mapping - Reinhard */
export function cpuToneMapReinhard(r: number, g: number, b: number): [number, number, number] {
  return [r / (1 + r), g / (1 + g), b / (1 + b)];
}

/** CPU fallback: tone mapping - Filmic */
export function cpuToneMapFilmic(r: number, g: number, b: number): [number, number, number] {
  const film = (x: number) => {
    const v = Math.max(0, x - 0.004);
    return (v * (6.2 * v + 0.5)) / (v * (6.2 * v + 1.7) + 0.06);
  };
  return [clampValue(film(r), 0, 1), clampValue(film(g), 0, 1), clampValue(film(b), 0, 1)];
}

/** CPU fallback: tone mapping */
export function cpuApplyToneMapping(
  r: number,
  g: number,
  b: number,
  method: ToneMappingMethod,
  exposure: number,
): [number, number, number] {
  const factor = 2 ** exposure;
  let er = r * factor;
  let eg = g * factor;
  let eb = b * factor;

  switch (method) {
    case 'none':
      break;
    case 'reinhard':
    case 'reinhard-extended':
      [er, eg, eb] = cpuToneMapReinhard(er, eg, eb);
      break;
    case 'filmic':
    case 'uncharted2':
      [er, eg, eb] = cpuToneMapFilmic(er, eg, eb);
      break;
    case 'aces-hill':
    case 'aces-narkowicz':
    case 'aces-lottes':
      [er, eg, eb] = cpuToneMapAcesHill(er, eg, eb);
      break;
    case 'agx': {
      const agxOffset = 0.008;
      const minEv = -12.47;
      const maxEv = 6.5;
      const norm = (v: number) =>
        clampValue((Math.log2(Math.max(v, 0.0001)) - minEv) / (maxEv - minEv) + agxOffset, 0, 1);
      er = norm(er);
      eg = norm(eg);
      eb = norm(eb);
      break;
    }
    default:
      [er, eg, eb] = cpuToneMapAcesHill(er, eg, eb);
  }

  return [clampValue(er, 0, 1), clampValue(eg, 0, 1), clampValue(eb, 0, 1)];
}

/** CPU fallback: 3D LUT trilinear interpolation */
export function cpuApply3DLUT(
  r: number,
  g: number,
  b: number,
  lutData: GPU3DLUTData,
  intensity: number,
): [number, number, number] {
  const size = lutData.size;
  const ri = clampValue(r, 0, 1) * (size - 1);
  const gi = clampValue(g, 0, 1) * (size - 1);
  const bi = clampValue(b, 0, 1) * (size - 1);

  const r0 = Math.floor(ri);
  const g0 = Math.floor(gi);
  const b0 = Math.floor(bi);
  const r1 = Math.min(r0 + 1, size - 1);
  const g1 = Math.min(g0 + 1, size - 1);
  const b1 = Math.min(b0 + 1, size - 1);

  const rf = ri - r0;
  const gf = gi - g0;
  const bf = bi - b0;

  const idx = (rr: number, gg: number, bb: number) => (bb * size * size + gg * size + rr) * 3;

  const lut = lutData.data;
  const get = (rr: number, gg: number, bb: number, ch: number) => {
    const i = idx(rr, gg, bb) + ch;
    return i < lut.length ? lut[i] : 0;
  };

  // Trilinear interpolation
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const c000 = [get(r0, g0, b0, 0), get(r0, g0, b0, 1), get(r0, g0, b0, 2)];
  const c100 = [get(r1, g0, b0, 0), get(r1, g0, b0, 1), get(r1, g0, b0, 2)];
  const c010 = [get(r0, g1, b0, 0), get(r0, g1, b0, 1), get(r0, g1, b0, 2)];
  const c110 = [get(r1, g1, b0, 0), get(r1, g1, b0, 1), get(r1, g1, b0, 2)];
  const c001 = [get(r0, g0, b1, 0), get(r0, g0, b1, 1), get(r0, g0, b1, 2)];
  const c101 = [get(r1, g0, b1, 0), get(r1, g0, b1, 1), get(r1, g0, b1, 2)];
  const c011 = [get(r0, g1, b1, 0), get(r0, g1, b1, 1), get(r0, g1, b1, 2)];
  const c111 = [get(r1, g1, b1, 0), get(r1, g1, b1, 1), get(r1, g1, b1, 2)];

  const result = [0, 0, 0];
  for (let ch = 0; ch < 3; ch++) {
    const c00 = lerp(c000[ch], c100[ch], rf);
    const c01 = lerp(c001[ch], c101[ch], rf);
    const c10 = lerp(c010[ch], c110[ch], rf);
    const c11 = lerp(c011[ch], c111[ch], rf);
    const c0 = lerp(c00, c10, gf);
    const c1 = lerp(c01, c11, gf);
    result[ch] = lerp(c0, c1, bf);
  }

  return [
    clampValue(r + (result[0] - r) * intensity, 0, 1),
    clampValue(g + (result[1] - g) * intensity, 0, 1),
    clampValue(b + (result[2] - b) * intensity, 0, 1),
  ];
}

/** CPU fallback: full color processing pipeline per pixel */
export function cpuProcessPixel(
  r: number,
  g: number,
  b: number,
  colorCorrection: GPUColorCorrectionParams | null,
  toneMapping: GPUToneMappingParams | null,
  lutData: GPU3DLUTData | null,
  lutIntensity: number,
): [number, number, number] {
  let cr = r;
  let cg = g;
  let cb = b;

  // Color correction
  if (colorCorrection) {
    [cr, cg, cb] = cpuApplyLiftGammaGain(cr, cg, cb, colorCorrection);
    [cr, cg, cb] = cpuApplyTemperatureTint(cr, cg, cb, colorCorrection.temperature, colorCorrection.tint);
    [cr, cg, cb] = cpuApplyContrast(cr, cg, cb, colorCorrection.contrast, colorCorrection.pivot);
    [cr, cg, cb] = cpuApplySaturation(cr, cg, cb, colorCorrection.saturation);
    if (Math.abs(colorCorrection.hueRotation) > 0.01) {
      const rad = (colorCorrection.hueRotation * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      const rr =
        cr * (0.213 + cosA * 0.787 - sinA * 0.213) +
        cg * (0.715 - cosA * 0.715 - sinA * 0.715) +
        cb * (0.072 - cosA * 0.072 + sinA * 0.928);
      const gr =
        cr * (0.213 - cosA * 0.213 + sinA * 0.143) +
        cg * (0.715 + cosA * 0.285 + sinA * 0.14) +
        cb * (0.072 - cosA * 0.072 - sinA * 0.283);
      const br =
        cr * (0.213 - cosA * 0.213 - sinA * 0.787) +
        cg * (0.715 - cosA * 0.715 + sinA * 0.715) +
        cb * (0.072 + cosA * 0.928 + sinA * 0.072);
      cr = clampValue(rr, 0, 1);
      cg = clampValue(gr, 0, 1);
      cb = clampValue(br, 0, 1);
    }
  }

  // Tone mapping
  if (toneMapping) {
    [cr, cg, cb] = cpuApplyToneMapping(cr, cg, cb, toneMapping.method, toneMapping.exposure);
  }

  // 3D LUT
  if (lutData) {
    [cr, cg, cb] = cpuApply3DLUT(cr, cg, cb, lutData, lutIntensity);
  }

  return [clampValue(cr, 0, 1), clampValue(cg, 0, 1), clampValue(cb, 0, 1)];
}

/** Process a full frame of image data (CPU fallback) */
export function cpuProcessFrame(
  input: Uint8ClampedArray,
  width: number,
  height: number,
  colorCorrection: GPUColorCorrectionParams | null,
  toneMapping: GPUToneMappingParams | null,
  lutData: GPU3DLUTData | null,
  lutIntensity: number,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(input.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = input[idx] / 255;
      const g = input[idx + 1] / 255;
      const b = input[idx + 2] / 255;

      const [or, og, ob] = cpuProcessPixel(r, g, b, colorCorrection, toneMapping, lutData, lutIntensity);

      output[idx] = Math.round(or * 255);
      output[idx + 1] = Math.round(og * 255);
      output[idx + 2] = Math.round(ob * 255);
      output[idx + 3] = input[idx + 3];
    }
  }
  return output;
}
