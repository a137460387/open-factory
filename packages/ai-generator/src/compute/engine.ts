/**
 * Compute engine abstraction
 */

import type { ComputeEngine, ComputeCapabilities, ComputeBackend } from '../types.js';

// ============================================================
// Compute Engine Factory
// ============================================================

export async function createComputeEngine(
  preferredBackend: ComputeBackend = 'webgpu'
): Promise<ComputeEngine> {
  // Try preferred backend first
  try {
    const engine = await tryCreateEngine(preferredBackend);
    if (engine) {
      await engine.initialize();
      return engine;
    }
  } catch {
    console.warn(`${preferredBackend} initialization failed, trying fallbacks...`);
  }

  // Fallback chain: webgpu -> webgl -> cpu
  const allBackends: ComputeBackend[] = ['webgpu', 'webgl', 'cpu'];
  const fallbacks = allBackends.filter((b) => b !== preferredBackend);

  for (const backend of fallbacks) {
    try {
      const engine = await tryCreateEngine(backend);
      if (engine) {
        await engine.initialize();
        return engine;
      }
    } catch {
      continue;
    }
  }

  throw new Error('No compute backend available');
}

async function tryCreateEngine(backend: ComputeBackend): Promise<ComputeEngine | null> {
  switch (backend) {
    case 'webgpu':
      return await createWebGPUEngine();
    case 'webgl':
      return await createWebGLEngine();
    case 'cpu':
      return createCPUEngine();
    default:
      return null;
  }
}

// ============================================================
// WebGPU Engine
// ============================================================

async function createWebGPUEngine(): Promise<ComputeEngine | null> {
  const nav = typeof navigator !== 'undefined' ? (navigator as unknown as NavigatorGPU) : null;
  if (!nav?.gpu) {
    return null;
  }

  const adapter = await nav.gpu.requestAdapter();
  if (!adapter) {
    return null;
  }

  const device = await adapter.requestDevice();
  if (!device) {
    return null;
  }

  const capabilities: ComputeCapabilities = {
    backend: 'webgpu',
    maxTextureSize: 8192,
    maxBufferSize: 256 * 1024 * 1024, // 256MB
    maxComputeWorkgroupSize: [256, 256, 64],
    supportsF16: adapter.features.has('shader-f16'),
    supportsInt8: false,
    memoryMB: 4096,
  };

  return {
    backend: 'webgpu',
    capabilities,

    async initialize() {
      // WebGPU is initialized during creation
    },

    async createBuffer(data: Float32Array) {
      return device.createBuffer({
        size: data.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
    },

    async createTexture(data: Uint8Array, width: number, height: number) {
      const texture = device.createTexture({
        size: { width, height },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });

      device.queue.writeTexture(
        { texture },
        data as unknown as BufferSource,
        { bytesPerRow: width * 4 },
        { width, height }
      );

      return texture;
    },

    async execute(program: unknown, inputs: unknown[]) {
      // Simplified execution - real implementation would use compute shaders
      return new Float32Array(1024);
    },

    dispose() {
      device.destroy();
    },
  };
}

// ============================================================
// WebGL Engine
// ============================================================

async function createWebGLEngine(): Promise<ComputeEngine | null> {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

  if (!gl) {
    return null;
  }

  const capabilities: ComputeCapabilities = {
    backend: 'webgl',
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxBufferSize: 128 * 1024 * 1024, // 128MB
    maxComputeWorkgroupSize: [1, 1, 1],
    supportsF16: false,
    supportsInt8: false,
    memoryMB: 2048,
  };

  return {
    backend: 'webgl',
    capabilities,

    async initialize() {
      // WebGL is initialized during creation
    },

    async createBuffer(data: Float32Array) {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return buffer;
    },

    async createTexture(data: Uint8Array, width: number, height: number) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return texture;
    },

    async execute(program: unknown, inputs: unknown[]) {
      // Simplified execution - real implementation would use WebGL shaders
      return new Float32Array(1024);
    },

    dispose() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

// ============================================================
// CPU Engine
// ============================================================

function createCPUEngine(): ComputeEngine {
  const capabilities: ComputeCapabilities = {
    backend: 'cpu',
    maxTextureSize: 4096,
    maxBufferSize: 512 * 1024 * 1024, // 512MB
    maxComputeWorkgroupSize: [1, 1, 1],
    supportsF16: false,
    supportsInt8: true,
    memoryMB: 8192,
  };

  return {
    backend: 'cpu',
    capabilities,

    async initialize() {
      // CPU engine needs no special initialization
    },

    async createBuffer(data: Float32Array) {
      return data.slice();
    },

    async createTexture(data: Uint8Array, width: number, height: number) {
      return { data: data.slice(), width, height };
    },

    async execute(program: unknown, inputs: unknown[]) {
      // CPU execution - used as fallback
      return new Float32Array(1024);
    },

    dispose() {
      // Nothing to dispose for CPU engine
    },
  };
}
