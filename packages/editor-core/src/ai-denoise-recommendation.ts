import { round } from './time';

/** 噪声频谱分析结果 */
export interface NoiseProfile {
  humScore: number;
  hissScore: number;
  windScore: number;
  snrEstimate: number;
}

/** 单个降噪滤镜推荐 */
export interface DenoiseFilterRecommendation {
  filter: 'afftdn' | 'highpass' | 'lowpass' | 'anlmdn';
  params: Record<string, number | string>;
  reason: string;
}

/** AI降噪推荐响应 */
export interface AIDenoiseResponse {
  recommendedFilters: DenoiseFilterRecommendation[];
  confidence: number;
}

/** 轨道级降噪推荐数据 */
export interface AIDenoiseRecommendation {
  noiseProfile: NoiseProfile;
  recommendedFilters: DenoiseFilterRecommendation[];
  appliedFilters: string[];
  generatedAt: string;
}

const HUM_FREQS = [50, 60, 100, 120, 150, 180, 200, 240, 300];
const HISS_LOW_FREQ = 6000;
const WIND_HIGH_FREQ = 150;
const HUM_THRESHOLD = 0.15;
const HISS_THRESHOLD = 0.01;
const WIND_THRESHOLD = 0.12;
const SNR_SILENCE_FLOOR = 0.001;

/**
 * 对音频样本做简化DFT频率分析，返回指定频率范围的归一化能量。
 * 使用Goertzel算法高效计算单个频率点的能量。
 */
export function analyzeFrequencyBand(
  samples: Float32Array,
  sampleRate: number,
  freqHz: number,
  bandwidthHz = 5
): number {
  if (samples.length === 0 || sampleRate <= 0 || freqHz <= 0) {
    return 0;
  }
  const N = Math.min(samples.length, 4096);
  const k = Math.round((freqHz / sampleRate) * N);
  const w = (2 * Math.PI * k) / N;
  const coeff = 2 * Math.cos(w);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let n = 0; n < N; n++) {
    s0 = samples[n] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  const normalized = power / (N * N);
  return Math.sqrt(Math.max(0, normalized));
}

/**
 * 计算宽带能量：对频率范围内多个采样点取平均。
 */
export function analyzeBroadbandEnergy(
  samples: Float32Array,
  sampleRate: number,
  lowFreq: number,
  highFreq: number,
  binCount = 8
): number {
  if (samples.length === 0 || sampleRate <= 0 || lowFreq >= highFreq) {
    return 0;
  }
  let totalEnergy = 0;
  const step = (highFreq - lowFreq) / Math.max(1, binCount);
  for (let i = 0; i < binCount; i++) {
    const freq = lowFreq + step * (i + 0.5);
    totalEnergy += analyzeFrequencyBand(samples, sampleRate, freq);
  }
  return totalEnergy / Math.max(1, binCount);
}

/**
 * 估算信噪比（SNR）：用信号区间的RMS与静音区间RMS的比值。
 */
export function estimateSNR(
  signalSamples: Float32Array,
  noiseSamples: Float32Array
): number {
  const signalRms = calculateSimpleRms(signalSamples);
  const noiseRms = Math.max(calculateSimpleRms(noiseSamples), SNR_SILENCE_FLOOR);
  if (noiseRms <= 0) {
    return 60;
  }
  const ratio = signalRms / noiseRms;
  return round(20 * Math.log10(Math.max(1e-6, ratio)), 1);
}

function calculateSimpleRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * 对噪声样本窗口进行频谱分析，分类噪声类型并生成噪声画像。
 */
export function classifyNoiseProfile(
  noiseSamples: Float32Array,
  sampleRate: number,
  signalSamples?: Float32Array
): NoiseProfile {
  if (noiseSamples.length === 0 || sampleRate <= 0) {
    return { humScore: 0, hissScore: 0, windScore: 0, snrEstimate: 60 };
  }

  // 嗡声检测：检查50/60Hz及其谐波的能量
  let humMax = 0;
  for (const freq of HUM_FREQS) {
    const energy = analyzeFrequencyBand(noiseSamples, sampleRate, freq, 3);
    humMax = Math.max(humMax, energy);
  }
  const humScore = round(Math.min(1, humMax / Math.max(HUM_THRESHOLD, 0.001)), 3);

  // 嘶声检测：高频宽带能量
  const hissEnergy = analyzeBroadbandEnergy(noiseSamples, sampleRate, HISS_LOW_FREQ, sampleRate / 2.2, 12);
  const hissScore = round(Math.min(1, hissEnergy / Math.max(HISS_THRESHOLD, 0.001)), 3);

  // 风声检测：低频宽带能量
  const windEnergy = analyzeBroadbandEnergy(noiseSamples, sampleRate, 20, WIND_HIGH_FREQ, 8);
  const windScore = round(Math.min(1, windEnergy / Math.max(WIND_THRESHOLD, 0.001)), 3);

  // SNR估算
  const snrEstimate = signalSamples ? estimateSNR(signalSamples, noiseSamples) : 30;

  return { humScore, hissScore, windScore, snrEstimate };
}

/**
 * 根据噪声画像推荐FFmpeg降噪滤镜参数。
 */
