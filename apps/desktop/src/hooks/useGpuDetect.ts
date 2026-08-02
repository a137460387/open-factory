import { useState, useCallback, useEffect } from 'react';
import { detectGpu as detectGpuBridge } from '../lib/tauri-bridge/ltx-video';

/** Inference precision option */
export type Precision = 'fp16' | 'fp32' | 'bf16';

/** GPU environment information from the backend */
export interface GpuInfo {
  available: boolean;
  gpuName: string | null;
  driverVersion: string | null;
  cudaVersion: string | null;
  vramTotalMb: number | null;
  vramFreeMb: number | null;
  recommendedPrecision: Precision;
  pytorchCompatible: boolean;
  errorMessage: string | null;
}

/** State for the GPU detection hook */
export interface GpuDetectState {
  info: GpuInfo | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for detecting GPU environment.
 */
export function useGpuDetect() {
  const [state, setState] = useState<GpuDetectState>({
    info: null,
    isLoading: false,
    error: null,
  });

  const detect = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const info = await detectGpuBridge();
      setState({ info, isLoading: false, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  useEffect(() => {
    void detect();
  }, [detect]);

  return {
    state,
    detect,
    isGpuAvailable: state.info?.available ?? false,
    isPytorchCompatible: state.info?.pytorchCompatible ?? false,
  };
}
