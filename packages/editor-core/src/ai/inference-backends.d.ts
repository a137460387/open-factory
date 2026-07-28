/**
 * AI inference engine — GPU backends (WebGPU + WebGL2 fallback)
 */
export declare class WebGPUBackend {
    private device;
    private adapter;
    private pipelines;
    private buffers;
    initialize(): Promise<boolean>;
    isAvailable(): boolean;
    createBuffer(size: number, usage: number): Promise<GPUBuffer>;
    createComputePipeline(shaderCode: string, entryPoint: string): Promise<GPUComputePipeline>;
    executeComputeShader(pipeline: GPUComputePipeline, bindGroups: GPUBindGroup[], workgroupCount: [number, number, number]): Promise<void>;
    readBuffer(buffer: GPUBuffer, size: number): Promise<ArrayBuffer>;
    destroy(): void;
}
export declare class WebGL2Backend {
    private gl;
    private programs;
    initialize(): Promise<boolean>;
    isAvailable(): boolean;
    createComputeProgram(shaderSource: string): WebGLProgram | null;
    destroy(): void;
}
//# sourceMappingURL=inference-backends.d.ts.map