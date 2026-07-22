/**
 * WebGPU 类型声明
 *
 * 为 TypeScript 提供 WebGPU API 的类型定义
 */

interface GPUDevice {
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
  createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
  createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
  createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;
  createCommandEncoder(): GPUCommandEncoder;
  createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
  createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
  createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
  createSampler(descriptor?: GPUSamplerDescriptor): GPUSampler;
  queue: GPUQueue;
  destroy(): void;
  lost: Promise<GPUDeviceLostInfo>;
  limits: GPULimits;
  features: Set<string>;
}

interface GPUAdapter {
  requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
  info: GPUAdapterInfo;
  features: Set<string>;
  limits: GPULimits;
}

interface GPUAdapterInfo {
  vendor: string;
  device: string;
  description: string;
}

interface GPULimits {
  maxTextureDimension1D: number;
  maxTextureDimension2D: number;
  maxTextureDimension3D: number;
  maxTextureArrayLayers: number;
  maxBufferSize: number;
  maxStorageBufferBindingSize: number;
  maxComputeWorkgroupSizeX: number;
  maxComputeWorkgroupSizeY: number;
  maxComputeWorkgroupSizeZ: number;
}

interface GPUBuffer {
  destroy(): void;
  mapAsync(mode: number): Promise<void>;
  getMappedRange(): ArrayBuffer;
  size: number;
  usage: number;
}

interface GPUTexture {
  createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView;
  destroy(): void;
  width: number;
  height: number;
  depthOrArrayLayers: number;
  format: string;
}

interface GPUTextureView {}

interface GPUSampler {}

interface GPUShaderModule {}

interface GPUComputePipeline {}

interface GPURenderPipeline {}

interface GPUBindGroupLayout {}

interface GPUPipelineLayout {
  label?: string;
}

interface GPUBindGroup {}

interface GPUCommandBuffer {}

interface GPUCommandEncoder {
  beginComputePass(): GPUComputePassEncoder;
  beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
  copyBufferToBuffer(source: GPUBuffer, sourceOffset: number, destination: GPUBuffer, destinationOffset: number, size: number): void;
  finish(): GPUCommandBuffer;
}

interface GPUComputePassEncoder {
  setPipeline(pipeline: GPUComputePipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  dispatchWorkgroups(x: number, y?: number, z?: number): void;
  end(): void;
}

interface GPURenderPassEncoder {
  setPipeline(pipeline: GPURenderPipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
  end(): void;
}

interface GPUQueue {
  submit(commandBuffers: GPUCommandBuffer[]): void;
  onSubmittedWorkDone(): Promise<void>;
  writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: BufferSource, dataOffset?: number, size?: number): void;
  writeTexture(destination: GPUImageCopyTexture, data: BufferSource, dataLayout: GPUImageDataLayout, size: GPUExtent3D): void;
  copyExternalImageToTexture(source: GPUCopyExternalImageSource, destination: GPUCopyExternalImageDest, copySize: GPUExtent3D): void;
}

interface GPUDeviceLostInfo {
  message: string;
}

interface GPUBufferDescriptor {
  size: number;
  usage: number;
  mappedAtCreation?: boolean;
  label?: string;
}

interface GPUShaderModuleDescriptor {
  code: string;
  label?: string;
}

interface GPUComputePipelineDescriptor {
  layout: 'auto' | GPUPipelineLayout;
  compute: {
    module: GPUShaderModule;
    entryPoint: string;
  };
  label?: string;
}

interface GPURenderPipelineDescriptor {
  layout: 'auto' | GPUPipelineLayout;
  vertex: {
    module: GPUShaderModule;
    entryPoint: string;
  };
  fragment?: {
    module: GPUShaderModule;
    entryPoint: string;
    targets: GPUColorTargetState[];
  };
  primitive?: GPUPrimitiveState;
  label?: string;
}

interface GPUColorTargetState {
  format: string;
}

interface GPUPrimitiveState {
  topology: string;
}

interface GPUBindGroupLayoutDescriptor {
  entries: GPUBindGroupLayoutEntry[];
  label?: string;
}

interface GPUBindGroupLayoutEntry {
  binding: number;
  visibility: number;
  texture?: {
    sampleType: string;
    viewDimension?: string;
  };
  sampler?: {};
  buffer?: {
    type: string;
  };
}

interface GPUPipelineLayoutDescriptor {
  bindGroupLayouts: GPUBindGroupLayout[];
  label?: string;
}

interface GPUBindGroupDescriptor {
  layout: GPUBindGroupLayout;
  entries: GPUBindGroupEntry[];
  label?: string;
}

interface GPUBindGroupEntry {
  binding: number;
  resource: GPUBindingResource;
}

type GPUBindingResource = GPUTextureView | GPUSampler | { buffer: GPUBuffer };

interface GPUTextureDescriptor {
  size: GPUExtent3D;
  format: string;
  usage: number;
  dimension?: string;
  label?: string;
}

interface GPUTextureViewDescriptor {
  format?: string;
  dimension?: string;
  label?: string;
}

interface GPUSamplerDescriptor {
  magFilter?: string;
  minFilter?: string;
  label?: string;
}

interface GPUTextureViewDescriptor {
  format?: string;
  dimension?: string;
  label?: string;
}

interface GPURenderPassDescriptor {
  colorAttachments: GPURenderPassColorAttachment[];
  label?: string;
}

interface GPURenderPassColorAttachment {
  view: GPUTextureView;
  loadOp: string;
  storeOp: string;
  clearValue?: GPUColor;
}

interface GPUColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface GPUImageCopyTexture {
  texture: GPUTexture;
}

interface GPUImageDataLayout {
  bytesPerRow: number;
  rowsPerImage: number;
}

type GPUExtent3D = { width: number; height: number; depthOrArrayLayers?: number } | number;

interface GPUCopyExternalImageSource {
  source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas;
}

interface GPUCopyExternalImageDest {
  texture: GPUTexture;
}

interface Navigator {
  gpu?: {
    requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
    getPreferredCanvasFormat(): string;
  };
}

interface GPURequestAdapterOptions {
  powerPreference?: 'low-power' | 'high-performance';
}

interface GPUDeviceDescriptor {
  requiredFeatures?: string[];
  requiredLimits?: Record<string, number>;
}

type GPUFeatureName = string;

interface GPUCanvasContext {
  configure(configuration: GPUCanvasConfiguration): void;
  getCurrentTexture(): GPUTexture;
}

interface GPUCanvasConfiguration {
  device: GPUDevice;
  format: string;
  alphaMode?: string;
}

// GPUBufferUsage constants
declare const GPUBufferUsage: {
  MAP_READ: number;
  MAP_WRITE: number;
  COPY_SRC: number;
  COPY_DST: number;
  INDEX: number;
  VERTEX: number;
  UNIFORM: number;
  STORAGE: number;
  INDIRECT: number;
  QUERY_RESOLVE: number;
};

// GPUTextureUsage constants
declare const GPUTextureUsage: {
  COPY_SRC: number;
  COPY_DST: number;
  TEXTURE_BINDING: number;
  STORAGE_BINDING: number;
  RENDER_ATTACHMENT: number;
};

// GPUShaderStage constants
declare const GPUShaderStage: {
  VERTEX: number;
  FRAGMENT: number;
  COMPUTE: number;
};
