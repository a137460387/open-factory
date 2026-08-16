/** Video generation request parameters */
export interface VideoGenerationParams {
  prompt: string;
  negativePrompt?: string;
  imagePath?: string;
  numFrames: number;
  resolution: number;
  fps: number;
  steps: number;
  cfgScale: number;
  seed?: number;
}

/** Progress event from the sidecar */
export interface LtxProgressPayload {
  taskId: string;
  progress: number;
  progressPct: number;
  stage: string;
}

/** Completion event from the sidecar */
export interface LtxCompletedPayload {
  taskId: string;
  status: string;
  videoPath?: string;
}

/** Specific error types for generation failures */
export type GenerationErrorType =
  | 'model_not_found'
  | 'gpu_unavailable'
  | 'sidecar_crash'
  | 'inference_timeout'
  | 'unknown';

/** User-friendly error messages */
export function getErrorHint(errorType: GenerationErrorType): string {
  switch (errorType) {
    case 'model_not_found':
      return 'The AI model is not installed. Please download it from the Model Manager first.';
    case 'gpu_unavailable':
      return 'No compatible GPU detected or GPU memory is insufficient. Close other GPU-intensive applications and try again.';
    case 'inference_timeout':
      return 'The generation process took too long. Try reducing the resolution or number of frames.';
    case 'sidecar_crash':
      return 'The inference process crashed. This may be due to insufficient memory or a model error.';
    case 'unknown':
      return 'An unexpected error occurred. Please try again.';
  }
}
