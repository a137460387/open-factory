import { useState, useCallback, useEffect } from 'react';
import { ArrowRight, FileVideo, FileAudio, FileImage, Wand2 } from 'lucide-react';
import {
  BUILTIN_CONVERSION_PRESETS,
  buildBatchConversionTasks,
  buildConversionPath,
  detectMediaCategory,
  type ConversionPreset,
  type FormatConversionTask,
} from '@open-factory/editor-core';
import { featureStrings } from '../i18n/featureStrings';

interface FormatConverterDialogProps {
  open: boolean;
  onClose: () => void;
  initialFiles?: DroppedFile[];
}

export interface DroppedFile {
  path: string;
  name: string;
  format: string;
}

export function FormatConverterDialog({ open, onClose, initialFiles }: FormatConverterDialogProps) {
  const [files, setFiles] = useState<DroppedFile[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<ConversionPreset | null>(null);
  const [tasks, setTasks] = useState<FormatConversionTask[]>([]);
  const [compatibilityHint, setCompatibilityHint] = useState<string | null>(null);
  const t = featureStrings.formatConverter;

  // E2E: seed files from external injection
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      setFiles(initialFiles);
    }
  }, [initialFiles]);

  const handlePresetSelect = useCallback(
    (preset: ConversionPreset) => {
      setSelectedPreset(preset);
      const newTasks = buildBatchConversionTasks(
        files.map((f) => ({ path: f.path, format: f.format })),
        preset,
        '/output',
      );
      setTasks(newTasks);
      // Check for intermediate format hints
      const hints = new Set<string>();
      for (const task of newTasks) {
        if (task.intermediateFormat) {
          const path = buildConversionPath(task.sourceFormat, task.targetFormat);
          if (path.hint) hints.add(path.hint);
        }
      }
      setCompatibilityHint(hints.size > 0 ? Array.from(hints).join('; ') : null);
    },
    [files],
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped: DroppedFile[] = [];
    for (const file of Array.from(e.dataTransfer.files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      dropped.push({ path: file.name, name: file.name, format: ext });
    }
    setFiles(dropped);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleStartConvert = useCallback(() => {
    // In real implementation, this would dispatch to the export queue
    // For now, mark tasks as started
    setTasks((prev) => prev.map((task) => ({ ...task, status: 'running' as const })));
  }, []);

  if (!open) return null;

  const iconForCategory = (cat: string) => {
    switch (cat) {
      case 'video':
        return <FileVideo size={14} />;
      case 'audio':
        return <FileAudio size={14} />;
      case 'image':
        return <FileImage size={14} />;
      default:
        return null;
    }
  };

  return (
    <div
      data-testid="format-converter-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 w-[560px] max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
            <Wand2 size={16} /> {t.title}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 text-xs"
            data-testid="format-converter-close"
          >
            ✕
          </button>
        </div>

        {/* Drop zone */}
        <div
          data-testid="format-converter-dropzone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-neutral-600 rounded-lg p-6 text-center mb-3 hover:border-neutral-400 transition-colors cursor-pointer"
        >
          {files.length === 0 ? (
            <div className="text-neutral-400 text-sm">{t.dragHint}</div>
          ) : (
            <div className="text-sm text-neutral-300">已选择 {files.length} 个文件</div>
          )}
        </div>

        {/* Preset selection */}
        {files.length > 0 && (
          <div data-testid="format-converter-presets" className="mb-3">
            <div className="text-xs text-neutral-400 mb-2">{t.selectPreset}</div>
            <div className="grid grid-cols-2 gap-2">
              {BUILTIN_CONVERSION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  data-testid={`preset-${preset.id}`}
                  onClick={() => handlePresetSelect(preset)}
                  className={`text-left p-2 rounded text-xs border transition-colors ${
                    selectedPreset?.id === preset.id
                      ? 'border-blue-500 bg-blue-900/30 text-blue-200'
                      : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  <div className="font-medium">{preset.name}</div>
                  <div className="text-neutral-500 mt-0.5">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Compatibility hint */}
        {compatibilityHint && (
          <div
            data-testid="format-converter-hint"
            className="mb-3 text-xs text-amber-300 bg-amber-900/20 border border-amber-700/30 rounded p-2"
          >
            {compatibilityHint}
          </div>
        )}

        {/* Task list */}
        {tasks.length > 0 && (
          <div data-testid="format-converter-tasks" className="mb-3 space-y-1">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 text-xs text-neutral-300 bg-neutral-800 rounded p-2"
              >
                {iconForCategory(detectMediaCategory(task.sourceFormat) ?? '')}
                <span className="flex-1 truncate">{task.sourcePath}</span>
                <ArrowRight size={12} className="text-neutral-500" />
                <span className="text-blue-300">.{task.targetFormat}</span>
                <span
                  className={`text-xs ${task.status === 'running' ? 'text-blue-400' : task.status === 'success' ? 'text-emerald-400' : 'text-neutral-500'}`}
                >
                  {task.status === 'pending'
                    ? '待转换'
                    : task.status === 'running'
                      ? '转换中...'
                      : task.status === 'success'
                        ? '完成'
                        : '错误'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Start button */}
        {tasks.length > 0 && (
          <button
            data-testid="format-converter-start"
            onClick={handleStartConvert}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-2 text-xs font-medium transition-colors"
          >
            {t.batchStart} ({tasks.length})
          </button>
        )}
      </div>
    </div>
  );
}
