import React, { useState, useCallback } from 'react';
import { ChevronDown, Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
import type { VideoPreset } from '../../lib/video-presets';
import { usePresets } from '../../hooks/usePresets';
import type { VideoGenerationParams } from '../../hooks/useVideoGeneration';

export interface PresetSelectorProps {
  /** Currently selected preset ID */
  selectedPresetId: string | null;
  /** Callback when a preset is selected */
  onSelect: (preset: VideoPreset) => void;
  /** Current params for saving as new preset */
  currentParams: Omit<VideoGenerationParams, 'prompt' | 'negativePrompt' | 'imagePath' | 'seed'>;
  /** GPU VRAM in MB (null if unknown) */
  vramMb?: number | null;
  /** Whether GPU is compatible with PyTorch */
  pytorchCompatible?: boolean;
}

/**
 * Preset selector for video generation parameters.
 * Shows built-in + user presets, allows creating and deleting custom presets.
 */
export function PresetSelector({
  selectedPresetId,
  onSelect,
  currentParams,
  vramMb,
  pytorchCompatible: _pytorchCompatible,
}: PresetSelectorProps) {
  const { presets, createPreset, removePreset } = usePresets();
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newName, setNewName] = useState('');

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);

  // Warn if HQ preset selected on low-end GPU (<8GB VRAM)
  const showGpuWarning = selectedPresetId === 'builtin-hq' && vramMb !== null && vramMb !== undefined && vramMb < 8000;

  const handleSelect = useCallback(
    (preset: VideoPreset) => {
      onSelect(preset);
      setIsOpen(false);
    },
    [onSelect],
  );

  const handleSave = useCallback(async () => {
    if (!newName.trim()) return;
    await createPreset(newName.trim(), currentParams);
    setNewName('');
    setShowSaveDialog(false);
  }, [newName, currentParams, createPreset]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      await removePreset(id);
    },
    [removePreset],
  );

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-gray-400 mb-1.5">Preset</label>
      <div className="flex gap-1.5">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center justify-between px-3 py-1.5 bg-gray-800
                     border border-gray-600 rounded-md text-sm text-gray-200
                     hover:border-purple-500 transition-colors"
        >
          <span>{selectedPreset?.name ?? 'Custom'}</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        </button>
        <button
          onClick={() => setShowSaveDialog(!showSaveDialog)}
          className="px-2 py-1.5 bg-gray-800 border border-gray-600 rounded-md
                     hover:border-purple-500 transition-colors"
          title="Save current settings as preset"
        >
          <Save className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {presets.map((preset) => (
            <div
              key={preset.id}
              onClick={() => handleSelect(preset)}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                preset.id === selectedPresetId ? 'bg-purple-600/20 text-purple-300' : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{preset.name}</p>
                <p className="text-[10px] text-gray-500">
                  {preset.params.resolution}p · {preset.params.numFrames} frames · {preset.params.steps} steps
                </p>
              </div>
              {!preset.isBuiltIn && (
                <button
                  onClick={(e) => handleDelete(e, preset.id)}
                  className="p-1 hover:bg-gray-600 rounded transition-colors ml-2"
                  title="Delete preset"
                >
                  <Trash2 className="w-3 h-3 text-gray-500 hover:text-red-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="mt-2 p-2 bg-gray-800 border border-gray-600 rounded-lg space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Preset name..."
            className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm
                       text-gray-200 placeholder-gray-500 focus:border-purple-500 focus:ring-1
                       focus:ring-purple-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave();
            }}
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleSave}
              disabled={!newName.trim()}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1
                         bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500
                         rounded text-xs font-medium transition-colors"
            >
              <Plus className="w-3 h-3" />
              Save
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600
                         rounded text-xs text-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* GPU warning for HQ preset */}
      {showGpuWarning && (
        <div className="mt-2 flex items-start gap-2 p-2 bg-amber-900/20 border border-amber-700/50 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            High Quality 1080p requires at least 8 GB VRAM. Your GPU has {vramMb} MB. Consider using Standard 720p for
            better stability.
          </p>
        </div>
      )}
    </div>
  );
}
