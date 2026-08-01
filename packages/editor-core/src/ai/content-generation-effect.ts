/**
 * AI content generation - effect generation
 */

import {clamp} from '../utils/math';
import {
  generateId,
  EFFECT_BASE_PARTICLE_COUNT,
  type GeneratedContent,
  type EffectGenerationConfig,
  type AIEffectType,
} from './content-generation-types';

/**
 * AI 特效生成
 *
 * 基于特效类型和强度计算特效参数。
 * 不直接渲染，而是输出可用于渲染引擎的结构化参数。
 *
 * @param config - 特效配置
 * @returns 生成的特效参数内容
 */
export function generateEffect(config: EffectGenerationConfig): GeneratedContent {
  const startTime = performance.now();

  const intensity = clamp(config.intensity ?? 0.5, 0, 1);
  const duration = clamp(config.duration ?? 3, 0.1, 60);

  const effectParams = computeEffectParameters(config.effectType, intensity, duration, config.parameters);

  const generationTimeMs = performance.now() - startTime;

  return {
    id: generateId('effect'),
    type: 'effect',
    data: {
      effectType: config.effectType,
      parameters: effectParams,
      intensity,
      duration,
    },
    duration,
    metadata: {
      effectType: config.effectType,
      intensity,
    },
    quality: 'standard',
    generationTimeMs,
  };
}

/**
 * 计算特效参数
 */
function computeEffectParameters(
  effectType: AIEffectType,
  intensity: number,
  duration: number,
  customParams?: Record<string, unknown>,
): Record<string, unknown> {
  const baseParams: Record<string, unknown> = {
    effectType,
    intensity,
    duration,
  };

  switch (effectType) {
    case 'particle': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.particle * intensity * 3);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 1, max: 4 + intensity * 6 },
        speed: { min: 10, max: 50 + intensity * 100 },
        spread: 360 * intensity,
        lifetime: { min: 0.5, max: duration * 0.8 },
        gravity: 0.1 + intensity * 0.3,
        color: customParams?.color ?? '#ffffff',
        opacity: { start: 1, end: 0 },
        blendMode: 'additive',
      };
    }

    case 'light-leak': {
      return {
        ...baseParams,
        leakCount: Math.round(1 + intensity * 4),
        leakSize: 0.2 + intensity * 0.5,
        position: { x: 0.3 + Math.random() * 0.4, y: 0.2 + Math.random() * 0.3 },
        color: customParams?.color ?? '#ffaa44',
        opacity: intensity * 0.7,
        falloff: 0.5 + (1 - intensity) * 0.4,
        animation: 'drift',
        driftSpeed: 0.05 + intensity * 0.1,
      };
    }

    case 'lens-flare': {
      return {
        ...baseParams,
        flareCount: Math.round(2 + intensity * 6),
        primarySize: 0.1 + intensity * 0.3,
        secondarySize: 0.05 + intensity * 0.15,
        position: { x: 0.5, y: 0.3 },
        color: customParams?.color ?? '#ffffff',
        opacity: 0.3 + intensity * 0.5,
        chromaticAberration: intensity * 0.1,
        starburst: intensity > 0.6,
        starburstRays: intensity > 0.6 ? 6 + Math.round(intensity * 6) : 0,
      };
    }

    case 'glitch': {
      return {
        ...baseParams,
        glitchIntensity: intensity,
        blockSize: Math.round(2 + (1 - intensity) * 20),
        frequency: 0.5 + intensity * 3,
        sliceCount: Math.round(1 + intensity * 8),
        colorShift: intensity * 0.3,
        scanlines: intensity > 0.4,
        scanlineSpacing: 2 + Math.round((1 - intensity) * 4),
        noiseAmount: intensity * 0.5,
        corruption: intensity > 0.7,
      };
    }

    case 'smoke': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.smoke * intensity * 2);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 20, max: 80 + intensity * 120 },
        speed: { min: 5, max: 20 + intensity * 40 },
        direction: 'up',
        spread: 30 + intensity * 60,
        opacity: { start: intensity * 0.4, end: 0 },
        color: customParams?.color ?? '#888888',
        turbulence: 0.3 + intensity * 0.5,
        lifetime: { min: 2, max: duration * 0.9 },
      };
    }

    case 'fire': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.fire * intensity * 2);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 4, max: 15 + intensity * 25 },
        speed: { min: 40, max: 100 + intensity * 150 },
        direction: 'up',
        spread: 15 + intensity * 30,
        opacity: { start: 1, end: 0 },
        colors: ['#ff4400', '#ff8800', '#ffcc00', '#ffffff'],
        heat: intensity,
        flicker: 0.3 + intensity * 0.5,
        smokeEmission: intensity > 0.5,
      };
    }

    case 'rain': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.rain * intensity * 2);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 1, max: 2 + intensity * 2 },
        speed: { min: 200, max: 400 + intensity * 300 },
        direction: 270, // 向下
        spread: 5 + intensity * 10,
        angle: 10 + intensity * 15,
        opacity: { start: 0.4 + intensity * 0.3, end: 0.1 },
        color: customParams?.color ?? '#aaccee',
        splashes: intensity > 0.5,
        splashSize: 2 + intensity * 4,
        mist: intensity > 0.7,
      };
    }

    case 'snow': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.snow * intensity * 2);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 2, max: 5 + intensity * 8 },
        speed: { min: 20, max: 60 + intensity * 60 },
        direction: 270,
        spread: 60 + intensity * 40,
        drift: 0.3 + intensity * 0.5,
        opacity: { start: 0.7 + intensity * 0.3, end: 0 },
        color: '#ffffff',
        accumulation: intensity > 0.6,
        shimmer: 0.2 + intensity * 0.4,
      };
    }

    case 'sparkle': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.sparkle * intensity * 2);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 1, max: 4 + intensity * 6 },
        speed: { min: 5, max: 30 + intensity * 50 },
        spread: 360,
        opacity: { start: 1, end: 0 },
        color: customParams?.color ?? '#ffffcc',
        twinkle: 0.5 + intensity * 0.5,
        twinkleSpeed: 2 + intensity * 8,
        lifetime: { min: 0.3, max: 1.5 + intensity },
        glow: true,
        glowSize: 3 + intensity * 5,
      };
    }

    case 'bokeh': {
      const count = Math.round(EFFECT_BASE_PARTICLE_COUNT.bokeh * intensity * 2);
      return {
        ...baseParams,
        particleCount: count,
        size: { min: 10, max: 40 + intensity * 80 },
        speed: { min: 1, max: 10 + intensity * 20 },
        spread: 360,
        opacity: { start: 0.3 + intensity * 0.3, end: 0 },
        color: customParams?.color ?? '#ffffff',
        shape: 'circle',
        blur: 5 + intensity * 15,
        chromatic: intensity > 0.5,
        drift: 0.1 + intensity * 0.3,
      };
    }

    default:
      return baseParams;
  }
}