export function recommendDenoiseFilters(profile: NoiseProfile): DenoiseFilterRecommendation[] {
  const filters: DenoiseFilterRecommendation[] = [];

  // 嗡声 → highpass滤镜切除低频
  if (profile.humScore > 0.3) {
    const cutoffFreq = profile.humScore > 0.7 ? 100 : 80;
    filters.push({
      filter: 'highpass',
      params: { f: cutoffFreq, poles: 2 },
      reason: `检测到嗡声干扰（得分${profile.humScore.toFixed(2)}），建议使用高通滤波切除${cutoffFreq}Hz以下低频`
    });
  }

  // 嘶声 → afftdn自适应FFT降噪
  if (profile.hissScore > 0.2) {
    const nr = Math.min(0.95, 0.3 + profile.hissScore * 0.5);
    filters.push({
      filter: 'afftdn',
      params: { nr: round(nr, 2), nt: 'w', om: 'o' },
      reason: `检测到嘶声/高频噪声（得分${profile.hissScore.toFixed(2)}），建议使用自适应FFT降噪`
    });
  }

  // 风声 → lowpass + highpass组合
  if (profile.windScore > 0.3) {
    const lowCutoff = profile.windScore > 0.6 ? 120 : 150;
    filters.push({
      filter: 'lowpass',
      params: { f: lowCutoff, poles: 2 },
      reason: `检测到风声干扰（得分${profile.windScore.toFixed(2)}），建议使用低通滤波切除${lowCutoff}Hz以上风噪`
    });
  }

  // 通用降噪 → anlmdn
  if (profile.snrEstimate < 20 && filters.length === 0) {
    filters.push({
      filter: 'anlmdn',
      params: { s: round(Math.max(1, 10 - profile.snrEstimate / 3), 1) },
      reason: `信噪比偏低（${profile.snrEstimate}dB），建议使用非局部均值降噪`
    });
  }

  return filters;
}

const VALID_FILTERS = new Set(['afftdn', 'highpass', 'lowpass', 'anlmdn']);

/**
 * 解析AI返回的降噪推荐响应。
 */
export function parseDenoiseAiResponse(json: unknown): AIDenoiseResponse {
  const empty: AIDenoiseResponse = { recommendedFilters: [], confidence: 0 };
  if (!json || typeof json !== 'object') return empty;
  const obj = json as Record<string, unknown>;
  const confidence = typeof obj.confidence === 'number' ? Math.min(1, Math.max(0, obj.confidence)) : 0;
  if (!Array.isArray(obj.recommendedFilters)) return { ...empty, confidence };
  const recommendedFilters: DenoiseFilterRecommendation[] = obj.recommendedFilters
    .filter((item: unknown): item is DenoiseFilterRecommendation => {
      if (!item || typeof item !== 'object') return false;
      const i = item as Record<string, unknown>;
      return typeof i.filter === 'string' && VALID_FILTERS.has(i.filter) && typeof i.reason === 'string';
    })
    .map((item) => ({
      filter: (item as DenoiseFilterRecommendation).filter,
      params: typeof (item as DenoiseFilterRecommendation).params === 'object' ? (item as DenoiseFilterRecommendation).params : {},
      reason: ((item as DenoiseFilterRecommendation).reason ?? '').trim()
    }));
  return { recommendedFilters, confidence };
}

/**
 * 构建FFmpeg降噪滤镜链字符串。
 */
export function buildDenoiseFilterChain(filters: DenoiseFilterRecommendation[]): string {
  return filters
    .map((f) => {
      const params = Object.entries(f.params)
        .map(([k, v]) => `${k}=${v}`)
        .join(':');
      return params ? `${f.filter}=${params}` : f.filter;
    })
    .join(',');
}

/**
 * 为每个推荐滤镜生成FFmpeg参数数组（用于Command::new("ffmpeg")风格调用）。
 */
export function buildDenoiseFfmpegArgs(filters: DenoiseFilterRecommendation[]): string[] {
  const args: string[] = [];
  for (const f of filters) {
    args.push('-af', buildDenoiseFilterChain([f]));
  }
  return args;
}

/**
 * 创建默认的AIDenoiseRecommendation对象。
 */
export function createDenoiseRecommendation(
  noiseProfile: NoiseProfile,
  recommendedFilters: DenoiseFilterRecommendation[]
): AIDenoiseRecommendation {
  return {
    noiseProfile,
    recommendedFilters,
    appliedFilters: [],
    generatedAt: new Date().toISOString()
  };
}

/**
 * 规范化AIDenoiseRecommendation，处理旧项目兼容。
 */
export function normalizeAIDenoiseRecommendation(
  input: Partial<AIDenoiseRecommendation> | undefined
): AIDenoiseRecommendation | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const np = input.noiseProfile;
  if (!np || typeof np !== 'object') return undefined;
  return {
    noiseProfile: {
      humScore: finiteOrZero(np.humScore),
      hissScore: finiteOrZero(np.hissScore),
      windScore: finiteOrZero(np.windScore),
      snrEstimate: finiteOrZero(np.snrEstimate)
    },
    recommendedFilters: Array.isArray(input.recommendedFilters) ? input.recommendedFilters : [],
    appliedFilters: Array.isArray(input.appliedFilters) ? input.appliedFilters : [],
    generatedAt: typeof input.generatedAt === 'string' ? input.generatedAt : ''
  };
}

function finiteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
