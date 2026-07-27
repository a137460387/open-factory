/**
 * AI inference engine — domain-specific accelerators (ASR + Semantic)
 */
import { WebGPUBackend, WebGL2Backend } from './inference-backends.js';
export declare class ASRAccelerator {
    private backend;
    private encoderPipeline;
    private decoderPipeline;
    constructor(backend: WebGPUBackend | WebGL2Backend);
    initialize(): Promise<boolean>;
    transcribe(audioData: Float32Array): Promise<string>;
    private extractFeatures;
    private computeMFCC;
    private encoder;
    private decoder;
    private getEncoderShader;
    private getDecoderShader;
}
export declare class SemanticExtractorAccelerator {
    private backend;
    private embeddingPipeline;
    constructor(backend: WebGPUBackend | WebGL2Backend);
    initialize(): Promise<boolean>;
    extractEmbedding(text: string): Promise<Float32Array>;
    private tokenize;
    private computeEmbeddings;
    private poolEmbeddings;
    private getEmbeddingShader;
}
//# sourceMappingURL=inference-accelerators.d.ts.map