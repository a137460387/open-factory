import type { TTSConfig, TTSEngine } from './types';

/**
 * Build TTS request endpoint URL for the given engine.
 * ElevenLabs: {baseUrl}/text-to-speech/{voiceId}
 * OpenAI / compatible: {baseUrl}/audio/speech
 */
export function buildTtsEndpoint(config: TTSConfig): string {
  const base = config.baseUrl.replace(/\/+$/, '');
  if (config.engine === 'elevenlabs') {
    return `${base}/text-to-speech/${encodeURIComponent(config.voiceId)}`;
  }
  return `${base}/audio/speech`;
}

/**
 * Build TTS request body.
 * ElevenLabs: { text, model_id, voice_settings: { stability, speed } }
 * OpenAI: { model, input, voice, speed }
 */
export function buildTtsRequestBody(text: string, config: TTSConfig): Record<string, unknown> {
  if (config.engine === 'elevenlabs') {
    return {
      text,
      model_id: config.model ?? 'eleven_multilingual_v2',
      voice_settings: {
        stability: config.stability ?? 0.5,
        speed: config.speed,
      },
    };
  }
  return {
    model: config.model ?? 'tts-1',
    input: text,
    voice: config.voiceId,
    speed: config.speed,
  };
}

/**
 * Generate a deterministic cache key for a TTS request.
 * Based on text content + voice + speed + stability + engine.
 */
export function generateTtsCacheKey(text: string, config: TTSConfig): string {
  const parts = [text, config.voiceId, String(config.speed), config.engine, config.providerId];
  if (config.engine === 'elevenlabs' && config.stability !== undefined) {
    parts.push(String(config.stability));
  }
  // Simple DJB2 hash as hex string
  let hash = 5381;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash = ((hash << 5) + hash + part.charCodeAt(i)) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Detect TTS engine from provider baseUrl patterns.
 */
export function detectTtsEngine(baseUrl: string, providerId: string): TTSEngine {
  const url = baseUrl.toLowerCase();
  if (url.includes('elevenlabs')) return 'elevenlabs';
  if (url.includes('openai')) return 'openai';
  if (providerId === 'elevenlabs') return 'elevenlabs';
  return 'compatible';
}
