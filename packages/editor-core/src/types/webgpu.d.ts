/**
 * WebGPU 类型声明
 *
 * 为 TypeScript 提供 WebGPU API 的类型定义
 */

interface GPUDevice {
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
  createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
  createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
  createCommandEncoder(): GPUCommandEncoder;
  queue: GPUQueue;
  destroy(): void;
  lost: Promise<GPUDeviceLostInfo>;
}

interface GPUAdapter {
  requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
}

interface GPUBuffer {
  destroy(): void;
  mapAsync(mode: number): Promise<void>;
  getMappedRange(): ArrayBuffer;
  size: number;
  usage: number;
}

interface GPUShaderModule {}

interface GPUComputePipeline {}

interface GPUCommandEncoder {
  beginComputePass(): GPUComputePassEncoder;
  copyBufferToBuffer(source: GPUBuffer, sourceOffset: number, destination: GPUBuffer, destinationOffset: number, size: number): void;
  finish(): GPUCommandBuffer;
}

interface GPUComputePassEncoder {
  setPipeline(pipeline: GPUComputePipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  dispatchWorkgroups(x: number, y?: number, z?: number): void;
  end(): void;
}

interface GPUBindGroup {}

interface GPUCommandBuffer {}

interface GPUQueue {
  submit(commandBuffers: GPUCommandBuffer[]): void;
  onSubmittedWorkDone(): Promise<void>;
}

interface GPUDeviceLostInfo {
  message: string;
}

interface GPUBufferDescriptor {
  size: number;
  usage: number;
  mappedAtCreation?: boolean;
}

interface GPUShaderModuleDescriptor {
  code: string;
}

interface GPUComputePipelineDescriptor {
  layout: 'auto' | GPUPipelineLayout;
  compute: {
    module: GPUShaderModule;
    entryPoint: string;
  };
}

interface GPUPipelineLayout {}

interface Navigator {
  gpu?: {
    requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
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
