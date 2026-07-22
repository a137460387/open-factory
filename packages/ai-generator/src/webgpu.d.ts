/**
 * WebGPU type declarations for environments without @webgpu/types
 */

interface GPUBufferUsage {
  readonly STORAGE: number;
  readonly COPY_DST: number;
  readonly COPY_SRC: number;
  readonly MAP_READ: number;
  readonly MAP_WRITE: number;
  readonly INDEX: number;
  readonly VERTEX: number;
  readonly UNIFORM: number;
  readonly INDIRECT: number;
  readonly QUERY_RESOLVE: number;
}

interface GPUTextureUsage {
  readonly TEXTURE_BINDING: number;
  readonly COPY_DST: number;
  readonly COPY_SRC: number;
  readonly RENDER_ATTACHMENT: number;
  readonly STORAGE_BINDING: number;
}

declare const GPUBufferUsage: GPUBufferUsage;
declare const GPUTextureUsage: GPUTextureUsage;

interface GPUAdapter {
  readonly features: ReadonlySet<string>;
  requestDevice(): Promise<GPUDevice | null>;
}

interface GPUDevice {
  createBuffer(descriptor: object): object;
  createTexture(descriptor: object): object;
  readonly queue: GPUQueue;
  destroy(): void;
}

interface GPUQueue {
  writeTexture(destination: object, data: BufferSource, dataLayout: object, size: object): void;
}

interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
}

interface NavigatorGPU {
  readonly gpu?: GPU;
}
