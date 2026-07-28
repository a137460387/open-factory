import React, { useState, useCallback } from 'react';
import {
  Loader2,
  Play,
  X,
  AlertCircle,
  CheckCircle,
  RotateCcw,
  Video,
  Settings,
  Download,
} from 'lucide-react';
import {
  useVideoGeneration,
  getErrorHint,
  type VideoGenerationParams,
} from '../../hooks/useVideoGeneration';
import { useGpuDetect } from '../../hooks/useGpuDetect';
import { useModelManager } from '../../hooks/useModelManager';

/** VideoGenerationPanel props */
export interface VideoGenerationPanelProps {
  /** Close callback */
  onClose?: () => void;
  /** Completion callback with video path */
  onComplete?: (videoPath: string) => void;
  /** Initial prompt text */
  initialPrompt?: string;
  /** Callback to open model manager */
  onOpenModelManager?: () => void;
}

/** Resolution presets */
const RESOLUTION_PRESETS = [
  { label: '512p', value: 512 },
  { label: '720p', value: 720 },
  { label: '1080p', value: 1080 },
] as const;

/** Frame count presets */
const FRAME_PRESETS = [
  { label: '2s', value: 49 },
  { label: '4s', value: 97 },
  { label: '6s', value: 145 },
] as const;

/**
 * Video generation panel for LTX-Video AI plugin.
 * Provides prompt input, parameter controls, progress display, and result preview.
 */
export function VideoGenerationPanel({
  onClose,
  onComplete,
  initialPrompt = '',
  onOpenModelManager,
}: VideoGenerationPanelProps) {
  const {
    state,
    startGeneration,
    cancelGeneration,
    reset,
    isRunning,
    isCompleted,
    isFailed,
    isCanceled,
  } = useVideoGeneration();

  const { state: gpuState, isGpuAvailable, isPytorchCompatible } = useGpuDetect();
  const { state: modelState, loadLocalModels } = useModelManager();

  const [prompt, setPrompt] = useState(initialPrompt);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [steps, setSteps] = useState(50);
  const [cfgScale, setCfgScale] = useState(7.5);
  const [numFrames, setNumFrames] = useState(97);
  const [resolution, setResolution] = useState(720);
  const [fps] = useState(24);
  const [seed, setSeed] = useState<string>('');

  // Check if a model is available
  const hasModel = modelState.localModels.length > 0;
  const canGenerate = hasModel && isGpuAvailable && isPytorchCompatible && !isRunning;

  // Load models on mount
  React.useEffect(() => {
    void loadLocalModels();
  }, [loadLocalModels]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    const params: VideoGenerationParams = {
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim() || undefined,
      numFrames,
      resolution,
      fps,
      steps,
      cfgScale,
      seed: seed.trim() ? parseInt(seed.trim(), 10) : undefined,
    };

    await startGeneration(params);
  }, [prompt, negativePrompt, numFrames, resolution, fps, steps, cfgScale, seed, startGeneration]);

  const handleComplete = useCallback(() => {
    if (state.videoPath && onComplete) {
      onComplete(state.videoPath);
    }
  }, [state.videoPath, onComplete]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-semibold">AI Video Generation</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Environment Checks */}
        {(!hasModel || !isGpuAvailable) && (
          <div className="space-y-2">
            {!hasModel && (
              <div className="flex items-center justify-between p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-yellow-400" />
                  <div>
                    <p className="text-sm text-yellow-300">No model installed</p>
                    <p className="text-xs text-yellow-400/70">
                      Download the LTX-Video model to start generating.
                    </p>
                  </div>
                </div>
                {onOpenModelManager && (
                  <button
                    onClick={onOpenModelManager}
                    className="px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-700
                               rounded-md transition-colors"
                  >
                    Download
                  </button>
                )}
              </div>
            )}

            {!isGpuAvailable && gpuState.info !== null && (
              <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-300">No compatible GPU</p>
                  <p className="text-xs text-red-400/70">
                    A CUDA-compatible GPU with at least 4 GB VRAM is required.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prompt */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the video you want to generate..."
            disabled={isRunning}
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm
                       placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500
                       disabled:opacity-50 resize-none"
          />
        </div>

        {/* Negative Prompt */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Negative Prompt
          </label>
          <textarea
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="What to avoid in the video..."
            disabled={isRunning}
            rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm
                       placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500
                       disabled:opacity-50 resize-none"
          />
        </div>

        {/* Resolution & Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Resolution
            </label>
            <div className="flex gap-1.5">
              {RESOLUTION_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setResolution(preset.value)}
                  disabled={isRunning}
                  className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                    resolution === preset.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  } disabled:opacity-50`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Duration
            </label>
            <div className="flex gap-1.5">
              {FRAME_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setNumFrames(preset.value)}
                  disabled={isRunning}
                  className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                    numFrames === preset.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  } disabled:opacity-50`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
        </button>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg">
            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-400">
                  Inference Steps
                </label>
                <span className="text-xs text-gray-500">{steps}</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                disabled={isRunning}
                className="w-full accent-purple-500 disabled:opacity-50"
              />
            </div>

            {/* CFG Scale */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-400">
                  CFG Scale
                </label>
                <span className="text-xs text-gray-500">{cfgScale.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                step={0.5}
                value={cfgScale}
                onChange={(e) => setCfgScale(Number(e.target.value))}
                disabled={isRunning}
                className="w-full accent-purple-500 disabled:opacity-50"
              />
            </div>

            {/* Seed */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Seed (optional)
              </label>
              <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Random"
                disabled={isRunning}
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-md text-sm
                           placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500
                           disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {/* Progress */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 capitalize">{state.stage || 'Starting...'}</span>
              <span className="text-gray-500">{Math.round(state.progress * 100)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.round(state.progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Status Messages */}
        {isCompleted && (
          <div className="flex items-center gap-2 p-3 bg-green-900/30 border border-green-700 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-green-300">Generation complete!</p>
              {state.durationMs && (
                <p className="text-xs text-green-400/70 mt-0.5">
                  Took {(state.durationMs / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          </div>
        )}

        {isFailed && state.error && (
          <div className="space-y-1.5 p-3 bg-red-900/30 border border-red-700 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{state.error}</p>
            </div>
            {state.errorType && (
              <p className="text-xs text-red-400/70 pl-6">
                {getErrorHint(state.errorType)}
              </p>
            )}
          </div>
        )}

        {isCanceled && (
          <div className="flex items-center gap-2 p-3 bg-gray-800 border border-gray-700 rounded-lg">
            <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <p className="text-sm text-gray-400">Generation canceled</p>
          </div>
        )}

        {/* Video Preview */}
        {isCompleted && state.videoPath && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-400">
              Generated Video
            </label>
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                src={`asset://localhost/${state.videoPath}`}
                controls
                loop
                className="w-full max-h-64 object-contain"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t border-gray-700 space-y-2">
        {isRunning ? (
          <button
            onClick={cancelGeneration}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                       bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel Generation
          </button>
        ) : isCompleted ? (
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                         bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              New Video
            </button>
            {onComplete && (
              <button
                onClick={handleComplete}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                           bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Use Video
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || !canGenerate}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                       bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500
                       rounded-lg text-sm font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            Generate Video
          </button>
        )}

        {(isFailed || isCanceled) && (
          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                       bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
