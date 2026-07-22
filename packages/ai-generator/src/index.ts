/**
 * AI Generator main module
 */

import type {
  TextToVideoOptions,
  TextToVideoResult,
  ImageToVideoOptions,
  ImageToVideoResult,
  ComputeEngine,
} from './types.js';
import type { GeneratorConfig } from './config.js';
import { getConfig, loadConfig } from './config.js';
import { createComputeEngine } from './compute/engine.js';
import { modelManager } from './models/model-manager.js';
import { TextToVideoPipeline } from './pipelines/text-to-video.js';
import { ImageToVideoPipeline } from './pipelines/image-to-video.js';

// ============================================================
// AI Generator
// ============================================================

export class AIGenerator {
  private config: GeneratorConfig;
  private engine: ComputeEngine | null = null;
  private textToVideoPipeline: TextToVideoPipeline | null = null;
  private imageToVideoPipeline: ImageToVideoPipeline | null = null;
  private initialized = false;

  constructor(config?: Partial<GeneratorConfig>) {
    this.config = config ? loadConfig(config) : getConfig();
  }

  /**
   * Initialize the generator
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create compute engine
    this.engine = await createComputeEngine(this.config.compute.preferredBackend);

    // Initialize pipelines
    this.textToVideoPipeline = new TextToVideoPipeline(this.engine);
    this.imageToVideoPipeline = new ImageToVideoPipeline(this.engine);

    // Load model manifest
    await modelManager.loadManifest();

    this.initialized = true;
  }

  /**
   * Generate video from text prompt
   */
  async textToVideo(options: TextToVideoOptions): Promise<TextToVideoResult> {
    await this.ensureInitialized();
    return this.textToVideoPipeline!.generate(options);
  }

  /**
   * Generate video from image
   */
  async imageToVideo(options: ImageToVideoOptions): Promise<ImageToVideoResult> {
    await this.ensureInitialized();
    return this.imageToVideoPipeline!.generate(options);
  }

  /**
   * Get available models
   */
  async getAvailableModels() {
    return modelManager.loadManifest();
  }

  /**
   * Get compute capabilities
   */
  async getComputeCapabilities() {
    await this.ensureInitialized();
    return this.engine!.capabilities;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return modelManager.getCacheStats();
  }

  /**
   * Clear model cache
   */
  clearCache() {
    modelManager.clearCache();
  }

  /**
   * Dispose resources
   */
  dispose() {
    if (this.engine) {
      this.engine.dispose();
      this.engine = null;
    }
    this.textToVideoPipeline = null;
    this.imageToVideoPipeline = null;
    this.initialized = false;
  }

  /**
   * Ensure generator is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// ============================================================
// Factory Function
// ============================================================

export async function createAIGenerator(
  config?: Partial<GeneratorConfig>
): Promise<AIGenerator> {
  const generator = new AIGenerator(config);
  await generator.initialize();
  return generator;
}

// ============================================================
// Re-exports
// ============================================================

export { getConfig, loadConfig, resetConfig } from './config.js';
export { createComputeEngine } from './compute/engine.js';
export { modelManager } from './models/model-manager.js';
export { TextToVideoPipeline } from './pipelines/text-to-video.js';
export { ImageToVideoPipeline } from './pipelines/image-to-video.js';
export * from './types.js';
