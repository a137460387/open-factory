import React, { useCallback, useState, useRef } from 'react';
import type { ColorGradingLUTLayer, LUTLibraryEntry } from '@open-factory/editor-core/color-grading/lut';
import { createColorGradingLUTLayer } from '@open-factory/editor-core/color-grading/lut';
import { parseCubeFile, parse3dlFile } from '@open-factory/editor-core/color-grading/lut-parser';

interface LUTManagerProps {
  layers: ColorGradingLUTLayer[];
  library: LUTLibraryEntry[];
  onLayersChange: (layers: ColorGradingLUTLayer[]) => void;
  onLibraryChange: (library: LUTLibraryEntry[]) => void;
  onImportLUT?: (file: File) => void;
}

export const LUTManager: React.FC<LUTManagerProps> = ({
  layers,
  library,
  onLayersChange,
  onLibraryChange,
  onImportLUT,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedLUT, setSelectedLUT] = useState<string | null>(null);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        const text = await file.text();
        let lutData;

        try {
          if (file.name.endsWith('.cube')) {
            lutData = parseCubeFile(text);
          } else if (file.name.endsWith('.3dl')) {
            lutData = parse3dlFile(text);
          } else {
            console.warn('Unsupported LUT format:', file.name);
            continue;
          }

          const entry: LUTLibraryEntry = {
            id: `lut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: file.name.replace(/\.(cube|3dl)$/i, ''),
            filePath: file.name,
            format: file.name.endsWith('.cube') ? 'cube' : '3dl',
            size: lutData.size,
            tags: [],
            createdAt: new Date().toISOString(),
          };

          onLibraryChange([...library, entry]);
        } catch (err) {
          console.error('Failed to parse LUT:', err);
        }
      }

      // 清除 input 值以便重新选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [library, onLibraryChange],
  );

  const handleApplyLUT = useCallback(
    (lutId: string) => {
      const newLayer = createColorGradingLUTLayer(lutId);
      onLayersChange([...layers, newLayer]);
    },
    [layers, onLayersChange],
  );

  const handleRemoveLayer = useCallback(
    (layerId: string) => {
      onLayersChange(layers.filter((l) => l.id !== layerId));
    },
    [layers, onLayersChange],
  );

  const handleIntensityChange = useCallback(
    (layerId: string, intensity: number) => {
      onLayersChange(layers.map((l) => (l.id === layerId ? { ...l, intensity } : l)));
    },
    [layers, onLayersChange],
  );

  const handleToggleLayer = useCallback(
    (layerId: string) => {
      onLayersChange(layers.map((l) => (l.id === layerId ? { ...l, enabled: !l.enabled } : l)));
    },
    [layers, onLayersChange],
  );

  const handleRemoveFromLibrary = useCallback(
    (lutId: string) => {
      onLibraryChange(library.filter((l) => l.id !== lutId));
      // 同时移除使用此 LUT 的图层
      onLayersChange(layers.filter((l) => l.lutId !== lutId));
    },
    [library, layers, onLibraryChange, onLayersChange],
  );

  return (
    <div className="flex flex-col h-full bg-gray-900" data-testid="lut-manager">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-200">LUT 管理器</h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1 text-xs bg-blue-600 rounded hover:bg-blue-500"
          data-testid="import-lut-btn"
        >
          导入 LUT
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".cube,.3dl"
          multiple
          onChange={handleImport}
          className="hidden"
          data-testid="lut-file-input"
        />
      </div>

      {/* 活动 LUT 图层 */}
      <div className="px-3 py-2 border-b border-gray-700">
        <h4 className="text-xs text-gray-400 mb-2">活动 LUT 图层</h4>
        {layers.length === 0 ? (
          <div className="text-xs text-gray-500 py-2" data-testid="no-active-lut">
            无活动 LUT
          </div>
        ) : (
          <div className="space-y-1" data-testid="active-lut-layers">
            {layers.map((layer) => {
              const entry = library.find((e) => e.id === layer.lutId);
              return (
                <div
                  key={layer.id}
                  className="flex items-center gap-2 bg-gray-800 rounded p-1.5"
                  data-testid={`lut-layer-${layer.id}`}
                >
                  <button
                    onClick={() => handleToggleLayer(layer.id)}
                    className={`w-3 h-3 rounded-full ${layer.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                    data-testid={`toggle-lut-${layer.id}`}
                  />
                  <span className="text-xs text-gray-200 flex-1 truncate">{entry?.name || 'Unknown LUT'}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={layer.intensity * 100}
                    onChange={(e) => handleIntensityChange(layer.id, Number(e.target.value) / 100)}
                    className="w-16"
                    data-testid={`lut-intensity-${layer.id}`}
                  />
                  <span className="text-xs w-8" data-testid={`lut-intensity-value-${layer.id}`}>
                    {(layer.intensity * 100).toFixed(0)}%
                  </span>
                  <button
                    onClick={() => handleRemoveLayer(layer.id)}
                    className="text-gray-400 hover:text-red-400"
                    data-testid={`remove-lut-${layer.id}`}
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LUT 库 */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <h4 className="text-xs text-gray-400 mb-2">LUT 库</h4>
        {library.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8" data-testid="lut-library-empty">
            点击"导入 LUT"添加 .cube 或 .3dl 文件
          </div>
        ) : (
          <div className="space-y-1" data-testid="lut-library-list">
            {library.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center gap-2 bg-gray-800 rounded p-2 cursor-pointer hover:bg-gray-700 ${
                  selectedLUT === entry.id ? 'ring-1 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedLUT(entry.id)}
                data-testid={`lut-entry-${entry.id}`}
              >
                {/* 缩略图占位 */}
                <div
                  className="w-12 h-8 bg-gradient-to-r from-black to-white rounded-sm"
                  data-testid={`lut-thumbnail-${entry.id}`}
                />

                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-200 truncate" data-testid={`lut-name-${entry.id}`}>
                    {entry.name}
                  </div>
                  <div className="text-xs text-gray-500" data-testid={`lut-info-${entry.id}`}>
                    {entry.format.toUpperCase()} · {entry.size}
                  </div>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyLUT(entry.id);
                    }}
                    className="px-1.5 py-0.5 text-xs bg-green-600 rounded hover:bg-green-500"
                    data-testid={`apply-lut-${entry.id}`}
                  >
                    应用
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFromLibrary(entry.id);
                    }}
                    className="px-1.5 py-0.5 text-xs bg-red-600 rounded hover:bg-red-500"
                    data-testid={`delete-lut-${entry.id}`}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
