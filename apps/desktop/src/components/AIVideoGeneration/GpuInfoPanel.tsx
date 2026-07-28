import React from 'react';
import {
  Cpu,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCcw,
  Zap,
} from 'lucide-react';
import { useGpuDetect, type GpuInfo } from '../../hooks/useGpuDetect';

/** GpuInfoPanel props */
export interface GpuInfoPanelProps {
  /** Callback when GPU status changes */
  onGpuStatusChange?: (available: boolean, compatible: boolean) => void;
}

/** Format MB to GB string */
function formatVram(mb: number | null): string {
  if (mb === null) return 'Unknown';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

/**
 * GPU environment info panel.
 * Shows GPU model, driver, CUDA version, VRAM, and recommended precision.
 */
export function GpuInfoPanel({ onGpuStatusChange }: GpuInfoPanelProps) {
  const { state, detect, isGpuAvailable, isPytorchCompatible } = useGpuDetect();

  React.useEffect(() => {
    if (state.info) {
      onGpuStatusChange?.(isGpuAvailable, isPytorchCompatible);
    }
  }, [state.info, isGpuAvailable, isPytorchCompatible, onGpuStatusChange]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-gray-300">GPU Environment</h3>
        </div>
        <button
          onClick={() => void detect()}
          disabled={state.isLoading}
          className="p-1 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
          aria-label="Refresh GPU info"
        >
          <RefreshCcw
            className={`w-3.5 h-3.5 ${state.isLoading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Loading */}
      {state.isLoading && (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
          <span className="text-xs text-gray-500">Detecting GPU...</span>
        </div>
      )}

      {/* Error */}
      {state.error && (
        <div className="flex items-center gap-2 p-2.5 bg-red-900/20 border border-red-700/50 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-300">{state.error}</p>
        </div>
      )}

      {/* GPU Info */}
      {state.info && <GpuInfoDisplay info={state.info} />}
    </div>
  );
}

/** Displays GPU info details */
function GpuInfoDisplay({ info }: { info: GpuInfo }) {
  if (!info.available) {
    return (
      <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-400" />
          <p className="text-sm text-yellow-300">No compatible GPU detected</p>
        </div>
        {info.errorMessage && (
          <p className="text-xs text-yellow-400/70">{info.errorMessage}</p>
        )}
        <p className="text-xs text-gray-500">
          Video generation requires a CUDA-compatible GPU with at least 4 GB VRAM.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Status Badge */}
      <div className="flex items-center gap-2">
        {info.pytorchCompatible ? (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-900/30 border border-green-700/50 rounded-md">
            <CheckCircle className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-300">Ready</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-900/30 border border-yellow-700/50 rounded-md">
            <AlertCircle className="w-3 h-3 text-yellow-400" />
            <span className="text-xs text-yellow-300">Limited</span>
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-2">
        {info.gpuName && (
          <InfoItem label="GPU" value={info.gpuName} />
        )}
        {info.driverVersion && (
          <InfoItem label="Driver" value={info.driverVersion} />
        )}
        {info.cudaVersion && (
          <InfoItem label="CUDA" value={info.cudaVersion} />
        )}
        <InfoItem
          label="VRAM"
          value={formatVram(info.vramTotalMb)}
        />
        {info.vramFreeMb !== null && (
          <InfoItem
            label="Free VRAM"
            value={formatVram(info.vramFreeMb)}
          />
        )}
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-purple-400" />
          <span className="text-xs text-gray-500">Precision:</span>
          <span className="text-xs font-medium text-purple-300 uppercase">
            {info.recommendedPrecision}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Single info item */
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-xs text-gray-300 truncate">{value}</p>
    </div>
  );
}
