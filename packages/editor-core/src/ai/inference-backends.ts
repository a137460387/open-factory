/**
 * AI inference engine — GPU backends (WebGPU + WebGL2 fallback)
 */

import { logger } from '../utils/logger.js';

// ==================== WebGPU Backend ====================

export class WebGPUBackend {
  private device: GPUDevice | null = null;
  private adapter: GPUAdapter | null = null;
  private pipelines = new Map<string, GPUComputePipeline>();
  private buffers = new Map<string, GPUBuffer>();

  async initialize(): Promise<boolean> {
    if (!navigator.gpu) {
      logger.warn('WebGPU not supported, falling back to WebGL2');
      return false;
    }

    try {
      this.adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (!this.adapter) {
        logger.warn('WebGPU adapter not available');
        return false;
      }

      this.device = await this.adapter.requestDevice({
        requiredFeatures: ['shader-f16'] as GPUFeatureName[],
        requiredLimits: {
          maxStorageBufferBindingSize: 1024 * 1024 * 256, // 256MB
          maxBufferSize: 1024 * 1024 * 256,
        },
      });

      this.device.lost.then((info) => {
        logger.error('WebGPU device lost:', info.message);
        this.device = null;
      });

      return true;
    } catch (error) {
      logger.error('WebGPU initialization failed:', error);
      return false;
    }
  }

  isAvailable(): boolean {
    return this.device !== null;
  }

  async createBuffer(size: number, usage: number): Promise<GPUBuffer> {
    if (!this.device) throw new Error('WebGPU not initialized');

    const buffer = this.device.createBuffer({
      size,
      usage,
      mappedAtCreation: false,
    });

    return buffer;
  }

  async createComputePipeline(shaderCode: string, entryPoint: string): Promise<GPUComputePipeline> {
    if (!this.device) throw new Error('WebGPU not initialized');

    const shaderModule = this.device.createShaderModule({
      code: shaderCode,
    });

    const pipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint,
      },
    });

    return pipeline;
  }

  async executeComputeShader(
    pipeline: GPUComputePipeline,
    bindGroups: GPUBindGroup[],
    workgroupCount: [number, number, number],
  ): Promise<void> {
    if (!this.device) throw new Error('WebGPU not initialized');

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();

    passEncoder.setPipeline(pipeline);
    bindGroups.forEach((group, index) => {
      passEncoder.setBindGroup(index, group);
    });

    passEncoder.dispatchWorkgroups(...workgroupCount);
    passEncoder.end();

    const commandBuffer = commandEncoder.finish();
    this.device.queue.submit([commandBuffer]);

    await this.device.queue.onSubmittedWorkDone();
  }

  async readBuffer(buffer: GPUBuffer, size: number): Promise<ArrayBuffer> {
    if (!this.device) throw new Error('WebGPU not initialized');

    const stagingBuffer = this.device.createBuffer({
      size,
      usage: 9, // GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ = 8 | 1
    });

    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(buffer, 0, stagingBuffer, 0, size);
    this.device.queue.submit([commandEncoder.finish()]);

    await stagingBuffer.mapAsync(1); // GPUMapMode.READ = 1
    const data = stagingBuffer.getMappedRange().slice(0);
    stagingBuffer.destroy();

    return data;
  }

  destroy(): void {
    this.buffers.forEach((buffer) => buffer.destroy());
    this.buffers.clear();
    this.pipelines.clear();
    this.device?.destroy();
    this.device = null;
    this.adapter = null;
  }
}

// ==================== WebGL2 Fallback Backend ====================

export class WebGL2Backend {
  private gl: WebGL2RenderingContext | null = null;
  private programs = new Map<string, WebGLProgram>();

  async initialize(): Promise<boolean> {
    try {
      const canvas = document.createElement('canvas');
      this.gl = canvas.getContext('webgl2', {
        powerPreference: 'high-performance',
        antialias: false,
        alpha: false,
      });

      if (!this.gl) {
        logger.warn('WebGL2 not available');
        return false;
      }

      // Enable float textures
      this.gl.getExtension('EXT_color_buffer_float');
      this.gl.getExtension('OES_texture_float_linear');

      return true;
    } catch (error) {
      logger.error('WebGL2 initialization failed:', error);
      return false;
    }
  }

  isAvailable(): boolean {
    return this.gl !== null;
  }

  createComputeProgram(shaderSource: string): WebGLProgram | null {
    if (!this.gl) return null;

    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER)!;
    this.gl.shaderSource(
      vertexShader,
      `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `,
    );
    this.gl.compileShader(vertexShader);

    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER)!;
    this.gl.shaderSource(fragmentShader, shaderSource);
    this.gl.compileShader(fragmentShader);

    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    return program;
  }

  destroy(): void {
    this.programs.forEach((program) => this.gl?.deleteProgram(program));
    this.programs.clear();
    this.gl = null;
  }
}
