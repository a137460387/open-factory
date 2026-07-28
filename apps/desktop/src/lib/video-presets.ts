import type { VideoGenerationParams } from '../hooks/useVideoGeneration';

/** A video generation preset */
export interface VideoPreset {
  id: string;
  name: string;
  params: Omit<VideoGenerationParams, 'prompt' | 'negativePrompt' | 'imagePath' | 'seed'>;
  isBuiltIn: boolean;
  createdAt: number;
}

/** Built-in presets */
export const BUILT_IN_PRESETS: VideoPreset[] = [
  {
    id: 'builtin-quick',
    name: 'Quick 480p',
    params: {
      numFrames: 16,
      resolution: 480,
      fps: 24,
      steps: 25,
      cfgScale: 5.0,
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'builtin-standard',
    name: 'Standard 720p',
    params: {
      numFrames: 32,
      resolution: 720,
      fps: 24,
      steps: 50,
      cfgScale: 7.5,
    },
    isBuiltIn: true,
    createdAt: 0,
  },
  {
    id: 'builtin-hq',
    name: 'High Quality 1080p',
    params: {
      numFrames: 64,
      resolution: 1080,
      fps: 24,
      steps: 75,
      cfgScale: 10.0,
    },
    isBuiltIn: true,
    createdAt: 0,
  },
];
